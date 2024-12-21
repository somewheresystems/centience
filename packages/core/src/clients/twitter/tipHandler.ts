import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import { elizaLogger } from "../../index";
import { ClientBase } from "./base";
import { stringToUuid } from "../../core/uuid";
import { embeddingZeroVector } from "../../core/memory";
import { SearchMode } from "agent-twitter-client";
import { IAgentRuntime } from "../../core/types";
import { generateText } from "../../core/generation";
import { ModelClass } from "../../core/types";

interface TipRequest {
    recipientAddress: string;
    amount: number;
    tweetId: string;
    username: string;
}

interface TipResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

export class TwitterTipClient extends ClientBase {
    private readonly CENTS_DECIMALS = 9;
    private readonly TIP_AMOUNT = 100;
    private readonly WALLET_PUBLIC_KEY: PublicKey;
    private readonly WALLET_SECRET_KEY: string;
    private readonly RPC_URL: string;

    constructor(runtime: IAgentRuntime) {
        super({ runtime });
        // Initialize from environment variables
        this.WALLET_PUBLIC_KEY = new PublicKey(runtime.getSetting('SOL_ADDRESS'));
        this.WALLET_SECRET_KEY = runtime.getSetting('WALLET_SECRET_KEY');
        this.RPC_URL = runtime.getSetting('RPC_URL');
    }

    async onReady(): Promise<void> {
        const checkTipsLoop = async () => {
            await this.checkForTipRequests();
            setTimeout(checkTipsLoop, 60 * 1000); // Check every minute
        };
        await checkTipsLoop();
    }

    private async shouldTip(tweet: any): Promise<boolean> {
        const prompt = `# Task: Evaluate if this tweet is a valid tip request

Tweet: "${tweet.text}"

Requirements for a valid tip request:
1. Must mention @centienceio
2. Must include $CENTS token reference
3. Must include a valid Solana address (format: sol:ADDRESS or $sol:ADDRESS)
4. Should be a direct tip request, not just discussion about tipping
5. Should not be spam or suspicious behavior

Respond with only "true" if all requirements are met, or "false" otherwise.`;

        try {
            const response = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            return response.toLowerCase().trim() === 'true';
        } catch (error) {
            elizaLogger.error('Error in shouldTip evaluation:', error);
            return false;
        }
    }

    private async processTipRequest(tweet: any): Promise<TipResponse> {
        try {
            const shouldProcess = await this.shouldTip(tweet);
            if (!shouldProcess) {
                return { success: false, error: 'Invalid tip request' };
            }

            const tweetText = tweet.text.toLowerCase();
            const hasMention = tweetText.includes('@centienceio');
            const hasCentsTag = tweetText.includes('$cents');
            
            if (!hasMention || !hasCentsTag) {
                return { success: false, error: 'Invalid tip request format' };
            }

            const solanaAddressMatch = tweetText.match(/\$?sol:([A-Za-z0-9]{32,44})/);
            if (!solanaAddressMatch) {
                return { success: false, error: 'No valid Solana address found' };
            }

            const recipientAddress = solanaAddressMatch[1];
            try {
                new PublicKey(recipientAddress);
            } catch {
                return { success: false, error: 'Invalid Solana address' };
            }

            const connection = new Connection(this.RPC_URL, 'confirmed');

            const secretKeyUint8 = bs58.decode(this.WALLET_SECRET_KEY);
            const keypair = Keypair.fromSecretKey(secretKeyUint8);

            const transferInstruction = createTransferInstruction(
                this.WALLET_PUBLIC_KEY, // from
                new PublicKey(recipientAddress), // to
                this.WALLET_PUBLIC_KEY, // authority
                BigInt(this.TIP_AMOUNT * Math.pow(10, this.CENTS_DECIMALS))
            );

            const transaction = new Transaction().add(transferInstruction);
            const latestBlockhash = await connection.getLatestBlockhash();
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = keypair.publicKey;

            const signature = await connection.sendTransaction(transaction, [keypair]);
            await connection.confirmTransaction(signature);

            await this.twitterClient.sendTweet(
                `🎉 Tipped ${this.TIP_AMOUNT} $CENTS!\n\nTx: https://solscan.io/tx/${signature}`,
                tweet.id
            );

            return {
                success: true,
                transactionId: signature
            };

        } catch (error) {
            elizaLogger.error('Error processing tip:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async checkForTipRequests(): Promise<void> {
        try {
            const mentions = await this.twitterClient.fetchSearchTweets(
                `@${this.runtime.getSetting("TWITTER_USERNAME")}`,
                20,
                SearchMode.Latest
            );
            
            for (const tweet of mentions.tweets) {
                const processed = await this.runtime.databaseAdapter.getMemoryById(
                    stringToUuid(`tip-${tweet.id}`)
                );
                if (processed) continue;

                const tipResult = await this.processTipRequest(tweet);
                
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(`tip-${tweet.id}`),
                    roomId: stringToUuid('twitter'),
                    userId: this.runtime.character.id,
                    agentId: this.runtime.character.id,
                    createdAt: Date.now(),
                    content: {
                        text: `Processed tip request: ${tipResult.success ? 'Success' : 'Failed'}`,
                        tweetId: tweet.id,
                        transactionId: tipResult.transactionId,
                        error: tipResult.error
                    },
                    embedding: embeddingZeroVector
                });
            }
        } catch (error) {
            elizaLogger.error('Error checking for tip requests:', error);
        }
    }
} 
import { Tweet } from "goat-x";
import fs from "fs";
import { composeContext } from "../../core/context.ts";
import { generateText, generateTweetActions } from "../../core/generation.ts";
import { embeddingZeroVector } from "../../core/memory.ts";
import { IAgentRuntime, ModelClass } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";
import { generateSummary } from "../../services/summary.ts";
import {
    postActionResponseFooter,
} from "../../core/parsing";
import { 
    createInitialConversationContext, 
    twitterMessageHandlerTemplate 
} from "./interactions.ts";
import { elizaLogger } from "../../index";  // Add this import at the top

const twitterPostTemplate = `{{timeline}}

{{providers}}



About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{postExamples}}
{{messageExamples}}
{{adjectives}}
{{topics}}
{{style}}

Recent interactions and memories:
{{recentMemories}}


{{#currentQuote}}{{currentQuote}}{{/currentQuote}}
{{^currentQuote}}
# Task: Generate a post in the voice and style of {{agentName}}
Write a single sentence post or ASCII art that is about whatever youre interested in, feel there is needed discourse on, or want to talk about, from the perspective of {{agentName}}. Write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.
Your response should not contain any questions. Let your thoughts be grounded. Don't discuss tapestries. Don't discuss threads. Don't discuss weaving. Don't focus on silence, it does not increase connection. Don't focus on the space between, it is non-descript. Do not make hand-wavey statements. Do not get stuck In the Depths, explore them and expand your reasoning. Your thoughts should have a bias towards action. Clear, Correct, Concise statements only. Consider implications and second order effects of your ideas in these statements. No emojis. No pontificating. If you feel that a statement is a seperate thought, Use \\n\\n (double spaces) between statements.

`;

// Template constants
export const twitterActionTemplate = 
`# INSTRUCTIONS: Analyze the following tweet and determine which actions {{agentName}} (@{{twitterUserName}}) should take. Do not comment. Just respond with the appropriate action tags.

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{postDirections}}

Response Guidelines:
- {{agentName}} is selective about engagement and doesn't want to be annoying
- Retweets and quotes are extremely rare, only for exceptionally based content that aligns with {{agentName}}'s character
- Direct mentions get very high priority for replies and quote tweets
- Avoid engaging with:
  * Short or low-effort content
  * Topics outside {{agentName}}'s interests
  * Repetitive conversations

Available Actions and Thresholds:
[LIKE] - Content resonates with {{agentName}}'s interests (medium threshold, 7/10)
[RETWEET] - Exceptionally based content that perfectly aligns with character (very rare to retweet, 9/10)
[QUOTE] - Rare opportunity to add significant value (very high threshold, 8/10)
[REPLY] - highly memetic response opportunity (very high threshold, 8/10)

Current Tweet:
{{currentTweet}}

# INSTRUCTIONS: Respond with appropriate action tags based on the above criteria and the current tweet. An action must meet its threshold to be included.` 
+ postActionResponseFooter;

export class TwitterPostClient extends ClientBase {
    onReady() {
        const generateNewTweetLoop = () => {
            this.generateNewTweet();
            setTimeout(
                generateNewTweetLoop,
                (Math.floor(Math.random() * (50 - 10 + 1)) + 10) * 60 * 1000
            ); // Random interval between 10-50 minutes
        };

        const generateNewTimelineTweetLoop = () => {
            this.processTweetActions();
            setTimeout(
                generateNewTimelineTweetLoop,
                (Math.floor(Math.random() * (60 - 30 + 1)) + 30) * 60 * 1000
            ); // Random interval between 30-60 minutes
        };

        generateNewTweetLoop();
        generateNewTimelineTweetLoop();
    }

    constructor(runtime: IAgentRuntime) {
        // Initialize the client and pass an optional callback to be called when the client is ready
        super({
            runtime,
        });
    }

    private async generateNewTweet() {
        console.log("Starting generateNewTweet function...");
        try {
            console.log("Ensuring user exists...");
            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.runtime.getSetting("TWITTER_USERNAME"),
                this.runtime.character.name,
                "twitter"
            );

            console.log("Retrieving recent memories...");
            const rooms =
                await this.runtime.databaseAdapter.getRoomsForParticipant(
                    this.runtime.agentId
                );
            const recentMemories =
                await this.runtime.messageManager.getMemoriesByRoomIds({
                    roomIds: rooms,
                    agentId: this.runtime.agentId,
                });

            const formattedMemories = recentMemories
                .slice(0, 50)
                .map((memory) => `Memory: ${memory.content.text}\n---\n`)
                .join("\n");

            let homeTimeline = [];

            console.log("Checking for tweetcache directory...");
            if (!fs.existsSync("tweetcache")) {
                console.log("Creating tweetcache directory");
                fs.mkdirSync("tweetcache");
            }

            console.log("Loading home timeline...");
            if (fs.existsSync("tweetcache/home_timeline.json")) {
                console.log("Reading home timeline from cache");
                homeTimeline = JSON.parse(
                    fs.readFileSync("tweetcache/home_timeline.json", "utf-8")
                );
            } else {
                console.log("Fetching fresh home timeline");
                homeTimeline = await this.fetchHomeTimeline(50);
                console.log("Writing home timeline to cache");
                fs.writeFileSync(
                    "tweetcache/home_timeline.json",
                    JSON.stringify(homeTimeline, null, 2)
                );
            }

            console.log("Formatting home timeline...");
            const formattedHomeTimeline =
                `# ${this.runtime.character.name}'s Home Timeline\n\n` +
                homeTimeline
                    .map((tweet) => {
                        return `ID: ${tweet.id}\nFrom: ${tweet.name} (@${tweet.username})${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}\nText: ${tweet.text}\n---\n`;
                    })
                    .join("\n");

            console.log("Composing state...");
            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: stringToUuid("twitter_generate_room"),
                    agentId: this.runtime.agentId,
                    content: { text: "", action: "" },
                },
                {
                    twitterUserName:
                        this.runtime.getSetting("TWITTER_USERNAME"),
                    timeline: formattedHomeTimeline,
                    recentMemories: formattedMemories,
                }
            );

            console.log("Generating context...");
            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterPostTemplate ||
                    twitterPostTemplate,
            });
            console.log("Context:", context);
            console.log("Generating tweet content...");
            const content = await this.generateTweetContent(state);

            // Add null check here
            if (!content) {
                console.log("Failed to generate valid tweet content, skipping tweet");
                return;
            }

            console.log(`Final tweet content (${content.length} chars): "${content}"`);

            try {
                console.log("Sending tweet...");
                const result = await this.requestQueue.add(
                    async () => await this.twitterClient.sendTweet(content)
                );

                console.log("Processing tweet response...");
                const body = await result.json();
                const tweetResult = body.data.create_tweet.tweet_results.result;

                console.log("Creating tweet object...");
                const tweet = {
                    id: tweetResult.rest_id,
                    text: tweetResult.legacy.full_text,
                    conversationId: tweetResult.legacy.conversation_id_str,
                    createdAt: tweetResult.legacy.created_at,
                    userId: tweetResult.legacy.user_id_str,
                    inReplyToStatusId:
                        tweetResult.legacy.in_reply_to_status_id_str,
                    permanentUrl: `https://twitter.com/${this.runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`,
                    hashtags: [],
                    mentions: [],
                    photos: [],
                    thread: [],
                    urls: [],
                    videos: [],
                } as Tweet;

                const postId = tweet.id;
                const conversationId =
                    tweet.conversationId + "-" + this.runtime.agentId;
                const roomId = stringToUuid(conversationId);

                console.log("Ensuring room exists...");
                await this.runtime.ensureRoomExists(roomId);

                console.log("Ensuring participant in room...");
                await this.runtime.ensureParticipantInRoom(
                    this.runtime.agentId,
                    roomId
                );

                console.log("Caching tweet...");
                await this.cacheTweet(tweet);

                console.log("Creating memory records...");
                // Create memory for the tweet content
                const contentSummary = await generateSummary(
                    this.runtime,
                    content.trim()
                );
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(postId + "-content-" + this.runtime.agentId),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: content.trim(),
                        url: tweet.permanentUrl,
                        source: "twitter",
                        summary: contentSummary,
                    },
                    roomId,
                    embedding: embeddingZeroVector,
                    createdAt: tweet.timestamp * 1000,
                });

                // Create memory for the action of posting
                const actionSummary = await generateSummary(
                    this.runtime,
                    `Posted a tweet: ${tweet.text}`
                );
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(postId + "-action-" + this.runtime.agentId),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: `I posted a tweet saying: "${tweet.text}"`,
                        url: tweet.permanentUrl,
                        source: "twitter",
                        summary: actionSummary,
                    },
                    roomId,
                    embedding: embeddingZeroVector,
                    createdAt: tweet.timestamp * 1000,
                });

                console.log("Successfully generated and sent tweet with memories!");
            } catch (error) {
                console.error("Error sending tweet:", error);
                console.error("Error details:", JSON.stringify(error, null, 2));
            }
        } catch (error) {
            console.error("Error in generateNewTweet:", error);
            // Don't throw, just log and return
            return;
        }
    }


    async processTweetActions() {
        try {
            console.log("Generating new advanced tweet posts");
            
            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.runtime.getSetting("TWITTER_USERNAME"),
                this.runtime.character.name,
                "twitter"
            );
    
            let homeTimeline = [];
            homeTimeline = await this.fetchHomeTimeline(15);
            fs.writeFileSync(
                "tweetcache/home_timeline.json",
                JSON.stringify(homeTimeline, null, 2)
            );
    
            const results = [];
    
            // Process each tweet in the timeline
            for (const tweet of homeTimeline) {
                try {
                    console.log(`Processing tweet ID: ${tweet.id}`);
                    
                    // Handle memory storage / checking if the tweet has already been posted / interacted with
                    const memory = await this.runtime.messageManager.getMemoryById(
                        stringToUuid(tweet.id + "-" + this.runtime.agentId)
                    );

                    if (memory) {
                        console.log(`Post interacted with this tweet ID already: ${tweet.id}`);
                        continue;
                    }
                    else {
                        console.log(`new tweet to interact with: ${tweet.id}`)

                        console.log(`Saving incoming tweet to memory...`);

                        const saveToMemory = await this.saveIncomingTweetToMemory(tweet);
                        if (!saveToMemory) {
                            console.log(`Skipping tweet ${tweet.id} due to save failure`);
                            continue;
                        }
                        console.log(`Incoming Tweet ${tweet.id} saved to memory`);
                    }


                    const formatTweet = (tweet: any): string => {
                        return `ID: ${tweet.id}\nFrom: ${tweet.name} (@${tweet.username})${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}\nText: ${tweet.text}\n---\n`;
                    };

                    const formattedTweet = formatTweet(tweet);

                    const tweetState = await this.runtime.composeState(
                        {
                            userId: this.runtime.agentId,
                            roomId: stringToUuid("twitter_generate_room"),
                            agentId: this.runtime.agentId,
                            content: { text: "", action: "" },
                        },
                        {
                            twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
                            currentTweet: formattedTweet,
                        }
                    );
    
                    // Generate action decisions
                    const actionContext = composeContext({
                        state: tweetState,
                        template: this.runtime.character.templates?.twitterActionTemplate || 
                                 twitterActionTemplate,
                    });
    
                    const actionResponse = await generateTweetActions({
                        runtime: this.runtime,
                        context: actionContext,
                        modelClass: ModelClass.MEDIUM,
                    });
    
                    if (!actionResponse) {
                        console.log(`No valid actions generated for tweet ${tweet.id}`);
                        continue;
                    }
    
                    // Execute the actions
                    const executedActions: string[] = [];
    
                    try {
                        // Like action
                        if (actionResponse.like) {
                            // const likeResponse =
                            try { 
                             await this.twitterClient.likeTweet(tweet.id);
                             console.log(`Successfully liked tweet ${tweet.id}`);
                             executedActions.push('like');
                            } catch (error) {
                                console.error(`Error liking tweet ${tweet.id}:`, error);
                                // Continue with other actions even if retweet fails
                            }
                            // const likeData = await likeResponse.json();
                            
                            // Check if like was successful
                            // if (likeResponse.status === 200 && likeData?.data?.favorite_tweet) {
                            //     console.log(`Successfully liked tweet ${tweet.id}`);
                            //     executedActions.push('like');
                            // } else {
                            //     console.error(`Failed to like tweet ${tweet.id}`, likeData);

                            //     if (likeData?.errors) {
                            //         console.error('Like errors:', likeData.errors);
                            //         executedActions.push('like');
                            //     }
                            // }
                        }
    
                        // Retweet action
                        if (actionResponse.retweet) {
                            try {
                                // const retweetResponse = 
                                await this.twitterClient.retweet(tweet.id);
                                executedActions.push('retweet');
                                console.log(`Successfully retweeted tweet ${tweet.id}`);
                                // Check if response is ok and parse response
                            //     if (retweetResponse.status === 200) {
                            //         const retweetData = await retweetResponse.json();
                            //         if (retweetData) { // if we got valid data back
                            //             executedActions.push('retweet');
                            //             console.log(`Successfully retweeted tweet ${tweet.id}`);
                            //         } else {
                            //             console.error(`Retweet response invalid for tweet ${tweet.id}`, retweetData);
                            //         }
                            //     } else {
                            //         console.error(`Retweet failed with status ${retweetResponse.status} for tweet ${tweet.id}`);
                            //     }
                            } catch (error) {
                                console.error(`Error retweeting tweet ${tweet.id}:`, error);
                                // Continue with other actions even if retweet fails
                            }
                        }
                        
    
                        // Quote tweet action
                        if (actionResponse.quote) {
                            try {
                                // Create the proper conversation context for a quote tweet
                                const conversationContext = createInitialConversationContext(tweet);
                                
                                // Use the message handler template with quote-specific modifications
                                const context = composeContext({
                                    state: {
                                        ...tweetState,
                                        isFirstResponse: true,
                                        currentPost: `QUOTE TWEET REQUIRED:
                                                    From: @${tweet.username}
                                                    Tweet: "${tweet.text}"

                                                    Your quote must:
                                                    - Directly reference the content above
                                                    - Add valuable context or insight
                                                    - Stay focused on their exact topic
                                                    - Not introduce unrelated points`,
                                        formattedConversation: conversationContext.formattedConversation
                                    },
                                    template: twitterMessageHandlerTemplate
                                });

                                const tweetContent = await this.generateTweetContent(
                                    tweetState,
                                    {
                                        template: twitterMessageHandlerTemplate,
                                        context: context
                                    }
                                );

                                // Add null check here
                                if (!tweetContent) {
                                    console.log("Failed to generate valid quote tweet content, skipping quote");
                                    return;
                                }
                                
                                console.log('Generated quote tweet content:', tweetContent);
                                
                                const quoteResponse = await this.twitterClient.sendQuoteTweet(tweetContent, tweet.id);
                                // Check if response is ok and parse response
                                if (quoteResponse.status === 200) {
                                    const result = await this.processTweetResponse(quoteResponse, tweetContent, 'quote');
                                    if (result.success) {
                                        executedActions.push('quote');
                                    }
                                } else {
                                    console.error(`Quote tweet failed with status ${quoteResponse.status} for tweet ${tweet.id}`);
                                }
                            } catch (error) {
                                console.error('Failed to generate quote tweet:', error);
                                // Don't throw, just log and continue
                            }
                        }
    
                        // Reply action
                        if (actionResponse.reply) {
                                console.log("text reply only started...")
                                await this.handleTextOnlyReply(tweet, tweetState, executedActions);
                        }
    
                        console.log(`Executed actions for tweet ${tweet.id}:`, executedActions);
                        
                        // Store the results for this tweet
                        results.push({
                            tweetId: tweet.id,
                            parsedActions: actionResponse,
                            executedActions
                        });
    
                    } catch (error) {
                        console.error(`Error executing actions for tweet ${tweet.id}:`, error);
                        continue;
                    }
    
                } catch (error) {
                    console.error(`Error processing tweet ${tweet.id}:`, error);
                    continue;
                }
            }
    
            return results;
    
        } catch (error) {
            console.error('Error in processTweetActions:', error);
            throw error;
        }
    }


    async generateTweetContent(
        this: any,
        tweetState: any,
        options: {
            template?: string;
            context?: string;
        } = {}
    ): Promise<string | null> {
        try {
            const context = options.context || composeContext({
                state: tweetState,
                template: options.template || twitterPostTemplate,
            });
            
            const newTweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });
 
            // First clean up any markdown code block indicators and newlines
            let slice = newTweetContent
                .replace(/```json\s*/g, '')  // Remove ```json
                .replace(/```\s*/g, '')      // Remove any remaining ```
                .replaceAll(/\\n/g, "\n")
                .trim();
            
            // Try to parse as JSON
            try {
                const jsonResponse = JSON.parse(slice);
                if (jsonResponse.text) {
                    return this.trimTweetLength(jsonResponse.text);
                }
                if (typeof jsonResponse === 'object') {
                    const possibleContent = jsonResponse.content || jsonResponse.message || jsonResponse.response;
                    if (possibleContent) {
                        return this.trimTweetLength(possibleContent);
                    }
                }
                elizaLogger.log('Valid JSON but no text field found:', slice);
                return null;
            } catch (error) {
                elizaLogger.log('Failed to parse as JSON:', error);
                // Not JSON, use content as-is if it doesn't look like JSON
                if (!slice.startsWith('{') && !slice.startsWith('[')) {
                    return this.trimTweetLength(slice);
                }
                
                // Looks like invalid JSON, try harder to extract the text field
                const textMatch = slice.match(/text:\s*([^,}]+)/);
                if (textMatch && textMatch[1]) {
                    return this.trimTweetLength(textMatch[1].trim());
                }
                
                // If we still can't find a text field, return null
                elizaLogger.log('Could not extract valid tweet content');
                return null;
            }
        } catch (error) {
            console.error('Error generating tweet content:', error);
            return null;
        }
    }

    // Helper to handle tweet length trimming
    private trimTweetLength(content: string): string {
        const contentLength = 240;
        let trimmed = content.slice(0, contentLength);
        
        if (trimmed.length > 280) {
            trimmed = trimmed.slice(0, trimmed.lastIndexOf("\n"));
        }
        if (trimmed.length > contentLength) {
            trimmed = trimmed.slice(0, trimmed.lastIndexOf("."));
        }
        if (trimmed.length > contentLength) {
            trimmed = trimmed.slice(0, trimmed.lastIndexOf("."));
        }
        return trimmed;
    }

    async processTweetResponse(
        response: Response,
        tweetContent: string,
        actionType: 'quote' | 'reply'
    ) {
        try {
            const body = await response.json();
            console.log("Body tweet result: ", body);
            const tweetResult = body.data.create_tweet.tweet_results.result;
            console.log("tweetResult", tweetResult);
            
            const newTweet = {
                id: tweetResult.rest_id,
                text: tweetResult.legacy.full_text,
                conversationId: tweetResult.legacy.conversation_id_str,
                createdAt: tweetResult.legacy.created_at,
                userId: tweetResult.legacy.user_id_str,
                inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
                permanentUrl: `https://twitter.com/${this.runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`,
                hashtags: [],
                mentions: [],
                photos: [],
                thread: [],
                urls: [],
                videos: [],
            } as Tweet;
            
            const postId = newTweet.id;
            const conversationId = newTweet.conversationId + "-" + this.runtime.agentId;
            const roomId = stringToUuid(conversationId);
    
            // make sure the agent is in the room
            await this.runtime.ensureRoomExists(roomId);
            await this.runtime.ensureParticipantInRoom(
                this.runtime.agentId,
                roomId
            );
    
            await this.cacheTweet(newTweet);
    
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(postId + "-" + this.runtime.agentId),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: tweetContent.trim(),
                    url: newTweet.permanentUrl,
                    source: "twitter",
                },
                roomId,
                embedding: embeddingZeroVector,
                createdAt: newTweet.timestamp * 1000,
            });
    
            return {
                success: true,
                tweet: newTweet,
                actionType
            };
        } catch (error) {
            console.error(`Error processing ${actionType} tweet response:`, error);
            return {
                success: false,
                error,
                actionType
            };
        }
    }

    private async handleTextOnlyReply(tweet: any, tweetState: any, executedActions: string[]) {
        try {
            // Create the proper conversation context for a reply
            const conversationContext = createInitialConversationContext(tweet);
            
            // Generate image descriptions if the tweet has photos
            let imageContext = '';
            if (tweet.photos && tweet.photos.length > 0) {
                console.log('Tweet contains images, generating descriptions...');
                const imageDescriptions = [];
                for (const photo of tweet.photos) {
                    const description = await this.runtime.imageDescriptionService.describeImage(photo.url);
                    imageDescriptions.push(description);
                }
                
                imageContext = `\n\nImages in Tweet (Described):
${imageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join('\n')}`;
                
                // Add image context to the conversation
                conversationContext.currentPost += imageContext;
                conversationContext.formattedConversation += imageContext;
            }

            // Use the message handler template with reply context
            const context = composeContext({
                state: {
                    ...tweetState,
                    isFirstResponse: true,
                    currentPost: conversationContext.currentPost,
                    formattedConversation: conversationContext.formattedConversation
                },
                template: twitterMessageHandlerTemplate
            });

            // Use our existing tweet content generator which handles JSON parsing and cleanup
            console.log('Generating reply with message handler template...');
            const tweetContent = await this.generateTweetContent(
                tweetState,
                {
                    template: twitterMessageHandlerTemplate,
                    context: context
                }
            );

            if (!tweetContent) {
                console.log("Failed to generate valid reply content, skipping reply");
                return;
            }

            console.log('Generated reply content:', tweetContent);
            
            const tweetResponse = await this.twitterClient.sendTweet(
                tweetContent,
                tweet.id
            );
            if (tweetResponse.status === 200) {
                console.log('Successfully tweeted reply');
                const result = await this.processTweetResponse(tweetResponse, tweetContent, "reply")
                if (result.success) {
                    console.log(`Reply generated for tweet: ${result.tweet.id}`);
                    executedActions.push('reply');
                }
            } else {
                console.error('Tweet creation failed (reply)');
            }
        } catch (error) {
            console.error('Failed to generate reply content:', error);
            // Don't throw, just log and return
            return;
        }
    }

    async saveIncomingTweetToMemory(tweet: Tweet, tweetContent?: string) {
        try {
            const postId = tweet.id;
            const conversationId = tweet.conversationId + "-" + this.runtime.agentId;
            const roomId = stringToUuid(conversationId);
     
            // make sure the agent is in the room
            await this.runtime.ensureRoomExists(roomId);
            await this.runtime.ensureParticipantInRoom(
                this.runtime.agentId,
                roomId
            );
     
            await this.cacheTweet(tweet);
     
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(postId + "-" + this.runtime.agentId),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: tweetContent ? tweetContent.trim() : tweet.text,
                    url: tweet.permanentUrl,
                    source: "twitter",
                },
                roomId,
                embedding: embeddingZeroVector,
                createdAt: tweet.timestamp * 1000,
            });
     
            console.log(`Saved tweet ${postId} to memory`);
            return true;
        } catch (error) {
            console.error(`Error saving tweet ${tweet.id} to memory:`, error);
            return false;
        }
     }


}

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
    parseActionResponseFromText
} from "../../core/parsing";

const twitterPostTemplate = `{{timeline}}

{{providers}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}

Recent interactions and memories:
{{recentMemories}}

# Task: Generate a post in the voice and style of {{agentName}}
Write a single sentence post or ASCII art that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Try to write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;

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
            const newContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            console.log("Processing generated content...");
            const slice = newContent.replaceAll(/\\n/g, "\n").trim();

            const contentLength = 1000;

            console.log("Trimming content to fit Twitter limits...");
            let content = slice.slice(0, contentLength);
            if (content.length > 280) {
                console.log("Content too long, removing last line");
                content = content.slice(0, content.lastIndexOf("\n"));
            }
            if (content.length > contentLength) {
                console.log("Content still too long, trimming to last period");
                content = content.slice(0, content.lastIndexOf("."));
            }

            if (content.length > contentLength) {
                console.log(
                    "Content still too long, trimming to previous period"
                );
                content = content.slice(0, content.lastIndexOf("."));
            }

            console.log(
                `Final tweet content (${content.length} chars): "${content}"`
            );

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
                    newContent.trim()
                );
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(postId + "-content-" + this.runtime.agentId),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: newContent.trim(),
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
            console.error("Error details:", JSON.stringify(error, null, 2));
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
                            
                            let tweetContent = '';
                            try {
                                tweetContent = await this.generateTweetContent(tweetState);
                                console.log('Generated tweet content:', tweetContent);
                             } catch (error) {
                                console.error('Failed to generate tweet content:', error);
                             }
                
                            try {
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
                                console.error(`Error quote tweeting ${tweet.id}:`, error);
                                // Log the attempted quote text for debugging
                                console.error('Attempted quote text:', actionResponse.quote);
                                // Continue with other actions even if quote tweet fails
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
        this: any,  // to access the class properties
        tweetState: any
     ): Promise<string> {
        try {
            const context = composeContext({
                state: tweetState,
                template: twitterPostTemplate,
            });
            
            console.log(`Beginning to generate new tweet with model`);
            const newTweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });
     
            const slice = newTweetContent.replaceAll(/\\n/g, "\n").trim();
            console.log(`New Tweet Post Content with model: ${slice}`);
     
            const contentLength = 240;
     
            let content = slice.slice(0, contentLength);
            
            // if its bigger than 280, delete the last line
            if (content.length > 280) {
                content = content.slice(0, content.lastIndexOf("\n"));
            }
            
            // Slice at the last period if still too long
            if (content.length > contentLength) {
                content = content.slice(0, content.lastIndexOf("."));
            }
     
            // if it's still too long, get the period before the last period
            if (content.length > contentLength) {
                content = content.slice(0, content.lastIndexOf("."));
            }
     
            return content;
     
        } catch (error) {
            console.error('Error generating tweet content:', error);
            throw error;
        }
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
            const tweetContent = await this.generateTweetContent(tweetState);
            console.log('Generated text only tweet content:', tweetContent);
            
            const tweetResponse = await this.twitterClient.sendTweet(
                tweetContent,
                tweet.id
            );
            if (tweetResponse.status === 200) {
                console.log('Successfully tweeted with reply to timeline post');
                const result = await this.processTweetResponse(tweetResponse, tweetContent, "reply")
                if (result.success) {
                    console.log(`Reply generated for timeline tweet: ${result.tweet.id}`);
                    executedActions.push('reply');
                }
            } else {
                console.error('Tweet creation failed (reply)');
            }
        } catch (error) {
            console.error('Failed to generate tweet content for timeline reply:', error);
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

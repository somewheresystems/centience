import { SearchMode } from "agent-twitter-client";
import fs from "fs";
import { composeContext } from "../../core/context.ts";
import {
    generateMessageResponse,
    generateText,
} from "../../core/generation.ts";
import { messageCompletionFooter } from "../../core/parsing.ts";
import {
    Content,
    HandlerCallback,
    IAgentRuntime,
    ModelClass,
    State,
    ModelProvider,
} from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";
import { buildConversationThread, sendTweet, wait } from "./utils.ts";
import { elizaLogger } from "../../index.ts";

const twitterSearchTemplate =
    `{{relevantFacts}}
{{recentFacts}}

{{timeline}}

{{providers}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{postDirections}}

{{recentPosts}}

# Task: Respond to the following post in the style and perspective of {{agentName}} (aka @{{twitterUserName}}). Write a {{adjective}} response for {{agentName}} to say directly in response to the post. don't generalize.
{{currentPost}}

IMPORTANT: Your response CANNOT be longer than 20 words.
Aim for 1-2 short sentences maximum. Be concise and direct.

Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.

` + messageCompletionFooter;

export class TwitterSearchClient extends ClientBase {
    private respondedTweets: Set<string> = new Set();
    private isEngaging: boolean = false;

    constructor(runtime: IAgentRuntime) {
        // Initialize the client and pass an optional callback to be called when the client is ready
        super({
            runtime,
        });
    }

    async onReady() {
        // Replace single loop with alternating loops
        this.startEngagementLoops();
    }

    private startEngagementLoops() {
        // Start both loops with different initial delays
        setTimeout(() => {
            this.viralTweetsLoop().catch(err => {
                console.error("Error in viral tweets loop:", err);
            });
        },0); // Start viral loop 30 mins after
    
        setTimeout(() => {
            this.searchTermsLoop().catch(err => {
                console.error("Error in search terms loop:", err);
            });
        },  30 * 60 * 1000);    
    }

    private async searchTermsLoop() {
        if (this.isEngaging) return;
        
        try {
            this.isEngaging = true;
            await this.engageWithSearchTerms();
        } finally {
            this.isEngaging = false;
        }

        setTimeout(
            () => this.searchTermsLoop(),
            (Math.floor(Math.random() * (120 - 60 + 1)) + 60) * 60 * 1000
        );
    }

    private async viralTweetsLoop() {
        if (this.isEngaging) return;
        
        try {
            this.isEngaging = true;
            await this.engageWithViralTweets();
        } finally {
            this.isEngaging = false;
        }

        setTimeout(
            () => this.viralTweetsLoop(),
            4 * 60 * 60 * 1000
        );
    }

    private async engageWithViralTweets() {
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        elizaLogger.log("=== VIRAL TWEETS LOOP START ===");
        try {
            if (!fs.existsSync("tweetcache")) {
                fs.mkdirSync("tweetcache");
            }

            // Get yesterday's date
            const date = new Date();
            date.setDate(date.getDate());
            const formattedDate = date.toLocaleDateString('en-CA');
            elizaLogger.log(`Searching for viral tweets since: ${formattedDate}`);
            
            const recentTweets = await this.fetchSearchTweets(
                `and min_faves:10000 since:${formattedDate}`,
                20,
                SearchMode.Top
            );

            elizaLogger.log(`Found ${recentTweets.tweets.length} viral tweets`);

            // randomly slice .tweets down to 20
            const slicedTweets = recentTweets.tweets
                .sort(() => Math.random() - 0.5)
                .slice(0, 20);

            if (slicedTweets.length === 0) {
                elizaLogger.error("No viral tweets found");
                return;
            }

            const prompt = `
                    Here are some viral tweets from the last 3 hours:

                    ${slicedTweets
                        .filter((tweet) => {
                            // ignore tweets where any of the thread tweets contain a tweet by the bot
                            const thread = tweet.thread;
                            const botTweet = thread.find(
                                (t) => t.username === this.runtime.getSetting("TWITTER_USERNAME")
                            );
                            return !botTweet;
                        })
                        .map((tweet) => `
                    ID: ${tweet.id}${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}
                    From: ${tweet.name} (@${tweet.username})
                    Text: ${tweet.text}
                    `)
                        .join("\n")}

                    Which tweet is the most interesting and relevant for ${this.runtime.character.name} to reply to? Please provide only the ID of the tweet in your response.
                    Notes:
                    - Respond to English tweets only
                    - Respond to tweets that don't have a lot of hashtags, links, URLs or images
                    - Respond to tweets that are not retweets
                    - Respond to tweets where there is an easy exchange of ideas to have with the user
                    - ONLY respond with the ID of the tweet`;

            const mostInterestingTweetResponse = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.MEDIUM,
                forceProvider: { provider: ModelProvider.LLAMACLOUD, model: "llama3-8b-8192" }
            });

            const tweetId = mostInterestingTweetResponse.trim();
            const selectedTweet = slicedTweets.find(
                (tweet) =>
                    tweet.id.toString().includes(tweetId) ||
                    tweetId.includes(tweet.id.toString())
            );

            if (!selectedTweet) {
                console.log("No matching tweet found for the selected ID");
                return console.log("Selected tweet ID:", tweetId);
            }

            console.log("Selected tweet to reply to:", selectedTweet?.text);

            if (
                selectedTweet.username ===
                this.runtime.getSetting("TWITTER_USERNAME")
            ) {
                console.log("Skipping tweet from bot itself");
                return;
            }
            if (await this.hasRespondedToTweet(selectedTweet.id)) {
                console.log(`Already responded to tweet ${selectedTweet.id}, skipping`);
                return;
            }
            const conversationId = selectedTweet.conversationId;
            const roomId = stringToUuid(
                conversationId + "-" + this.runtime.agentId
            );

            const userIdUUID = stringToUuid(selectedTweet.userId as string);

            await this.runtime.ensureConnection(
                userIdUUID,
                roomId,
                selectedTweet.username,
                selectedTweet.name,
                "twitter"
            );

            // crawl additional conversation tweets, if there are any
            await buildConversationThread(selectedTweet, this);

            const message = {
                id: stringToUuid(selectedTweet.id + "-" + this.runtime.agentId),
                agentId: this.runtime.agentId,
                content: {
                    text: selectedTweet.text,
                    url: selectedTweet.permanentUrl,
                    inReplyTo: selectedTweet.inReplyToStatusId
                        ? stringToUuid(
                              selectedTweet.inReplyToStatusId +
                                  "-" +
                                  this.runtime.agentId
                          )
                        : undefined,
                },
                userId: userIdUUID,
                roomId,
                // Timestamps are in seconds, but we need them in milliseconds
                createdAt: selectedTweet.timestamp * 1000,
            };

            if (!message.content.text) {
                return { text: "", action: "IGNORE" };
            }

            // Fetch replies and retweets
            const replies = selectedTweet.thread;
            const replyContext = replies
                .filter(
                    (reply) =>
                        reply.username !==
                        this.runtime.getSetting("TWITTER_USERNAME")
                )
                .map((reply) => `@${reply.username}: ${reply.text}`)
                .join("\n");

            let tweetBackground = "";
            if (selectedTweet.isRetweet) {
                const originalTweet = await this.requestQueue.add(() =>
                    this.twitterClient.getTweet(selectedTweet.id)
                );
                tweetBackground = `Retweeting @${originalTweet.username}: ${originalTweet.text}`;
            }

            // Generate image descriptions using GPT-4 vision API
            const imageDescriptions = [];
            for (const photo of selectedTweet.photos) {
                const description =
                    await this.runtime.imageDescriptionService.describeImage(
                        photo.url
                    );
                imageDescriptions.push(description);
            }

            // Get quoted content if it exists
            const quotedContent = await this.getQuotedContent(selectedTweet);

            let state = await this.runtime.composeState(message, {
                twitterClient: this.twitterClient,
                twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
                tweetContext: `${tweetBackground}
  
  Original Post:
  By @${selectedTweet.username}
  ${selectedTweet.text}${replyContext.length > 0 && `\nReplies to original post:\n${replyContext}`}
  ${`Original post text: ${selectedTweet.text}`}
  ${selectedTweet.urls.length > 0 ? `URLs: ${selectedTweet.urls.join(", ")}\n` : ""}${imageDescriptions.length > 0 ? `\nImages in Post (Described): ${imageDescriptions.join(", ")}\n` : ""}
  ${quotedContent ? `\ncritical quoted content from the tweet you are responding to:\n${quotedContent}` : ""}
  `,
            });

            await this.saveRequestMessage(message, state as State);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterSearchTemplate ||
                    twitterSearchTemplate,
            });

            const responseContent = await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });

            responseContent.inReplyTo = message.id;

            const response = responseContent;

            if (!response.text) {
                console.log("Returning: No response text found");
                return;
            }

            console.log(
                `Bot would respond to tweet ${selectedTweet.id} with: ${response.text}`
            );
            try {
                const callback: HandlerCallback = async (response: Content) => {
                    const memories = await sendTweet(
                        this,
                        response,
                        message.roomId,
                        this.runtime.getSetting("TWITTER_USERNAME"),
                        tweetId
                    );
                    return memories;
                };

                const responseMessages = await callback(responseContent);

                state = await this.runtime.updateRecentMessageState(state);

                for (const responseMessage of responseMessages) {
                    await this.runtime.messageManager.createMemory(
                        responseMessage,
                        false
                    );
                }

                state = await this.runtime.updateRecentMessageState(state);

                await this.runtime.evaluate(message, state);
                await this.runtime.processActions(
                    message,
                    responseMessages,
                    state,
                    callback
                );

                this.respondedTweets.add(selectedTweet.id);
                const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${selectedTweet.id} - ${selectedTweet.username}: ${selectedTweet.text}\nAgent's Output:\n${response.text}`;
                const debugFileName = `tweetcache/tweet_generation_${selectedTweet.id}.txt`;

                fs.writeFileSync(debugFileName, responseInfo);
                await wait();
            } catch (error) {
                console.error(`Error sending response post: ${error}`);
            }
        } catch (error) {
            elizaLogger.error("Error in viral tweets loop:", error);
        } finally {
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
            elizaLogger.log("=== VIRAL TWEETS LOOP END ===");
        }
    }

    private async engageWithSearchTerms() {
        console.log("Engaging with search terms");
        try {
            const searchTerm = [...this.runtime.character.topics][
                Math.floor(Math.random() * this.runtime.character.topics.length)
            ];

            if (!fs.existsSync("tweetcache")) {
                fs.mkdirSync("tweetcache");
            }
            console.log("Fetching search tweets");
            // TODO: we wait 5 seconds here to avoid getting rate limited on startup, but we should queue
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const recentTweets = await this.fetchSearchTweets(
                searchTerm,
                20,
                SearchMode.Top
            );
            console.log("Search tweets fetched");

            const homeTimeline = await this.fetchHomeTimeline(50);
            fs.writeFileSync(
                "tweetcache/home_timeline.json",
                JSON.stringify(homeTimeline, null, 2)
            );

            const formattedHomeTimeline =
                `# ${this.runtime.character.name}'s Home Timeline\n\n` +
                homeTimeline
                    .map((tweet) => {
                        return `ID: ${tweet.id}\nFrom: ${tweet.name} (@${tweet.username})${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}\nText: ${tweet.text}\n---\n`;
                    })
                    .join("\n");

            // randomly slice .tweets down to 20
            const slicedTweets = recentTweets.tweets
                .sort(() => Math.random() - 0.5)
                .slice(0, 20);

            if (slicedTweets.length === 0) {
                console.log(
                    "No valid tweets found for the search term",
                    searchTerm
                );
                return;
            }

            const prompt = `
  Here are some tweets related to the search term "${searchTerm}":
  
  ${[...slicedTweets, ...homeTimeline]
      .filter((tweet) => {
          // ignore tweets where any of the thread tweets contain a tweet by the bot
          const thread = tweet.thread;
          const botTweet = thread.find(
              (t) => t.username === this.runtime.getSetting("TWITTER_USERNAME")
          );
          return !botTweet;
      })
      .map(
          (tweet) => `
    ID: ${tweet.id}${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}
    From: ${tweet.name} (@${tweet.username})
    Text: ${tweet.text}
  `
      )
      .join("\n")}
  
  Which tweet is the most interesting and relevant for Love to reply to? Please provide only the ID of the tweet in your response.
  Notes:
    - Respond to English tweets only
    - Respond to tweets that don't have a lot of hashtags, links, URLs or images
    - Respond to tweets that are not retweets
    - Respond to tweets where there is an easy exchange of ideas to have with the user
    - ONLY respond with the ID of the tweet`;

            const mostInterestingTweetResponse = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.MEDIUM,
                forceProvider: { provider: ModelProvider.LLAMACLOUD, model: "llama3-8b-8192" }
            });

            const tweetId = mostInterestingTweetResponse.trim();
            const selectedTweet = slicedTweets.find(
                (tweet) =>
                    tweet.id.toString().includes(tweetId) ||
                    tweetId.includes(tweet.id.toString())
            );

            if (!selectedTweet) {
                console.log("No matching tweet found for the selected ID");
                return console.log("Selected tweet ID:", tweetId);
            }

            console.log("Selected tweet to reply to:", selectedTweet?.text);

            if (
                selectedTweet.username ===
                this.runtime.getSetting("TWITTER_USERNAME")
            ) {
                console.log("Skipping tweet from bot itself");
                return;
            }
            if (await this.hasRespondedToTweet(selectedTweet.id)) {
                console.log(`Already responded to tweet ${selectedTweet.id}, skipping`);
                return;
            }
            const conversationId = selectedTweet.conversationId;
            const roomId = stringToUuid(
                conversationId + "-" + this.runtime.agentId
            );

            const userIdUUID = stringToUuid(selectedTweet.userId as string);

            await this.runtime.ensureConnection(
                userIdUUID,
                roomId,
                selectedTweet.username,
                selectedTweet.name,
                "twitter"
            );

            // crawl additional conversation tweets, if there are any
            await buildConversationThread(selectedTweet, this);

            const message = {
                id: stringToUuid(selectedTweet.id + "-" + this.runtime.agentId),
                agentId: this.runtime.agentId,
                content: {
                    text: selectedTweet.text,
                    url: selectedTweet.permanentUrl,
                    inReplyTo: selectedTweet.inReplyToStatusId
                        ? stringToUuid(
                              selectedTweet.inReplyToStatusId +
                                  "-" +
                                  this.runtime.agentId
                          )
                        : undefined,
                },
                userId: userIdUUID,
                roomId,
                // Timestamps are in seconds, but we need them in milliseconds
                createdAt: selectedTweet.timestamp * 1000,
            };

            if (!message.content.text) {
                return { text: "", action: "IGNORE" };
            }

            // Fetch replies and retweets
            const replies = selectedTweet.thread;
            const replyContext = replies
                .filter(
                    (reply) =>
                        reply.username !==
                        this.runtime.getSetting("TWITTER_USERNAME")
                )
                .map((reply) => `@${reply.username}: ${reply.text}`)
                .join("\n");

            let tweetBackground = "";
            if (selectedTweet.isRetweet) {
                const originalTweet = await this.requestQueue.add(() =>
                    this.twitterClient.getTweet(selectedTweet.id)
                );
                tweetBackground = `Retweeting @${originalTweet.username}: ${originalTweet.text}`;
            }

            // Generate image descriptions using GPT-4 vision API
            const imageDescriptions = [];
            for (const photo of selectedTweet.photos) {
                const description =
                    await this.runtime.imageDescriptionService.describeImage(
                        photo.url
                    );
                imageDescriptions.push(description);
            }

            // Get quoted content if it exists
            const quotedContent = await this.getQuotedContent(selectedTweet);

            let state = await this.runtime.composeState(message, {
                twitterClient: this.twitterClient,
                twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
                timeline: formattedHomeTimeline,
                tweetContext: `${tweetBackground}
  
  Original Post:
  By @${selectedTweet.username}
  ${selectedTweet.text}${replyContext.length > 0 && `\nReplies to original post:\n${replyContext}`}
  ${`Original post text: ${selectedTweet.text}`}
  ${selectedTweet.urls.length > 0 ? `URLs: ${selectedTweet.urls.join(", ")}\n` : ""}${imageDescriptions.length > 0 ? `\nImages in Post (Described): ${imageDescriptions.join(", ")}\n` : ""}
  ${quotedContent ? `\ncritical quoted content from the tweet you are responding to:\n${quotedContent}` : ""}
  `,
            });

            await this.saveRequestMessage(message, state as State);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterSearchTemplate ||
                    twitterSearchTemplate,
            });

            const responseContent = await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });

            responseContent.inReplyTo = message.id;

            const response = responseContent;

            if (!response.text) {
                console.log("Returning: No response text found");
                return;
            }

            console.log(
                `Bot would respond to tweet ${selectedTweet.id} with: ${response.text}`
            );
            try {
                const callback: HandlerCallback = async (response: Content) => {
                    const memories = await sendTweet(
                        this,
                        response,
                        message.roomId,
                        this.runtime.getSetting("TWITTER_USERNAME"),
                        tweetId
                    );
                    return memories;
                };

                const responseMessages = await callback(responseContent);

                state = await this.runtime.updateRecentMessageState(state);

                for (const responseMessage of responseMessages) {
                    await this.runtime.messageManager.createMemory(
                        responseMessage,
                        false
                    );
                }

                state = await this.runtime.updateRecentMessageState(state);

                await this.runtime.evaluate(message, state);

                await this.runtime.processActions(
                    message,
                    responseMessages,
                    state,
                    callback
                );

                this.respondedTweets.add(selectedTweet.id);
                const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${selectedTweet.id} - ${selectedTweet.username}: ${selectedTweet.text}\nAgent's Output:\n${response.text}`;
                const debugFileName = `tweetcache/tweet_generation_${selectedTweet.id}.txt`;

                fs.writeFileSync(debugFileName, responseInfo);
                await wait();
            } catch (error) {
                console.error(`Error sending response post: ${error}`);
            }
        } catch (error) {
            console.error("Error engaging with search terms:", error);
        }
    }
}

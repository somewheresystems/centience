import { Tweet } from "agent-twitter-client";
import fs from "fs";
import { composeContext } from "../../core/context.ts";
import { generateText } from "../../core/generation.ts";
import { embeddingZeroVector } from "../../core/memory.ts";
import { IAgentRuntime, ModelClass } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";

const twitterPostTemplate = `{{timeline}}

{{providers}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{postDirections}}

{{recentPosts}}

{{characterPostExamples}}

# Task: Generate a post in the voice and style of {{agentName}}, aka @{{twitterUserName}}
Write a single sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Try to write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;

export class TwitterPostClient extends ClientBase {
    onReady() {
        const generateNewTweetLoop = () => {
            this.generateNewTweet();
            setTimeout(
                generateNewTweetLoop,
                (Math.floor(Math.random() * (20 - 2 + 1)) + 2) * 60 * 1000
            ); // Random interval between 4-8 hours
        };
        // setTimeout(() => {
        generateNewTweetLoop();
        // }, 5 * 60 * 1000); // Wait 5 minutes before starting the loop
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
                }
            );

            console.log("Generating context...");
            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterPostTemplate ||
                    twitterPostTemplate,
            });

            console.log("Generating tweet content...");
            const newTweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            console.log("Processing generated content...");
            const slice = newTweetContent.replaceAll(/\\n/g, "\n").trim();

            const contentLength = 240;

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
                console.log("Content still too long, trimming to previous period");
                content = content.slice(0, content.lastIndexOf("."));
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

                console.log("Creating memory record...");
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(postId + "-" + this.runtime.agentId),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: newTweetContent.trim(),
                        url: tweet.permanentUrl,
                        source: "twitter",
                    },
                    roomId,
                    embedding: embeddingZeroVector,
                    createdAt: tweet.timestamp * 1000,
                });

                console.log("Successfully generated and sent tweet!");
            } catch (error) {
                console.error("Error sending tweet:", error);
                console.error("Error details:", JSON.stringify(error, null, 2));
            }
        } catch (error) {
            console.error("Error in generateNewTweet:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
        }
    }
}

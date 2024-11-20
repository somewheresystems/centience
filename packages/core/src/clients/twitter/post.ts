import { Tweet } from "agent-twitter-client";
import fs from "fs";
import { composeContext } from "../../core/context.ts";
import { generateText } from "../../core/generation.ts";
import { embeddingZeroVector } from "../../core/memory.ts";
import { IAgentRuntime, ModelClass } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";
import path from "path";

const twitterPostTemplate = `{{timeline}}

{{providers}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}


# Task: Generate a post in the voice and style of {{agentName}}
Write a single sentence post or ASCII art that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Try to write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;

export class TwitterPostClient extends ClientBase {
    onReady() {
        const generateNewTweetLoop = () => {
            this.generateNewTweet();
            setTimeout(
                generateNewTweetLoop,
                (Math.floor(Math.random() * (40 - 4 + 1)) + 4) * 60 * 1000
            ); // Random interval between 4-40 minutes
        };
        generateNewTweetLoop();
    }

    constructor(runtime: IAgentRuntime) {
        // Initialize the client and pass an optional callback to be called when the client is ready
        super({
            runtime,
        });
    }

    private async generateNewTweet() {
        console.log("Generating new tweet");
        try {
            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.runtime.getSetting("TWITTER_USERNAME"),
                this.runtime.character.name,
                "twitter"
            );

            let homeTimeline = [];

            if (!fs.existsSync("tweetcache")) fs.mkdirSync("tweetcache");
            // read the file if it exists
            if (fs.existsSync("tweetcache/home_timeline.json")) {
                homeTimeline = JSON.parse(
                    fs.readFileSync("tweetcache/home_timeline.json", "utf-8")
                );
            } else {
                homeTimeline = await this.fetchHomeTimeline(50);
                fs.writeFileSync(
                    "tweetcache/home_timeline.json",
                    JSON.stringify(homeTimeline, null, 2)
                );
            }

            const formattedHomeTimeline =
                `# ${this.runtime.character.name}'s Home Timeline\n\n` +
                homeTimeline
                    .map((tweet) => {
                        return `ID: ${tweet.id}\nFrom: ${tweet.name} (@${tweet.username})${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}\nText: ${tweet.text}\n---\n`;
                    })
                    .join("\n");

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
            // Generate new tweet
            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterPostTemplate ||
                    twitterPostTemplate,
            });

            const newTweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            let content = newTweetContent.replaceAll(/\\n/g, "\n").trim();
            if (content.length > 1000) {
                content = content.slice(0, content.lastIndexOf("\n"));
            }

            let tweet: Tweet;
            const mediaPath = this.runtime.getSetting("TWITTER_MEDIA_PATH");
            
            if (mediaPath && fs.existsSync(mediaPath)) {
                const mediaFiles = fs.readdirSync(mediaPath)
                    .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
                
                if (mediaFiles.length > 0) {
                    // Randomly select a media file
                    const mediaFile = mediaFiles[Math.floor(Math.random() * mediaFiles.length)];
                    const fullPath = path.join(mediaPath, mediaFile);
                    
                    try {
                        const mediaResponse = await this.uploadMedia(fullPath);
                        tweet = await this.sendTweetWithMedia(content, [mediaResponse.media_id_string]);
                    } catch (error) {
                        console.error("Error uploading media:", error);
                        // Fallback to text-only tweet
                        tweet = await this.sendTweetWithoutMedia(content);
                    }
                } else {
                    tweet = await this.sendTweetWithoutMedia(content);
                }
            } else {
                tweet = await this.sendTweetWithoutMedia(content);
            }

            const postId = tweet.id;
            const conversationId =
                tweet.conversationId + "-" + this.runtime.agentId;
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
                    text: newTweetContent.trim(),
                    url: tweet.permanentUrl,
                    source: "twitter",
                },
                roomId,
                embedding: embeddingZeroVector,
                createdAt: tweet.timestamp * 1000,
            });
        } catch (error) {
            console.error("Error generating new tweet:", error);
        }
    }

    private async sendTweetWithoutMedia(content: string): Promise<Tweet> {
        const result = await this.requestQueue.add(() =>
            this.twitterClient.sendTweet(content)
        );
        const body = await result.json();
        const tweetResult = body.data.create_tweet.tweet_results.result;

        return {
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
    }

    public async sendTweet(content: string) {
        console.log("Attempting to send tweet:", content);
        try {
            const result = await this.requestQueue.add(
                async () => await this.twitterClient.sendTweet(content)
            );
            const body = await result.json();
            console.log("Tweet response:", body);
            return result;
        } catch (error) {
            console.error("Failed to send tweet:", error);
            throw error;
        }
    }
}

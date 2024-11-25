import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "../../../core/types";
import { elizaLogger } from "../../../index";
import { generateText } from "../../../core/generation";
import { ModelClass } from "../../../core/types";
import { ClientBase } from "../../../clients/twitter/base";
import { stringToUuid } from "../../../core/uuid";
import { embeddingZeroVector } from "../../../core/memory";
import { generateVideo } from "../../../actions/videoGenerationUtils";
import { generateImage } from "../../../actions/imageGenerationUtils";
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

const MAX_VIDEO_RETRIES = 3;
const VIDEO_RETRY_DELAY = 5000; // 5 seconds
const MAX_TWITTER_RETRIES = 3;
const TWITTER_RETRY_DELAY = 5000;

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for video generation with retries
async function generateVideoWithRetry(
    prompt: string,
    runtime: IAgentRuntime,
    retries = MAX_VIDEO_RETRIES
): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            elizaLogger.log(`Attempting to generate video (attempt ${attempt}/${retries})...`);
            const video = await generateVideo(
                {
                    prompt,
                    duration: 5,
                    resolution: "1080p"
                },
                runtime
            );
            
            if (!video?.url) {
                throw new Error("Video generation failed - no URL returned");
            }
            
            return video;
        } catch (error) {
            elizaLogger.error(`Video generation attempt ${attempt} failed:`, error);
            if (attempt === retries) {
                throw error;
            }
            await delay(VIDEO_RETRY_DELAY);
        }
    }
}

// Add helper function for posting to Twitter with retries
async function postTweetWithMedia(
    client: ClientBase,
    text: string,
    mediaBuffer: Buffer,
    mediaType: 'video/mp4' | 'image/png',
    inReplyTo?: string
) {
    for (let attempt = 1; attempt <= MAX_TWITTER_RETRIES; attempt++) {
        try {
            elizaLogger.log(`Attempting to post tweet with media (attempt ${attempt}/${MAX_TWITTER_RETRIES})...`);
            const result = await client.requestQueue.add(
                async () => await client.twitterClient.sendTweet(
                    text,
                    inReplyTo,
                    [{
                        data: mediaBuffer,
                        mediaType
                    }]
                )
            );
            
            const body = await result.json();
            return body;
        } catch (error) {
            elizaLogger.error(`Tweet posting attempt ${attempt} failed:`, error);
            if (attempt === MAX_TWITTER_RETRIES) {
                // On final attempt, try posting without media as fallback
                elizaLogger.log("Attempting to post without media as fallback...");
                const textOnlyResult = await client.requestQueue.add(
                    async () => await client.twitterClient.sendTweet(
                        text,
                        inReplyTo
                    )
                );
                return await textOnlyResult.json();
            }
            await delay(TWITTER_RETRY_DELAY);
        }
    }
}

export const discordStoryGeneration: Action = {
    name: "GENERATE_STORY",
    similes: ["STORY_GENERATION", "STORY_GEN", "CREATE_STORY", "MAKE_STORY"],
    description: "Generate and post a story to Twitter.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.log("Starting story generation from Discord command");
            
            if (!runtime || !runtime.getSetting) {
                throw new Error("Runtime is not properly initialized");
            }

            let formattedMemories = '';
            try {
                // Get recent memories
                elizaLogger.log("Retrieving recent memories...");
                const rooms = await runtime.databaseAdapter.getRoomsForParticipant(
                    runtime.agentId
                );
                const recentMemories = await runtime.messageManager.getMemoriesByRoomIds({
                    roomIds: rooms,
                    agentId: runtime.agentId,
                });

                formattedMemories = recentMemories
                    .slice(0, 5)
                    .map((memory) => {
                        const text = memory.content.text.length > 280 ? 
                            memory.content.text.slice(0, 280) + '...' : 
                            memory.content.text;
                        return `Memory: ${text}\n`;
                    })
                    .join("\n");

            } catch (memoryError) {
                elizaLogger.error("Error retrieving recent memories:", memoryError);
                throw memoryError;
            }

            const randomPosts = formattedMemories
                .split('\n')
                .sort(() => 0.5 - Math.random())
                .slice(0, 5)
                .join('\n\n');

            // First, generate the opening tweet with video
            const openingContext = `# Task: Generate an opening hook for a story based on the context.
Create a compelling opening line that will grab attention and work well with a video. 

Original message: ${message.content.text}

Requirements:
- Must be under 180 characters
- Must be insanely novel
- No hashtags, but can use unicode symbols
- sounds like fucky funny schizo shit
- Must be relevant to the original message/conversation

Example memories for tone and style:
${randomPosts}

Also, make it sound like a mix of infinite jest, Accelerando, and Nick Land. but with a personal touch.

Opening hook:`;

            const openingTweet = await generateText({
                runtime,
                context: openingContext,
                modelClass: ModelClass.LARGE,
            });

            // Generate video for opening tweet
            elizaLogger.log("Generating video for opening tweet...");
            const video = await generateVideoWithRetry(
                openingTweet,
                runtime
            );

            // Generate middle part with image
            const middleContext = `# Task: Generate the middle part of the story
Create the main body of the story that follows this opening:
${openingTweet}

Original message: ${message.content.text}

Requirements:
- Must be under 180 characters
- Should expand 
- Should include vivid imagery that can be turned into a picture
- No hashtags, but can use unicode symbols
- Must continue the theme from the original message

Middle part:`;

            const middleTweet = await generateText({
                runtime,
                context: middleContext,
                modelClass: ModelClass.LARGE,
            });

            // Generate closing tweet early
            const closingContext = `# Task: Generate the closing part of the CumeTV story
Following these previous parts:
${openingTweet}
${middleTweet}

Original message: ${message.content.text}

Requirements:
- Must be under 180 characters
- Should provide a satisfying conclusion or a complete non-sequitur
- No hashtags, but can use unicode symbols
- Must tie back to the original conversation theme

Closing part:`;

            const closingTweet = await generateText({
                runtime,
                context: closingContext,
                modelClass: ModelClass.LARGE,
            });

            // Generate image for middle tweet
            elizaLogger.log("Generating image for middle tweet...");
            const image = await generateImage(
                {
                    prompt: middleTweet,
                    width: 1024,
                    height: 1024,
                    count: 1,
                },
                runtime
            );

            // Convert base64 image to Buffer
            const imageBuffer = Buffer.from(
                image.data[0].replace(/^data:image\/\w+;base64,/, ""),
                'base64'
            );

            try {
                // Create temp directory if it doesn't exist
                const tempDir = path.join(process.cwd(), 'temp');
                await fs.mkdir(tempDir, { recursive: true });
                
                // Download and save video
                elizaLogger.log("Downloading video...");
                const videoResponse = await fetch(video.url);
                const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
                
                // Save to temp file
                const tempFileName = path.join(tempDir, `${randomUUID()}.mp4`);
                await fs.writeFile(tempFileName, videoBuffer);

                try {
                    // Create a client instance
                    const client = new ClientBase({ runtime });
                    
                    // Post opening tweet with video
                    elizaLogger.log("Posting opening tweet with video...");
                    const openingBody = await postTweetWithMedia(
                        client,
                        openingTweet,
                        videoBuffer,
                        'video/mp4'
                    );
                    
                    const firstTweetId = openingBody.data.create_tweet.tweet_results.result.rest_id;
                    let lastTweetId = firstTweetId;

                    await delay(10000);

                    // Post middle tweet with image
                    elizaLogger.log("Posting middle tweet with image...");
                    const middleBody = await postTweetWithMedia(
                        client,
                        middleTweet,
                        imageBuffer,
                        'image/png',
                        lastTweetId
                    );
                    
                    lastTweetId = middleBody.data.create_tweet.tweet_results.result.rest_id;

                    await delay(10000);

                    // Post closing tweet (text only)
                    elizaLogger.log("Posting closing tweet...");
                    const closingResult = await client.requestQueue.add(
                        async () => await client.twitterClient.sendTweet(
                            closingTweet,
                            lastTweetId
                        )
                    );

                    const tweetUrl = `https://twitter.com/${runtime.getSetting("TWITTER_USERNAME")}/status/${firstTweetId}`;
                    elizaLogger.log("Successfully posted story thread to Twitter:", tweetUrl);

                    // Save the entire story to memory
                    await runtime.messageManager.createMemory({
                        id: stringToUuid(`story-${Date.now()}-${runtime.agentId}`),
                        userId: runtime.agentId,
                        agentId: runtime.agentId,
                        content: {
                            text: [openingTweet, middleTweet, closingTweet].join("\n\n"),
                            url: tweetUrl,
                            source: "twitter_story"
                        },
                        roomId: message.roomId,
                        embedding: embeddingZeroVector,
                        createdAt: Date.now(),
                    });

                    await callback({
                        text: `✨ Story thread posted to Twitter! 🐦\n${tweetUrl}`,
                        action: "GENERATE_STORY"
                    }, []);

                } catch (twitterError) {
                    elizaLogger.error("Error posting to Twitter:", twitterError);
                    // Save story to memory and return success even if Twitter fails
                    await runtime.messageManager.createMemory({
                        id: stringToUuid(`story-${Date.now()}-${runtime.agentId}`),
                        userId: runtime.agentId,
                        agentId: runtime.agentId,
                        content: {
                            text: [openingTweet, middleTweet, closingTweet].join("\n\n"),
                            source: "twitter_story"
                        },
                        roomId: message.roomId,
                        embedding: embeddingZeroVector,
                        createdAt: Date.now(),
                    });

                    await callback({
                        text: "Story generated successfully! (Twitter posting failed)",
                        action: "GENERATE_STORY"
                    }, []);
                }

                // Cleanup temp file
                await fs.unlink(tempFileName).catch(err => 
                    elizaLogger.error("Error cleaning up temp file:", err)
                );

            } catch (fsError) {
                elizaLogger.error("File system error:", fsError);
                await callback({
                    text: "Story generated successfully! (Media handling failed)",
                    action: "GENERATE_STORY"
                }, []);
            }

        } catch (error) {
            elizaLogger.error("Error in story generation:", error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack
                });
            }
            await callback({
                text: "Sorry, there was an error generating the story.",
                action: "GENERATE_STORY"
            }, []);
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "generate story" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Story generated and posted to Twitter successfully!",
                    action: "GENERATE_STORY"
                }
            }
        ]
    ],
};

export default discordStoryGeneration; 
import {
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    Action,
} from "../core/types.ts";
import { elizaLogger } from "../index.ts";
import { generateCaption, generateImage } from "./imageGenerationUtils.ts";
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs/promises';
import fetch from 'node-fetch';

interface ImageGenerationActionConfig {
  ANTHROPIC_API_KEY: string;
  TOGETHER_API_KEY: string;
  TWITTER_API_KEY: string;
  TWITTER_API_SECRET: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
}

export const imageGeneration: Action = {
    name: "GENERATE_IMAGE",
    similes: ["IMAGE_GENERATION", "IMAGE_GEN", "CREATE_IMAGE", "MAKE_PICTURE"],
    description: "Generate an image to go along with the message and optionally post it to Twitter.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // TODO: Abstract this to an image provider thing

        const anthropicApiKeyOk = !!runtime.getSetting("ANTHROPIC_API_KEY");
        const togetherApiKeyOk = !!runtime.getSetting("TOGETHER_API_KEY");
        const twitterKeysOk = !!runtime.getSetting("TWITTER_API_KEY") &&
            !!runtime.getSetting("TWITTER_API_SECRET") &&
            !!runtime.getSetting("TWITTER_ACCESS_TOKEN") &&
            !!runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET");

        // TODO: Add openai DALL-E generation as well

        return anthropicApiKeyOk && togetherApiKeyOk && twitterKeysOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        state = (await runtime.composeState(message)) as State;
        const userId = runtime.agentId;
        elizaLogger.log("User ID:", userId);

        const imagePrompt = message.content.text;
        elizaLogger.log("Image prompt received:", imagePrompt);

        // TODO: Generate a prompt for the image

        const res: { image: string; caption: string }[] = [];

        elizaLogger.log("Generating image with prompt:", imagePrompt);
        const images = await generateImage(
            {
                prompt: imagePrompt,
                width: 1024,
                height: 1024,
                count: 1,
            },
            runtime
        );

        if (images.success && images.data && images.data.length > 0) {
            elizaLogger.log(
                "Image generation successful, number of images:",
                images.data.length
            );

            // Initialize Twitter client
            const client = new TwitterApi({
                appKey: runtime.getSetting("TWITTER_API_KEY"),
                appSecret: runtime.getSetting("TWITTER_API_SECRET"),
                accessToken: runtime.getSetting("TWITTER_ACCESS_TOKEN"),
                accessSecret: runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET"),
            });

            for (let i = 0; i < images.data.length; i++) {
                const image = images.data[i];
                const caption = await generateCaption(
                    { imageUrl: image },
                    runtime
                );

                try {
                    // Convert base64 to buffer
                    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Initialize Twitter client
                    const client = new TwitterApi({
                        appKey: runtime.getSetting("TWITTER_API_KEY"),
                        appSecret: runtime.getSetting("TWITTER_API_SECRET"),
                        accessToken: runtime.getSetting("TWITTER_ACCESS_TOKEN"),
                        accessSecret: runtime.getSetting("TWITTER_ACCESS_TOKEN_SECRET"),
                    });

                    // Create a read-write v2 client
                    const v2Client = client.v2;

                    // Upload media using v1 API (still required for media upload)
                    const mediaId = await client.v1.uploadMedia(image);
                    
                    // Create tweet with media using v2 API
                    const tweet = await v2Client.tweet({
                        text: caption.title,
                        media: {
                            media_ids: [mediaId]
                        }
                    });

                    elizaLogger.log("Successfully posted to Twitter with ID:", tweet.data.id);
                } catch (error) {
                    elizaLogger.error("Failed to post to Twitter:", error);
                }

                callback(
                    {
                        text: caption.description,
                        attachments: [
                            {
                                id: crypto.randomUUID(),
                                url: image,
                                title: "Generated image",
                                source: "imageGeneration",
                                description: caption.title,
                                text: caption.description,
                            },
                        ],
                    },
                    []
                );
            }
        } else {
            elizaLogger.error("Image generation failed or returned no data.");
        }
    },
    examples: [
        // TODO: We want to generate images in more abstract ways, not just when asked to generate an image

        [
            {
                user: "{{user1}}",
                content: { text: "Generate an image of a cat" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an image of a cat",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Generate an image of a dog" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an image of a dog",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Create an image of a cat with a hat" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an image of a cat with a hat",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Make an image of a dog with a hat" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an image of a dog with a hat",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Paint an image of a cat with a hat" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an image of a cat with a hat",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
    ],
} as Action;

import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "../../../core/types";
import { elizaLogger } from "../../../index";
import { generateImage } from "../../../actions/imageGenerationUtils";
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { generateText } from "../../../core/generation.ts";
import { ModelClass } from "../../../core/types";
import { Scraper } from "goat-x";
import { ClientBase } from "../../../clients/twitter/base";

export const discordImageGeneration: Action = {
    name: "GENERATE_IMAGE",
    similes: ["IMAGE_GENERATION", "IMAGE_GEN", "CREATE_IMAGE", "MAKE_PICTURE"],
    description: "Generate an image based on the user's prompt.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const togetherApiKeyOk = !!runtime.getSetting("TOGETHER_API_KEY");
        return togetherApiKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.log("Processing image generation request:", message);
            
            let imagePrompt = message.content.text;
            elizaLogger.log("Original prompt:", imagePrompt);

            try {
                const context = `# Task: Enhance the image generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image. The goal is also to make sure that it fits into a theme that is consistent with Centience, using the following tags:
- IMAX
- filmic
- cinematic
- 8K
- 4K
- 1080p
- 720p  
- photorealistic
- hyper-realistic
- hyper-detailed
- filmic
- cinematic

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: ${message.content.text}

Enhanced prompt:`;

                elizaLogger.log("Sending context to generate text:", context);
                
                const promptResponse = await generateText({
                    runtime,
                    context,
                    modelClass: ModelClass.LARGE,
                });

                if (promptResponse?.trim()) {
                    imagePrompt = promptResponse.trim();
                    elizaLogger.log("Successfully enhanced prompt to:", imagePrompt);
                } else {
                    elizaLogger.log("Using original prompt due to empty enhancement response");
                }
            } catch (promptError) {
                elizaLogger.error("Prompt enhancement failed, using original prompt:", promptError);
            }

            // Clean the prompt of any Discord mentions
            const cleanPrompt = imagePrompt.replace(/<@[^>]+>/g, '').trim();
            elizaLogger.log("Final cleaned prompt:", cleanPrompt);

            const images = await generateImage(
                {
                    prompt: cleanPrompt,
                    width: 1024,
                    height: 1024,
                    count: 1,
                },
                runtime
            );
            elizaLogger.log("Generate image response:", images);

            if (images.success && images.data && images.data.length > 0) {
                elizaLogger.log("Image generation successful");
                
                try {
                    // Create temp directory if it doesn't exist
                    const tempDir = path.join(process.cwd(), 'temp');
                    await fs.mkdir(tempDir, { recursive: true });
                    
                    // Convert base64 to Buffer
                    const imageBuffer = Buffer.from(
                        images.data[0].replace(/^data:image\/\w+;base64,/, ""),
                        'base64'
                    );

                    // Save to temp file
                    const tempFileName = path.join(tempDir, `${randomUUID()}.png`);
                    await fs.writeFile(tempFileName, imageBuffer);

                    // Send to Discord
                    await callback(
                        {
                            text: `Prompt Used: "${imagePrompt}"`,
                            files: [{
                                attachment: tempFileName,
                                name: 'generated_image.png'
                            }]
                        },
                        [tempFileName]
                    );

                
                        try {
                            const tweetContext = `# Task: Generate a post in the voice and style of ${runtime.character.name}
Write a single sentence about the following image (without directly describing it), from your perspective. Be creative and engaging. No emojis.

Image description: ${imagePrompt}

Your response should be brief and concise. Do not add commentary, just write the tweet.`;

                            elizaLogger.log("Generating tweet text for image...");
                            const tweetText = await generateText({
                                runtime,
                                context: tweetContext,
                                modelClass: ModelClass.MEDIUM,
                            });

                            const finalTweetText = tweetText.trim().slice(0, 240); // Ensure tweet length
                            
                            elizaLogger.log("Attempting to post to Twitter with text:", finalTweetText);

                            // Create a client instance
                            const client = new ClientBase({ runtime });
                            const result = await client.requestQueue.add(
                                async () => await client.twitterClient.sendTweet(
                                    finalTweetText,
                                    undefined,
                                    [{
                                        data: imageBuffer,
                                        mediaType: 'image/png'
                                    }]
                                )
                            );

                            const body = await result.json();
                            const tweetResult = body.data.create_tweet.tweet_results.result;

                            elizaLogger.log("Successfully posted image to Twitter:", tweetResult);

                            await callback({
                                text: `Image has been generated and shared on Twitter! 🐦\nhttps://twitter.com/${runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`,
                                files: [{
                                    attachment: tempFileName,
                                    name: 'generated_image.png'
                                }]
                            }, [tempFileName]);

                        } catch (twitterError) {
                            elizaLogger.error("Error posting to Twitter:", twitterError);
                            // Continue with Discord post even if Twitter fails
                        }

                    // Cleanup temp file
                    await fs.unlink(tempFileName).catch(err => 
                        elizaLogger.error("Error cleaning up temp file:", err)
                    );
                } catch (fsError) {
                    elizaLogger.error("File system error:", fsError);
                    throw fsError;
                }
            } else {
                elizaLogger.error("Image generation failed");
                await callback(
                    {
                        text: "Sorry, I couldn't generate the image at this time.",
                    },
                    []
                );
            }
        } catch (error) {
            elizaLogger.error("Error in image generation:", error);
            await callback(
                {
                    text: "Sorry, there was an error generating the image.",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Generate an image of a sunset over mountains" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's your generated image of a sunset over mountains",
                    action: "GENERATE_IMAGE",
                },
            },
        ],
    ],
};

export default discordImageGeneration;
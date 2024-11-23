import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    ActionExample,
} from "../../../../core/types";
import { elizaLogger } from "../../../../index";
import { generateImage } from "../../../../actions/imageGenerationUtils";
import { generateText } from "../../../../core/generation";
import { ModelClass } from "../../../../core/types";
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import ImageDescriptionService from "../../../../services/image";

const QUALITY_CHECK_PROMPT = `# Task: Evaluate Image Quality

Analyze this image and determine if it meets high quality standards for social media sharing.

Consider:
- Overall composition and aesthetics
- Clarity and sharpness
- Artistic value
- Appropriate content
- Visual appeal

Respond only with "SHARE" or "SKIP" based on if the image meets these criteria.`;

const SHOULD_GENERATE_PROMPT = `# Task: Determine if image generation is appropriate

Analyze the user's message and decide if generating an image would be helpful or necessary.

Consider:
- Is the user explicitly requesting an image?
- Would an image enhance the response significantly?
- Is the topic something that can be meaningfully visualized?

Respond only with "GENERATE" or "SKIP" followed by a suggested text response.
Format: <GENERATE|SKIP>||<response text>

Example 1:
User: "Can you make me a picture of a sunset?"
Response:
`;

const postToTwitter = async (runtime: IAgentRuntime, imagePath: string, promptText: string) => {
    try {
        const { ClientBase } = await import('../../../../clients/twitter/base');
        const client = new ClientBase({ runtime });
        const imageBuffer = await fs.readFile(imagePath);
        
        const result = await client.requestQueue.add(
            async () => await client.twitterClient.sendTweet(
                promptText.trim(),
                undefined,
                [{
                    data: imageBuffer,
                    mediaType: 'image/png'
                }]
            )
        );

        const body = await result.json();
        const tweetResult = body.data?.create_tweet?.tweet_results?.result;
        elizaLogger.log("Successfully shared image on Twitter:", tweetResult);
    } catch (twitterError) {
        elizaLogger.error("Error sharing on Twitter:", twitterError);
    }
};

export const telegramImageGeneration: Action = {
    name: "GENERATE_IMAGE",
    similes: ["IMAGE_GENERATION", "IMAGE_GEN", "CREATE_IMAGE", "MAKE_PICTURE"],
    description: "Generate an image based on the user's prompt.",
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "generate an image of a sunset" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Generating image of a sunset...",
                    action: "GENERATE_IMAGE",
                    actionData: { prompt: "sunset" }
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "please generate an image" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll help you generate an image. What would you like me to create?",
                    action: "GENERATE_IMAGE",
                    actionData: { prompt: "creative" }
                }
            }
        ]
    ] as ActionExample[][],
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
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image.

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: ${message.content.text}`;

                const promptResponse = await generateText({
                    runtime,
                    context,
                    modelClass: ModelClass.LARGE,
                });

                if (promptResponse) {
                    elizaLogger.log("Enhanced prompt:", promptResponse);

                    const image = await generateImage(
                        {
                            prompt: promptResponse,
                            width: 1024,
                            height: 1024,
                            count: 1
                        },
                        runtime
                    );

                    if (image && image.data?.[0]) {
                        elizaLogger.log("Image generated successfully");

                        const imagePath = path.join(
                            process.cwd(),
                            `images/${randomUUID()}.png`
                        );

                        await fs.writeFile(imagePath, image.data[0]);

                        elizaLogger.log("Image saved to:", imagePath);

                        // Quality check using vision model
                        const imageService = ImageDescriptionService.getInstance(runtime);
                        const qualityCheck = await imageService.describeImage(imagePath);
                        
                        const shouldShare = await generateText({
                            runtime,
                            context: `${QUALITY_CHECK_PROMPT}\n\nImage Analysis:\n${qualityCheck.description}\n\nDecision:`,
                            modelClass: ModelClass.MEDIUM,
                        });

                        if (shouldShare?.trim().toUpperCase() === 'SHARE') {
                            elizaLogger.log("Image passed quality check, sharing on Twitter");
                            
                            await postToTwitter(runtime, imagePath, promptResponse);
                        } else {
                            elizaLogger.log("Image did not pass quality check, skipping Twitter share");
                        }

                        callback(null, {
                            content: {
                                text: `Image generated successfully. Check your images folder for the generated image.`,
                            },
                        });
                    } else {
                        elizaLogger.error("Failed to generate image");
                        callback(null, {
                            content: {
                                text: "Failed to generate image",
                            },
                        });
                    }
                } else {
                    elizaLogger.error("Failed to generate prompt");
                    callback(null, {
                        content: {
                            text: "Failed to generate prompt",
                        },
                    });
                }
            } catch (error) {
                elizaLogger.error("Error generating prompt:", error);
                callback(error);
            }
        } catch (error) {
            elizaLogger.error("Error processing image generation request:", error);
            callback(error);
        }
    },
}; 
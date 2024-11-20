import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "../../../core/types";
import { elizaLogger } from "../../../index";
import { generateVideo } from "../../../actions/videoGenerationUtils";
import { generateText } from "../../../core/generation";
import { ModelClass } from "../../../core/types";
import { randomUUID } from 'crypto';
import { TwitterPostClient } from "../../../clients/twitter/post";

export const discordVideoGeneration: Action = {
    name: "GENERATE_VIDEO",
    similes: ["VIDEO_GENERATION", "VIDEO_GEN", "CREATE_VIDEO", "MAKE_VIDEO"],
    description: "Generate a video based on the user's prompt.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const lumaApiKeyOk = !!runtime.getSetting("LUMA_API_KEY");
        return lumaApiKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.log("Processing video generation request:", message);
            
            let videoPrompt = message.content.text;
            elizaLogger.log("Original prompt:", videoPrompt);

            try {
                const context = `# Task: Enhance the video generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible AI video.

# Instructions
- Focus on motion, camera angles, lighting, and composition
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
                    videoPrompt = promptResponse.trim();
                    elizaLogger.log("Successfully enhanced prompt to:", videoPrompt);
                } else {
                    elizaLogger.log("Using original prompt due to empty enhancement response");
                }
            } catch (promptError) {
                elizaLogger.error("Prompt enhancement failed, using original prompt:", promptError);
            }

            // Clean the prompt of any Discord mentions
            const cleanPrompt = videoPrompt.replace(/<@[^>]+>/g, '').trim();
            elizaLogger.log("Final cleaned prompt:", cleanPrompt);

            // Add more detailed logging here
            elizaLogger.log("Checking LUMA_API_KEY availability...");
            const lumaApiKey = runtime.getSetting("LUMA_API_KEY");
            if (!lumaApiKey) {
                elizaLogger.error("LUMA_API_KEY is not set in runtime settings");
                await callback({
                    text: "Sorry, video generation is not properly configured.",
                }, []);
                return;
            }

            elizaLogger.log("Starting video generation...");
            const video = await generateVideo(
                {
                    prompt: cleanPrompt,
                    duration: 5,
                    resolution: "1080p"
                },
                runtime
            );
            elizaLogger.log("Video generation response received:", video);

            if (video.success && video.url) {
                elizaLogger.log("Video generation successful, URL:", video.url);
                
                // Post to Twitter if configured
                try {
                    const twitterClient = new TwitterPostClient(runtime);
                    const tweetContent = `✨ Generated video: ${cleanPrompt}\n\n${video.url}`;
                    elizaLogger.log("Attempting to post to Twitter:", tweetContent);
                    
                    await twitterClient.sendTweet(tweetContent);
                    elizaLogger.log("Successfully posted video to Twitter");
                } catch (twitterError) {
                    elizaLogger.error("Failed to post to Twitter:", twitterError);
                }

                await callback(
                    {
                        text: `\`${cleanPrompt}\`\n\n${video.url}`,
                        action: "GENERATE_VIDEO"
                    },
                    []
                );
                
                elizaLogger.log("Discord response sent successfully");
            } else {
                elizaLogger.error("Video generation failed with response:", video);
                await callback(
                    {
                        text: "Sorry, I couldn't generate the video at this time. Please try again.",
                        action: "GENERATE_VIDEO"
                    },
                    []
                );
            }
        } catch (error) {
            elizaLogger.error("Error in video generation:", error);
            if (error instanceof Error) {
                elizaLogger.error("Error details:", {
                    message: error.message,
                    stack: error.stack
                });
            }
            await callback(
                {
                    text: "Sorry, there was an error generating the video.",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Generate a video of a spinning galaxy" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's your generated video of a spinning galaxy",
                    action: "GENERATE_VIDEO",
                },
            },
        ],
    ],
};

export default discordVideoGeneration;

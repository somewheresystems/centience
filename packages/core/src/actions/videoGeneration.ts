import { Action, ActionExample, Content, HandlerCallback, IAgentRuntime, Memory, State } from "../core/types.ts";
import { generateVideo } from "../actions/videoGenerationUtils.ts";
import { sendTweetChunks } from "../clients/twitter/utils.ts";
import { prettyConsole } from "../index.ts";

export const VIDEO_GENERATION: Action = {
    name: "GENERATE_VIDEO",
    similes: ["VIDEO_GENERATION", "VIDEO_GEN", "CREATE_VIDEO", "MAKE_VIDEO"],
    description: "Generate a 3D video using Luma Labs API.",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        return !!runtime.getSetting("LUMA_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<Content | void> => {
        try {
            state = (await runtime.composeState(message)) as State;
            const userId = runtime.agentId;
            prettyConsole.log("User ID:", userId);

            const videoPrompt = message.content.text;
            prettyConsole.log("Video prompt received:", videoPrompt);

            prettyConsole.log("Generating video with prompt:", videoPrompt);
            const video = await generateVideo({
                prompt: videoPrompt,
                duration: 10,
                resolution: "1080p"
            }, runtime);

            if (video.success && video.url) {
                prettyConsole.log("Video generation successful:", video.url);
                const response: Content = {
                    text: message.content.text,
                    attachments: [{
                        id: crypto.randomUUID(),
                        url: video.url,
                        title: "Generated video",
                        source: "videoGeneration",
                        description: "",
                        text: ""
                    }],
                    action: "GENERATE_VIDEO"
                };

                if (message.content.source === "twitter") {
                    await sendTweetChunks(
                        runtime.getClient("twitter"),
                        response,
                        message.roomId,
                        runtime.getSetting("TWITTER_USERNAME"),
                        message.content.inReplyTo
                    );
                    return response;
                }

                await callback(response, []);
                return response;
            } else {
                prettyConsole.error("Video generation failed or returned no data.");
                await callback({
                    text: "Sorry, I couldn't generate the video at this time.",
                    action: "GENERATE_VIDEO"
                }, []);
                return;
            }
        } catch (error) {
            prettyConsole.error("An error occurred while generating the video:", error);
            await callback({
                text: "Sorry, I couldn't generate the video at this time.",
                action: "GENERATE_VIDEO"
            }, []);
            return;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Generate a 3D video of a spinning galaxy" }
            },
            {
                user: "{{agentName}}",
                content: { 
                    text: "Here's a 3D video of a spinning galaxy",
                    action: "GENERATE_VIDEO"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Create a video of a rotating planet" }
            },
            {
                user: "{{agentName}}",
                content: { 
                    text: "Here's a video of a rotating planet",
                    action: "GENERATE_VIDEO"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Make a 3D animation of a floating crystal" }
            },
            {
                user: "{{agentName}}",
                content: { 
                    text: "Here's a 3D animation of a floating crystal",
                    action: "GENERATE_VIDEO"
                }
            }
        ]
    ]
} as Action;
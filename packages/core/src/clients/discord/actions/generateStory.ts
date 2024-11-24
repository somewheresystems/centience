import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
} from "../../../core/types";
import { elizaLogger } from "../../../index";
import { StorytellingClient } from "../../twitter/storytelling";

export const discordStoryGeneration: Action = {
    name: "GENERATE_STORY",
    similes: ["STORY_GENERATION", "STORY_GEN", "CREATE_STORY", "MAKE_STORY"],
    description: "Generate and post a story to Twitter.",
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
            
            // Create a storytelling client instance
            const storyClient = new StorytellingClient({ runtime });
            
            // Generate and post the story
            await storyClient.generateStoryPost();

            return {
                success: true,
                message: "Story generated and posted to Twitter successfully!"
            };
        } catch (error) {
            elizaLogger.error("Error generating story:", error);
            return {
                success: false,
                message: "Failed to generate and post story: " + error.message
            };
        }
    }
}; 
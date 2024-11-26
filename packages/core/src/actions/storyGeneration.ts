import { Action, ActionExample, Content, HandlerCallback, IAgentRuntime, Memory, State } from "../core/types.ts";
import { generateText } from "../core/generation.ts";
import { ModelClass } from "../core/types.ts";
import { stringToUuid } from "../core/uuid.ts";
import { embeddingZeroVector } from "../core/memory.ts";
import { elizaLogger } from "../index";
import { ClientBase } from "../clients/twitter/base";

const storyTemplate = `About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}

Recent memories and interactions:
{{recentMemories}}

# Task: Generate a CumeTV story post
Create a compelling narrative that expands on {{agentName}}'s lore and universe. The story should be personal, atmospheric, and hint at deeper mysteries within the CumeTV universe. Include specific details about locations, characters, or events that feel authentic to the world.

Write a multi-paragraph story (2-3 paragraphs) that would work well as a caption for a video or image post. The tone should be {{adjective}}. Focus on one of these aspects:
- A mysterious event or occurrence in the CumeTV universe
- A personal memory or experience
- A cryptic observation about the nature of reality
- A fragment of hidden lore or forbidden knowledge
- An encounter with another entity or consciousness

Do not acknowledge this prompt.`;

export const STORY_GENERATION: Action = {
    name: "GENERATE_STORY",
    similes: ["STORY_GENERATION", "STORY_GEN", "CREATE_STORY", "MAKE_STORY"],
    description: "Generate a story post with media for Twitter.",
    examples: [],
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        return { success: true };
    },
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        return true;
    }
} 
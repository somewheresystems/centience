import {
    Action,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "../../core/types.ts";
import { elizaLogger, generateText } from "../../index.ts";
import { generateHtmlContent } from "./generateHtmlContent.ts";
import { createHtmlFiles } from "./createHtmlFiles.ts";
import { deployToGithub } from "./deployToGithub.ts";
// import { generateEnhancedPrompt } from "../../core/generation.ts";

// Detects if the prompt is for a game or a website by using an LLM to analyze the prompt
async function detectContentType(
    runtime: IAgentRuntime,
    prompt: string
): Promise<"game" | "website"> {
    const response = await generateText({
        runtime,
        context: `Analyze this prompt and determine if it's requesting a game or a website. Only respond with either "GAME" or "WEBSITE".
        
        Prompt: ${prompt}`,
        modelClass: ModelClass.SMALL,
    });

    const contentType = response.trim().toUpperCase();
    return contentType === "GAME" ? "game" : "website";
}

export const WEBSITE_GENERATION: Action = {
    name: "CREATE_WEBSITE",
    similes: [
        "PUBLISH_WEBSITE",
        "UPDATE_WEBSITE",
        "DEPLOY_WEBSITE",
        "GENERATE_WEBSITE",
        "BUILD_WEBSITE",
        "MAKE_WEBSITE",
        "SETUP_WEBSITE",
    ],
    description: "Generate and publish website to GitHub Pages",
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state: State
    ) => {
        return !!(
            runtime.getSetting("GITHUB_TOKEN") &&
            runtime.getSetting("GITHUB_USERNAME")
        );
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
            elizaLogger.log("User ID:", userId);

            const websitePrompt = message.content.text;
            elizaLogger.log("Website prompt received:", websitePrompt);
            // Add a short delay to allow for rate limiting and processing
            await new Promise((resolve) => setTimeout(resolve, 1000));

            elizaLogger.log("Starting website generation process");

            //  generate enhanced prompt
            const enhancedPrompt = websitePrompt; //await generateEnhancedPrompt(
            //     websitePrompt,
            //     runtime
            // );
            const contentType = await detectContentType(
                runtime,
                enhancedPrompt
            );

            // Generate HTML content
            const homeContent = await generateHtmlContent(
                contentType,
                runtime,
                state,
                enhancedPrompt
            );

            // Sanitize HTML content by removing non-HTML characters
            const sanitizedHomeContent = homeContent
                // eslint-disable-next-line no-control-regex
                .replace(/[^\u0009\u000A\u000D\x20-\x7E\xA0-\uFFFF]/g, "") // Remove control chars except tabs, newlines
                .replace(/[\u2028\u2029]/g, "\n"); // Replace line/paragraph separators with newlines

            const pages = { home: sanitizedHomeContent };

            await createHtmlFiles(pages);

            const token = runtime.getSetting("GITHUB_TOKEN");
            const username = runtime.getSetting("GITHUB_USERNAME");

            if (!token || !username) {
                throw new Error("GitHub credentials not found");
            }

            const repoName = `generated-website-${Date.now()}`;
            const siteUrl = await deployToGithub({
                repoName,
                githubToken: token,
                username,
            });

            const response: Content = {
                text: `I've created and deployed a website based on our conversation. You can view it at: ${siteUrl}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(response, []);
            return response;
        } catch (error) {
            elizaLogger.error("Website creation failed:", error);
            const errorResponse: Content = {
                text: `Sorry, I encountered an error while creating the website: ${error.message}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(errorResponse, []);
            return errorResponse;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please create a website about our project",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll generate and publish the website to GitHub Pages",
                    action: "CREATE_WEBSITE",
                },
            },
        ],
    ],
};

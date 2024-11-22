import {
    Action,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "../../core/types.ts";
import {
    elizaLogger,
    generateEnhancedPrompt,
    generateText,
} from "../../index.ts";
import { generateHtmlContent } from "./generateHtmlContent.ts";
import { createHtmlFiles } from "./createHtmlFiles.ts";
import { deployToGithub } from "./deployToGithub.ts";
import { booleanFooter } from "../../core/parsing.ts";
import { composeContext } from "../../core/context.ts";
import { fixHtml } from "./fixHtml.ts";

export const shouldCreateWebsiteTemplate = `Based on the conversation so far:

{{recentMessages}}

Should {{agentName}} create a website or game for this request?
Respond with YES if one of the following is true:
- The user has explicitly requested a website or game to be created
- The user has provided clear requirements or content for a website or game
- The user is discussing a project or topic that would benefit from a website or game
- Creating a website or game would be valuable and appropriate for the user's needs

Respond with NO if:
- The user hasn't mentioned anything about websites or web content
- The request is better suited for a different format (like a document or image)
- The conversation is not related to content that should be published online
- The user has indicated they don't want a website or game

Consider these factors:
- Is there enough content/context to create a meaningful website or game?
- Would a website or game be the most appropriate format for this content?
- Has the user expressed interest in having an online presence? 
- Would a website or game help achieve the user's goals?

${booleanFooter}`;

// Detects if the prompt is for a game or a website by using an LLM to analyze the prompt
async function detectContentType(
    runtime: IAgentRuntime,
    prompt: string
): Promise<"game" | "website"> {
    const response = await generateText({
        runtime,
        context: `Analyze this prompt and determine if it's requesting a game or a website. Only respond with either "GAME" or "WEBSITE".
        
        Prompt: ${prompt}`,
        modelClass: ModelClass.MEDIUM,
    });

    const contentType = response.trim().toUpperCase();
    return contentType === "GAME" ? "game" : "website";
}

export const WEBSITE_CORRECTION: Action = {
    name: "FIX_WEBSITE",
    similes: ["CORRECT_WEBSITE", "UPDATE_WEBSITE", "MODIFY_WEBSITE"],
    description: "Fix and update website HTML content",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        const hasEnvVars = !!(
            process.env.GITHUB_TOKEN && process.env.GITHUB_USERNAME
        );
        return hasEnvVars;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<Content | void> => {
        try {
            const token = runtime.getSetting("GITHUB_TOKEN");
            const username = runtime.getSetting("GITHUB_USERNAME");

            if (!token || !username) {
                throw new Error("GitHub credentials not found");
            }

            const corrections = message.content.text;

            // Extract repo URL using regex - handle both github.com and github.io URLs
            const githubComMatch = message.content.text.match(
                /https:\/\/github\.com\/[\w-]+\/[\w-]+/
            );
            const githubIoMatch = message.content.text.match(
                /https:\/\/([\w-]+)\.github\.io\/([\w-]+)/
            );

            let repoUrl;
            if (githubComMatch) {
                repoUrl = githubComMatch[0];
            } else if (githubIoMatch) {
                // Convert github.io URL to github.com repo URL
                const [_, owner, repo] = githubIoMatch;
                repoUrl = `https://github.com/${owner}/${repo}`;
            } else {
                throw new Error(
                    "No GitHub repository or pages URL found in message"
                );
            }
            const filePath = "index.html"; // Default to index.html
            console.log("Fixing HTML for repo:", repoUrl);
            await fixHtml({
                runtime,
                repoUrl,
                filePath,
                githubToken: token,
                username,
                corrections,
            });

            const response: Content = {
                text: "Website HTML has been corrected and updated successfully.",
                action: "FIX_WEBSITE",
                source: message.content.source,
            };

            await callback(response, []);
            return response;
        } catch (error) {
            elizaLogger.error("Website correction failed:", error);
            const errorResponse: Content = {
                text: `Sorry, I encountered an error while correcting the website: ${error.message}`,
                action: "FIX_WEBSITE",
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
                    text: "Please fix the HTML on my website",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll correct and update the website HTML",
                    action: "FIX_WEBSITE",
                },
            },
        ],
    ],
};

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
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        elizaLogger.log("Validating CREATE_WEBSITE action");

        // First check environment variables
        const hasEnvVars = !!(
            process.env.OPENAI_API_KEY &&
            process.env.GITHUB_TOKEN &&
            process.env.GITHUB_USERNAME
        );

        if (!hasEnvVars) {
            elizaLogger.log("Missing required environment variables");
            return false;
        }

        // Update state with recent messages
        state = await runtime.updateRecentMessageState(state);

        // Use the template to determine if we should create a website
        try {
            const context = composeContext({
                state,
                template: shouldCreateWebsiteTemplate,
            });
            console.log("Composed context:", context);

            const shouldCreateResponse = await generateText({
                runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });
            console.log("Should create response:", shouldCreateResponse);

            const shouldCreate = shouldCreateResponse
                .trim()
                .toUpperCase()
                .includes("YES");
            elizaLogger.log(`Should create website? ${shouldCreate}`);

            return shouldCreate;
        } catch (error) {
            elizaLogger.error("Error in website validation:", error);
            return false;
        }
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
            const enhancedPrompt = await generateEnhancedPrompt({
                runtime,
                context: websitePrompt,
                modelClass: ModelClass.MEDIUM,
            });
            console.log("Enhanced prompt:", enhancedPrompt);
            const contentType = await detectContentType(runtime, websitePrompt);

            // Generate HTML content
            const homeContent = await generateHtmlContent(
                contentType,
                runtime,
                state,
                websitePrompt
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

            // Send deploying message
            const deployingResponse: Content = {
                text: "Website is being deployed to GitHub Pages. This will take a few minutes...",
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };
            await callback(deployingResponse, []);

            const siteUrl = await deployToGithub({
                repoName,
                githubToken: token,
                username,
            });

            // Add delay to allow deployment to complete
            await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000)); // 2 minute delay

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

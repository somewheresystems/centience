import { Action, IAgentRuntime, Memory, ModelClass, HandlerCallback } from "../../../core/types";
import { execSync } from "child_process";
import { booleanFooter } from "../../../core/parsing";
import fs from "node:fs";
import path from "node:path";
import { composeContext } from "../../../core/context";
import { State } from "../../../core/types";
import { elizaLogger } from "../../../index.ts";
import { generateText } from "../../../core/generation.ts";
import { parseHtmlFromText } from "../../../core/parsing";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shouldCreateWebsiteTemplate = `Based on the conversation so far:

{{recentMessages}}

Should {{agentName}} create a website for this request?
Respond with YES if one of the following is true:
- The user has explicitly requested a website to be created
- The user has provided clear requirements or content for the website
- Creating a website would be valuable and appropriate for the user's needs

Otherwise, respond with NO.
${booleanFooter}`;

async function generateHtmlContent(
    title: string,
    runtime: IAgentRuntime,
    state: State
): Promise<string> {
    elizaLogger.log(`Generating HTML content for page: ${title}`);
    const htmlContent = await generateText({
        runtime,
        context: composeContext({
            state,
            template: `
                Based on this conversation context:
                {{recentMessages}}

                Generate clean, valid HTML content for a ${title.toLowerCase()} page that is relevant to the conversation above.
                The content should be a single HTML fragment (no doctype/html/head/body tags).
                Include semantic headings, paragraphs, and lists.
                Use Tailwind CSS classes for styling.
                Example format:
                <main class="container mx-auto px-4 py-8">
                    <h1 class="text-4xl font-bold mb-6">Welcome</h1>
                    <p class="text-gray-700 mb-4">Main introduction text here.</p>
                    <section>
                        <h2 class="text-2xl font-semibold mb-4">Key Features</h2>
                        <ul class="list-disc pl-5 space-y-2">
                            <li class="text-gray-700">Feature one</li>
                            <li class="text-gray-700">Feature two</li>
                        </ul>
                    </section>
                </main>
            `,
        }),
        modelClass: ModelClass.SMALL,
    });

    elizaLogger.log(`Generated raw HTML content for ${title}:`, htmlContent);

    // Sanitize HTML content by removing any emojis
    const sanitizedHtml = htmlContent.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");

    const parsedHtml = parseHtmlFromText(sanitizedHtml);
    if (!parsedHtml) {
        elizaLogger.error(`Failed to parse HTML content for ${title}`);
        throw new Error("Failed to generate valid HTML content");
    }
    elizaLogger.log(
        `Successfully parsed HTML content for ${title}`,
        parsedHtml
    );
    return parsedHtml;
}

async function createHtmlFiles(pages: { [key: string]: string }) {
    elizaLogger.log("Starting HTML file creation");

    try {
        if (!pages || !pages.home) {
            elizaLogger.error("Missing required home page content");
            throw new Error("Home page content is required");
        }

        const websiteDir = path.join(__dirname, "website");
        elizaLogger.log(`Website directory path: ${websiteDir}`);

        if (!fs.existsSync(websiteDir)) {
            elizaLogger.log("Creating website directory");
            fs.mkdirSync(websiteDir, { recursive: true });
        }

        const generatePage = async (
            title: string,
            filename: string,
            content: string
        ) => {
            if (!title || !filename || !content) {
                throw new Error(
                    `Missing required parameters for page generation: ${filename}`
                );
            }

            elizaLogger.log(`Generating page: ${title} (${filename})`);
            const filePath = path.join(websiteDir, filename);

            try {
                fs.writeFileSync(
                    filePath,
                    `<!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>${title}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                    </head>
                    <body class="bg-white">
                        ${content}
                    </body>
                    </html>`
                );
                elizaLogger.log(`Successfully created ${filename}`);
            } catch (writeError) {
                elizaLogger.error(
                    `Failed to write file ${filename}:`,
                    writeError
                );
                throw new Error(
                    `Failed to write ${filename}: ${writeError.message} (Code: ${writeError.code}, Stack: ${writeError.stack})`
                );
            }
        };

        elizaLogger.log("Creating index.html");
        await generatePage("Home", "index.html", pages.home);

        if (pages.about) {
            elizaLogger.log("Creating about.html");
            await generatePage("About", "about.html", pages.about);
        }
    } catch (error) {
        elizaLogger.error("Failed to create HTML files:", error);
        if (error.code === "EACCES") {
            throw new Error(
                `Permission denied when creating website files: ${error.message} (Code: ${error.code}, Stack: ${error.stack})`
            );
        } else if (error.code === "ENOSPC") {
            throw new Error(
                `Not enough disk space to create website files: ${error.message} (Code: ${error.code}, Stack: ${error.stack})`
            );
        } else {
            throw new Error(
                `Failed to create HTML files: ${error.message} (Stack: ${error.stack})`
            );
        }
    }
}

function createCssFile() {
    // No longer needed since we're using Tailwind CSS via CDN
    elizaLogger.log("Skipping CSS file creation - using Tailwind CSS");
}

async function deployToGithub(
    repoName: string,
    githubToken: string,
    username: string
) {
    elizaLogger.log(`Starting GitHub deployment for repo: ${repoName}`);
    const websiteDir = path.join(__dirname, "website");
    const headers = {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
    };

    try {
        elizaLogger.log("Creating GitHub repository");
        const createRepoResponse = await fetch(
            "https://api.github.com/user/repos",
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    name: repoName,
                    auto_init: true,
                    private: false,
                }),
            }
        );

        if (!createRepoResponse.ok) {
            const responseText = await createRepoResponse.text();
            throw new Error(
                `Failed to create repository: ${createRepoResponse.status} - ${responseText}`
            );
        }

        // Wait a moment for GitHub to initialize the repo
        await new Promise((resolve) => setTimeout(resolve, 2000));

        elizaLogger.log("Initializing Git repository");
        const gitCommands = [
            "rm -rf .git", // Remove any existing git repo
            "git init",
            "git add .",
            'git commit -m "Initial commit"',
            `git remote add origin https://${username}:${githubToken}@github.com/${username}/${repoName}.git`,
            "git fetch origin",
            "git reset --soft origin/main",
            "git add .",
            'git commit -m "Initial website files"',
            "git branch -M main",
            "git push -f origin main", // Force push since we've properly set up the history
        ];

        gitCommands.forEach((cmd) => {
            try {
                elizaLogger.log(
                    `Executing git command: ${cmd.replace(githubToken, "***")}`
                );
                execSync(cmd, { cwd: websiteDir });
            } catch (gitError) {
                throw new Error(
                    `Git command failed: ${cmd.replace(githubToken, "***")}\nError: ${gitError.message}\nStack: ${gitError.stack}`
                );
            }
        });

        elizaLogger.log("Enabling GitHub Pages");
        const enablePagesResponse = await fetch(
            `https://api.github.com/repos/${username}/${repoName}/pages`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ source: { branch: "main", path: "/" } }),
            }
        );

        if (!enablePagesResponse.ok) {
            const responseText = await enablePagesResponse.text();
            throw new Error(
                `Failed to enable GitHub Pages: ${enablePagesResponse.status} - ${responseText}`
            );
        }

        const siteUrl = `https://${username}.github.io/${repoName}`;
        elizaLogger.log(`Deployment successful. Site URL: ${siteUrl}`);
        return siteUrl;
    } catch (error) {
        elizaLogger.error("Deployment failed:", error);
        throw new Error(
            `Deployment failed: ${error.message} (Stack: ${error.stack})`
        );
    }
}

const createWebsite: Action = {
    name: "CREATE_WEBSITE",
    description: "Generate and publish website to GitHub Pages",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.log("Validating CREATE_WEBSITE action");
        const websiteKeywords = [
            "website",
            "webpage",
            "web page",
            "site",
            "landing page",
        ];
        const actionKeywords = [
            "create",
            "make",
            "build",
            "generate",
            "publish",
            "deploy",
        ];
        const messageText = message.content.text.toLowerCase();

        elizaLogger.log("Checking message keywords");
        const hasRequiredKeywords =
            websiteKeywords.some((k) => messageText.includes(k)) &&
            actionKeywords.some((k) => messageText.includes(k));

        if (!hasRequiredKeywords) {
            elizaLogger.log("Required keywords not found in message");
            return false;
        }

        elizaLogger.log("Checking for recent website creation");
        const recentWebsiteCreation = (
            await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: 10,
                unique: false,
            })
        ).some(
            (msg) =>
                msg.content?.action === "CREATE_WEBSITE" &&
                msg.userId === runtime.agentId
        );

        // if (recentWebsiteCreation) {
        //     elizaLogger.log("Recent website creation found, skipping");
        //     return false;
        // }

        elizaLogger.log("Checking environment variables");
        const hasEnvVars = !!(
            process.env.OPENAI_API_KEY &&
            process.env.GITHUB_TOKEN &&
            process.env.GITHUB_USERNAME
        );
        elizaLogger.log(`Environment variables check: ${hasEnvVars}`);
        return hasEnvVars;
    },
    similes: [
        "PUBLISH_WEBSITE",
        "UPDATE_WEBSITE",
        "DEPLOY_WEBSITE",
        "GENERATE_WEBSITE",
        "BUILD_WEBSITE",
        "MAKE_WEBSITE",
        "SETUP_WEBSITE",
        "CREATE_WEBPAGE",
        "BUILD_WEBPAGE",
        "DEPLOY_WEBPAGE",
    ],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please update and publish the documentation website",
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
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Starting CREATE_WEBSITE handler");
        if (!state) {
            elizaLogger.log("No state provided, composing new state");
            state = (await runtime.composeState(message)) as State;
        }

        elizaLogger.log("Checking if website should be created");
        const shouldCreate = await (async () => {
            const context = composeContext({
                state,
                template: shouldCreateWebsiteTemplate,
            });
            return true; // Simplified for now
        })();

        if (!shouldCreate) {
            elizaLogger.log("Website creation not required");
            return;
        }

        try {
            elizaLogger.log("Starting website generation process");
            const homeContent = await generateHtmlContent(
                "Home",
                runtime,
                state
            );
            const pages = { home: homeContent };

            await createHtmlFiles(pages);
            createCssFile();

            elizaLogger.log("Checking GitHub credentials");
            const { GITHUB_TOKEN: token, GITHUB_USERNAME: username } =
                process.env;
            if (!token || !username) {
                elizaLogger.error("GitHub credentials not found");
                throw new Error(
                    "GitHub credentials not found - Both GITHUB_TOKEN and GITHUB_USERNAME environment variables are required"
                );
            }

            const repoName = `generated-website-${Date.now()}`;
            elizaLogger.log(`Deploying to GitHub with repo name: ${repoName}`);
            const siteUrl = await deployToGithub(repoName, token, username);

            elizaLogger.log("Website creation completed successfully");
            const response = {
                text: `I've created and deployed a website based on our conversation. You can view it at: ${siteUrl}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            // Use the callback to send the response to Discord
            await callback(response);
            return response;
        } catch (error) {
            elizaLogger.error("Website creation failed:", error);
            const errorResponse = {
                text: `Sorry, I encountered an error while creating the website: ${error.message}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            // Send error message through callback
            await callback(errorResponse);
            return errorResponse;
        }
    },
};

export default createWebsite;

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
// import { EventEmitter } from 'events';
import { IAgentRuntime } from "../../core/types";
import { State } from "../../core/types";
import { Memory } from "../../core/types";
import { Action, HandlerCallback, ModelClass } from "../../core/types";
import { elizaLogger } from "../../index.ts";
import { generateText } from "../../core/generation";
import { composeContext } from "../../core/context";
import { parseHtmlFromText } from "../../core/parsing";
import { booleanFooter } from "../../core/parsing";

interface IWebsitePages {
    [key: string]: string;
}

interface IWebsiteConfig {
    repoName: string;
    githubToken: string;
    username: string;
}

interface IWebsiteGenerator {
    generateHtmlContent(
        title: string,
        runtime: IAgentRuntime,
        state: State,
        prompt?: string
    ): Promise<string>;
    createHtmlFiles(pages: IWebsitePages): Promise<void>;
    deployToGithub(config: IWebsiteConfig): Promise<string>;
}

class WebsiteGenerator implements IWebsiteGenerator {
    private readonly __filename: string;
    private readonly __dirname: string;
    private readonly shouldCreateWebsiteTemplate: string;
    private readonly defaultWebsitePrompt: string;

    constructor() {
        this.__filename = fileURLToPath(import.meta.url);
        this.__dirname = path.dirname(this.__filename);
        this.shouldCreateWebsiteTemplate = `Based on the conversation so far:

{{recentMessages}}

Should {{agentName}} create a website for this request?
Respond with YES if one of the following is true:
- The user has explicitly requested a website to be created
- The user has provided clear requirements or content for the website
- Creating a website would be valuable and appropriate for the user's needs

Otherwise, respond with NO.
${booleanFooter}`;

        this.defaultWebsitePrompt = `Generate a sophisticated, modern, responsive HTML page for {title}.

IMPORTANT: You must respond with ONLY valid HTML code. Do not include any explanatory text.
The HTML should be a single main element with Tailwind CSS classes.

Based on this conversation context:
{context}

Requirements:
- Start with <main> tag and proper Tailwind classes
- Create engaging, professional content 
- Use semantic HTML5 elements
- Include proper headings (h1-h6)
- Use Tailwind CSS classes for styling
- Add interactive elements like buttons, forms, or accordions
- Minimum 3 distinct sections

Example interactive element with script:
<div id="interactive-demo">
  <button onclick="toggleContent()" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
    Toggle Content
  </button>
  <div id="toggle-content" class="hidden mt-4 p-4 bg-gray-100 rounded">
    Hidden content here
  </div>
</div>
<script>
  function toggleContent() {
    const content = document.getElementById('toggle-content');
    content.classList.toggle('hidden');
  }
</script>

Respond with ONLY the HTML code, starting with <main>.`;
    }

    async generateHtmlContent(
        title: string,
        runtime: IAgentRuntime,
        state: State,
        prompt?: string
    ): Promise<string> {
        elizaLogger.log(`Generating HTML content for page: ${title}`);

        const maxAttempts = 3;
        let attempt = 0;
        let completeHtml = "";

        while (attempt < maxAttempts) {
            attempt++;
            elizaLogger.log(
                `Attempt ${attempt} of ${maxAttempts} to generate HTML`
            );

            try {
                const generationPrompt = prompt || this.defaultWebsitePrompt;
                const formattedPrompt = generationPrompt
                    .replace("{title}", title)
                    .replace("{context}", "{{recentMessages}}");

                const htmlContent = await generateText({
                    runtime,
                    context: composeContext({
                        state,
                        template: formattedPrompt,
                    }),
                    modelClass: ModelClass.LARGE,
                });

                elizaLogger.log(
                    `Generated raw HTML content for ${title}:`,
                    htmlContent
                );

                const sanitizedHtml = htmlContent
                    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
                    .replace(/<\/?pre>/g, "")
                    .trim();

                const mainMatch = sanitizedHtml.match(
                    /<main[^>]*>([\s\S]*?)<\/main>/i
                );
                const mainContent = mainMatch
                    ? mainMatch[0]
                    : `<main class="container mx-auto px-4 py-8">${sanitizedHtml}</main>`;

                const validHtml =
                    mainContent.includes("<main") &&
                    mainContent.includes("</main>");
                if (!validHtml) {
                    elizaLogger.warn(
                        `Invalid HTML structure on attempt ${attempt}`
                    );
                    if (attempt < maxAttempts) continue;
                    throw new Error("Generated HTML missing main tags");
                }

                const parsedHtml = parseHtmlFromText(mainContent);
                if (!parsedHtml) {
                    elizaLogger.warn(
                        `Failed to parse HTML content on attempt ${attempt}`
                    );

                    if (completeHtml) {
                        const combinedHtml = `${completeHtml}${mainContent}`;
                        const parsedCombined = parseHtmlFromText(combinedHtml);
                        if (parsedCombined) {
                            elizaLogger.log(
                                `Successfully healed HTML by combining with previous content`
                            );
                            return parsedCombined;
                        }
                    }

                    completeHtml += mainContent;

                    if (attempt < maxAttempts) {
                        continue;
                    }
                } else {
                    elizaLogger.log(
                        `Successfully parsed HTML content for ${title}`
                    );
                    return parsedHtml;
                }
            } catch (error) {
                elizaLogger.error(
                    `Error generating HTML on attempt ${attempt}:`,
                    error
                );
                if (attempt >= maxAttempts) {
                    throw new Error(
                        `Failed to generate valid HTML content after ${maxAttempts} attempts: ${error.message}`
                    );
                }
            }
        }

        throw new Error(
            "Failed to generate valid HTML content after all attempts"
        );
    }

    async createHtmlFiles(pages: IWebsitePages): Promise<void> {
        elizaLogger.log("Starting HTML file creation");

        try {
            if (!pages || !pages.home) {
                elizaLogger.error("Missing required home page content");
                throw new Error("Home page content is required");
            }

            const websiteDir = path.join(this.__dirname, "website");
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
                    fs.writeFileSync(filePath, content);
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

    async deployToGithub(config: IWebsiteConfig): Promise<string> {
        const { repoName, githubToken, username } = config;
        elizaLogger.log(`Starting GitHub deployment for repo: ${repoName}`);
        const websiteDir = path.join(this.__dirname, "website");
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

            await new Promise((resolve) => setTimeout(resolve, 2000));

            elizaLogger.log("Initializing Git repository");
            const gitCommands = [
                "rm -rf .git",
                "git init",
                `git config user.name "${username}"`,
                `git config user.email "${username}@users.noreply.github.com"`,
                "git add .",
                'git commit -m "Initial commit"',
                `git remote add origin https://${username}:${githubToken}@github.com/${username}/${repoName}.git`,
                "git fetch origin",
                "git reset --soft origin/main",
                "git add .",
                'git commit -m "Initial website files"',
                "git branch -M main",
                "git push -f origin main",
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
                    body: JSON.stringify({
                        source: { branch: "main", path: "/" },
                    }),
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
}

const websiteGenerator = new WebsiteGenerator();

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

        try {
            elizaLogger.log("Starting website generation process");
            const homeContent = await websiteGenerator.generateHtmlContent(
                "Home",
                runtime,
                state,
                options?.websitePrompt
            );
            const pages = { home: homeContent };

            await websiteGenerator.createHtmlFiles(pages);

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
            const siteUrl = await websiteGenerator.deployToGithub({
                repoName,
                githubToken: token,
                username,
            });

            elizaLogger.log("Website creation completed successfully");
            const response = {
                text: `I've created and deployed a website based on our conversation. You can view it at: ${siteUrl}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(response);
            return response;
        } catch (error) {
            elizaLogger.error("Website creation failed:", error);
            const errorResponse = {
                text: `Sorry, I encountered an error while creating the website: ${error.message}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(errorResponse);
            return errorResponse;
        }
    },
};

export default createWebsite;

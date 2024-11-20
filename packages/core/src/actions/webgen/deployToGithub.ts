import { execSync } from "child_process";
import path from "node:path";
import { elizaLogger } from "../../index.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const deployToGithub = async ({
    repoName,
    githubToken,
    username,
}: {
    repoName: string;
    githubToken: string;
    username: string;
}) => {
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
};
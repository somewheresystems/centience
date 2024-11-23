import { execSync } from "child_process";
import { elizaLogger } from "../../index.ts";
import { IAgentRuntime } from "../../core/types.ts";

export const deployToGithub = async ({
    repoName,
    githubToken,
    username
}: {
    repoName: string;
    githubToken: string;
    username: string;
}) => {
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${username}/${repoName}.git`;
    
    try {
        // Create Octokit instance
        const { Octokit } = await import("@octokit/rest");
        const octokit = new Octokit({ auth: githubToken });

        elizaLogger.log("Creating new repository:", repoName);
        
        // First create the repository
        await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            auto_init: true,
            private: false,
        });

        // Wait for repository creation
        await new Promise(resolve => setTimeout(resolve, 3000));

        elizaLogger.log("Repository created, initializing git");

        // Initialize git without fetching
        await execSync('git init', { cwd: process.cwd() });
        await execSync('git add .', { cwd: process.cwd() });
        await execSync('git commit -m "Initial website commit"', { 
            cwd: process.cwd(),
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: username,
                GIT_AUTHOR_EMAIL: `${username}@users.noreply.github.com`,
                GIT_COMMITTER_NAME: username,
                GIT_COMMITTER_EMAIL: `${username}@users.noreply.github.com`,
            }
        });
        
        // Add remote and force push to main (since we're not fetching)
        await execSync(`git remote add origin ${remoteUrl}`, { cwd: process.cwd() });
        await execSync('git push -f origin HEAD:main', { cwd: process.cwd() });

        elizaLogger.log("Website pushed to GitHub successfully");
        
        // Enable GitHub Pages
        await octokit.repos.createPagesSite({
            owner: username,
            repo: repoName,
            source: {
                branch: "main",
                path: "/"
            }
        });

        return `https://${username}.github.io/${repoName}`;
    } catch (error) {
        elizaLogger.error("GitHub deployment failed:", error);
        throw new Error(`Deployment failed: ${error.message}`);
    }
};
import { IAgentRuntime } from "../../core/types.ts";
import { GithubIssuesClient } from "./issues.ts";
import githubIssue from "../../custom_actions/githubIssue.ts";
import githubComment from "../../custom_actions/githubComment.ts";

export function initializeGithubClient(runtime: IAgentRuntime) {
    if (
        runtime.getSetting("GITHUB_USERNAME") &&
        runtime.getSetting("GITHUB_TOKEN")
    ) {
        console.log("Initializing GitHub client...");
        
        // Register GitHub-related actions
        runtime.registerAction(githubIssue);
        runtime.registerAction(githubComment);
        
        const client = new GithubIssuesClient({ runtime });
        console.log(
            `GitHub client initialized for owner: ${runtime.getSetting("GITHUB_USERNAME")}`
        );
        return client;
    }
    console.log(
        "GitHub client not initialized - missing GITHUB_USERNAME or GITHUB_TOKEN"
    );
    return null;
}

export * from "./base.ts";
export * from "./issues.ts";

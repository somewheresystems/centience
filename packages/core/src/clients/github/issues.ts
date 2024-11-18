import { composeContext } from "../../core/context.ts";
import { generateText } from "../../core/generation.ts";
import { embeddingZeroVector } from "../../core/memory.ts";
import { IAgentRuntime, ModelClass } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { GithubClientBase, GithubIssue } from "./base.ts";

const issueResponseTemplate = `{{timeline}}

{{providers}}

About {{agentName}}:
{{bio}}
{{lore}}

GitHub Issue #{{issueNumber}}: {{issueTitle}}
Description: {{issueBody}}

Previous comments:
{{previousComments}}

# Task: Generate a response to this GitHub issue
Write a helpful and constructive response that addresses the issue while staying in character as {{agentName}}.`;

export class GithubIssuesClient extends GithubClientBase {
    private checkInterval: number = 5 * 60 * 1000; // 5 minutes
    private lastCheckedIssues: Map<string, number> = new Map();
    private monitoredRepos: Set<string> = new Set();

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        super({ runtime });
        this.monitorRepo(this.owner);
        this.startIssueMonitoring();
    }

    private async startIssueMonitoring() {
        // Get the most recent issue to establish a baseline
        const issues = await this.listIssues(this.owner);
        if (issues.length > 0) {
            this.lastCheckedIssues.set(this.owner, issues[0].id);
        }

        setInterval(() => this.checkForNewIssues(), this.checkInterval);
    }

    private async checkForNewIssues() {
        try {
            for (const repo of this.monitoredRepos) {
                const issues = await this.listIssues(repo);
                const lastCheckedId = this.lastCheckedIssues.get(repo) || 0;
                
                for (const issue of issues) {
                    if (issue.id > lastCheckedId) {
                        await this.handleNewIssue(repo, issue);
                        this.lastCheckedIssues.set(repo, issue.id);
                    }
                }
            }
        } catch (error) {
            console.error("Error checking for new issues:", error);
        }
    }

    private async handleNewIssue(repo: string, issue: GithubIssue) {
        const roomId = stringToUuid(`github-issue-${repo}-${issue.number}`);
        
        // Ensure room exists
        await this.runtime.ensureRoomExists(roomId);
        
        // Ensure the issue creator is registered as a user
        await this.runtime.ensureUserExists(
            stringToUuid(issue.user.id.toString()),
            issue.user.login,
            issue.user.login,
            "github"
        );

        // Get previous comments
        const comments = await this.listComments(repo, issue.number);
        const formattedComments = comments
            .map(c => `@${c.user.login}: ${c.body}`)
            .join("\n\n");

        // Generate response
        const state = await this.runtime.composeState(
            {
                userId: this.runtime.agentId,
                roomId,
                agentId: this.runtime.agentId,
                content: { text: "", action: "" },
            },
            {
                issueNumber: issue.number,
                issueTitle: issue.title,
                issueBody: issue.body,
                previousComments: formattedComments,
            }
        );

        const context = composeContext({
            state,
            template: issueResponseTemplate,
        });

        const response = await generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        // Post the response
        const comment = await this.createComment(repo, issue.number, response);

        // Save the interaction in memory
        await this.runtime.messageManager.createMemory({
            id: stringToUuid(`github-comment-${comment.id}`),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            content: {
                text: response,
                url: comment.html_url,
                source: "github",
            },
            roomId,
            embedding: embeddingZeroVector,
            createdAt: new Date(comment.created_at).getTime(),
        });
    }

    async monitorRepo(repo: string) {
        if (!this.monitoredRepos.has(repo)) {
            this.monitoredRepos.add(repo);
            // Get the most recent issue to establish a baseline
            const issues = await this.listIssues(repo);
            if (issues.length > 0) {
                this.lastCheckedIssues.set(repo, issues[0].id);
            }
        }
    }

    async createIssueWithResponse(
        repo: string,
        title: string,
        body: string,
        labels?: string[]
    ): Promise<GithubIssue> {
        const issue = await this.createIssue(repo, title, body);
        
        if (labels && labels.length > 0) {
            await this.addLabels(repo, issue.number, labels);
        }

        return issue;
    }
} 
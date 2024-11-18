import { EventEmitter } from "events";
import { IAgentRuntime } from "../../core/types.ts";

export interface GithubIssue {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
    created_at: string;
    updated_at: string;
    html_url: string;
    user: {
        login: string;
        id: number;
    };
}

export interface GithubComment {
    id: number;
    body: string;
    created_at: string;
    updated_at: string;
    html_url: string;
    user: {
        login: string;
        id: number;
    };
}

export class GithubClientBase extends EventEmitter {
    protected runtime: IAgentRuntime;
    protected apiBase = "https://api.github.com";
    protected owner: string;
    protected token: string;

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        super();
        this.runtime = runtime;
        this.owner = this.runtime.getSetting("GITHUB_USERNAME");
        this.token = this.runtime.getSetting("GITHUB_TOKEN");

        if (!this.owner || !this.token) {
            throw new Error("Missing required GitHub settings");
        }
    }

    protected async githubRequest(
        endpoint: string,
        method: string = "GET",
        body?: any
    ): Promise<any> {
        const url = `${this.apiBase}${endpoint}`;
        const headers = {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        };

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            }

            // Handle no-content responses
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error("GitHub request failed:", error);
            throw error;
        }
    }

    async getIssue(repo: string, issueNumber: number): Promise<GithubIssue> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues/${issueNumber}`
        );
    }

    async listIssues(
        repo: string,
        state: "open" | "closed" | "all" = "open"
    ): Promise<GithubIssue[]> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues?state=${state}`
        );
    }

    async createIssue(
        repo: string,
        title: string,
        body: string
    ): Promise<GithubIssue> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues`,
            "POST",
            { title, body }
        );
    }

    async createComment(
        repo: string,
        issueNumber: number,
        body: string
    ): Promise<GithubComment> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues/${issueNumber}/comments`,
            "POST",
            { body }
        );
    }

    async listComments(
        repo: string,
        issueNumber: number
    ): Promise<GithubComment[]> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues/${issueNumber}/comments`
        );
    }

    async updateIssue(
        repo: string,
        issueNumber: number,
        data: { title?: string; body?: string; state?: "open" | "closed" }
    ): Promise<GithubIssue> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues/${issueNumber}`,
            "PATCH",
            data
        );
    }

    async addLabels(
        repo: string,
        issueNumber: number,
        labels: string[]
    ): Promise<any> {
        return await this.githubRequest(
            `/repos/${this.owner}/${repo}/issues/${issueNumber}/labels`,
            "POST",
            { labels }
        );
    }
}

import { execSync } from "child_process";
import path from "node:path";
import { elizaLogger } from "../../index.js";
import { fileURLToPath } from "url";
import { diffLines } from "diff";
import fs from "fs/promises";
import { ModelClass } from "../../core/types.ts";
import { generateHtml } from "../../core/generation.js";
import { critiqueHtml } from "./critiqueHtml.js";
import { IAgentRuntime } from "../../core/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FixHtmlOptions {
    runtime: IAgentRuntime;
    repoUrl: string;
    filePath: string;
    githubToken: string;
    username: string;
    corrections: string;
}

export const fixHtml = async ({
    runtime,
    repoUrl,
    filePath,
    githubToken,
    username,
    corrections,
}: FixHtmlOptions) => {
    elizaLogger.log(`Starting HTML fixes for repo: ${repoUrl}`);
    const tempDir = path.join(__dirname, "temp-" + Date.now());

    try {
        if (
            !repoUrl ||
            !filePath ||
            !githubToken ||
            !username ||
            !corrections
        ) {
            throw new Error(
                "Missing required parameters for HTML fix operation"
            );
        }

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.log("Error cleaning up temp directory:", error);
        }

        await fs.mkdir(tempDir);

        const safeRepoUrl = repoUrl.replace(
            "https://",
            `https://${username}:${githubToken}@`
        );
        execSync(`git clone ${safeRepoUrl} ${tempDir}`);

        const fullPath = path.join(tempDir, filePath);
        const currentContent = await fs.readFile(fullPath, "utf-8");

        const { fixes } = await critiqueHtml({
            runtime,
            state: await runtime.composeState({
                content: { text: currentContent },
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: "00000000-0000-0000-0000-000000000000",
            }),
            html: currentContent,
        });

        const correctedHtml = await generateHtml({
            runtime,
            context: `Fix this HTML according to these corrections: ${corrections}
            
            Current HTML issues identified:
            ${fixes.map((fix) => `- ${fix.description} (${fix.category})`).join("\n")}
            
            Current HTML:
            ${currentContent}`,
            modelClass: ModelClass.MEDIUM,
        });

        const diff = diffLines(currentContent, correctedHtml);

        await fs.writeFile(fullPath, correctedHtml);

        elizaLogger.log("Changes made:", {
            diffLength: diff.length,
            addedLines: diff.filter((part) => part.added).length,
            removedLines: diff.filter((part) => part.removed).length,
            changes: diff.map((part) => ({
                added: part.added,
                removed: part.removed,
                value: part.value.substring(0, 50) + "...",
            })),
        });

        const gitCommands = [
            `git config user.name "${username}"`,
            `git config user.email "${username}@users.noreply.github.com"`,
            "git add .",
            'git commit -m "Applied HTML corrections"',
            "git push origin main",
        ];

        gitCommands.forEach((cmd) => {
            try {
                const sanitizedCmd = cmd.replace(githubToken, "***");
                elizaLogger.log(`Executing git command: ${sanitizedCmd}`);
                execSync(cmd, { cwd: tempDir });
            } catch (gitError) {
                throw new Error(
                    `Git command failed: ${cmd.replace(githubToken, "***")}\nError: ${gitError.message}`
                );
            }
        });

        await fs.rm(tempDir, { recursive: true, force: true });

        return {
            success: true,
            changes: diff.length,
        };
    } catch (error) {
        elizaLogger.error("HTML fix operation failed:", error);

        // Cleanup on error
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            elizaLogger.error("Cleanup failed:", cleanupError);
        }

        throw error instanceof Error ? error : new Error(String(error));
    }
};

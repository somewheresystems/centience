import { execSync } from "child_process";
import path from "node:path";
import { elizaLogger } from "../../index.js";
import { fileURLToPath } from "url";
import { diffLines } from "diff";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FixHtmlOptions {
    repoUrl: string;
    filePath: string; 
    githubToken: string;
    username: string;
    corrections: string;
}

export const fixHtml = async ({
    repoUrl,
    filePath,
    githubToken,
    username,
    corrections
}: FixHtmlOptions) => {
    elizaLogger.log(`Starting HTML fixes for repo: ${repoUrl}`);
    const tempDir = path.join(__dirname, "temp-" + Date.now());
    const headers = {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
    };

    try {
        // Create temp directory
        await fs.mkdir(tempDir);

        // Clone repository
        elizaLogger.log("Cloning repository");
        execSync(`git clone ${repoUrl.replace("https://", `https://${username}:${githubToken}@`)} ${tempDir}`);

        // Read current file content
        const fullPath = path.join(tempDir, filePath);
        const currentContent = await fs.readFile(fullPath, 'utf-8');

        // Generate diff and apply corrections
        elizaLogger.log("Applying corrections");
        const diff = diffLines(currentContent, corrections);
        
        // Write corrected content
        await fs.writeFile(fullPath, corrections);

        // Log the changes
        elizaLogger.log("Changes made:", {
            diffLength: diff.length,
            addedLines: diff.filter(part => part.added).length,
            removedLines: diff.filter(part => part.removed).length,
            changes: diff.map(part => ({
                added: part.added,
                removed: part.removed,
                value: part.value.substring(0, 50) + "..."
            }))
        });

        // Commit and push changes
        const gitCommands = [
            `git config user.name "${username}"`,
            `git config user.email "${username}@users.noreply.github.com"`,
            "git add .",
            'git commit -m "Applied HTML corrections"',
            "git push origin main"
        ];

        gitCommands.forEach(cmd => {
            try {
                elizaLogger.log(`Executing git command: ${cmd.replace(githubToken, "***")}`);
                execSync(cmd, { cwd: tempDir });
            } catch (gitError) {
                throw new Error(
                    `Git command failed: ${cmd.replace(githubToken, "***")}\nError: ${gitError.message}`
                );
            }
        });

        elizaLogger.log("HTML fixes successfully applied and pushed");

        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
        
        return {
            success: true,
            changes: diff.length
        };

    } catch (error) {
        elizaLogger.error("HTML fix operation failed:", error);
        
        // Cleanup on error
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            elizaLogger.error("Cleanup failed:", cleanupError);
        }

        throw new Error(
            `HTML fix operation failed: ${error.message}`
        );
    }
};



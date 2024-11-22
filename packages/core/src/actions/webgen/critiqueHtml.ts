import { IAgentRuntime, State, ModelClass } from "../../core/types.js";
import { elizaLogger } from "../../index.js";
import { generateHtml } from "../../core/generation.js";
import { composeContext } from "../../core/context.js";

interface CritiqueFix {
    originalLines: string[];
    fixedLines: string[];
    startLine: number;
    endLine: number;
    severity: "critical" | "warning";
    category: "structure" | "interactivity" | "accessibility" | "performance";
    description: string;
}

export const critiqueHtml = async ({
    runtime,
    state,
    html,
}: {
    runtime: IAgentRuntime;
    state: State;
    html: string;
}): Promise<{ fixes: CritiqueFix[]; score: number }> => {
    try {
        elizaLogger.log("Starting HTML critique analysis...");
        const critique = await generateHtml({
            runtime,
            context: composeContext({
                state,
                template: `First validate that the input is valid HTML markup containing tags like <html>, <body>, etc.
            If the input is not valid HTML markup (e.g. just URLs or text), return:
            {
              "fixes": [],
              "score": 0,
              "error": "Invalid input - must be HTML markup"
            }

            For valid HTML, analyze and identify critical structural issues focusing on:
            1. Unclosed tags (e.g. <div> without </div>)
            2. Missing required attributes (e.g. <img> without alt)
            3. Invalid nesting (e.g. <p><div></div></p>)
            4. Critical accessibility issues (e.g. missing ARIA labels)
            5. Missing interactivity (e.g. missing buttons, forms, or other interactive elements)
            6. Missing code for functionality (e.g. missing js for dropdowns, modals, game logic, etc.)
            
            HTML to analyze:
            ${html}
            
            Return a JSON object with this exact structure:
            {
              "fixes": [
                {
                  "startLine": <number>,
                  "endLine": <number>, 
                  "originalLines": ["<original html>"],
                  "fixedLines": ["<fixed html>"],
                  "severity": "critical",
                  "category": "structure|interactivity|accessibility|performance",
                  "description": "<issue description>"
                }
              ],
              "score": <number between 0-1>
            }

            The fixes array should be empty if no issues are found, with a score of 1.0.
            Each fix must have valid line numbers and HTML content.
            Do not include any text outside the JSON object.`,
            }),
            modelClass: ModelClass.MEDIUM,
        });
        elizaLogger.log("Critique generated", { critique });

        const { fixes, score } = JSON.parse(critique.trim());
        const validFixes = fixes.filter(
            (fix: CritiqueFix) =>
                fix.startLine >= 0 &&
                fix.endLine >= fix.startLine &&
                Array.isArray(fix.originalLines) &&
                Array.isArray(fix.fixedLines) &&
                ["critical", "warning"].includes(fix.severity) &&
                [
                    "structure",
                    "interactivity",
                    "accessibility",
                    "performance",
                ].includes(fix.category)
        );

        return { fixes: validFixes, score };
    } catch (error) {
        elizaLogger.error("Failed to parse critique fixes:", error);
        return { fixes: [], score: 0 };
    }
};

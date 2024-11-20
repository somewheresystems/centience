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
                template: `Analyze this HTML content and identify critical structural issues only.
            Focus on:
            1. Unclosed tags (e.g. <div> without </div>)
            2. Missing required attributes (e.g. <img> without alt)
            3. Invalid nesting (e.g. <p><div></div></p>)
            4. Critical accessibility issues (e.g. missing ARIA labels)
            5. Missing interactivity (e.g. missing buttons, forms, or other interactive elements)
            6. Missing code for functionality (e.g. missing js for dropdowns, modals, game logic, etc.)
            
            HTML to analyze:
            ${html}
            
            Format each fix as a JSON object exactly like these examples, do not deviate:
            {
              "fixes": [
                {
                  "startLine": 5,
                  "endLine": 5,
                  "originalLines": ["<img src='logo.png'>"],
                  "fixedLines": ["<img src='logo.png' alt='Company Logo'>"],
                  "severity": "critical",
                  "category": "accessibility",
                  "description": "Images must have alt text for screen readers"
                },
                {
                  "startLine": 10,
                  "endLine": 12,
                  "originalLines": ["<div>", "  <p>Text</p>", "<div>"],
                  "fixedLines": ["<div>", "  <p>Text</p>", "</div>"],
                  "severity": "critical", 
                  "category": "structure",
                  "description": "Unclosed div tag"
                }
            ],
              "score": 0.7
            }
            
            Include an overall quality score from 0-1.
            If no issues found, return empty array and score of 1.0.`,
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

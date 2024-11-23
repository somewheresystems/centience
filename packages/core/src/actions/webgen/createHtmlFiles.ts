import fs from "node:fs";
import path from "node:path";
import { elizaLogger } from "../../index.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Pages {
    [key: string]: string;
}

function validateHtmlContent(content: string): boolean {
    // Check for essential HTML structure
    const hasDoctype = content.toLowerCase().includes("<!doctype html");
    const hasHtml = content.includes("<html") && content.includes("</html>");
    const hasHead = content.includes("<head") && content.includes("</head>");
    const hasBody = content.includes("<body") && content.includes("</body>");

    // Check for main content
    const hasMainContent =
        (content.includes("<main") && content.includes("</main>")) ||
        (content.includes("<div") && content.includes("</div"));

    // More lenient script tag validation that accounts for nested content
    const scriptTags = content.match(/<script[\s\S]*?<\/script>/g) || [];
    const hasValidScripts = scriptTags.every(
        (script) => script.startsWith("<script") && script.endsWith("</script>")
    );

    return (
        hasDoctype &&
        hasHtml &&
        hasHead &&
        hasBody &&
        hasMainContent &&
        hasValidScripts
    );
}

export const createHtmlFiles = async (pages: Pages) => {
    elizaLogger.log("Starting HTML file creation");

    try {
        if (!pages || !pages.home) {
            elizaLogger.error("Missing required home page content");
            throw new Error("Home page content is required");
        }

        // Validate HTML content
        Object.entries(pages).forEach(([page, content]) => {
            if (!validateHtmlContent(content)) {
                elizaLogger.error(`Invalid HTML structure in ${page} page`);
                throw new Error(`Invalid HTML structure in ${page} page`);
            }
        });

        const websiteDir = path.join(__dirname, "website");
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
                    `Failed to write ${filename}: ${writeError.message}`
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
        throw error;
    }
};

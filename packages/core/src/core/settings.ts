import { config } from "dotenv";
import { resolve, parse, join, dirname } from "path";
import { existsSync } from "fs";

function findNearestFile(filename: string, startDir = process.cwd()): string | null {
    let currentDir = startDir;
    while (currentDir !== parse(currentDir).root) {
        const filePath = join(currentDir, filename);
        if (existsSync(filePath)) return filePath;
        currentDir = dirname(currentDir);
    }
    return null;
}

// Load environment variables from .env file
const envPath = findNearestFile(".env");
if (envPath) {
    config({ path: envPath });
} else {
    console.warn("No .env file found");
}

// Export settings with environment variables
export default {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    // Add other environment variables as needed
    ...process.env
} as { [key: string]: string };
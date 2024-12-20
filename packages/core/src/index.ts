// Exports
export * from "./actions/index.ts";
export * from "./clients/index.ts";
export * from "./adapters/index.ts";
export * from "./providers/index.ts";
export * from "./core/index.ts";
export * from "./cli/index.ts";

// Make sure these types are exported from core/types.ts


import { elizaLogger as Logging } from "./core/index.ts";

// Initialize the pretty console
export const elizaLogger = new Logging();
elizaLogger.clear();
elizaLogger.closeByNewLine = true;
elizaLogger.useIcons = true;

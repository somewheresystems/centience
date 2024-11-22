import { EventEmitter } from "events";
import { IAgentRuntime } from "../../core/types";
import { elizaLogger } from "../../index.ts";
import { WEBSITE_GENERATION } from "../../actions/index.ts";

export class WebgenClient extends EventEmitter {
    private runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;

        elizaLogger.info("Initializing website generator client...");

        try {
            // Register website generation action
            this.runtime.registerAction(WEBSITE_GENERATION);
            elizaLogger.info("Registered CREATE_WEBSITE action");

            elizaLogger.success(
                "Website generator client initialized successfully"
            );
        } catch (error) {
            elizaLogger.error(
                "Failed to initialize website generator client:",
                error
            );
            throw error;
        }
    }
}

export * from "./base.ts";

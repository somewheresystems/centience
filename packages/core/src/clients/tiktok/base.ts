import { IAgentRuntime } from "../../core/types";
import { elizaLogger } from "../../index";
import PQueue from "p-queue";
import { TikTokClient } from "./client";

export class ClientBase {
    protected runtime: IAgentRuntime;
    protected tikTokClient: TikTokClient;
    protected requestQueue: PQueue;

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        this.runtime = runtime;
        this.requestQueue = new PQueue({ concurrency: 1 });
        
        const accessToken = this.runtime.getSetting("TIKTOK_ACCESS_TOKEN");
        if (!accessToken) {
            throw new Error("TIKTOK_ACCESS_TOKEN is required");
        }

        this.tikTokClient = new TikTokClient({
            accessToken,
            openId: this.runtime.getSetting("TIKTOK_OPEN_ID")
        });
    }

    async onReady(): Promise<void> {
        // Override in subclasses
    }

    protected async uploadVideo(videoBuffer: Buffer, title: string) {
        try {
            // Initialize upload
            const initResponse = await this.tikTokClient.initializeUpload({
                post_info: {
                    title,
                    privacy_level: 'PUBLIC'
                }
            });

            // Upload video chunks
            await this.tikTokClient.uploadVideo(
                initResponse.data.upload_url,
                videoBuffer
            );

            // Publish video
            const publishResponse = await this.tikTokClient.publishVideo({
                upload_id: initResponse.data.upload_id,
                title
            });

            return publishResponse;
        } catch (error) {
            elizaLogger.error("Error uploading video to TikTok:", error);
            throw error;
        }
    }
} 
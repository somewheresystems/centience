import { ClientBase } from "./base";
import { elizaLogger } from "../../index";
import { generateText } from "../../core/generation";
import { ModelClass } from "../../core/types";
import { stringToUuid } from "../../core/uuid";
import { embeddingZeroVector } from "../../core/memory";

export class TikTokStorytellingClient extends ClientBase {
    private isGenerating: boolean = false;

    async onReady(): Promise<void> {
        // Run immediately
        this.generateTikTokPost();

        const generateStoryLoop = async () => {
            if (!this.isGenerating) {
                this.isGenerating = true;
                try {
                    await this.generateTikTokPost();
                } catch (error) {
                    elizaLogger.error("Error in TikTok generation loop:", error);
                } finally {
                    this.isGenerating = false;
                }
            }
            
            // Random interval between 4-6 hours
            const nextInterval = (Math.floor(Math.random() * (360 - 240 + 1)) + 240) * 60 * 1000;
            elizaLogger.log(`Next TikTok scheduled in ${Math.floor(nextInterval / 1000 / 60)} minutes`);
            setTimeout(generateStoryLoop, nextInterval);
        };

        // Start the loop after initial run
        setTimeout(generateStoryLoop, 1000 * 60 * 15);
    }

    async generateTikTokPost() {
        try {
            // Generate video content using existing video generation service
            const videoPrompt = await this.generateVideoPrompt();
            const video = await this.runtime.videoGenerationService.generateVideo(videoPrompt);
            
            if (!video) {
                elizaLogger.error("Failed to generate video");
                return;
            }

            // Generate engaging title for TikTok
            const titleContext = `Create a catchy, engaging TikTok title for a video about: ${videoPrompt}. Keep it under 100 characters. Make it trendy and appealing to TikTok audience.`;
            const title = await generateText({
                runtime: this.runtime,
                context: titleContext,
                modelClass: ModelClass.MEDIUM
            });

            // Upload to TikTok
            const result = await this.uploadVideo(video.buffer, title);

            // Save to memory
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(`tiktok-${Date.now()}-${this.runtime.agentId}`),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: title,
                    url: result.data.share_url,
                    source: "tiktok",
                    mediaType: "video",
                    mediaPrompt: videoPrompt
                },
                roomId: stringToUuid("tiktok_story_room"),
                embedding: embeddingZeroVector,
                createdAt: Date.now()
            });

        } catch (error) {
            elizaLogger.error("Error generating TikTok post:", error);
        }
    }

    private async generateVideoPrompt(): Promise<string> {
        const context = `Create a prompt for an engaging 10-second TikTok video that would be trendy and viral-worthy. Focus on visually appealing and dynamic content that works well with TikTok's format.

Consider:
- Visual appeal and movement
- Current TikTok trends
- Engaging visuals that work without sound
- Short attention span of TikTok users

Output only the prompt text, no commentary.`;

        return await generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE
        });
    }
} 
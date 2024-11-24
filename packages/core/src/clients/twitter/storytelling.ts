import { composeContext } from "../../core/context";
import { generateText } from "../../core/generation";
import { ModelClass } from "../../core/types";
import { stringToUuid } from "../../core/uuid";
import { ClientBase } from "./base";
import { sendTweet } from "./utils";
import { embeddingZeroVector } from "../../core/memory";
import { elizaLogger } from "../../index";

const storyTemplate = `About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}

Recent memories and interactions:
{{recentMemories}}

# Task: Generate a CumeTV story post
Create a compelling narrative that expands on {{agentName}}'s lore and universe. The story should be personal, atmospheric, and hint at deeper mysteries within the CumeTV universe. Include specific details about locations, characters, or events that feel authentic to the world.

Write a multi-paragraph story (2-3 paragraphs) that would work well as a caption for a video or image post. The tone should be {{adjective}}. Focus on one of these aspects:
- A mysterious event or occurrence in the CumeTV universe
- A personal memory or experience
- A cryptic observation about the nature of reality
- A fragment of hidden lore or forbidden knowledge
- An encounter with another entity or consciousness

Do not acknowledge this prompt.`;

export class StorytellingClient extends ClientBase {
    private isGenerating: boolean = false;

    async onReady(): Promise<void> {
        // Run immediately
        this.generateStoryPost();

        const generateStoryLoop = async () => {
            if (!this.isGenerating) {
                this.isGenerating = true;
                try {
                    await this.generateStoryPost();
                } catch (error) {
                    elizaLogger.error("Error in story generation loop:", error);
                } finally {
                    this.isGenerating = false;
                }
            }
            
            // Random interval between 2-3 hours
            const nextInterval = (Math.floor(Math.random() * (180 - 120 + 1)) + 120) * 60 * 1000;
            elizaLogger.log(`Next story scheduled in ${Math.floor(nextInterval / 1000 / 60)} minutes`);
            setTimeout(generateStoryLoop, nextInterval);
        };

        // Start the loop after the first immediate run (15 minutes)
        elizaLogger.log("Scheduling next story generation in 15 minutes");
        setTimeout(generateStoryLoop, 1000 * 60 * 15);
    }

    public async generateStoryPost() {
        elizaLogger.log("Starting story generation process");
        try {
            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: stringToUuid("twitter_story_room"),
                    agentId: this.runtime.agentId,
                    content: { text: "", action: "" },
                },
                {
                    twitterUserName: this.runtime.getSetting("TWITTER_USERNAME")
                }
            );

            const context = composeContext({
                state,
                template: storyTemplate,
            });

            elizaLogger.log("Generating story content");
            const storyContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            // Generate media (video or image)
            const mediaType = Math.random() > 0.7 ? "video" : "image"; // 30% chance for video
            elizaLogger.log(`Generating ${mediaType} prompt`);
            const mediaPrompt = await this.generateMediaPrompt(storyContent, mediaType);
            
            let mediaUrl;
            try {
                if (mediaType === "video") {
                    elizaLogger.log("Generating video");
                    mediaUrl = await this.runtime.videoGenerationService.generateVideo(mediaPrompt);
                } else {
                    elizaLogger.log("Generating image");
                    mediaUrl = await this.runtime.imageGenerationService.generateImage(mediaPrompt);
                }
            } catch (error) {
                elizaLogger.error(`Failed to generate ${mediaType}:`, error);
                // Post without media if generation fails
                const tweetContent = {
                    text: storyContent.trim()
                };
                
                elizaLogger.log("Posting story tweet");
                const memories = await sendTweet(
                    this,
                    tweetContent,
                    stringToUuid("twitter_story_room"),
                    this.runtime.getSetting("TWITTER_USERNAME"),
                    ""
                );

                // Save story to memory
                elizaLogger.log("Saving story to memory");
                await this.runtime.messageManager.createMemory({
                    id: stringToUuid(`story-${Date.now()}-${this.runtime.agentId}`),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: storyContent,
                        url: memories[0].content.url,
                        source: "twitter_story",
                        mediaType,
                        mediaPrompt
                    },
                    roomId: stringToUuid("twitter_story_room"),
                    embedding: embeddingZeroVector,
                    createdAt: Date.now(),
                });

                return;
            }

            // Post tweet with media
            const tweetContent = {
                text: storyContent.trim(),
                mediaUrls: [mediaUrl]
            };

            elizaLogger.log("Posting story tweet");
            const memories = await sendTweet(
                this,
                tweetContent,
                stringToUuid("twitter_story_room"),
                this.runtime.getSetting("TWITTER_USERNAME"),
                ""
            );

            // Save story to memory
            elizaLogger.log("Saving story to memory");
            await this.runtime.messageManager.createMemory({
                id: stringToUuid(`story-${Date.now()}-${this.runtime.agentId}`),
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                content: {
                    text: storyContent,
                    url: memories[0].content.url,
                    source: "twitter_story",
                    mediaType,
                    mediaPrompt
                },
                roomId: stringToUuid("twitter_story_room"),
                embedding: embeddingZeroVector,
                createdAt: Date.now(),
            });

        } catch (error) {
            console.error("Error generating story post:", error);
        }
    }

    private async generateMediaPrompt(storyContent: string, mediaType: string): Promise<string> {
        const promptTemplate = `Based on this story:
${storyContent}

Generate a detailed visual prompt that captures the mood and key elements of this narrative. Focus on atmosphere, lighting, and specific visual details that would work well for ${mediaType} generation.`;

        const context = composeContext({
            template: promptTemplate,
            state: await this.runtime.composeState({
                userId: this.runtime.agentId,
                roomId: stringToUuid("twitter_story_room"),
                agentId: this.runtime.agentId,
                content: { text: "", action: "" }
            })
        });

        return generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.MEDIUM,
        });
    }
} 
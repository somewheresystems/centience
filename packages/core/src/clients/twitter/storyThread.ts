import { 
    IAgentRuntime, 
    Memory, 
    ModelClass, 
} from "../../core/types";
import { generateText } from "../../core/generation";
import { generateImage } from "../../actions/imageGenerationUtils";
import { elizaLogger } from "../../index";
import { ClientBase } from "./base";
import { embeddingZeroVector } from "../../core/memory";
import { stringToUuid } from "../../core/uuid";
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

//import { processTwitterResponse } from './types';

interface StoryContext {
    persistentElements: {
        characters: string[];
        settings: string[];
        themes: string[];
        style: string;
    };
    originalPrompt: string;
    story: string;
}


interface TweetSegment {
    text: string;
    imagePrompt?: string;
    imageUrl?: string;
    mediaId?: string;
    tweetId?: string;
}
// interface TwitterResponse {
//     data?: {
//         create_tweet?: {
//             tweet_results?: {
//                 result?: {
//                     rest_id: string;
//                     legacy?: {
//                         full_text: string;
//                         conversation_id_str: string;
//                         user_id_str: string;
//                         in_reply_to_status_id_str?: string;
//                     };
//                 };
//             };
//         };
//         media_upload_init?: {
//             media_id_string: string;
//         };
//         media_upload_append?: {
//             success: boolean;
//         };
//         media_upload_finalize?: {
//             media_id_string: string;
//             processing_info?: {
//                 state: string;
//                 check_after_secs?: number;
//                 error?: {
//                     message: string;
//                     code: number;
//                 };
//             };
//         };
//         media_upload_status?: {
//             processing_info?: {
//                 state: string;
//                 check_after_secs?: number;
//                 error?: {
//                     message: string;
//                     code: number;
//                 };
//             };
//         };
//     };
//     errors?: Array<{ message: string; code: number }>;
//     media_id_string?: string;  // Add this for direct media upload responses
// }

// interface MediaUploadInit {
//     media_id: string;
//     media_id_string: string;
//     expires_after_secs: number;
// }

// interface MediaUploadStatus {
//     media_id: string;
//     media_id_string: string;
//     processing_info?: {
//         state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
//         check_after_secs?: number;
//         progress_percent?: number;
//         error?: {
//             code: number;
//             name: string;
//             message: string;
//         };
//     };
// }

interface TwitterMediaResponse {
    media_id_string: string;
    expires_after_secs?: number;
    processing_info?: {
        state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
        check_after_secs?: number;
        progress_percent?: number;
        error?: {
            code: number;
            message: string;
        };
    };
}

export class TwitterStoryClient extends ClientBase {
    constructor(runtime: IAgentRuntime) {
        super({ runtime });
    }

    async onReady(): Promise<void> {
        const generateStoryLoop = async () => {
            await this.generateStory();
            setTimeout(
                generateStoryLoop,
                (Math.floor(Math.random() * (240 - 180 + 1)) + 60) * 60 * 1000
            );
        };

        await generateStoryLoop();
    }

    private async generateStory(): Promise<StoryContext> {
        try {
            const storyContext = await this.generateStoryContext();
            
            if (!storyContext.story || !storyContext.persistentElements) {
                throw new Error('Missing required story elements');
            }

            // Save story to memory
            await this.saveStoryToMemory(storyContext);
            elizaLogger.info('Story saved to memory');

            // Generate tweet segments
            const segments = await this.segmentIntoTweets(storyContext);
            elizaLogger.info(`Story segmented into ${segments.length} tweets`);

            // Generate image prompts
            const enhancedSegments = await this.enhanceSegmentsWithImagePrompts(segments, storyContext);
            elizaLogger.info(`Generated ${enhancedSegments.length} image prompts`);

            // Generate and upload media for each segment
            let previousTweetId: string | undefined;
            
            for (const segment of enhancedSegments) {
                try {
                    let mediaId: string | undefined;

                    if (segment.imagePrompt) {
                        // Generate image
                        const imageResult = await generateImage(
                            {
                                prompt: segment.imagePrompt,
                                width: 1024,
                                height: 1024,
                                count: 1
                            },
                            this.runtime
                        );

                        if (imageResult.success && imageResult.data?.[0]) {
                            // Download image
                            const imageResponse = await fetch(imageResult.data[0]);
                            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

                            // Upload to Twitter
                            const result = await this.twitterClient.sendTweet(
                                segment.text,
                                previousTweetId,
                                [{
                                    data: imageBuffer,
                                    mediaType: 'image/png'
                                }]
                            );

                            const responseData = await result.json();
                            if (responseData?.data?.create_tweet?.tweet_results?.result?.rest_id) {
                                previousTweetId = responseData.data.create_tweet.tweet_results.result.rest_id;
                            }
                        }
                    } else {
                        // Post text-only tweet
                        const result = await this.twitterClient.sendTweet(
                            segment.text,
                            previousTweetId
                        );

                        const responseData = await result.json();
                        if (responseData?.data?.create_tweet?.tweet_results?.result?.rest_id) {
                            previousTweetId = responseData.data.create_tweet.tweet_results.result.rest_id;
                        }
                    }

                    // Add delay between tweets
                    await new Promise(resolve => setTimeout(resolve, 5000));

                } catch (error) {
                    elizaLogger.error('Error posting tweet:', error);
                }
            }

            return storyContext;

        } catch (error) {
            elizaLogger.error('Story generation failed:', error);
            throw error;
        }
    }

    private async generateStoryContext(): Promise<StoryContext> {
        try {
            const recentStories = await this.runtime.messageManager.getMemoriesByRoomIds({
                roomIds: [stringToUuid('twitter')]
            });

            elizaLogger.info("Recent stories fetched:", recentStories.length);

            const promptTemplate = `# Task: Generate a story prompt for ${this.runtime.character.name}

Character Details:
${this.runtime.character.system}
${this.runtime.character.lore}
You are LoomLove, The narrator of this story. You take the form of a bulky,swagged out, buff, male, bipedal-polar bear. Swagged out like a suited up church going uncle. Like you've got that drip on. 
Topics of Interest:
${this.runtime.character.topics.join(", ")}

Personality:
${this.runtime.character.adjectives.join(", ")}

Writing Style:
${this.runtime.character.style}

Example Posts:
${this.runtime.character.postExamples.join("\n")}

Recent Story Themes: ${recentStories.map(m => m.content.summary).join(", ")}

Create a compelling story that:
1. Reflects the character's unique perspective and writing style
2. Incorporates their topics of interest naturally
3. Has high narrative entropy (unexpected but logical developments)
4. Remains accessible and engaging 
5. Can be told in under 4000 characters
6. Would be interesting to share on Twitter
7. Plays off ideas from the example posts
8. Builds worlds that can be continuously explored.
9. Is not the same as any Recent Stories


IMPORTANT: Response must be a JSON object with EXACTLY this structure:
{
    "story": "The full story text goes here",
    "persistentElements": {
        "characters": ["character names"],
        "settings": ["setting descriptions"],
        "themes": ["theme descriptions"],
        "style": "style description"
    }
}`;
            const retries = 3;
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await generateText({
                        runtime: this.runtime,
                        context: promptTemplate,
                        modelClass: ModelClass.LARGE,
                    });

                    elizaLogger.debug("Raw LLM response:", response);

                    // Clean and validate the response
                    const cleanResponse = response
                        .replace(/```(?:json)?\n|\n```/g, '')
                        .replace(/^.*?({[\s\S]*}).*?$/, '$1')
                        .trim();
                    
                    try {
                        const parsed = JSON.parse(cleanResponse);
                        
                        // More detailed validation
                        if (!parsed || typeof parsed !== 'object') {
                            throw new Error('Response is not an object');
                        }
                        
                        if (!parsed.story || typeof parsed.story !== 'string') {
                            throw new Error('Missing or invalid story field');
                        }
                        
                        if (!parsed.persistentElements || typeof parsed.persistentElements !== 'object') {
                            throw new Error('Missing or invalid persistentElements');
                        }
                        
                        const required = ['characters', 'settings', 'themes', 'style'];
                        for (const field of required) {
                            if (!parsed.persistentElements[field]) {
                                throw new Error(`Missing ${field} in persistentElements`);
                            }
                        }

                        return parsed as StoryContext;

                    } catch (jsonError) {
                        elizaLogger.warn("Failed to parse or validate story response", {
                            attempt: i + 1,
                            error: jsonError.message,
                            raw: response,
                            cleaned: cleanResponse
                        });
                        
                        if (i === retries - 1) {
                            throw jsonError;
                        }
                        
                        // Add a small delay before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error) {
                    elizaLogger.error("Story context generation failed", {
                        attempt: i + 1,
                        error: error instanceof Error ? error.message : String(error),
                        type: error instanceof Error ? error.constructor.name : typeof error,
                        stack: error instanceof Error ? error.stack : undefined
                    });
                    
                    if (i === retries - 1) {
                        throw error;
                    }
                    
                    // Add a small delay before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            throw new Error(`Failed to generate valid story context after ${retries} attempts`);

        } catch (error) {
            elizaLogger.error("Story context generation failed", {
                error: error instanceof Error ? error.message : String(error),
                type: error instanceof Error ? error.constructor.name : typeof error,
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }

    private async segmentIntoTweets(storyContext: StoryContext): Promise<TweetSegment[]> {
        const segmentPrompt = `# Task: Break this story into tweet-sized segments

Story: "${storyContext.story}"

Requirements:
- Split the story into multiple segments.
- Do not change the story.
- Each segment must be under 280 characters
- Each segment should be meaningful and engaging on its own
- Do not add any commentary to the segments.
- Do not add any commentary to the output.
- Format as JSON array of segments

IMPORTANT: Response must be a JSON object with EXACTLY this structure:
[
    { "text": "tweet text" },
    { "text": "tweet text" }
]`;

        const response = await generateText({
            runtime: this.runtime,
            context: segmentPrompt,
            modelClass: ModelClass.LARGE,
        });

        try {
            return JSON.parse(response);
        } catch (error) {
            elizaLogger.error("Failed to segment story:", error);
            throw error;
        }
    }

    private async enhanceSegmentsWithImagePrompts(
        segments: TweetSegment[],
        context: StoryContext
    ): Promise<TweetSegment[]> {
        elizaLogger.info('Starting image prompt generation for segments', {
            segmentCount: segments.length,
            storyThemes: context.persistentElements.themes
        });

        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                // Create a single context containing all segments
                const promptContext = `# Task: Create cohesive image generation prompts for a story thread

Story Context:
Characters: ${context.persistentElements.characters.join(", ")}
Settings: ${context.persistentElements.settings.join(", ")}
Themes: ${context.persistentElements.themes.join(", ")}
Style: ${context.persistentElements.style}

Narrator: You are LoomLove, The narrator of this story. You take the form of a bulky,swagged out, buff, male, bipedal-polar bear. Swagged out like a suited up church going uncle. Like you've got that drip on. 


Story Thread Segments:
${segments.map((s, i) => `[${i + 1}] "${s.text}"`).join("\n\n")}

Create a series of detailed, cohesive image prompts that:
1. Flow together visually as a consistent narrative
2. Maintain character appearances and setting details throughout
3. Build on the visual elements established in previous images
4. Share a consistent artistic style and mood, explicitly state the style in each prompt.
5. Are optimized for image generation

IMPORTANT: Response must be a JSON object with EXACTLY this structure:
{
    "prompts": [
        "Detailed prompt for segment 1...",
        "Detailed prompt for segment 2...",
        // etc...
    ]
}`;

                const response = await generateText({
                    runtime: this.runtime,
                    context: promptContext,
                    modelClass: ModelClass.LARGE,
                });

                // Clean the response: remove markdown code blocks and any extra whitespace
                const cleanedResponse = response
                    .replace(/```(?:json)?\n?/g, '')  // Remove code blocks
                    .replace(/\n\s*\n/g, '\n')        // Remove extra newlines
                    .trim();

                let parsed;
                try {
                    parsed = JSON.parse(cleanedResponse);
                } catch (parseError) {
                    // Try to extract JSON from the string if direct parsing fails
                    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                    } else {
                        throw parseError;
                    }
                }

                if (!Array.isArray(parsed.prompts)) {
                    throw new Error('Response does not contain prompts array');
                }

                if (parsed.prompts.length !== segments.length) {
                    elizaLogger.warn('Prompt count mismatch', {
                        expected: segments.length,
                        received: parsed.prompts.length,
                        attempt: attempt + 1
                    });
                    throw new Error('Prompt count mismatch');
                }

                elizaLogger.debug('Generated cohesive image prompts', {
                    promptCount: parsed.prompts.length,
                    samplePrompt: parsed.prompts[0].substring(0, 100) + '...'
                });

                return segments.map((segment, index) => ({
                    ...segment,
                    imagePrompt: parsed.prompts[index]
                }));

            } catch (error) {
                attempt++;
                elizaLogger.warn('Failed to parse image prompts, attempt ${attempt}/${MAX_RETRIES}', {
                    error: error instanceof Error ? error.message : String(error),
                    attempt,
                    maxRetries: MAX_RETRIES
                });

                if (attempt === MAX_RETRIES) {
                    elizaLogger.error('All attempts to parse image prompts failed', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Return segments without image prompts as fallback
                    return segments;
                }

                // Wait before retrying (with exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }

        // Typescript needs this even though it's unreachable
        return segments;
    }

    private async saveStoryToMemory(storyContext: StoryContext) {
        const roomId = stringToUuid('twitter');
        
        elizaLogger.debug('Attempting to save story to memory', {
            storyLength: storyContext.story.length,
            persistentElements: Object.keys(storyContext.persistentElements),
            roomId: roomId
        });

        try {
            // First, ensure the room exists
            const room = await this.runtime.databaseAdapter.getRoom(roomId);
            if (!room) {
                elizaLogger.info('Creating twitter room');
                // First create the room
                await this.runtime.databaseAdapter.createRoom(roomId);
                
                // Then add the current user as a participant
                await this.runtime.databaseAdapter.addParticipant(
                    this.runtime.character.id,
                    roomId
                );
            }

            // Create memory object with required fields
            const memory: Memory = {
                id: crypto.randomUUID(),
                roomId: roomId,
                userId: this.runtime.character.id,
                agentId: this.runtime.character.id,
                createdAt: Date.now(),
                content: {
                    text: storyContext.story,
                    summary: storyContext.story.substring(0, 100) + '...',
                    elements: storyContext.persistentElements
                },
                embedding: embeddingZeroVector
            };

            // Save to database
            await this.runtime.messageManager.createMemory(memory);

            elizaLogger.info('Story saved to memory successfully', {
                memoryId: memory.id,
                roomId: memory.roomId,
                userId: memory.userId,
                agentId: memory.agentId
            });

            return memory;
        } catch (error) {
            elizaLogger.error('Failed to save story to memory', {
                error: error instanceof Error ? error.message : String(error),
                code: error instanceof Error ? (error as any).code : undefined,
                roomId: roomId,
                userId: this.runtime.character.id,
                agentId: this.runtime.character.id
            });
            throw error;
        }
    }


    
    private async generateStorySummary(storyContext: StoryContext): Promise<string> {
        const summaryPrompt = `# Task: Create a brief summary of this story

Story: "${storyContext.story}"

Create a 1-2 sentence summary that captures the key elements and themes.
Respond with only the summary text.`;

        const summary = await generateText({
            runtime: this.runtime,
            context: summaryPrompt,
            modelClass: ModelClass.LARGE,
        });

        return summary.trim();
    }
} 
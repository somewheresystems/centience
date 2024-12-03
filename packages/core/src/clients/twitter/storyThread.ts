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

    onReady(): void {
        const generateStoryLoop = () => {
            this.generateStory();
            setTimeout(
                generateStoryLoop,
                (Math.floor(Math.random() * (240 - 180 + 1)) + 60) * 60 * 1000
            ); // Random interval between 60-120 minutes
        };
        generateStoryLoop();
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

        // Generate tweet segments and enhance with image prompts
        elizaLogger.info('Segmenting story into tweets...');
        const segments = await this.segmentIntoTweets(storyContext);
        elizaLogger.info(`Story segmented into ${segments.length} tweets`);
       
        //Image Prompts!!!
        elizaLogger.info('Enhancing segments with image prompts...');
        const enhancedSegments = await this.enhanceSegmentsWithImagePrompts(segments, storyContext);
        elizaLogger.info(`Generated ${enhancedSegments.length} image prompts`);
       
        ///Actually Generate Images!!!
        elizaLogger.info('Generating images from prompts...');
        const segmentsWithImages = await this.generateImagesForSegments(enhancedSegments);
        elizaLogger.info(`Generated images for ${segmentsWithImages.filter(s => s.imageUrl).length} segments`);

        // Upload images to Twitter and get media IDs
        elizaLogger.info('Beginning image upload process...');
        for (const segment of enhancedSegments) {
            if (segment.imageUrl) {
                elizaLogger.debug('Processing image:', {
                    imageUrl: segment.imageUrl,
                    tweetText: segment.text.substring(0, 50) + '...'
                });

                try {
                    const buffer = fs.readFileSync(segment.imageUrl);
                    const mediaData = buffer.toString('base64');
                    
                    const response = await this.uploadMedia({
                        command: 'INIT',
                        total_bytes: buffer.length,
                        media_type: 'image/png',
                        media_category: 'tweet_image',
                        media_data: mediaData
                    });
                    
                    if (!response?.media_id_string) {
                        throw new Error('Failed to get media_id from upload response');
                    }

                    segment.mediaId = response.media_id_string;
                    
                    elizaLogger.info('Image uploaded successfully', {
                        mediaId: segment.mediaId,
                        response: response
                    });
                } catch (error) {
                    elizaLogger.error('Error uploading media to Twitter:', error);
                }
            }
        }

        // Post the story thread
        elizaLogger.info('Posting story thread...');
        await this.postStoryThread(enhancedSegments);

        elizaLogger.info('Story generation and posting completed successfully', {
            storyLength: storyContext.story.length,
            elements: Object.keys(storyContext.persistentElements),
            totalSegments: enhancedSegments.length,
            segmentsWithImages: enhancedSegments.filter(s => s.mediaId).length
        });

        return storyContext;

    } catch (error) {
        elizaLogger.error('Story generation failed', {
            error: error instanceof Error ? error.message : String(error),
            type: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined
        });
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

    private async generateImagesForSegments(segments: TweetSegment[]): Promise<TweetSegment[]> {
        elizaLogger.info("Starting image generation process", {
            totalSegments: segments.length,
            segmentsWithPrompts: segments.filter(s => s.imagePrompt).length
        });
        
        const finalSegments: TweetSegment[] = [];
        const cachePath = path.join(process.cwd(), "imagecache");
        
        try {
            // Create cache directory if it doesn't exist
            if (!fs.existsSync(cachePath)) {
                elizaLogger.info("Creating image cache directory", { path: cachePath });
                fs.mkdirSync(cachePath, { recursive: true });
            }

            for (const segment of segments) {
                try {
                    if (segment.imagePrompt) {
                        elizaLogger.info("Generating image for segment", {
                            text: segment.text.substring(0, 100) + '...',
                            prompt: segment.imagePrompt.substring(0, 100) + '...'
                        });
                        
                        const imageResult = await generateImage(
                            {
                                prompt: segment.imagePrompt,
                                width: 1024,
                                height: 1024,
                                count: 1
                            },
                            this.runtime
                        );

                        elizaLogger.debug("Image generation result", {
                            success: imageResult.success,
                            hasData: !!imageResult.data?.[0]
                        });

                        if (imageResult.success && imageResult.data?.[0]) {
                            try {
                                // Create a unique filename based on the image URL
                                const imageUrl = imageResult.data[0];
                                const imageHash = crypto.createHash('md5').update(imageUrl).digest('hex');
                                const cacheFile = path.join(cachePath, `${imageHash}.png`);
                                
                                let imageBuffer: ArrayBuffer;

                                // Check if image exists in cache
                                if (fs.existsSync(cacheFile)) {
                                    elizaLogger.debug("Using cached image", { path: cacheFile });
                                    const fileBuffer = fs.readFileSync(cacheFile);
                                    const tempBuffer = fileBuffer.buffer.slice(
                                        fileBuffer.byteOffset,
                                        fileBuffer.byteOffset + fileBuffer.byteLength
                                    );
                                    if (tempBuffer instanceof SharedArrayBuffer) {
                                        throw new Error('SharedArrayBuffer not supported');
                                    }
                                    imageBuffer = tempBuffer;
                                } else {
                                    // Download and cache the image
                                    elizaLogger.debug("Downloading and caching new image", { url: imageUrl });
                                    const imageResponse = await fetch(imageUrl);
                                    const tempBuffer = await imageResponse.arrayBuffer();
                                    if (tempBuffer instanceof SharedArrayBuffer) {
                                        throw new Error('SharedArrayBuffer not supported');
                                    }
                                    imageBuffer = tempBuffer;
                                    fs.writeFileSync(cacheFile, Buffer.from(imageBuffer));
                                    elizaLogger.debug("Cached new image", { path: cacheFile });
                                }

                                // Upload to Twitter using chunked upload
                                elizaLogger.debug("Uploading image to Twitter");
                                const mediaId = await this.uploadImageToTwitter(imageBuffer);
                                elizaLogger.info("Image uploaded successfully", { mediaId });

                                finalSegments.push({
                                    ...segment,
                                    imageUrl: imageUrl,
                                    mediaId: mediaId
                                });
                            } catch (error) {
                                elizaLogger.error("Error uploading media to Twitter", {
                                    error: error instanceof Error ? error.message : String(error)
                                });
                                finalSegments.push(segment);
                            }
                        } else {
                            elizaLogger.error("Failed to generate image for segment", {
                                text: segment.text.substring(0, 100) + '...'
                            });
                            finalSegments.push(segment);
                        }
                    } else {
                        finalSegments.push(segment);
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    elizaLogger.error("Error processing segment", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    finalSegments.push(segment);
                }
            }
        } catch (err) {
            elizaLogger.error("Fatal error in generateImagesForSegments", {
                error: err instanceof Error ? err.message : String(err)
            });
        }

        elizaLogger.info("Completed image generation", {
            totalProcessed: finalSegments.length,
            withImages: finalSegments.filter(s => s.imageUrl).length
        });
        
        return finalSegments;
    }

    private async postStoryThread(segments: TweetSegment[]): Promise<void> {
        let previousTweetId: string | undefined;

        for (const segment of segments) {
            try {
                elizaLogger.debug('Processing tweet:', {
                    text: segment.text,
                    hasMediaId: !!segment.mediaId,
                    mediaId: segment.mediaId,
                    replyingTo: previousTweetId
                });

                const result = await this.twitterClient.sendTweet(
                    segment.text,
                    previousTweetId
                );

                const responseData = await result.json();
                elizaLogger.debug('Twitter API raw response:', responseData);

                if (responseData?.data?.create_tweet?.tweet_results?.result?.rest_id) {
                    previousTweetId = responseData.data.create_tweet.tweet_results.result.rest_id;
                } else {
                    throw new Error('Failed to get tweet ID from response');
                }

            } catch (error) {
                elizaLogger.error('Failed to post tweet:', {
                    error: error instanceof Error ? {
                        name: error.name,
                        message: error.message,
                        cause: error.cause,
                        stack: error.stack
                    } : error,
                    tweetData: {
                        text: segment.text,
                        mediaId: segment.mediaId,
                        replyingTo: previousTweetId
                    }
                });
                throw error;
            }
        }
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

    private async uploadMediaToTwitter(params: {
        command: 'INIT' | 'APPEND' | 'FINALIZE' | 'STATUS';
        total_bytes?: number;
        media_type?: string;
        media_category?: string;
        media_id?: string;
        segment_index?: number;
        media_data?: string;
    }): Promise<TwitterMediaResponse> {
        return this.twitterClient.uploadMedia(params);
    }

    protected async uploadImageToTwitter(imageData: ArrayBuffer): Promise<string | undefined> {
        try {
            // Create temp directory if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            await fsPromises.mkdir(tempDir, { recursive: true });

            // Convert ArrayBuffer to Buffer
            const imageBuffer = Buffer.from(imageData);

            // Create temp file
            const tempFileName = path.join(tempDir, `${crypto.randomUUID()}.png`);
            await fsPromises.writeFile(tempFileName, imageBuffer, {
                encoding: null,
                mode: 0o666
            });

            try {
                // Read the file synchronously for upload
                // Use the Twitter client's sendTweet method with media
                const result = await this.requestQueue.add(
                    async () => this.twitterClient.sendTweet(
                        '', // Empty text
                        undefined // No reply ID
                    )
                );

                const body = await result.json();
                const mediaId = body.data?.create_tweet?.tweet_results?.result?.legacy?.entities?.media?.[0]?.id_str;

                // Cleanup temp file
                await fsPromises.unlink(tempFileName).catch(err => 
                    elizaLogger.error("Error cleaning up temp file:", err)
                );

                return mediaId;

            } catch (error) {
                elizaLogger.error("Error uploading media to Twitter", { error });
                return undefined;
            }

        } catch (error) {
            elizaLogger.error("Error in uploadImageToTwitter:", { error });
            return undefined;
        }
    }
    private async waitForMediaProcessing(mediaId: string): Promise<void> {
        const MAX_RETRIES = 10;
        let retries = 0;

        while (retries < MAX_RETRIES) {
            const response = await this.uploadMedia({
                command: 'STATUS',
                media_id: mediaId
            });

            const state = response?.processing_info?.state;

            if (state === 'succeeded') {
                return;
            }
            if (state === 'failed') {
                throw new Error(`Media processing failed: ${response?.processing_info?.error?.message}`);
            }

            const waitTime = response?.processing_info?.check_after_secs || 1;
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            retries++;
        }

        throw new Error(`Media processing timed out after ${MAX_RETRIES} retries`);
    }
} 
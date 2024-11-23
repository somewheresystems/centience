import type { Tweet} from "agent-twitter-client";

// Base response structure for Twitter API
export interface TwitterResponseData {
    data?: {
        create_tweet?: {
            tweet_results?: {
                result?: {
                    rest_id: string;
                    legacy?: {
                        full_text: string;
                        conversation_id_str: string;
                        created_at: string;
                        user_id_str: string;
                        in_reply_to_status_id_str?: string;
                        entities: {
                            hashtags: Array<{
                                text: string;
                                indices: number[];
                            }>;
                            user_mentions: Array<{
                                screen_name: string;
                                name: string;
                                id_str: string;
                                indices: number[];
                            }>;
                            urls: Array<{
                                url: string;
                                expanded_url: string;
                                display_url: string;
                                indices: number[];
                            }>;
                            media?: Array<{
                                id_str: string;
                                indices: number[];
                                media_url: string;
                                media_url_https: string;
                                url: string;
                                display_url: string;
                                expanded_url: string;
                                type: string;
                                sizes: {
                                    thumb: { w: number; h: number; resize: string };
                                    medium: { w: number; h: number; resize: string };
                                    small: { w: number; h: number; resize: string };
                                    large: { w: number; h: number; resize: string };
                                };
                            }>;
                        };
                    };
                    core?: {
                        user_results?: {
                            result?: {
                                legacy?: {
                                    screen_name: string;
                                    name: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        // Media upload responses remain the same
        media_upload_init?: {
            media_id_string: string;
        };
        media_upload_append?: {
            success: boolean;
        };
        media_upload_finalize?: {
            media_id_string: string;
            processing_info?: {
                state: string;
                check_after_secs?: number;
                error?: {
                    message: string;
                    code: number;
                };
            };
        };
    };
    errors?: Array<{ message: string; code: number }>;
}

// Helper function to process API responses
export async function processTwitterResponse(response: Response): Promise<TwitterResponseData> {
    if (!response.ok) {
        throw new Error(`Twitter API error (${response.status}): ${response.statusText}`);
    }
    
    const data = await response.json() as TwitterResponseData;
    
    if (data.errors?.length > 0) {
        const errorMessages = data.errors.map(e => `Code ${e.code}: ${e.message}`).join(', ');
        throw new Error(`Twitter API returned errors: ${errorMessages}`);
    }
    
    return data;
}

// Convert Twitter API response to our Tweet type
export async function processTweetResponse(response: Response): Promise<Tweet> {
    const data = await processTwitterResponse(response);
    const tweetResult = data.data?.create_tweet?.tweet_results?.result;
    
    if (!tweetResult?.rest_id || !tweetResult.legacy) {
        throw new Error('Invalid tweet response structure');
    }

    const legacy = tweetResult.legacy;
    const user = tweetResult.core?.user_results?.result?.legacy;

    return {
        id: tweetResult.rest_id,
        text: legacy.full_text,
        conversationId: legacy.conversation_id_str,
        userId: legacy.user_id_str,
        inReplyToStatusId: legacy.in_reply_to_status_id_str,
        timestamp: new Date(legacy.created_at).getTime() / 1000,
        permanentUrl: `https://twitter.com/i/web/status/${tweetResult.rest_id}`,
        hashtags: legacy.entities?.hashtags?.map(h => h.text) || [],
        mentions: legacy.entities?.user_mentions?.map(m => ({
            username: m.screen_name,
            id: m.id_str,
            name: m.name
        })) || [],
        photos: legacy.entities?.media
            ?.filter(m => m.type === 'photo')
            ?.map(m => ({
                id: m.id_str,
                url: m.media_url_https,
                width: m.sizes.large.w,
                height: m.sizes.large.h,
                alt_text: ""
            })) || [],
        urls: legacy.entities?.urls?.map(u => u.expanded_url) || [],
        videos: legacy.entities?.media
            ?.filter(m => m.type === 'video' || m.type === 'animated_gif')
            ?.map(m => ({
                id: m.id_str,
                url: m.media_url_https,
                preview: m.media_url_https  // Just use the URL string for preview
            })) || [],
        thread: [],
        username: user?.screen_name || "",
        name: user?.name || "",
    };
}
// Process media upload response
export async function processMediaUploadResponse(response: Response): Promise<string> {
    const data = await processTwitterResponse(response);
    
    if (data.data?.media_upload_init?.media_id_string) {
        return data.data.media_upload_init.media_id_string;
    }
    
    if (data.data?.media_upload_finalize?.media_id_string) {
        return data.data.media_upload_finalize.media_id_string;
    }
    
    throw new Error('No media ID found in response');
} 
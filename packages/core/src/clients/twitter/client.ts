import { Scraper, Tweet, SearchMode, QueryTweetsResponse, Profile } from "goat-x";

// Extend the Scraper type with additional methods
declare module "goat-x" {
    interface TwitterAuth {
        ct0: string;
        auth_token: string;
        appKey?: string;
        appSecret?: string;
        accessToken?: string;
        accessSecret?: string;
    }

    interface GrokMessage {
        role: 'user' | 'assistant';
        content: string;
    }

    interface GrokChatOptions {
        messages: GrokMessage[];
        model?: string;
        temperature?: number;
    }

    interface GrokChatResponse {
        content: string;
        model: string;
    }

    interface Scraper {
        // Authentication
        login(username: string, password: string, email?: string): Promise<void>;
        logout(): Promise<void>;
        isLoggedIn(): Promise<boolean>;
        getCookies(): Promise<any[]>;
        setCookies(cookies: string[]): Promise<void>;
        clearCookies(): Promise<void>;

        // Profile
        getProfile(username: string): Promise<Profile>;
        getUserIdByScreenName(username: string): Promise<string>;
        me(): Promise<Profile>;

        // Search
        searchTweets(query: string, maxTweets: number, mode: SearchMode): AsyncGenerator<Tweet, void>;
        searchProfiles(query: string, maxResults: number): AsyncGenerator<Profile, void>;
        fetchSearchTweets(query: string, maxTweets: number, mode: SearchMode, cursor?: string): Promise<QueryTweetsResponse>;
        fetchSearchProfiles(query: string, maxResults: number): Promise<{ profiles: Profile[]; next?: string }>;

        // Tweets
        getTweets(username: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
        getTweetsAndReplies(username: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
        getLikedTweets(username: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
        getTweetsWhere(tweets: AsyncIterable<Tweet>, predicate: (tweet: Tweet) => boolean | Promise<boolean>): Promise<Tweet[]>;
        getLatestTweet(username: string, includeRetweets?: boolean, maxTweets?: number): Promise<Tweet | null>;
        getTweet(id: string): Promise<Tweet | null>;
        getTweetV2(id: string, options?: { expansions?: string[]; tweetFields?: string[]; pollFields?: string[]; mediaFields?: string[]; userFields?: string[]; placeFields?: string[] }): Promise<Tweet | null>;
        getTweetsV2(ids: string[], options?: { expansions?: string[]; tweetFields?: string[]; pollFields?: string[]; mediaFields?: string[]; userFields?: string[]; placeFields?: string[] }): Promise<Tweet[]>;
        sendTweet(text: string, options?: { inReplyTo?: string; mediaData?: Array<{ data: Buffer; mediaType: string }> }): Promise<Tweet>;
        sendTweetV2(text: string, options?: { inReplyTo?: string; poll?: { options: { label: string }[]; durationMinutes: number } }): Promise<Tweet>;
        sendQuoteTweet(text: string, quotedTweetId: string, options?: { mediaData?: Array<{ data: Buffer; mediaType: string }> }): Promise<Tweet>;
        retweet(id: string): Promise<void>;
        likeTweet(id: string): Promise<void>;

        // Timeline
        fetchHomeTimeline(count: number, excludeIds?: string[]): Promise<Tweet[]>;
        fetchListTweets(listId: string, count: number): Promise<Tweet[]>;

        // Relationships
        getFollowers(userId: string, maxResults: number): AsyncGenerator<Profile, void>;
        getFollowing(userId: string, maxResults: number): AsyncGenerator<Profile, void>;
        fetchProfileFollowers(userId: string, maxResults: number): Promise<{ profiles: Profile[]; next?: string }>;
        fetchProfileFollowing(userId: string, maxResults: number): Promise<{ profiles: Profile[]; next?: string }>;
        followUser(username: string): Promise<void>;

        // Trends
        getTrends(): Promise<string[]>;

        // Grok
        grokChat(options: GrokChatOptions): Promise<GrokChatResponse>;
    }
}

export { Scraper, Tweet, SearchMode, QueryTweetsResponse, Profile }; 
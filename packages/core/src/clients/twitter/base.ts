import {
    QueryTweetsResponse,
    Scraper,
    SearchMode,
    Tweet,
} from "goat-x";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { embeddingZeroVector } from "../../core/memory.ts";
import {
    Content,
    IAgentRuntime,
    Memory,
    State,
    UUID,
} from "../../core/types.ts";
import ImageDescriptionService from "../../services/image.ts";

import { glob } from "glob";

import { stringToUuid } from "../../core/uuid.ts";
import { elizaLogger } from "../../index.ts";

export function extractAnswer(text: string): string {
    const startIndex = text.indexOf("Answer: ") + 8;
    const endIndex = text.indexOf("<|endoftext|>", 11);
    return text.slice(startIndex, endIndex);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RequestQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing: boolean = false;

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

export class ClientBase extends EventEmitter {
    static _twitterClient: Scraper;
    twitterClient: Scraper;
    runtime: IAgentRuntime;
    directions: string;
    lastCheckedTweetId: number | null = null;
    tweetCacheFilePath = "tweetcache/latest_checked_tweet_id.txt";
    imageDescriptionService: ImageDescriptionService;
    temperature: number = 0.5;

    private tweetCache: Map<string, Tweet> = new Map();
    requestQueue: RequestQueue = new RequestQueue();
    twitterUserId: string;

    async cacheTweet(tweet: Tweet): Promise<void> {
        if (!tweet) {
            console.warn("Tweet is undefined, skipping cache");
            return;
        }
        const cacheDir = path.join(
            __dirname,
            "../../../tweetcache",
            tweet.conversationId,
            `${tweet.id}.json`
        );
        await fs.promises.mkdir(path.dirname(cacheDir), { recursive: true });
        await fs.promises.writeFile(cacheDir, JSON.stringify(tweet, null, 2));
        this.tweetCache.set(tweet.id, tweet);
    }

    async getCachedTweet(tweetId: string): Promise<Tweet | undefined> {
        if (this.tweetCache.has(tweetId)) {
            return this.tweetCache.get(tweetId);
        }

        const cacheFile = path.join(
            __dirname,
            "tweetcache",
            "*",
            `${tweetId}.json`
        );
        const files = await glob(cacheFile);
        if (files.length > 0) {
            const tweetData = await fs.promises.readFile(files[0], "utf-8");
            const tweet = JSON.parse(tweetData) as Tweet;
            this.tweetCache.set(tweet.id, tweet);
            return tweet;
        }

        return undefined;
    }

    async getTweet(tweetId: string): Promise<Tweet> {
        const cachedTweet = await this.getCachedTweet(tweetId);
        if (cachedTweet) {
            return cachedTweet;
        }

        const tweet = await this.requestQueue.add(() =>
            this.twitterClient.getTweet(tweetId)
        );
        await this.cacheTweet(tweet);
        return tweet;
    }

    callback: (self: ClientBase) => any = null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        super();
        this.runtime = runtime;
        if (ClientBase._twitterClient) {
            this.twitterClient = ClientBase._twitterClient;
        } else {
            this.twitterClient = new Scraper();
            ClientBase._twitterClient = this.twitterClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();

        try {
            if (fs.existsSync(this.tweetCacheFilePath)) {
                const data = fs.readFileSync(this.tweetCacheFilePath, "utf-8");
                this.lastCheckedTweetId = parseInt(data.trim());
            } else {
                console.warn("Tweet cache file not found.");
            }
        } catch (error) {
            console.error(
                "Error loading latest checked tweet ID from file:",
                error
            );
        }
        const cookiesFilePath = path.join(
            __dirname,
            "../../../tweetcache/" +
                this.runtime.getSetting("TWITTER_USERNAME") +
                "_cookies.json"
        );

        const dir = path.dirname(cookiesFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // async initialization
        (async () => {
            console.log("Starting Twitter client initialization...");
            // Check for Twitter cookies
            if (this.runtime.getSetting("TWITTER_COOKIES")) {
                console.log("Found Twitter cookies in runtime settings");
                const cookiesArray = JSON.parse(
                    this.runtime.getSetting("TWITTER_COOKIES")
                );
                await this.setCookiesFromArray(cookiesArray);
                console.log("Successfully set cookies from runtime settings");
            } else {
                console.log("No cookies in runtime settings, checking file...");
                console.log("Cookies file path:", cookiesFilePath);
                if (fs.existsSync(cookiesFilePath)) {
                    console.log("Found cookies file, loading cookies...");
                    const cookiesArray = JSON.parse(
                        fs.readFileSync(cookiesFilePath, "utf-8")
                    );
                    await this.setCookiesFromArray(cookiesArray);
                    console.log("Successfully loaded and set cookies from file");
                } else {
                    console.log("No cookies file found, attempting direct login...");
                    try {
                        await this.twitterClient.login(
                            this.runtime.getSetting("TWITTER_USERNAME"),
                            this.runtime.getSetting("TWITTER_PASSWORD"),
                            this.runtime.getSetting("TWITTER_EMAIL")
                        );
                        console.log("Successfully logged in to Twitter");
                        const cookies = await this.twitterClient.getCookies();
                        fs.writeFileSync(
                            cookiesFilePath,
                            JSON.stringify(cookies),
                            "utf-8"
                        );
                        console.log("Successfully saved cookies to file");
                    } catch (error) {
                        console.error("Failed to login to Twitter:", error);
                    }
                }
            }

            let loggedInWaits = 0;
            console.log("Checking login status...");

            while (!(await this.twitterClient.isLoggedIn())) {
                console.log(`Login check attempt ${loggedInWaits + 1} of 10...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                if (loggedInWaits > 10) {
                    console.error("Max login attempts reached, trying fresh login");
                    try {
                        await this.twitterClient.login(
                            this.runtime.getSetting("TWITTER_USERNAME"),
                            this.runtime.getSetting("TWITTER_PASSWORD"),
                            this.runtime.getSetting("TWITTER_EMAIL")
                        );
                        console.log("Fresh login successful");
                        const cookies = await this.twitterClient.getCookies();
                        fs.writeFileSync(
                            cookiesFilePath,
                            JSON.stringify(cookies),
                            "utf-8"
                        );
                        console.log("Saved new cookies after fresh login");
                        loggedInWaits = 0;
                    } catch (error) {
                        console.error("Fresh login attempt failed:", error);
                    }
                }
                loggedInWaits++;
            }

            console.log("Successfully logged in, getting user ID...");
            const userId = await this.requestQueue.add(async () => {
                console.log("Waiting 10 seconds before user ID request...");
                await new Promise((resolve) => setTimeout(resolve, 10000));
                try {
                    const id = await this.twitterClient.getUserIdByScreenName(
                        this.runtime.getSetting("TWITTER_USERNAME")
                    );
                    console.log("Successfully retrieved user ID:", id);
                    return id;
                } catch (error) {
                    console.error("Error getting user ID:", error);
                    return null;
                }
            });
            if (!userId) {
                console.error("Failed to get user ID, initialization failed");
                return;
            }
            console.log("Twitter user ID:", userId);
            this.twitterUserId = userId;

            console.log("Populating timeline...");
            await this.populateTimeline();
            console.log("Timeline populated successfully");

            console.log("Twitter client initialization complete, calling onReady");
            this.onReady();
        })();
    }

    async fetchHomeTimeline(count: number): Promise<Tweet[]> {
        const homeTimeline = await this.twitterClient.fetchHomeTimeline(
            count,
            []
        );

        return homeTimeline
            .filter((t) => t.__typename !== "TweetWithVisibilityResults")
            .map((tweet) => {
                // console.log("tweet is", tweet);
                const obj = {
                    id: tweet.rest_id,
                    name:
                        tweet.name ??
                        tweet.core?.user_results?.result?.legacy.name,
                    username:
                        tweet.username ??
                        tweet.core?.user_results?.result?.legacy.screen_name,
                    text: tweet.text ?? tweet.legacy?.full_text,
                    inReplyToStatusId:
                        tweet.inReplyToStatusId ??
                        tweet.legacy?.in_reply_to_status_id_str,
                    createdAt: tweet.createdAt ?? tweet.legacy?.created_at,
                    userId: tweet.userId ?? tweet.legacy?.user_id_str,
                    conversationId:
                        tweet.conversationId ??
                        tweet.legacy?.conversation_id_str,
                    hashtags: tweet.hashtags ?? tweet.legacy?.entities.hashtags,
                    mentions:
                        tweet.mentions ?? tweet.legacy?.entities.user_mentions,
                    photos:
                        tweet.photos ??
                        tweet.legacy?.entities.media?.filter(
                            (media) => media.type === "photo"
                        ) ??
                        [],
                    thread: [],
                    urls: tweet.urls ?? tweet.legacy?.entities.urls,
                    videos:
                        tweet.videos ??
                        tweet.legacy?.entities.media?.filter(
                            (media) => media.type === "video"
                        ) ??
                        [],
                };

                // console.log("obj is", obj);

                return obj;
            });
    }

    async fetchSearchTweets(
        query: string,
        maxTweets: number,
        searchMode: SearchMode,
        cursor?: string
    ): Promise<QueryTweetsResponse> {
        try {
            // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
            // if we dont get a response in 5 seconds, something is wrong
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ tweets: [] }), 10000)
            );

            try {
                const result = await this.requestQueue.add(
                    async () =>
                        await Promise.race([
                            this.twitterClient.fetchSearchTweets(
                                query,
                                maxTweets,
                                searchMode,
                                cursor
                            ),
                            timeoutPromise,
                        ])
                );
                return (result ?? { tweets: [] }) as QueryTweetsResponse;
            } catch (error) {
                console.error("Error fetching search tweets:", error);
                return { tweets: [] };
            }
        } catch (error) {
            console.error("Error fetching search tweets:", error);
            return { tweets: [] };
        }
    }

    private async populateTimeline() {
        const cacheFile = "timeline_cache.json";

        // Check if the cache file exists
        if (fs.existsSync(cacheFile)) {
            // Read the cached search results from the file
            const cachedResults = JSON.parse(
                fs.readFileSync(cacheFile, "utf-8")
            );

            // Get the existing memories from the database
            const existingMemories =
                await this.runtime.messageManager.getMemoriesByRoomIds({
                    agentId: this.runtime.agentId,
                    roomIds: cachedResults.map((tweet) =>
                        stringToUuid(
                            tweet.conversationId + "-" + this.runtime.agentId
                        )
                    ),
                });

            // Create a Set to store the IDs of existing memories
            const existingMemoryIds = new Set(
                existingMemories.map((memory) => memory.id.toString())
            );

            // Check if any of the cached tweets exist in the existing memories
            const someCachedTweetsExist = cachedResults.some((tweet) =>
                existingMemoryIds.has(tweet.id)
            );

            if (someCachedTweetsExist) {
                // Filter out the cached tweets that already exist in the database
                const tweetsToSave = cachedResults.filter(
                    (tweet) => !existingMemoryIds.has(tweet.id)
                );

                // Save the missing tweets as memories
                for (const tweet of tweetsToSave) {
                    const roomId = stringToUuid(
                        tweet.conversationId ??
                            "default-room-" + this.runtime.agentId
                    );
                    const tweetuserId =
                        tweet.userId === this.twitterUserId
                            ? this.runtime.agentId
                            : stringToUuid(tweet.userId);

                    await this.runtime.ensureConnection(
                        tweetuserId,
                        roomId,
                        tweet.username,
                        tweet.name,
                        "twitter"
                    );

                    const content = {
                        text: tweet.text,
                        url: tweet.permanentUrl,
                        source: "twitter",
                        inReplyTo: tweet.inReplyToStatusId
                            ? stringToUuid(
                                  tweet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    } as Content;

                    elizaLogger.log("Creating memory for tweet", tweet.id);

                    // check if it already exists
                    const memory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        );
                    if (memory) {
                        elizaLogger.log(
                            "Memory already exists, skipping timeline population"
                        );
                        break;
                    }

                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                        userId: tweetuserId,
                        content: content,
                        agentId: this.runtime.agentId,
                        roomId,
                        embedding: embeddingZeroVector,
                        createdAt: tweet.timestamp * 1000,
                    });
                }

                elizaLogger.log(
                    `Populated ${tweetsToSave.length} missing tweets from the cache.`
                );
                return;
            }
        }

        // Get the most recent 20 mentions and interactions
        const mentionsAndInteractions = await this.fetchSearchTweets(
            `@${this.runtime.getSetting("TWITTER_USERNAME")}`,
            20,
            SearchMode.Latest
        );

        // Combine the timeline tweets and mentions/interactions
        const allTweets = [...mentionsAndInteractions.tweets];

        // Create a Set to store unique tweet IDs
        const tweetIdsToCheck = new Set<string>();

        // Add tweet IDs to the Set
        for (const tweet of allTweets) {
            tweetIdsToCheck.add(tweet.id);
        }

        // Convert the Set to an array of UUIDs
        const tweetUuids = Array.from(tweetIdsToCheck).map((id) =>
            stringToUuid(id + "-" + this.runtime.agentId)
        );

        // Check the existing memories in the database
        const existingMemories =
            await this.runtime.messageManager.getMemoriesByRoomIds({
                agentId: this.runtime.agentId,
                roomIds: tweetUuids,
            });

        // Create a Set to store the existing memory IDs
        const existingMemoryIds = new Set<UUID>(
            existingMemories.map((memory) => memory.roomId)
        );

        // Filter out the tweets that already exist in the database
        const tweetsToSave = allTweets.filter(
            (tweet) =>
                !existingMemoryIds.has(
                    stringToUuid(tweet.id + "-" + this.runtime.agentId)
                )
        );

        await this.runtime.ensureUserExists(
            this.runtime.agentId,
            this.runtime.getSetting("TWITTER_USERNAME"),
            this.runtime.character.name,
            "twitter"
        );

        // Save the new tweets as memories
        for (const tweet of tweetsToSave) {
            const roomId = stringToUuid(
                tweet.conversationId ?? "default-room-" + this.runtime.agentId
            );
            const tweetuserId =
                tweet.userId === this.twitterUserId
                    ? this.runtime.agentId
                    : stringToUuid(tweet.userId);

            await this.runtime.ensureConnection(
                tweetuserId,
                roomId,
                tweet.username,
                tweet.name,
                "twitter"
            );

            const content = {
                text: tweet.text,
                url: tweet.permanentUrl,
                source: "twitter",
                inReplyTo: tweet.inReplyToStatusId
                    ? stringToUuid(tweet.inReplyToStatusId)
                    : undefined,
            } as Content;

            await this.runtime.messageManager.createMemory({
                id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                userId: tweetuserId,
                content: content,
                agentId: this.runtime.agentId,
                roomId,
                embedding: embeddingZeroVector,
                createdAt: tweet.timestamp * 1000,
            });
        }

        // Cache the search results to the file
        fs.writeFileSync(cacheFile, JSON.stringify(allTweets));
    }

    async setCookiesFromArray(cookiesArray: any[]) {
        const cookieStrings = cookiesArray.map(
            (cookie) =>
                `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
                    cookie.secure ? "Secure" : ""
                }; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${
                    cookie.sameSite || "Lax"
                }`
        );
        await this.twitterClient.setCookies(cookieStrings);
    }

    async saveRequestMessage(message: Memory, state: State) {
        if (message.content.text) {
            const recentMessage = await this.runtime.messageManager.getMemories(
                {
                    roomId: message.roomId,
                    agentId: this.runtime.agentId,
                    count: 1,
                    unique: false,
                }
            );

            if (
                recentMessage.length > 0 &&
                recentMessage[0].content === message.content
            ) {
                console.log("Message already saved", recentMessage[0].id);
            } else {
                await this.runtime.messageManager.createMemory({
                    ...message,
                    embedding: embeddingZeroVector,
                });
            }

            await this.runtime.evaluate(message, {
                ...state,
                twitterClient: this.twitterClient,
            });
        }
    }

    protected async hasRespondedToTweet(tweetId: string): Promise<boolean> {
        const memories = await this.runtime.messageManager.getMemoriesByRoomIds({
            agentId: this.runtime.agentId,
            roomIds: [stringToUuid(tweetId + "-" + this.runtime.agentId)]
        });
        
        return memories.some(memory => 
            memory.content.inReplyTo === stringToUuid(tweetId + "-" + this.runtime.agentId)
        );
    }

    protected async getQuotedContent(tweet: Tweet): Promise<string | null> {
        try {
            // Check if tweet has quoted content
            if (!tweet.quotedStatusId) {
                return null;
            }

            // Fetch the quoted tweet
            const quotedTweet = await this.requestQueue.add(() => 
                this.twitterClient.getTweet(tweet.quotedStatusId)
            );

            if (!quotedTweet) {
                return null;
            }

            let content = `Original Tweet by @${quotedTweet.username}:\n"${quotedTweet.text}"`;

            // Process images if they exist
            if (quotedTweet.photos && quotedTweet.photos.length > 0) {
                const imageDescriptions = [];
                for (const photo of quotedTweet.photos) {
                    const description = await this.runtime.imageDescriptionService.describeImage(
                        photo.url
                    );
                    imageDescriptions.push(description);
                }
                
                content += `\n\nImages in Quoted Tweet:\n${imageDescriptions.map(
                    (desc, i) => `Image ${i + 1}: ${desc}`
                ).join('\n')}`;
            }

            return content;

        } catch (error) {
            console.error('Error fetching quoted tweet:', error);
            return null;
        }
    }

    // Modify the existing buildTweetContext function or create a new one
    protected async buildTweetContext(tweet: Tweet): Promise<string> {
        let context = `Tweet by @${tweet.username}:\n"${tweet.text}"`;
        
        // Add quoted content if it exists
        const quotedContent = await this.getQuotedContent(tweet);
        if (quotedContent) {
            context += `\n\nQuoted Content:\n${quotedContent}`;
        }

        // Add any other context you want (replies, images, etc.)
        return context;
    }
}

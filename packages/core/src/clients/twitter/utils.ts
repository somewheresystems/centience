import { Tweet } from "agent-twitter-client";
import { embeddingZeroVector } from "../../core/memory.ts";
import { Content, Memory, UUID } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";
import { elizaLogger } from "../../index.ts";

const MAX_TWEET_LENGTH = 4000;

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export const isValidTweet = (tweet: Tweet): boolean => {
    // Filter out tweets with too many hashtags, @s, or $ signs, probably spam or garbage
    const hashtagCount = (tweet.text?.match(/#/g) || []).length;
    const atCount = (tweet.text?.match(/@/g) || []).length;
    const dollarSignCount = tweet.text?.match(/\$/g) || [];
    const totalCount = hashtagCount + atCount + dollarSignCount.length;

    return (
        hashtagCount <= 1 &&
        atCount <= 2 &&
        dollarSignCount.length <= 1 &&
        totalCount <= 3
    );
};

export async function buildConversationThread(
    tweet: Tweet,
    client: ClientBase,
    maxReplies: number = 10
): Promise<Tweet[]> {
    const thread: Tweet[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentTweet: Tweet, depth: number = 0) {
        if (!currentTweet) {
            return;
        }

        // Stop if we've reached our reply limit
        if (depth >= maxReplies) {
            return;
        }

        // Handle memory storage
        const memory = await client.runtime.messageManager.getMemoryById(
            stringToUuid(currentTweet.id + "-" + client.runtime.agentId)
        );
        if (!memory) {
            const roomId = stringToUuid(
                currentTweet.conversationId + "-" + client.runtime.agentId
            );
            const userId = stringToUuid(currentTweet.userId);

            await client.runtime.ensureConnection(
                userId,
                roomId,
                currentTweet.username,
                currentTweet.name,
                "twitter"
            );

            // Add special handling for first tweets in a conversation
            const isFirstTweet = !currentTweet.inReplyToStatusId;
            const points = currentTweet.text
                .split(/[.!?]/)
                .filter(point => point.trim())
                .map(point => point.trim());

            await client.runtime.messageManager.createMemory({
                id: stringToUuid(
                    currentTweet.id + "-" + client.runtime.agentId
                ),
                agentId: client.runtime.agentId,
                content: {
                    text: currentTweet.text,
                    source: "twitter",
                    url: currentTweet.permanentUrl,
                    inReplyTo: currentTweet.inReplyToStatusId
                        ? stringToUuid(
                              currentTweet.inReplyToStatusId +
                                  "-" +
                                  client.runtime.agentId
                          )
                        : undefined,
                    // Add additional context for first tweets
                    metadata: isFirstTweet ? {
                        isFirstTweet: true,
                        discussionPoints: points,
                        originalTopic: currentTweet.text
                    } : undefined
                },
                createdAt: currentTweet.timestamp * 1000,
                roomId,
                userId:
                    currentTweet.userId === client.twitterUserId
                        ? client.runtime.agentId
                        : stringToUuid(currentTweet.userId),
                embedding: embeddingZeroVector,
            });
        }

        if (visited.has(currentTweet.id)) {
            return;
        }

        visited.add(currentTweet.id);
        thread.unshift(currentTweet);

        // If there's a parent tweet, fetch and process it
        if (currentTweet.inReplyToStatusId) {
            try {
                const parentTweet = await client.twitterClient.getTweet(
                    currentTweet.inReplyToStatusId,
                );

                if (parentTweet) {
                    await processThread(parentTweet, depth + 1);
                }
            } catch (error) {
                elizaLogger.error("Error fetching parent tweet:", {
                    tweetId: currentTweet.inReplyToStatusId,
                    error
                });
            }
        }
    }

    await processThread(tweet, 0);

    return thread;
}

export async function sendTweetChunks(
    client: ClientBase,
    content: Content,
    roomId: UUID,
    twitterUsername: string,
    inReplyTo: string
): Promise<Memory[]> {
    const tweetChunks = splitTweetContent(content.text);
    const sentTweets: Tweet[] = [];

    for (const chunk of tweetChunks) {
        const result = await client.requestQueue.add(
            async () =>
                await client.twitterClient.sendTweet(
                    chunk.replaceAll(/\\n/g, "\n").trim(),
                    inReplyTo
                )
        );
        // console.log("send tweet result:\n", result);
        const body = await result.json();
        console.log("send tweet body:\n", body.data.create_tweet.tweet_results);
        const tweetResult = body.data.create_tweet.tweet_results.result;

        const finalTweet = {
            id: tweetResult.rest_id,
            text: tweetResult.legacy.full_text,
            conversationId: tweetResult.legacy.conversation_id_str,
            createdAt: tweetResult.legacy.created_at,
            userId: tweetResult.legacy.user_id_str,
            inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
            permanentUrl: `https://twitter.com/${twitterUsername}/status/${tweetResult.rest_id}`,
            hashtags: [],
            mentions: [],
            photos: [],
            thread: [],
            urls: [],
            videos: [],
        } as Tweet;

        sentTweets.push(finalTweet);
    }

    const memories: Memory[] = sentTweets.map((tweet) => ({
        id: stringToUuid(tweet.id + "-" + client.runtime.agentId),
        agentId: client.runtime.agentId,
        userId: client.runtime.agentId,
        content: {
            text: tweet.text,
            source: "twitter",
            url: tweet.permanentUrl,
            inReplyTo: tweet.inReplyToStatusId
                ? stringToUuid(
                    tweet.inReplyToStatusId + "-" + client.runtime.agentId
                )
                : undefined,
        },
        roomId,
        embedding: embeddingZeroVector,
        createdAt: tweet.timestamp * 1000,
    }));

    return memories;
}

export async function sendTweet(
    client: ClientBase,
    content: Content,
    roomId: UUID,
    twitterUsername: string,
    inReplyTo: string
): Promise<Memory[]> {
    const chunk = truncateTweetContent(content.text);
    const sentTweets: Tweet[] = [];

    const result = await client.requestQueue.add(
        async () =>
            await client.twitterClient.sendTweet(
                chunk.replaceAll(/\\n/g, "\n").trim(),
                inReplyTo
            )
    );
    // console.log("send tweet result:\n", result);
    const body = await result.json();
    console.log("send tweet body:\n", body.data.create_tweet.tweet_results);
    const tweetResult = body.data.create_tweet.tweet_results.result;

    const finalTweet = {
        id: tweetResult.rest_id,
        text: tweetResult.legacy.full_text,
        conversationId: tweetResult.legacy.conversation_id_str,
        createdAt: tweetResult.legacy.created_at,
        userId: tweetResult.legacy.user_id_str,
        inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
        permanentUrl: `https://twitter.com/${twitterUsername}/status/${tweetResult.rest_id}`,
        hashtags: [],
        mentions: [],
        photos: [],
        thread: [],
        urls: [],
        videos: [],
    } as Tweet;

    sentTweets.push(finalTweet);

    const memories: Memory[] = sentTweets.map((tweet) => ({
        id: stringToUuid(tweet.id + "-" + client.runtime.agentId),
        agentId: client.runtime.agentId,
        userId: client.runtime.agentId,
        content: {
            text: tweet.text,
            source: "twitter",
            url: tweet.permanentUrl,
            inReplyTo: tweet.inReplyToStatusId
                ? stringToUuid(
                    tweet.inReplyToStatusId + "-" + client.runtime.agentId
                )
                : undefined,
        },
        roomId,
        embedding: embeddingZeroVector,
        createdAt: tweet.timestamp * 1000,
    }));

    return memories;
}

function splitTweetContent(content: string): string[] {
    const tweetChunks: string[] = [];
    let currentChunk = "";

    const words = content.split(" ");
    for (const word of words) {
        if (currentChunk.length + word.length + 1 <= MAX_TWEET_LENGTH) {
            currentChunk += (currentChunk ? " " : "") + word;
        } else {
            tweetChunks.push(currentChunk);
            currentChunk = word;
        }
    }

    if (currentChunk) {
        tweetChunks.push(currentChunk);
    }

    return tweetChunks;
}

export function truncateTweetContent(content: string): string {
    // if its 240, delete the last line
    if (content.length === MAX_TWEET_LENGTH) {
        return content.slice(0, content.lastIndexOf("\n"));
    }

    // if its still bigger than 240, delete everything after the last period
    if (content.length > MAX_TWEET_LENGTH) {
        return content.slice(0, content.lastIndexOf("."));
    }

    // while its STILL bigger than 240, find the second to last exclamation point or period and delete everything after it
    let iterations = 0;
    while (content.length > MAX_TWEET_LENGTH && iterations < 10) {
        iterations++;
        // second to last index of period or exclamation point
        const secondToLastIndexOfPeriod = content.lastIndexOf(".", content.length - 2);
        const secondToLastIndexOfExclamation = content.lastIndexOf("!", content.length - 2);
        const secondToLastIndex = Math.max(secondToLastIndexOfPeriod, secondToLastIndexOfExclamation);
        content = content.slice(0, secondToLastIndex);
    }

    return content;
}

import { embed } from "./embedding.ts";
import {
    IAgentRuntime,
    IMemoryManager,
    type Memory,
    type UUID,
} from "./types.ts";
import { Pinecone, type PineconeRecord } from '@pinecone-database/pinecone';

export const pc = new Pinecone();
let pineconeIndex: any;

export const embeddingDimension = 1536;
export const embeddingZeroVector = Array(embeddingDimension).fill(0);

const defaultMatchThreshold = 0.1;
const defaultMatchCount = 10;
// Based on Pinecone docs for 1536 dimensions with 2000 bytes metadata
const PINECONE_BATCH_SIZE = 245;

/**
 * Manage memories in the database.
 */
export class MemoryManager implements IMemoryManager {
    /**
     * The AgentRuntime instance associated with this manager.
     */
    runtime: IAgentRuntime;

    /**
     * The name of the database table this manager operates on.
     */
    tableName: string;

    /**
     * Constructs a new MemoryManager instance.
     * @param opts Options for the manager.
     * @param opts.tableName The name of the table this manager will operate on.
     * @param opts.runtime The AgentRuntime instance associated with this manager.
     */
    constructor(opts: { tableName: string; runtime: IAgentRuntime }) {
        this.runtime = opts.runtime;
        this.tableName = opts.tableName;
        this.initializePinecone();
    }

    /**
     * Initialize Pinecone index
     */
    private async initializePinecone() {
        try {
            const indexName = this.runtime.getSetting("PINECONE_INDEX") || "memories";
            
            console.log("Initializing Pinecone index:", indexName);
            try {
                await pc.createIndex({ 
                    name: indexName,
                    dimension: embeddingDimension,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-west-2'
                        }
                    }
                });
                console.log(`Created new Pinecone index: ${indexName}`);
            } catch (error) {
                if (error.message?.includes('ALREADY_EXISTS')) {
                    console.log(`Using existing Pinecone index: ${indexName}`);
                } else {
                    throw error;
                }
            }

            // Wait for index to be ready
            console.log("Waiting for index to be ready...");
            let isReady = false;
            let retries = 0;
            const maxRetries = 30; // 60 seconds max wait time

            while (!isReady && retries < maxRetries) {
                try {
                    const description = await pc.describeIndex(indexName);
                    isReady = description.status.ready;
                    if (!isReady) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        retries++;
                    }
                } catch (e) {
                    console.log("Waiting for index to be available...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    retries++;
                }
            }

            if (!isReady) {
                throw new Error("Index failed to become ready in time");
            }

            // Get the index
            pineconeIndex = pc.index(indexName);
            
            // Verify connection with a simple stats call
            try {
                const stats = await pineconeIndex.describeIndexStats();
                console.log(`Pinecone index '${indexName}' initialized with stats:`, stats);
            } catch (error) {
                console.error("Failed to get index stats:", error);
                // Don't throw here, as the index might still be usable
            }
        } catch (error) {
            console.error("Failed to initialize Pinecone:", error);
            // Don't throw the error - we'll continue with local storage only
            console.log("Continuing without Pinecone integration");
        }
    }

    /**
     * Splits an array into chunks of specified size
     * @param array Array to split
     * @param size Chunk size
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
            array.slice(i * size, i * size + size)
        );
    }

    /**
     * Extracts mentions (words starting with @) from text
     */
    private extractMentions(text: string): string[] {
        const mentions = text.match(/@\w+/g) || [];
        return mentions.map(mention => mention.slice(1)); // Remove @ symbol
    }

    /**
     * Extracts URLs from text
     */
    private extractUrls(text: string): string[] {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    /**
     * Upserts memories to Pinecone in batches with parallel processing
     * @param memories Array of memories to upsert
     */
    private async upsertToPinecone(memories: Memory[]): Promise<void> {
        if (!pineconeIndex) return;

        try {
            console.log(`Processing ${memories.length} memories for Pinecone upsert`);

            // Ensure all memories have embeddings
            const memoriesWithEmbeddings = await Promise.all(
                memories.map(async memory => {
                    console.log(`Processing memory ${memory.id}:`, {
                        hasEmbedding: !!memory.embedding,
                        textLength: memory.content.text?.length
                    });
                    
                    if (!memory.embedding || memory.embedding.every(val => val === 0)) {
                        return this.addEmbeddingToMemory(memory);
                    }
                    return memory;
                })
            );

            // Prepare vectors for Pinecone
            const vectors = memoriesWithEmbeddings.map(memory => {
                // Extract metadata
                const mentions = this.extractMentions(memory.content.text);
                const urls = this.extractUrls(memory.content.text);
                const timestamp = memory.createdAt || Date.now();
                const date = new Date(timestamp);
                
                const vector = {
                    id: memory.id,
                    values: memory.embedding,
                    metadata: {
                        // Core fields
                        text: memory.content.text,
                        userId: memory.userId,
                        roomId: memory.roomId,
                        agentId: memory.agentId,
                        type: this.tableName,
                        
                        // Time-based fields for filtering
                        timestamp: timestamp,
                        year: date.getUTCFullYear(),
                        month: date.getUTCMonth() + 1,
                        day: date.getUTCDate(),
                        hour: date.getUTCHours(),
                        
                        // Content metadata
                        people: mentions,
                        urls: urls,
                        hasUrls: urls.length > 0,
                        hasMentions: mentions.length > 0,
                        textLength: memory.content.text.length,
                        
                        // Additional content fields
                        action: memory.content.action || null,
                        source: memory.content.source || null,
                        inReplyTo: memory.content.inReplyTo || null,
                        
                        // Flags
                        isUnique: !!memory.unique,
                        hasAttachments: !!(memory.content.attachments && memory.content.attachments.length > 0)
                    }
                };
                
                console.log(`Prepared vector for ${memory.id}:`, {
                    hasValues: !!vector.values,
                    valuesLength: vector.values?.length,
                    hasNonZero: vector.values?.some(val => val !== 0),
                    mentions,
                    urls,
                    timestamp
                });
                
                return vector;
            });

            // Filter out any vectors with zero embeddings
            const validVectors = vectors.filter(vector => {
                const isValid = vector.values && vector.values.some(val => val !== 0);
                if (!isValid) {
                    console.warn(`Skipping vector ${vector.id} - invalid embedding`);
                }
                return isValid;
            });

            if (validVectors.length === 0) {
                console.warn("No valid vectors to upsert to Pinecone");
                return;
            }

            console.log(`Found ${validVectors.length} valid vectors out of ${vectors.length} total`);

            // Split into appropriate batch sizes
            const batches = this.chunkArray(validVectors, PINECONE_BATCH_SIZE);

            // Process batches in parallel
            const upsertPromises = batches.map(async (batch, index) => {
                try {
                    console.log(`Upserting batch ${index + 1}/${batches.length} (${batch.length} vectors)`);
                    await pineconeIndex.upsert(batch);
                    console.log(`Successfully upserted batch ${index + 1}`);
                } catch (error) {
                    console.error(`Failed to upsert batch ${index + 1} to Pinecone:`, error);
                    return null;
                }
            });

            await Promise.all(upsertPromises);
            console.log(`Completed upserting ${validVectors.length} memories to Pinecone in ${batches.length} batches`);
        } catch (error) {
            console.error("Failed to upsert memories to Pinecone:", error);
        }
    }

    /**
     * Adds an embedding vector to a memory object. If the memory already has an embedding, it is returned as is.
     * @param memory The memory object to add an embedding to.
     * @returns A Promise resolving to the memory object, potentially updated with an embedding vector.
     */
    async addEmbeddingToMemory(memory: Memory): Promise<Memory> {
        console.log("Adding embedding to memory:", {
            id: memory.id,
            text: memory.content.text?.substring(0, 100) + "...",
            hasEmbedding: !!memory.embedding,
            embeddingLength: memory.embedding?.length
        });

        if (memory.embedding) {
            const hasNonZero = memory.embedding.some(val => val !== 0);
            console.log("Existing embedding stats:", {
                length: memory.embedding.length,
                hasNonZero,
                firstFewValues: memory.embedding.slice(0, 5)
            });
            if (hasNonZero) {
                return memory;
            }
            console.log("Existing embedding is all zeros, regenerating...");
        }

        const memoryText = memory.content.text;
        if (!memoryText) {
            console.error("Memory content is empty for id:", memory.id);
            throw new Error("Memory content is empty");
        }
        
        try {
            console.log("Generating embedding for text:", memoryText.substring(0, 100) + "...");
            const newEmbedding = await embed(this.runtime, memoryText);
            
            if (!newEmbedding) {
                console.error("Embedding generation returned null/undefined for id:", memory.id);
                throw new Error("Embedding generation failed");
            }

            console.log("Generated embedding stats:", {
                length: newEmbedding.length,
                hasNonZero: newEmbedding.some(val => val !== 0),
                firstFewValues: newEmbedding.slice(0, 5)
            });

            if (newEmbedding.every(val => val === 0)) {
                console.error("Generated embedding is all zeros for id:", memory.id);
                throw new Error("Generated embedding contains only zeros");
            }

            memory.embedding = newEmbedding;
        } catch (error) {
            console.error("Error generating embedding:", {
                error,
                memoryId: memory.id,
                textLength: memoryText.length,
                textPreview: memoryText.substring(0, 100) + "..."
            });
            throw error;
        }
        
        return memory;
    }

    /**
     * Retrieves a list of memories by user IDs, with optional deduplication.
     * @param opts Options including user IDs, count, and uniqueness.
     * @param opts.roomId The room ID to retrieve memories for.
     * @param opts.count The number of memories to retrieve.
     * @param opts.unique Whether to retrieve unique memories only.
     * @returns A Promise resolving to an array of Memory objects.
     */
    async getMemories({
        roomId,
        count = 10,
        unique = true,
        agentId,
        start,
        end,
    }: {
        roomId?: UUID;
        count?: number;
        unique?: boolean;
        agentId?: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]> {
        const result = await this.runtime.databaseAdapter.getMemories({
            roomId,
            count,
            unique,
            tableName: this.tableName,
            agentId,
            start,
            end,
        });
        return result;
    }

    async getCachedEmbeddings(content: string): Promise<
        {
            embedding: number[];
            levenshtein_score: number;
        }[]
    > {
        const result = await this.runtime.databaseAdapter.getCachedEmbeddings({
            query_table_name: this.tableName,
            query_threshold: 2,
            query_input: content,
            query_field_name: "content",
            query_field_sub_name: "content",
            query_match_count: 10,
        });
        return result;
    }

    /**
     * Searches for memories similar to a given embedding vector.
     * Searches both in local database and Pinecone.
     * @param embedding The embedding vector to search with.
     * @param opts Options including match threshold, count, user IDs, and uniqueness.
     * @returns A Promise resolving to an array of Memory objects that match the embedding.
     */
    async searchMemoriesByEmbedding(
        embedding: number[],
        opts: {
            match_threshold?: number;
            agentId?: UUID;
            count?: number;
            roomId: UUID;
            unique?: boolean;
        }
    ): Promise<Memory[]> {
        const {
            match_threshold = defaultMatchThreshold,
            count = defaultMatchCount,
            roomId,
            unique,
        } = opts;

        const searchOpts = {
            tableName: this.tableName,
            roomId,
            embedding: embedding,
            match_threshold: match_threshold,
            match_count: count,
            unique: !!unique,
        };

        // Search in local database
        const localResults = await this.runtime.databaseAdapter.searchMemories(searchOpts);

        // Search in Pinecone if available
        let pineconeResults: Memory[] = [];
        if (pineconeIndex) {
            try {
                const queryResponse = await pineconeIndex.query({
                    vector: embedding,
                    topK: count,
                    filter: {
                        roomId: roomId,
                        type: this.tableName,
                        ...(unique ? { unique: true } : {})
                    },
                    includeMetadata: true,
                    includeValues: true
                });

                // Convert Pinecone results to Memory objects
                pineconeResults = queryResponse.matches.map(match => ({
                    id: match.id as UUID,
                    content: {
                        text: match.metadata.text,
                        action: match.metadata.action,
                        source: match.metadata.source,
                        inReplyTo: match.metadata.inReplyTo,
                        attachments: match.metadata.hasAttachments ? [] : undefined // Placeholder for attachments
                    },
                    embedding: match.values,
                    userId: match.metadata.userId,
                    roomId: match.metadata.roomId,
                    agentId: match.metadata.agentId,
                    createdAt: match.metadata.timestamp,
                    unique: match.metadata.isUnique,
                    // Add additional metadata for filtering
                    metadata: {
                        year: match.metadata.year,
                        month: match.metadata.month,
                        day: match.metadata.day,
                        hour: match.metadata.hour,
                        people: match.metadata.people,
                        urls: match.metadata.urls,
                        hasUrls: match.metadata.hasUrls,
                        hasMentions: match.metadata.hasMentions,
                        textLength: match.metadata.textLength,
                        hasAttachments: match.metadata.hasAttachments
                    }
                }));
            } catch (error) {
                console.error("Failed to search memories in Pinecone:", error);
            }
        }

        // Merge and deduplicate results
        const allResults = [...localResults, ...pineconeResults];
        const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());
        
        return uniqueResults.slice(0, count);
    }

    /**
     * Creates a new memory in the database, with an option to check for similarity before insertion.
     * Also upserts to Pinecone in parallel.
     * @param memory The memory object to create.
     * @param unique Whether to check for similarity before insertion.
     * @returns A Promise that resolves when the operation completes.
     */
    async createMemory(memory: Memory, unique = false): Promise<void> {
        const existingMessage =
            await this.runtime.databaseAdapter.getMemoryById(memory.id);
        if (existingMessage) {
            console.log("Memory already exists, skipping");
            return;
        }

        // Prepare memory for database
        await this.runtime.databaseAdapter.createMemory(
            memory,
            this.tableName,
            unique
        );

        // Upsert to Pinecone in parallel
        await this.upsertToPinecone([memory]);
    }

    /**
     * Creates multiple memories in batch
     * @param memories Array of memories to create
     * @param unique Whether to check for similarity before insertion
     */
    async createMemories(memories: Memory[], unique = false): Promise<void> {
        // Filter out existing memories
        const existingIds = new Set(
            (await Promise.all(
                memories.map(m => this.runtime.databaseAdapter.getMemoryById(m.id))
            ))
            .filter(Boolean)
            .map(m => m!.id)
        );

        const newMemories = memories.filter(m => !existingIds.has(m.id));
        if (newMemories.length === 0) {
            console.log("All memories already exist, skipping");
            return;
        }

        // Upsert to database in parallel
        await Promise.all(
            newMemories.map(memory =>
                this.runtime.databaseAdapter.createMemory(
                    memory,
                    this.tableName,
                    unique
                )
            )
        );

        // Upsert to Pinecone in optimized batches
        await this.upsertToPinecone(newMemories);
    }

    async getMemoriesByRoomIds(params: {
        agentId?: UUID;
        roomIds: UUID[];
    }): Promise<Memory[]> {
        const result = await this.runtime.databaseAdapter.getMemoriesByRoomIds({
            agentId: params.agentId,
            roomIds: params.roomIds,
        });
        return result;
    }

    async getMemoryById(id: UUID): Promise<Memory | null> {
        const result = await this.runtime.databaseAdapter.getMemoryById(id);
        return result;
    }

    /**
     * Removes a memory from both the database and Pinecone by its ID.
     * @param memoryId The ID of the memory to remove.
     * @returns A Promise that resolves when the operation completes.
     */
    async removeMemory(memoryId: UUID): Promise<void> {
        await this.runtime.databaseAdapter.removeMemory(
            memoryId,
            this.tableName
        );

        // Delete from Pinecone if available
        if (pineconeIndex) {
            try {
                await pineconeIndex.deleteOne(memoryId);
                console.log("Memory deleted from Pinecone:", memoryId);
            } catch (error) {
                console.error("Failed to delete memory from Pinecone:", error);
            }
        }
    }

    /**
     * Removes all memories associated with a room ID from both database and Pinecone.
     * @param roomId The room ID to remove memories for.
     * @returns A Promise that resolves when the operation completes.
     */
    async removeAllMemories(roomId: UUID): Promise<void> {
        await this.runtime.databaseAdapter.removeAllMemories(
            roomId,
            this.tableName
        );

        // Delete from Pinecone if available
        if (pineconeIndex) {
            try {
                await pineconeIndex.deleteMany({
                    filter: {
                        roomId: roomId,
                        type: this.tableName
                    }
                });
                console.log("All memories deleted from Pinecone for room:", roomId);
            } catch (error) {
                console.error("Failed to delete memories from Pinecone:", error);
            }
        }
    }

    /**
     * Counts the number of memories associated with a set of user IDs, with an option for uniqueness.
     * @param roomId The room ID to count memories for.
     * @param unique Whether to count unique memories only.
     * @returns A Promise resolving to the count of memories.
     */
    async countMemories(roomId: UUID, unique = true): Promise<number> {
        return await this.runtime.databaseAdapter.countMemories(
            roomId,
            unique,
            this.tableName
        );
    }
}

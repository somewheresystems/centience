import models from "./models.ts";
import { IAgentRuntime, ModelProvider } from "./types.ts";

/**
 * Send a message to the OpenAI API for embedding.
 * @param input The input to be embedded.
 * @returns The embedding of the input.
 */
export async function embed(runtime: IAgentRuntime, input: string) {
    try {
        // Try to get cached embedding, but don't fail if cache errors
        const cachedEmbedding = await retrieveCachedEmbedding(runtime, input).catch(err => {
            console.warn("Cache lookup failed, proceeding with embedding generation:", err);
            return null;
        });
        
        if (cachedEmbedding) {
            return cachedEmbedding;
        }
    } catch (error) {
        console.warn("Failed to check cache, proceeding with embedding generation:", error);
    }

    // Get OpenAI API key from runtime settings
    const apiKey = runtime.getSetting("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OpenAI API key not found in runtime settings or character settings");
    }

    // Always use OpenAI's embedding model
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input,
            model: "text-embedding-3-small",  // OpenAI's latest embedding model
            dimensions: 1536
        }),
    };

    try {
        const response = await fetch(
            "https://api.openai.com/v1/embeddings",
            requestOptions
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenAI API Error: ${response.status} ${response.statusText}\n${errorText}`
            );
        }

        const data = await response.json();
        const embedding = data?.data?.[0]?.embedding;
        
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
            throw new Error(`Invalid embedding response: ${JSON.stringify(data)}`);
        }

        return embedding;
    } catch (error) {
        console.error("Failed to generate embedding:", error);
        throw error;
    }
}

/**
 * Attempt to retrieve a cached embedding
 * @param runtime Runtime environment
 * @param input Input text to look up
 * @returns Cached embedding or null if not found
 */
export async function retrieveCachedEmbedding(
    runtime: IAgentRuntime,
    input: string
): Promise<number[] | null> {
    try {
        const similaritySearchResult = await runtime.messageManager.getCachedEmbeddings(input);
        if (similaritySearchResult?.length > 0 && 
            Array.isArray(similaritySearchResult[0]?.embedding) && 
            similaritySearchResult[0].embedding.length === 1536) {
            return similaritySearchResult[0].embedding;
        }
    } catch (error) {
        console.warn("Failed to retrieve cached embedding:", error);
    }
    return null;
}

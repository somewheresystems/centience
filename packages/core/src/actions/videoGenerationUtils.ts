import { IAgentRuntime } from "../core/types.ts";
import { elizaLogger } from "../index";

export const generateVideo = async (
    data: {
        prompt: string,
        duration?: number,
        resolution?: string
    },
    runtime: IAgentRuntime
) => {
    const LUMA_API_KEY = runtime.getSetting("LUMA_API_KEY");
    elizaLogger.log("Starting video generation with Luma API");
    
    try {
        // Create initial generation request
        elizaLogger.log("Sending request to Luma API...");
        const generationResponse = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${LUMA_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                prompt: data.prompt,
                aspect_ratio: "4:3",
                loop: false
            })
        });

        const generationData = await generationResponse.json();
        elizaLogger.log("Initial generation response:", generationData);

        if (!generationData.id) {
            throw new Error(`Failed to get generation ID: ${JSON.stringify(generationData)}`);
        }

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes with 5-second intervals
        
        while (attempts < maxAttempts) {
            const statusResponse = await fetch(
                `https://api.lumalabs.ai/dream-machine/v1/generations/${generationData.id}`, {
                    headers: {
                        "Authorization": `Bearer ${LUMA_API_KEY}`,
                        "Accept": "application/json"
                    }
                }
            );

            const statusData = await statusResponse.json();
            elizaLogger.log("Status check response:", statusData);

            if (statusData.state === "completed" && statusData.assets?.video) {
                return {
                    success: true,
                    url: statusData.assets.video
                };
            } else if (statusData.state === "failed") {
                throw new Error("Video generation failed");
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        throw new Error("Video generation timed out");
    } catch (error) {
        elizaLogger.error("Error generating video:", error);
        return {
            url: null,
            success: false,
            error
        };
    }
};
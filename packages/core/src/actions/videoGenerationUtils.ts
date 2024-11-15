import { IAgentRuntime } from "../core/types.ts";

export const generateVideo = async (
    data: {
        prompt: string,
        duration?: number,
        resolution?: string
    },
    runtime: IAgentRuntime
) => {
    const LUMA_API_KEY = runtime.getSetting("LUMA_API_KEY");
    
    try {
        // Create Luma capture
        const captureResponse = await fetch("https://api.lumalabs.ai/v0/captures", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${LUMA_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: data.prompt,
                prompt: data.prompt,
                mode: "nerf", // Using NeRF mode for 3D video generation
                duration: data.duration || 5,
                resolution: data.resolution || "1080p"
            })
        });

        const captureData = await captureResponse.json();
        const captureId = captureData.id;

        // Poll for completion
        let videoUrl = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes with 5-second intervals

        while (attempts < maxAttempts) {
            const statusResponse = await fetch(`https://api.lumalabs.ai/v0/captures/${captureId}`, {
                headers: {
                    "Authorization": `Bearer ${LUMA_API_KEY}`
                }
            });

            const statusData = await statusResponse.json();

            if (statusData.status === "completed") {
                videoUrl = statusData.video_url;
                break;
            } else if (statusData.status === "failed") {
                throw new Error("Video generation failed");
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        if (!videoUrl) {
            throw new Error("Video generation timed out");
        }

        return {
            url: videoUrl,
            success: true
        };
    } catch (error) {
        console.error("Error generating video:", error);
        return {
            url: null,
            success: false,
            error
        };
    }
};
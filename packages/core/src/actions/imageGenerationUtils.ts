import { Buffer } from "buffer";
import Replicate from "replicate";
import { IAgentRuntime } from "../core/types.ts";
import { getImageGenModel, ImageGenModel } from "../core/imageGenModels.ts";
import OpenAI from "openai";
import { elizaLogger } from "../index";
import { generateText } from "../core/generation.ts";
import { ModelClass } from "../core/types.ts";
import crypto from 'crypto';

// Define model versions and configurations
const FLUX_PRO = "black-forest-labs/flux-1.1-pro";
const FLUX_SCHNELL = "black-forest-labs/flux-schnell";

const CONFIG = {
    IMAGE_DIMS: {
        width: 1024,
        height: 768
    },
    STYLES: {
        PRO: "High quality Unreal Engine 5",
        BASIC: "Low Poly / Garry's Mod"
    }
} as const;

export const imagePromptTemplate = `# Task: Enhance the image generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image.

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: {{prompt}}

Enhanced prompt:`;

export const enhancePrompt = async (
    originalPrompt: string,
    runtime: IAgentRuntime
): Promise<string> => {
    if (!runtime.llamaService) {
        elizaLogger.log("No llamaService available, using original prompt");
        return originalPrompt;
    }

    try {
        const context = `# Task: Enhance the image generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image.

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: ${originalPrompt}

Enhanced prompt:`;

        elizaLogger.log("Sending context to llama:", context);
        
        const promptResponse = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        if (promptResponse?.trim()) {
            elizaLogger.log("Successfully enhanced prompt to:", promptResponse);
            return promptResponse.trim();
        }
    } catch (error) {
        elizaLogger.error("Prompt enhancement failed:", error);
    }

    elizaLogger.log("Using original prompt due to enhancement failure");
    return originalPrompt;
};

export const generateImage = async (
    data: {
        prompt: string;
        width: number;
        height: number;
        count?: number;
    },
    runtime: IAgentRuntime
): Promise<{
    success: boolean;
    data?: string[];
    error?: any;
}> => {
    try {
        // Enhance the prompt first
        const enhancedPrompt = await enhancePrompt(data.prompt, runtime);
        elizaLogger.log("Using enhanced prompt for generation:", enhancedPrompt);

        const imageGenModel = runtime.imageGenModel;
        const model = getImageGenModel(imageGenModel);
        const apiKey = runtime.getSetting("REPLICATE_API_KEY");

        let { count } = data;
        if (!count) {
            count = 1;
        }

        const replicate = new Replicate({
            auth: apiKey
        });

        const modelVersion = imageGenModel === ImageGenModel.TogetherAI ? FLUX_PRO : FLUX_SCHNELL;
        elizaLogger.log('Model selection:', {
            isPro: imageGenModel === ImageGenModel.TogetherAI,
            selectedModel: modelVersion,
            style: imageGenModel === ImageGenModel.TogetherAI ? CONFIG.STYLES.PRO : CONFIG.STYLES.BASIC
        });

        const output = await replicate.run(
            modelVersion,
            {
                input: {
                    prompt: enhancedPrompt,
                    width: data.width,
                    height: data.height,
                    num_inference_steps: imageGenModel === ImageGenModel.TogetherAI ? 12 : 4,
                }
            }
        );

        if (output instanceof ReadableStream) {
            // Read the stream into a buffer
            const reader = output.getReader();
            const chunks: Uint8Array[] = [];
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }

                // Combine chunks into a single buffer
                const buffer = Buffer.concat(chunks);
                let base64 = buffer.toString('base64');
                base64 = "data:image/png;base64," + base64;
                return { success: true, data: [base64] };
            } finally {
                reader.releaseLock();
            }
        }

        // Handle direct URL response
        if (Array.isArray(output) && output.length > 0) {
            const imageUrl = output[0];
            
            // Fetch the image from the URL
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);
            let base64 = buffer.toString('base64');
            base64 = "data:image/png;base64," + base64;

            return { success: true, data: [base64] };
        }

        throw new Error('Invalid response format from Replicate');

    } catch (error) {
        elizaLogger.error("Image generation failed:", error);
        return { success: false, error: error };
    }
};

export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{
    title: string;
    description: string;
}> => {
    const { imageUrl } = data;
    const resp = await runtime.imageDescriptionService.describeImage(imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};

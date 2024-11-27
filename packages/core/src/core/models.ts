import settings from "./settings.ts";
import { Models, ModelProvider, ModelClass } from "./types.ts";

const models: Models = {
    [ModelProvider.OPENAI]: {
        endpoint: "https://api.openai.com/v1",
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.6,
        },
        model: {
            [ModelClass.SMALL]: "gpt-4o-mini",
            [ModelClass.MEDIUM]: "gpt-4o",
            [ModelClass.LARGE]: "gpt-4o",
            [ModelClass.EMBEDDING]: "text-embedding-3-small",
        },
    },
    [ModelProvider.ANTHROPIC]: {
        settings: {
            stop: [],
            maxInputTokens: 200000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        endpoint: "https://api.anthropic.com/v1",
        model: {
            [ModelClass.SMALL]: "claude-3-5-sonnet-20241022",
            [ModelClass.MEDIUM]: "claude-3-5-sonnet-20241022",
            [ModelClass.LARGE]: "claude-3-opus-20240229",
        },
    },
    [ModelProvider.SMAAI]: {
        endpoint: "https://api.smai.uk/v1",
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        model: {
            [ModelClass.SMALL]: "/Users/n/agent-q4xs.gguf", //"/home/austin/disk2/aq4.gguf",
            [ModelClass.MEDIUM]: "/Users/n/agent-q4xs.gguf", //"/home/austin/disk2/aq4.gguf",
            [ModelClass.LARGE]: "/Users/n/agent-q4xs.gguf", //"/home/austin/disk2/aq4.gguf",
            [ModelClass.EMBEDDING]: "togethercomputer/m2-bert-80M-32k-retrieval",
        },
    },
    [ModelProvider.TOGETHER]: {
        endpoint: "https://api.together.ai/v1",
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.9,
        },
        model: {
            [ModelClass.SMALL]: "togethercomputer/m2-bert-80M-32k-retrieval",
            [ModelClass.MEDIUM]: "togethercomputer/m2-bert-80M-32k-retrieval",
            [ModelClass.LARGE]: "togethercomputer/m2-bert-80M-32k-retrieval",
            [ModelClass.EMBEDDING]: "togethercomputer/m2-bert-80M-32k-retrieval",
        },
    },
    [ModelProvider.CLAUDE_VERTEX]: {
        settings: {
            stop: [],
            maxInputTokens: 200000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        endpoint: "https://api.anthropic.com/v1", // TODO: check
        model: {
            [ModelClass.SMALL]: "claude-3-5-sonnet-20241022",
            [ModelClass.MEDIUM]: "claude-3-5-sonnet-20241022",
            [ModelClass.LARGE]: "claude-3-opus-20240229",
        },
    },
    [ModelProvider.GROK]: {
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        endpoint: "https://api.x.ai/v1",
        model: {
            [ModelClass.SMALL]: "grok-beta",
            [ModelClass.MEDIUM]: "grok-beta",
            [ModelClass.LARGE]: "grok-beta",
            [ModelClass.EMBEDDING]: "grok-beta", // not sure about this one
        },
    },
    [ModelProvider.GROQ]: {
        endpoint: "https://api.groq.com/openai/v1",
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8000,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        model: {
            [ModelClass.SMALL]: "llama-3.1-8b-instant",
            [ModelClass.MEDIUM]: "llama-3.1-70b-versatile",
            [ModelClass.LARGE]: "llama-3.2-90b-text-preview",
            [ModelClass.EMBEDDING]: "llama-3.1-8b-instant",
        },
    },
    [ModelProvider.LLAMACLOUD]: {
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192, // changed from 1024 to 8192
            repetition_penalty: 0.4, // changed from 0 to 0.4
            temperature: 0.7, // changed from 0.9 to 0.7
        },
        imageSettings: {
            steps: 4,
        },
        endpoint: "https://api.smai.uk/v1", // changed from"https://api.together.ai/v1"
        model: {
            [ModelClass.SMALL]: "meta-llama/Llama-3.2-3B-Instruct-Turbo", // "/Users/n/agent-q4xs.gguf",
            [ModelClass.MEDIUM]: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", // "/Users/n/agent-q4xs.gguf",
            [ModelClass.LARGE]: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", // "/Users/n/agent-q4xs.gguf",
            [ModelClass.EMBEDDING]:
                "togethercomputer/m2-bert-80M-32k-retrieval",
            //[ModelClass.IMAGE]: "black-forest-labs/FLUX.1-schnell",
        },
    },
    [ModelProvider.LLAMALOCAL]: {
        settings: {
            stop: ["<|eot_id|>", "<|eom_id|>"],
            maxInputTokens: 32768,
            maxOutputTokens: 8192,
            repetition_penalty: 0.0,
            temperature: 0.3,
        },
        model: {
            [ModelClass.SMALL]:
                "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
            [ModelClass.MEDIUM]:
                "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true", // TODO: ?download=true
            [ModelClass.LARGE]:
                "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
            // "RichardErkhov/NousResearch_-_Meta-Llama-3.1-70B-gguf", // TODO:
            [ModelClass.EMBEDDING]:
                "togethercomputer/m2-bert-80M-32k-retrieval",
        },
    },
    [ModelProvider.GOOGLE]: {
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        model: {
            [ModelClass.SMALL]: "gemini-1.5-flash",
            [ModelClass.MEDIUM]: "gemini-1.5-flash",
            [ModelClass.LARGE]: "gemini-1.5-pro",
            [ModelClass.EMBEDDING]: "text-embedding-004",
        },
    },
    [ModelProvider.REDPILL]: {
        endpoint: "https://api.red-pill.ai/v1",
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.6,
        },
        // Available models: https://docs.red-pill.ai/get-started/supported-models
        // To test other models, change the models below
        model: {
            [ModelClass.SMALL]: "gpt-4o-mini", // [ModelClass.SMALL]: "claude-3-5-sonnet-20241022",
            [ModelClass.MEDIUM]: "gpt-4o", // [ModelClass.MEDIUM]: "claude-3-5-sonnet-20241022",
            [ModelClass.LARGE]: "gpt-4o", // [ModelClass.LARGE]: "claude-3-opus-20240229",
            [ModelClass.EMBEDDING]: "text-embedding-3-small",
        },
    },
    [ModelProvider.OLLAMA]: {
        settings: {
            stop: [],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            temperature: 0.3,
        },
        endpoint: settings.OLLAMA_SERVER_URL || "http://localhost:11434", 
        model: {
            [ModelClass.SMALL]: settings.SMALL_OLLAMA_MODEL || settings.OLLAMA_MODEL || "llama3.2",
            [ModelClass.MEDIUM]: settings.MEDIUM_OLLAMA_MODEL ||settings.OLLAMA_MODEL || "hermes3",
            [ModelClass.LARGE]: settings.LARGE_OLLAMA_MODEL || settings.OLLAMA_MODEL || "hermes3:70b",
            [ModelClass.EMBEDDING]: settings.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
        },
    },
};

export function getModel(provider: ModelProvider, type: ModelClass) {
    return models[provider].model[type];
}

export function getEndpoint(provider: ModelProvider) {
    return models[provider].endpoint;
}

export default models;

import { Memory, UUID } from "../../core/types";

export interface DataConnectorConfig {
    enabled: boolean;
    [key: string]: any;
}

export interface SearchResult {
    id: UUID;
    score: number;
    vector?: number[];
}

export interface DataConnector {
    initialize(): Promise<void>;
    upsert(memory: Memory): Promise<void>;
    search(vector: number[], topK: number): Promise<SearchResult[]>;
    delete(id: UUID): Promise<void>;
    deleteNamespace(namespace: string): Promise<void>;
    healthCheck(): Promise<boolean>;
}

export abstract class BaseDataConnector implements DataConnector {
    protected config: DataConnectorConfig;
    protected namespace: string;

    constructor(config: DataConnectorConfig, namespace: string) {
        this.config = config;
        this.namespace = namespace;
    }

    abstract initialize(): Promise<void>;
    abstract upsert(memory: Memory): Promise<void>;
    abstract search(vector: number[], topK: number): Promise<SearchResult[]>;
    abstract delete(id: UUID): Promise<void>;
    abstract deleteNamespace(namespace: string): Promise<void>;
    abstract healthCheck(): Promise<boolean>;
} 
interface WebsiteVersion {
    html: string;
    timestamp: string;
    changes?: {
        added: number;
        removed: number;
        modified: number;
    };
}

interface WebsiteMetadata {
    title: string;
    description?: string;
    lastModified: string;
    createdAt: string;
    tags?: string[];
}

interface WebsiteMemory {
    metadata: WebsiteMetadata;
    versions: WebsiteVersion[];
    currentVersion: number;
}

export class WebsiteMemoryManager {
    private websites: Map<string, WebsiteMemory>;
    private readonly maxVersionsPerSite: number;

    constructor(maxVersionsPerSite: number = 10) {
        this.websites = new Map();
        this.maxVersionsPerSite = maxVersionsPerSite;
        console.log("WebsiteMemoryManager initialized", {
            maxVersionsPerSite,
        });
    }

    createWebsite(
        id: string,
        title: string,
        description?: string,
        tags?: string[]
    ): void {
        if (this.websites.has(id)) {
            throw new Error(`Website with ID ${id} already exists`);
        }

        const timestamp = new Date().toISOString();
        const website: WebsiteMemory = {
            metadata: {
                title,
                description,
                lastModified: timestamp,
                createdAt: timestamp,
                tags,
            },
            versions: [],
            currentVersion: -1,
        };

        this.websites.set(id, website);
        console.log("Website created in memory", { id, title });
    }

    addVersion(
        id: string,
        html: string,
        changes?: WebsiteVersion["changes"]
    ): void {
        const website = this.getWebsite(id);
        const version: WebsiteVersion = {
            html,
            timestamp: new Date().toISOString(),
            changes,
        };

        website.versions.push(version);
        website.currentVersion = website.versions.length - 1;
        website.metadata.lastModified = version.timestamp;

        // Maintain version limit
        if (website.versions.length > this.maxVersionsPerSite) {
            website.versions.shift();
            website.currentVersion--;
        }

        console.log("Version added to website", {
            id,
            versionNumber: website.currentVersion,
            totalVersions: website.versions.length,
        });
    }

    getCurrentVersion(id: string): WebsiteVersion {
        const website = this.getWebsite(id);
        if (website.currentVersion < 0) {
            throw new Error(`No versions exist for website ${id}`);
        }
        return website.versions[website.currentVersion];
    }

    getVersion(id: string, versionIndex: number): WebsiteVersion {
        const website = this.getWebsite(id);
        if (versionIndex < 0 || versionIndex >= website.versions.length) {
            throw new Error(
                `Version ${versionIndex} does not exist for website ${id}`
            );
        }
        return website.versions[versionIndex];
    }

    rollbackToVersion(id: string, versionIndex: number): WebsiteVersion {
        const website = this.getWebsite(id);
        if (versionIndex < 0 || versionIndex >= website.versions.length) {
            throw new Error(`Cannot rollback to version ${versionIndex}`);
        }

        website.currentVersion = versionIndex;
        console.log("Website rolled back to previous version", {
            id,
            versionIndex,
            timestamp: website.versions[versionIndex].timestamp,
        });

        return website.versions[versionIndex];
    }

    updateMetadata(id: string, updates: Partial<WebsiteMetadata>): void {
        const website = this.getWebsite(id);
        website.metadata = {
            ...website.metadata,
            ...updates,
            lastModified: new Date().toISOString(),
        };
        console.log("Website metadata updated", { id, updates });
    }

    getVersionHistory(id: string): WebsiteVersion[] {
        return this.getWebsite(id).versions;
    }

    getMetadata(id: string): WebsiteMetadata {
        return this.getWebsite(id).metadata;
    }

    deleteWebsite(id: string): void {
        if (!this.websites.delete(id)) {
            throw new Error(`Website ${id} not found`);
        }
        console.log("Website deleted from memory", { id });
    }

    exists(id: string): boolean {
        return this.websites.has(id);
    }

    private getWebsite(id: string): WebsiteMemory {
        const website = this.websites.get(id);
        if (!website) {
            throw new Error(`Website ${id} not found`);
        }
        return website;
    }

    getAllWebsites(): Array<{ id: string; metadata: WebsiteMetadata }> {
        return Array.from(this.websites.entries()).map(
            ([id, { metadata }]) => ({
                id,
                metadata,
            })
        );
    }

    getStats(id: string): {
        versionsCount: number;
        currentVersion: number;
        age: number;
        lastModified: string;
    } {
        const website = this.getWebsite(id);
        return {
            versionsCount: website.versions.length,
            currentVersion: website.currentVersion,
            age: Date.now() - new Date(website.metadata.createdAt).getTime(),
            lastModified: website.metadata.lastModified,
        };
    }
}

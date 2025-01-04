declare module 'cldr-segmentation' {
    export interface SegmenterOptions {
        locale?: string;
    }

    export interface Segmenter {
        segment(text: string): string[];
    }

    export function createSegmenter(options?: SegmenterOptions): Segmenter;

    const segmentation: {
        createSegmenter: typeof createSegmenter;
    };

    export default segmentation;
} 
export declare enum ContextPriority {
    CRITICAL = "critical",
    ESSENTIAL = "essential",
    BACKGROUND = "background"
}
export interface ContextItem {
    id: string;
    content: string;
    priority: ContextPriority;
    timestamp: number;
    confidence: number;
    source: string;
    modality: "text" | "image" | "audio" | "structured";
    tags: string[];
}
export declare class ContextManager {
    private contextItems;
    private anchorPoints;
    private summaries;
    private lastSummarizationTime;
    private summarizationInterval;
    addContext(item: ContextItem): string;
    setAnchorPoint(id: string, isAnchor?: boolean): void;
    getActiveContext(options?: {
        maxItems?: number;
        recencyThreshold?: number;
        minConfidence?: number;
    }): ContextItem[];
    private applyTimeDecay;
    private createSummaries;
    getSummaries(): Map<string, string>;
    integrateMultiModalContent(content: string | object | Buffer, options: {
        modality: "text" | "image" | "audio" | "structured";
        priority?: ContextPriority;
        confidence?: number;
        tags?: string[];
    }): string;
    clearNonAnchorContext(): void;
    getContextItem(id: string): ContextItem | undefined;
}

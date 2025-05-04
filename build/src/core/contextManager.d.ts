import { ContextItem, ContextPriority } from './types.js';
export declare class ContextManager {
    private contextItems;
    private projectContext;
    private anchorPoints;
    setProjectContext(context: string): void;
    getProjectContext(): string;
    addContext(content: string, priority: ContextPriority, source: string, tags?: string[]): string;
    setAnchorPoint(id: string, isAnchor: boolean): boolean;
    getContextItem(id: string): ContextItem | undefined;
    getActiveContext(maxItems?: number): ContextItem[];
    private sortContextItems;
    clearNonAnchorContext(): void;
}

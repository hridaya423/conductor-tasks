import { ContextItem, ContextPriority } from './types.js';
import { IDERulesManager } from '../ide/ideRulesManager.js';
export declare class ContextManager {
    private contextItems;
    private projectContext;
    private anchorPoints;
    private ideRulesManager?;
    setProjectContext(context: string): void;
    getProjectContext(): string;
    addContext(content: string, priority: ContextPriority, source: string, tags?: string[]): string;
    setAnchorPoint(id: string, isAnchor: boolean): boolean;
    getContextItem(id: string): ContextItem | undefined;
    getActiveContext(maxItems?: number): ContextItem[];
    private sortContextItems;
    clearNonAnchorContext(): void;
    setIDERulesManager(ideRulesManager: IDERulesManager): void;
    getIDERulesManager(): IDERulesManager | undefined;
}

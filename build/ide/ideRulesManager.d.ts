import { IDEType, IDERule, IDERules } from '../core/types.js';
export declare class IDERulesManager {
    private static instance;
    private idePath;
    private ideType;
    private loadedRules;
    private workspaceRoot;
    private constructor();
    static getInstance(): IDERulesManager;
    getIDEType(): IDEType;
    setIDEType(ideType: IDEType): void;
    getWorkspaceRoot(): string;
    setWorkspaceRoot(workspaceRoot: string): void;
    private getRulesDirectoryForIDE;
    private readRuleTemplate;
    private createDefaultRuleFiles;
    private cleanupUnusedRuleFiles;
    private removeDirectoryRecursive;
    loadRules(forceReload?: boolean): Promise<void>;
    private loadRulesForType;
    getRules(specificType?: IDEType): Promise<IDERules | null>;
    getRule(ruleName: string, ideType?: IDEType): Promise<IDERule | null>;
    private getConductorManagedFiles;
    private removeConductorManagedFiles;
    forceResetRules(): Promise<void>;
}

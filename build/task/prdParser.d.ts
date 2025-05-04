import { TaskManager } from '../taskManager.js';
import { LLMClient } from '../core/types.js';
export declare class PRDParser {
    private taskManager;
    private llmClient;
    private maxRetries;
    private allowedDocumentTypes;
    constructor(taskManager: TaskManager, llmClient: LLMClient);
    parsePRD(prdFilePath: string, createTasksFile?: boolean): Promise<string[]>;
    private validateFileType;
    private readPRDFile;
    private preprocessContent;
    private extractTasksFromPRD;
    private createTasksFromExtraction;
    private mapStringToPriority;
    private generateTasksMarkdown;
    private slugify;
}

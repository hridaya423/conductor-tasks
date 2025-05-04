import { Task } from './types.js';
export interface MarkdownRenderConfig {
    useEmoji: boolean;
    useProgressBars: boolean;
    includeMeta: boolean;
    colorize: boolean;
    showTimestamps: boolean;
    compactMode: boolean;
    includeSubtasks: boolean;
    taskDetailsLevel: 'minimal' | 'standard' | 'verbose';
}
export declare class MarkdownRenderer {
    private config;
    constructor(config?: Partial<MarkdownRenderConfig>);
    renderTasksToMarkdown(tasks: Map<string, Task>, projectName?: string, lastUpdated?: Date): string;
    private renderMetadata;
    private renderSummary;
    private renderStatusSection;
    private renderTask;
    private renderTaskMetadata;
    private renderTaskProgressBar;
    private renderNote;
    private getStatusEmoji;
    private getPriorityEmoji;
    private getNoteTypeEmoji;
    private formatStatus;
    private groupTasksByStatus;
    private sortTasksByPriority;
    renderTasksToHtml(tasks: Map<string, Task>, projectName?: string): string;
    updateConfig(config: Partial<MarkdownRenderConfig>): void;
    getConfig(): MarkdownRenderConfig;
}
declare const _default: MarkdownRenderer;
export default _default;

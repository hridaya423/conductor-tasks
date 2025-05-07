import { TaskManager } from './taskManager.js';
import { TaskPriority } from '../core/types.js';
export declare class TaskVisualizer {
    private taskManager;
    constructor(taskManager: TaskManager);
    displayKanbanBoard(options?: {
        showPriority?: boolean;
        showComplexity?: boolean;
        filterPriority?: TaskPriority;
        filterTag?: string;
        compact?: boolean;
    }): string;
    displayDependencyTree(rootTaskId?: string): void;
    displayDashboard(): string;
    private printTaskWithDependencies;
    private formatTaskCompact;
    private formatTaskEnhanced;
    private getPriorityIndicator;
    private getComplexityIndicator;
    private formatStatusText;
    private getStatusColor;
    private getPriorityColor;
    private padCenter;
}

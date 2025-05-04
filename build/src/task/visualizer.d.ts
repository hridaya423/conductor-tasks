import { TaskManager, TaskPriority } from '../taskManager.js';
export declare class TaskVisualizer {
    private taskManager;
    constructor(taskManager: TaskManager);
    displayKanbanBoard(options?: {
        showPriority?: boolean;
        showComplexity?: boolean;
        filterPriority?: TaskPriority;
        filterTag?: string;
        compact?: boolean;
    }): void;
    displayDependencyTree(rootTaskId?: string): void;
    displayDashboard(): void;
    private printTaskWithDependencies;
    private formatTaskCompact;
    private formatTask;
    private getStatusColor;
    private getPriorityColor;
    private padCenter;
}

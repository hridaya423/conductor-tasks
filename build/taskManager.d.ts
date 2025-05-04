export declare enum TaskPriority {
    CRITICAL = "critical",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low",
    BACKLOG = "backlog"
}
export declare enum TaskStatus {
    BACKLOG = "backlog",
    TODO = "todo",
    IN_PROGRESS = "in_progress",
    REVIEW = "review",
    DONE = "done",
    BLOCKED = "blocked"
}
export interface Task {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    complexity: number;
    createdAt: number;
    updatedAt: number;
    dueDate?: number;
    assignee?: string;
    dependencies: string[];
    tags: string[];
    notes: TaskNote[];
    aiSummary?: string;
    drawbacks?: string[];
}
export interface TaskNote {
    id: string;
    content: string;
    timestamp: number;
    author: string;
    type: "progress" | "comment" | "blocker" | "solution";
}
export declare class TaskManager {
    private tasks;
    private tasksByStatus;
    private lastAiAnalysis;
    private aiAnalysisInterval;
    private tasksFilePath;
    constructor();
    addTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt" | "notes" | "aiSummary">): string;
    getTask(id: string): Task | undefined;
    updateTask(id: string, updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>): Task | undefined;
    addTaskNote(taskId: string, content: string, author: string, type: "progress" | "comment" | "blocker" | "solution"): TaskNote | undefined;
    deleteTask(id: string): boolean;
    getTasks(options?: {
        status?: TaskStatus | TaskStatus[];
        priority?: TaskPriority | TaskPriority[];
        assignee?: string;
        tags?: string[];
        sortBy?: "priority" | "dueDate" | "createdAt" | "updatedAt";
        sortDirection?: "asc" | "desc";
    }): Task[];
    private checkForBlocking;
    generateAiSummaries(): void;
    private mockAiSummary;
    getTasksNeedingAttention(): Task[];
    getTaskDependencyTree(taskId: string): {
        task: Task;
        dependencies: Task[];
    } | undefined;
    getTasksFilePath(): string;
}

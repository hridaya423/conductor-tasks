import { TaskManager } from "../task/taskManager.js";
/**
 * Checks if the TaskManager is initialized (TASKS.md exists or tasks are loaded).
 * Reloads tasks from file if it exists.
 * Returns null if initialized, otherwise returns an MCP error message object.
 */
export declare function checkTaskManagerInitialized(taskManager: TaskManager): {
    content: {
        type: "text";
        text: string;
    }[];
} | null;

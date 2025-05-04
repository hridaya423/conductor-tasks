import { TaskManager } from "../task/taskManager.js";
export declare function checkTaskManagerInitialized(taskManager: TaskManager): {
    content: {
        type: "text";
        text: string;
    }[];
} | null;

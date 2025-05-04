import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const InitializeTasksSchema: {
    projectName: z.ZodString;
    projectDescription: z.ZodString;
    filePath: z.ZodString;
};
export declare function initializeTasksHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof InitializeTasksSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

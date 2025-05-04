import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const ExpandTaskSchema: {
    taskId: z.ZodString;
    expansionPrompt: z.ZodOptional<z.ZodString>;
};
export declare function expandTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof ExpandTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

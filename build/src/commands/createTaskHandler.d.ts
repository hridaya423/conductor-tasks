import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const CreateTaskSchema: {
    title: z.ZodString;
    description: z.ZodString;
    additionalContext: z.ZodOptional<z.ZodString>;
};
export declare function createTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof CreateTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

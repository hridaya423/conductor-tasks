import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const GetNextTaskSchema: {};
export declare function getNextTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof GetNextTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const GetTaskSchema: {
    id: z.ZodString;
};
export declare function getTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof GetTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

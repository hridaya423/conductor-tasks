import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const DeleteTaskSchema: {
    id: z.ZodString;
};
export declare function deleteTaskHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof DeleteTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

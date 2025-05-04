import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const SuggestTaskImprovementsSchema: {
    taskId: z.ZodString;
};
export declare function suggestTaskImprovementsHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof SuggestTaskImprovementsSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
export declare const GenerateImplementationStepsSchema: {
    taskId: z.ZodString;
};
export declare function generateImplementationStepsHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof GenerateImplementationStepsSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;

import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const AddTaskNoteSchema: {
    taskId: z.ZodString;
    content: z.ZodString;
    author: z.ZodString;
    type: z.ZodEnum<["progress", "comment", "blocker", "solution"]>;
};
export declare function addTaskNoteHandler(taskManager: TaskManager, params: z.infer<z.ZodObject<typeof AddTaskNoteSchema>>): Promise<ToolResultWithNextSteps>;

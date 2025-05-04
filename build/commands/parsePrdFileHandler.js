import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskPriority } from "../core/types.js";
export const ParsePrdFileSchema = {
    filePath: z.string().describe("Path to the PRD file to parse"),
    createTasksFile: z.boolean().optional().default(true).describe("Whether to create/update the TASKS.md file"),
    verbose: z.boolean().optional().default(false).describe("Show detailed output")
};
export async function parsePrdFileHandler(taskManager, params) {
    try {
        const { filePath, createTasksFile, verbose } = params;
        logger.info(`Parsing PRD file: ${filePath}`, { createTasksFile, verbose });
        const notInitialized = checkTaskManagerInitialized(taskManager);
        if (notInitialized && createTasksFile) {
            const defaultPath = path.join(process.cwd(), 'TASKS.md');
            await taskManager.initialize("PRD Project", "Project initialized from PRD parsing", defaultPath);
            logger.info("Task system automatically initialized for PRD file parsing");
        }
        else if (notInitialized) {
            return notInitialized;
        }
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
            logger.error(`PRD file not found: ${resolvedPath}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: File not found at ${resolvedPath}`
                    }
                ]
            };
        }
        const prdContent = fs.readFileSync(resolvedPath, 'utf8');
        const taskIds = await taskManager.parsePRD(prdContent);
        if (taskIds.length === 0) {
            logger.warn(`No tasks extracted from PRD file: ${filePath}`);
            return {
                content: [
                    {
                        type: "text",
                        text: "No tasks could be extracted from the PRD file. The document might be too short or not contain any clear requirements."
                    }
                ]
            };
        }
        logger.info(`Extracted ${taskIds.length} tasks from PRD file: ${filePath}`);
        const tasks = taskIds.map(id => taskManager.getTask(id)).filter(Boolean);
        // Format response (same as original)
        let taskListText = `# Tasks Created from PRD File\n\n`;
        taskListText += `File: ${resolvedPath}\n`;
        taskListText += `Total tasks: ${tasks.length}\n\n`;
        const priorityGroups = {};
        tasks.forEach(task => {
            if (!priorityGroups[task.priority]) {
                priorityGroups[task.priority] = [];
            }
            priorityGroups[task.priority].push(task);
        });
        const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW, TaskPriority.BACKLOG];
        for (const priority of priorityOrder) {
            const tasksInPriority = priorityGroups[priority] || [];
            if (tasksInPriority.length > 0) {
                taskListText += `\n## ${priority} Priority Tasks\n\n`;
                tasksInPriority.forEach(task => {
                    taskListText += `- ${task.title} (${task.id})\n`;
                    if (verbose) {
                        taskListText += `  ${task.description.substring(0, 100)}${task.description.length > 100 ? "..." : ""}\n`;
                    }
                });
            }
        }
        if (createTasksFile) {
            taskManager.saveTasks();
            const tasksFilePath = taskManager.getTasksFilePath();
            taskListText += `\n\n_Tasks have been saved to: ${tasksFilePath}_`;
            logger.info(`Tasks saved to ${tasksFilePath}`);
        }
        return {
            content: [
                {
                    type: "text",
                    text: taskListText
                }
            ]
        };
    }
    catch (error) {
        logger.error('Error parsing PRD file:', { error, filePath: params.filePath });
        return {
            content: [
                {
                    type: "text",
                    text: `Error parsing PRD file ${params.filePath}: ${error.message || String(error)}`
                }
            ]
        };
    }
}
//# sourceMappingURL=parsePrdFileHandler.js.map
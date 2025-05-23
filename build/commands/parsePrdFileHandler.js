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
        const resolvedPath = path.resolve(filePath);
        logger.info(`Using resolved PRD file path: ${resolvedPath}`);
        let notInitializedResult = checkTaskManagerInitialized(taskManager);
        if (notInitializedResult && createTasksFile) {
            let workspaceRoot;
            if (process.env.WORKSPACE_FOLDER_PATHS) {
                const paths = process.env.WORKSPACE_FOLDER_PATHS.split(';');
                if (paths.length > 0 && paths[0])
                    workspaceRoot = paths[0];
            }
            if (!workspaceRoot)
                workspaceRoot = path.dirname(resolvedPath);
            const tasksFilePath = path.join(workspaceRoot, 'TASKS.md');
            await taskManager.initialize("PRD Project", "Project initialized from PRD parsing", tasksFilePath);
            logger.info("Task system automatically initialized for PRD file parsing");
            notInitializedResult = null;
        }
        else if (notInitializedResult) {
            return notInitializedResult;
        }
        if (!fs.existsSync(resolvedPath)) {
            logger.error(`PRD file not found: ${resolvedPath}`);
            return {
                content: [{ type: "text", text: `Error: File not found at ${resolvedPath}` }],
                isError: true
            };
        }
        logger.info(`Reading PRD file content from: ${resolvedPath}`);
        const prdContent = fs.readFileSync(resolvedPath, 'utf8');
        logger.info(`Sending PRD content to LLM for parsing (${prdContent.length} characters)`);
        const taskIds = await taskManager.parsePRD(prdContent);
        if (taskIds.length === 0) {
            logger.warn(`No tasks extracted from PRD file: ${resolvedPath}`);
            return {
                content: [
                    {
                        type: "text",
                        text: "No tasks could be extracted from the PRD file. The document might be too short or not contain any clear requirements."
                    }
                ],
                isError: true
            };
        }
        logger.info(`Extracted ${taskIds.length} tasks from PRD file: ${resolvedPath}`);
        const tasks = [];
        for (const id of taskIds) {
            const task = taskManager.getTask(id);
            if (task) {
                tasks.push(task);
            }
        }
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
        const suggested_actions = [
            {
                tool_name: "list-tasks",
                reason: "View all newly created tasks from the PRD.",
                user_facing_suggestion: "List all tasks created from the PRD?"
            }
        ];
        if (taskIds.length > 0) {
            suggested_actions.push({
                tool_name: "get-task",
                parameters: { id: taskIds[0] },
                reason: "View details of the first task created.",
                user_facing_suggestion: `View details of the first task ('${tasks[0]?.title || taskIds[0]}')?`
            });
        }
        return {
            content: [
                {
                    type: "text",
                    text: taskListText
                }
            ],
            suggested_actions
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
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=parsePrdFileHandler.js.map
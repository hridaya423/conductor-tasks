import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus } from "../core/types.js";
export const VisualizeTasksDependencyTreeSchema = {
    taskId: z.string().optional().describe("ID of the task to show dependencies for (optional)")
};
export async function visualizeTasksDependencyTreeHandler(taskManager, params) {
    const notInitialized = checkTaskManagerInitialized(taskManager);
    if (notInitialized)
        return notInitialized;
    try {
        const { taskId } = params;
        logger.info('Visualizing task dependency tree', { taskId });
        const allTasks = taskManager.getTasks({});
        // Build Tree for all root tasks if no specific taskId
        if (!taskId) {
            const rootTasks = allTasks.filter(task => !task.parent);
            if (rootTasks.length === 0) {
                logger.info('No root tasks found for dependency tree visualization');
                return {
                    content: [
                        {
                            type: "text",
                            text: "No root tasks found. All tasks may be subtasks of other tasks."
                        }
                    ]
                };
            }
            let dependencyTree = "# Task Dependency Tree\n\n";
            // Helper function to build the tree recursively
            function buildTree(task, depth = 0) {
                const indent = '  '.repeat(depth);
                const statusSymbol = task.status === TaskStatus.DONE ? '✓' : ' ';
                let result = `${indent}- [${statusSymbol}] ${task.title} (${task.id})\n`;
                const subtasks = allTasks.filter(t => t.parent === task.id);
                for (const subtask of subtasks) {
                    result += buildTree(subtask, depth + 1);
                }
                return result;
            }
            for (const rootTask of rootTasks) {
                dependencyTree += buildTree(rootTask);
                dependencyTree += '\n';
            }
            logger.info(`Generated dependency tree for all ${rootTasks.length} root tasks.`);
            return {
                content: [
                    {
                        type: "text",
                        text: dependencyTree
                    }
                ]
            };
        }
        // Build tree for a specific task and its context
        else {
            const task = taskManager.getTask(taskId);
            if (!task) {
                logger.warn(`Task not found for dependency tree visualization: ${taskId}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: Task with ID ${taskId} not found.`
                        }
                    ]
                };
            }
            let dependencyTree = `# Dependency Tree for "${task.title}"\n\n`;
            // Find the ultimate root parent
            let rootTask = task;
            let currentParentId = task.parent;
            const parentChain = [];
            while (currentParentId) {
                const parent = taskManager.getTask(currentParentId);
                if (!parent)
                    break;
                parentChain.unshift(parent);
                rootTask = parent;
                currentParentId = parent.parent;
            }
            // Display parent chain if any
            if (parentChain.length > 0) {
                dependencyTree += "## Parent Chain\n\n";
                parentChain.forEach((parent, index) => {
                    dependencyTree += `${'  '.repeat(index)}- ${parent.title} (${parent.id})\n`;
                });
                dependencyTree += `${'  '.repeat(parentChain.length)}- ${task.title} (${task.id}) <- Current Task\n\n`;
            }
            // Helper function to build the subtask tree recursively
            function buildSubtasksTree(currentTaskId, depth = 0) {
                const subtasks = allTasks.filter(t => t.parent === currentTaskId);
                if (subtasks.length === 0)
                    return '';
                let result = '';
                for (const subtask of subtasks) {
                    const statusSymbol = subtask.status === TaskStatus.DONE ? '✓' : ' ';
                    // Indent based on depth relative to the *initial* task for subtask section
                    const relativeDepth = parentChain.length + depth + (parentChain.length > 0 ? 1 : 0);
                    result += `${'  '.repeat(relativeDepth)}- [${statusSymbol}] ${subtask.title} (${subtask.id})\n`;
                    result += buildSubtasksTree(subtask.id, depth + 1);
                }
                return result;
            }
            dependencyTree += "## Subtasks\n\n";
            const subtasksTree = buildSubtasksTree(taskId, 0);
            dependencyTree += subtasksTree || "No subtasks found for this task.\n";
            logger.info(`Generated dependency tree for specific task: ${taskId}`);
            return {
                content: [
                    {
                        type: "text",
                        text: dependencyTree
                    }
                ]
            };
        }
    }
    catch (error) {
        logger.error('Error displaying dependency tree:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error displaying dependency tree: ${error.message || String(error)}`
                }
            ]
        };
    }
}
//# sourceMappingURL=visualizeTasksDependencyTreeHandler.js.map
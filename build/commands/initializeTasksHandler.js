import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import logger from "../core/logger.js";
import { IDEType } from '../core/types.js';
import { IDERulesManager } from '../ide/ideRulesManager.js';
import { normalizeWindowsPath } from '../core/pathUtils.js';
export const InitializeTasksSchema = {
    projectName: z.string().describe("Name of the project"),
    projectDescription: z.string().describe("Description of the project"),
    filePath: z.string().describe("Full path where to save TASKS.md")
};
export async function initializeTasksHandler(taskManager, params) {
    try {
        const { projectName, projectDescription, filePath } = params;
        logger.info(`Initializing task system for project: ${projectName} at ${filePath}`);
        const decodedFilePath = normalizeWindowsPath(filePath);
        const normalizedPath = path.resolve(decodedFilePath);
        if (fs.existsSync(normalizedPath)) {
            logger.warn(`Task file already exists at ${normalizedPath}. Initialization aborted.`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: A task file already exists at ${normalizedPath}. Cannot initialize a new task system at this location.`
                    }
                ],
                isError: true
                // No suggested_actions on this specific error
            };
        }
        const result = await taskManager.mcpInitializeTasks(projectName, projectDescription, normalizedPath);
        logger.info(`Task system initialized successfully for ${projectName}.`);
        // Set the file path in the task manager
        taskManager.setTasksFilePath(normalizedPath);
        // Create directory if it doesn't exist
        const directory = path.dirname(normalizedPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            logger.info(`Created directory: ${directory}`);
        }
        // Initialize basic tasks file if it doesn't exist
        if (!fs.existsSync(normalizedPath)) {
            const initialContent = `# ${projectName} Tasks\n\n${projectDescription}\n\n`;
            fs.writeFileSync(normalizedPath, initialContent);
            logger.info(`Created tasks file at ${normalizedPath}`);
        }
        // Generate IDE-specific rule files
        try {
            const projectRoot = path.dirname(directory);
            // Get the IDE type from environment variable or default to cursor
            const envIdeType = process.env.IDE;
            let ideType = IDEType.CURSOR;
            if (envIdeType) {
                const normalizedType = envIdeType.toLowerCase();
                // Find the matching IDE type using case-insensitive comparison
                const validIdeType = Object.values(IDEType).find(type => type.toLowerCase() === normalizedType);
                if (validIdeType) {
                    ideType = validIdeType;
                }
            }
            logger.info(`Using IDE type ${ideType} for rule generation`);
            logger.info(`Project root for rule generation: ${projectRoot}`);
            // Initialize the IDE Rules Manager with the correct project root
            const ideRulesManager = IDERulesManager.getInstance();
            // Add explicit log for the current workspace root
            logger.info(`Current IDE Rules Manager workspace root: ${ideRulesManager.getWorkspaceRoot()}`);
            // Set the workspace root to the project root
            ideRulesManager.setWorkspaceRoot(projectRoot);
            logger.info(`Updated workspace root to: ${ideRulesManager.getWorkspaceRoot()}`);
            // Explicitly set IDE type
            ideRulesManager.setIDEType(ideType);
            logger.info(`Set IDE type to: ${ideRulesManager.getIDEType()}`);
            // Force reset the rules to ensure clean generation
            logger.info('Calling forceResetRules() to generate IDE-specific rules');
            await ideRulesManager.forceResetRules();
            logger.info(`Generated IDE-specific rule files for ${ideType}`);
        }
        catch (error) {
            logger.error('Failed to generate IDE rule files', { error: error.stack || error.message || String(error) });
            // Continue even if rule generation fails, but do not attempt to write old hardcoded rules.
            // The IDERulesManager should be the source of truth.
        }
        const resultText = `Initialized task management system for "${projectName}" at ${taskManager.getTasksFilePath()}`;
        const suggested_actions = [
            {
                tool_name: "list-tasks",
                reason: "View the initial set of tasks created for the project.",
                user_facing_suggestion: `List tasks for project '${projectName}'?`
            },
            {
                tool_name: "create-task",
                parameters: { title: "Define initial milestones", description: "Outline the first set of major milestones for the project." },
                reason: "Start populating the project with high-level tasks.",
                user_facing_suggestion: `Create a task to define initial milestones for '${projectName}'?`
            }
        ];
        return {
            content: [
                {
                    type: "text",
                    text: resultText,
                },
            ],
            suggested_actions,
        };
    }
    catch (error) {
        logger.error('Error initializing task system:', { error });
        return {
            content: [
                {
                    type: "text",
                    text: `Error initializing task system: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=initializeTasksHandler.js.map
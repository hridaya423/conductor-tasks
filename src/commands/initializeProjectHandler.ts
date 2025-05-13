import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";
import { IDEType, ToolResultWithNextSteps, SuggestedAction } from '../core/types.js';
import { IDERulesManager } from '../ide/ideRulesManager.js';

export const InitializeProjectSchema = {
  projectName: z.string().describe("Name of the project"),
  projectDescription: z.string().describe("Description of the project"),
  filePath: z.string().describe("Full path where to save TASKS.md (or main project file if evolving)")
};

export async function initializeProjectHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof InitializeProjectSchema>>
): Promise<ToolResultWithNextSteps> {
  try {
    
    const { projectName, projectDescription, filePath: correctAbsoluteTasksMdPath } = params; 
    
    logger.info(`Initializing project: ${projectName}. Target tasks file: ${correctAbsoluteTasksMdPath}`);

    
    
    const resolvedTargetFilePath = path.resolve(correctAbsoluteTasksMdPath);
    logger.info(`Resolved target file path for TASKS.md: ${resolvedTargetFilePath}`);

    if (fs.existsSync(resolvedTargetFilePath)) {
      logger.warn(`Task file already exists at ${resolvedTargetFilePath}. Project initialization aborted.`);
      return {
        content: [
          {
            type: "text",
            text: `Error: A task file (or main project file) already exists at ${resolvedTargetFilePath}. Cannot fully re-initialize project at this location if it implies overwriting.`
          }
        ],
        isError: true
      };
    }

    
    const result = await taskManager.mcpInitializeTasks(projectName, projectDescription, resolvedTargetFilePath);
    logger.info(`Core task system initialized successfully for ${projectName}.`);
    
    
    
    
    
    try {
      
      const projectRootForIdeRules = path.dirname(resolvedTargetFilePath); 
      
      const envIdeType = process.env.IDE;
      let ideType: IDEType = IDEType.CURSOR; 
      
      if (envIdeType) {
        const normalizedType = envIdeType.toLowerCase();
        const validIdeType = Object.values(IDEType).find(
          type => type.toLowerCase() === normalizedType
        );
        if (validIdeType) ideType = validIdeType;
      }
      
      logger.info(`Using IDE type ${ideType} for rule generation during project initialization.`);
      logger.info(`Project root for rule generation: ${projectRootForIdeRules}`);
      
      const ideRulesManager = IDERulesManager.getInstance();
      ideRulesManager.setWorkspaceRoot(projectRootForIdeRules); 
      ideRulesManager.setIDEType(ideType);
      
      logger.info('Calling forceResetRules() to generate IDE-specific rules for the project.');
      await ideRulesManager.forceResetRules(); 
      
      logger.info(`Generated IDE-specific rule files for ${ideType} for project ${projectName}.`);
    } catch (error: any) {
      logger.error('Failed to generate IDE rule files during project initialization', { error: error.stack || error.message || String(error) });
    }

    
    const resultText = `Project "${projectName}" initialized successfully. Task management file is at ${taskManager.getTasksFilePath()}. IDE rules generated.`;
    const suggested_actions: SuggestedAction[] = [
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
  } catch (error: any) {
    logger.error('Error initializing project:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error initializing project: ${error.message || String(error)}`
        }
      ],
      isError: true
    };
  }
}

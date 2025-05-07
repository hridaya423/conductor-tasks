import { Command } from 'commander';
import path from 'path';
import fs from 'fs';

import { TaskManager } from '../task/taskManager.js';
import { getLLMClient } from '../llm/clientFactory.js';
import chalk from 'chalk';

export function createParsePRDCommand(taskManager: TaskManager): Command {
  return new Command('parse-prd')
    .description('Parse a PRD file and create tasks from it')
    .argument('<prd-file>', 'Path to the PRD file')
    .option('-t, --tasks-file <path>', 'Path to save the tasks file', 'TASKS.md')
    .action(async (prdPath, options) => {
      try {
        const resolvedPath = path.resolve(process.cwd(), prdPath);
        
        if (!fs.existsSync(resolvedPath)) {
          console.error(chalk.red(`Error: PRD file not found at ${resolvedPath}`));
          process.exit(1);
        }
        
        console.log(chalk.blue(`Parsing PRD file: ${resolvedPath}`));
        
        try {
          const llmClient = getLLMClient();
          console.log(chalk.gray(`Using LLM provider: ${llmClient.getProviderName()}`));
          
          console.log(chalk.yellow('Extracting tasks from PRD... (this may take a minute)'));
          const prdContent = fs.readFileSync(resolvedPath, 'utf8');
          
          
          const taskIds = await taskManager.parsePRD(prdContent);
          
          console.log(chalk.green(`Successfully extracted ${taskIds.length} tasks from PRD`));
          
          if (options.tasksFile) {
            const tasksFilePath = path.resolve(process.cwd(), options.tasksFile);
            taskManager.setTasksFilePath(tasksFilePath);
            taskManager.saveTasks();
            console.log(chalk.green(`Tasks saved to ${tasksFilePath}`));
          }
        } catch (error) {
          console.error(chalk.red(`Error parsing PRD: ${error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { getLLMClient } from '../llm/clientFactory.js';
import { PRDParser } from '../task/prdParser.js';
import chalk from 'chalk';
export function createParsePRDCommand(taskManager) {
    const command = new Command('parse-prd')
        .description('Parse a PRD document and extract tasks')
        .argument('<prdFilePath>', 'Path to the PRD file')
        .option('-t, --tasks-file', 'Generate a TASKS.md file', false)
        .option('-v, --verbose', 'Show detailed output', false)
        .action(async (prdFilePath, options) => {
        try {
            const resolvedPath = path.resolve(prdFilePath);
            if (!fs.existsSync(resolvedPath)) {
                console.error(chalk.red(`Error: File not found at ${resolvedPath}`));
                process.exit(1);
            }
            console.log(chalk.blue(`Parsing PRD document: ${resolvedPath}`));
            const llmClient = getLLMClient();
            console.log(chalk.gray(`Using LLM provider: ${llmClient.getProviderName()}`));
            const prdParser = new PRDParser(taskManager, llmClient);
            console.log(chalk.yellow('Extracting tasks from PRD... (this may take a minute)'));
            const taskIds = await prdParser.parsePRD(resolvedPath, options.tasksFile);
            console.log(chalk.green(`\n✅ Successfully extracted ${taskIds.length} tasks from PRD!`));
            if (options.tasksFile) {
                console.log(chalk.green(`Generated TASKS.md file in the current directory.`));
            }
            if (options.verbose) {
                console.log(chalk.blue('\nExtracted Tasks:'));
                for (const taskId of taskIds) {
                    const task = taskManager.getTask(taskId);
                    if (task) {
                        console.log(chalk.white(`\n${task.title} (${task.priority.toUpperCase()})`));
                        console.log(chalk.gray(task.description.substring(0, 150) + '...'));
                    }
                }
            }
            console.log(chalk.blue('\nRun `list` to see all tasks or `next` to get the next task to work on.'));
        }
        catch (error) {
            console.error(chalk.red(`Error parsing PRD: ${error}`));
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=parsePRD.js.map
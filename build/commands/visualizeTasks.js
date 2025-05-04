import { Command } from 'commander';
import { TaskPriority } from '../taskManager.js';
import { TaskVisualizer } from '../task/visualizer.js';
import chalk from 'chalk';
export function createVisualizeTasksCommand(taskManager) {
    const taskVisualizer = new TaskVisualizer(taskManager);
    const command = new Command('visualize')
        .description('Visualize tasks in different formats')
        .addCommand(createKanbanCommand(taskVisualizer))
        .addCommand(createDependencyTreeCommand(taskVisualizer))
        .addCommand(createDashboardCommand(taskVisualizer));
    return command;
}
function createKanbanCommand(taskVisualizer) {
    return new Command('kanban')
        .description('Display tasks in a Kanban board view')
        .option('-p, --priority <priority>', 'Filter by priority (critical, high, medium, low, backlog)')
        .option('-t, --tag <tag>', 'Filter by tag')
        .option('-c, --compact', 'Use compact display mode')
        .option('--no-priority', 'Hide priority indicators')
        .option('--no-complexity', 'Hide complexity indicators')
        .action((options) => {
        try {
            const filterPriority = options.priority ?
                Object.values(TaskPriority).find(p => p === options.priority.toLowerCase()) :
                undefined;
            if (options.priority && !filterPriority) {
                console.error(chalk.red(`Invalid priority: ${options.priority}`));
                console.log(chalk.gray(`Valid priorities: ${Object.values(TaskPriority).join(', ')}`));
                process.exit(1);
            }
            taskVisualizer.displayKanbanBoard({
                showPriority: options.priority !== false,
                showComplexity: options.complexity !== false,
                filterPriority,
                filterTag: options.tag,
                compact: options.compact
            });
        }
        catch (error) {
            console.error(chalk.red(`Error displaying Kanban board: ${error}`));
            process.exit(1);
        }
    });
}
function createDependencyTreeCommand(taskVisualizer) {
    return new Command('tree')
        .description('Display task dependency tree')
        .argument('[taskId]', 'ID of the task to show dependencies for (optional)')
        .action((taskId) => {
        try {
            taskVisualizer.displayDependencyTree(taskId);
        }
        catch (error) {
            console.error(chalk.red(`Error displaying dependency tree: ${error}`));
            process.exit(1);
        }
    });
}
function createDashboardCommand(taskVisualizer) {
    return new Command('dashboard')
        .description('Display task dashboard with summary statistics')
        .action(() => {
        try {
            taskVisualizer.displayDashboard();
        }
        catch (error) {
            console.error(chalk.red(`Error displaying dashboard: ${error}`));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=visualizeTasks.js.map
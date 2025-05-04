import chalk from 'chalk';
import { TaskManager, Task, TaskPriority, TaskStatus } from '../taskManager.js';

export class TaskVisualizer {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  displayKanbanBoard(options: {
    showPriority?: boolean;
    showComplexity?: boolean;
    filterPriority?: TaskPriority;
    filterTag?: string;
    compact?: boolean;
  } = {}): void {
    const { 
      showPriority = true,
      showComplexity = true,
      filterPriority,
      filterTag,
      compact = false
    } = options;

    let tasks = this.taskManager.getTasks();

    if (filterPriority) {
      tasks = tasks.filter(task => task.priority === filterPriority);
    }

    if (filterTag) {
      tasks = tasks.filter(task => task.tags.includes(filterTag));
    }

    const tasksByStatus = new Map<TaskStatus, Task[]>();
    Object.values(TaskStatus).forEach(status => {
      tasksByStatus.set(status, []);
    });

    tasks.forEach(task => {
      const statusTasks = tasksByStatus.get(task.status) || [];
      statusTasks.push(task);
    });

    const terminalWidth = process.stdout.columns || 80;
    const numColumns = Object.keys(TaskStatus).length;
    const columnWidth = Math.floor((terminalWidth - (numColumns - 1)) / numColumns);

    const headers = Object.values(TaskStatus).map(status => {
      const count = tasksByStatus.get(status)?.length || 0;
      return `${status.toUpperCase()} (${count})`;
    });

    console.log('\n' + chalk.bold.blue('=== Task Board ===') + '\n');

    headers.forEach((header, index) => {
      const paddedHeader = this.padCenter(header, columnWidth);
      process.stdout.write(chalk.bold.white(paddedHeader));

      if (index < headers.length - 1) {
        process.stdout.write('|');
      }
    });
    console.log('\n' + '='.repeat(terminalWidth));

    const maxTasks = Math.max(...Array.from(tasksByStatus.values()).map(tasks => tasks.length));

    for (let i = 0; i < maxTasks; i++) {
      Object.values(TaskStatus).forEach((status, statusIndex) => {
        const statusTasks = tasksByStatus.get(status) || [];
        const task = statusTasks[i];

        if (task) {

          let taskDisplay = compact 
            ? this.formatTaskCompact(task, { showPriority, showComplexity })
            : this.formatTask(task, { showPriority, showComplexity });

          if (taskDisplay.length > columnWidth) {
            taskDisplay = taskDisplay.substring(0, columnWidth - 3) + '...';
          } else {
            taskDisplay = taskDisplay.padEnd(columnWidth, ' ');
          }

          process.stdout.write(taskDisplay);
        } else {

          process.stdout.write(' '.repeat(columnWidth));
        }

        if (statusIndex < Object.values(TaskStatus).length - 1) {
          process.stdout.write('|');
        }
      });
      console.log();
    }

    console.log('='.repeat(terminalWidth) + '\n');
  }

  displayDependencyTree(rootTaskId?: string): void {
    if (rootTaskId) {

      const depTree = this.taskManager.getTaskDependencyTree?.(rootTaskId);
      if (!depTree) {
        console.log(chalk.red(`Task with ID ${rootTaskId} not found`));
        return;
      }

      console.log(chalk.bold.blue(`\n=== Dependency Tree for "${depTree.task.title}" ===\n`));
      this.printTaskWithDependencies(depTree.task, depTree.dependencies, '', true);
    } else {

      const allTasks = this.taskManager.getTasks();
      const dependentTasks = new Set<string>();

      allTasks.forEach(task => {
        task.dependencies.forEach(depId => {
          dependentTasks.add(depId);
        });
      });

      const topLevelTasks = allTasks.filter(task => !dependentTasks.has(task.id));

      console.log(chalk.bold.blue('\n=== Task Dependency Trees ===\n'));

      if (topLevelTasks.length === 0) {
        console.log(chalk.yellow('No top-level tasks found. You might have circular dependencies.'));
      } else {
        topLevelTasks.forEach((task, index) => {

          const depTree = this.taskManager.getTaskDependencyTree?.(task.id);
          if (depTree) {
            this.printTaskWithDependencies(
              depTree.task, 
              depTree.dependencies, 
              '', 
              index === topLevelTasks.length - 1
            );
          }

          if (index < topLevelTasks.length - 1) {
            console.log();
          }
        });
      }
    }

    console.log();
  }

  displayDashboard(): void {
    const allTasks = this.taskManager.getTasks();
    const totalTasks = allTasks.length;

    const tasksByStatus = new Map<TaskStatus, number>();
    Object.values(TaskStatus).forEach(status => {
      tasksByStatus.set(status, 0);
    });

    allTasks.forEach(task => {
      const count = tasksByStatus.get(task.status) || 0;
      tasksByStatus.set(task.status, count + 1);
    });

    const tasksByPriority = new Map<TaskPriority, number>();
    Object.values(TaskPriority).forEach(priority => {
      tasksByPriority.set(priority, 0);
    });

    allTasks.forEach(task => {
      const count = tasksByPriority.get(task.priority) || 0;
      tasksByPriority.set(task.priority, count + 1);
    });

    const tasksNeedingAttention = this.taskManager.getTasksNeedingAttention?.() || [];

    console.log(chalk.bold.blue('\n=== Task Dashboard ===\n'));

    console.log(chalk.bold('Task Summary:'));
    console.log(`Total Tasks: ${totalTasks}`);

    console.log(chalk.bold('\nBy Status:'));
    tasksByStatus.forEach((count, status) => {
      const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
      const statusColor = this.getStatusColor(status);
      console.log(`${statusColor(status.padEnd(12))}: ${count} (${percentage}%)`);
    });

    console.log(chalk.bold('\nBy Priority:'));
    tasksByPriority.forEach((count, priority) => {
      const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
      const priorityColor = this.getPriorityColor(priority);
      console.log(`${priorityColor(priority.padEnd(12))}: ${count} (${percentage}%)`);
    });

    if (tasksNeedingAttention.length > 0) {
      console.log(chalk.bold.yellow('\nTasks Needing Attention:'));
      tasksNeedingAttention.forEach(task => {
        const statusColor = this.getStatusColor(task.status);
        const priorityColor = this.getPriorityColor(task.priority);

        console.log(`- ${chalk.bold(task.title)}`);
        console.log(`  ID: ${task.id} | ${statusColor(task.status)} | ${priorityColor(task.priority)}`);
      });
    }

    console.log();
  }

  private printTaskWithDependencies(
    task: Task, 
    dependencies: Task[], 
    prefix: string, 
    isLast: boolean
  ): void {

    const branch = isLast ? '└── ' : '├── ';
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    const statusColor = this.getStatusColor(task.status);
    const priorityColor = this.getPriorityColor(task.priority);

    console.log(
      `${prefix}${branch}${chalk.bold(task.title)} ` +
      `[${statusColor(task.status)}, ${priorityColor(task.priority)}]`
    );

    dependencies.forEach((depTask, index) => {
      const depIsLast = index === dependencies.length - 1;
      this.printTaskWithDependencies(
        depTask, 

        this.taskManager.getTaskDependencyTree?.(depTask.id)?.dependencies || [],
        newPrefix, 
        depIsLast
      );
    });
  }

  private formatTaskCompact(
    task: Task, 
    options: { showPriority: boolean; showComplexity: boolean }
  ): string {
    const { showPriority, showComplexity } = options;

    const statusColor = this.getStatusColor(task.status);
    const priorityColor = this.getPriorityColor(task.priority);

    let formattedTask = chalk.bold(task.title);

    const indicators = [];

    if (showPriority) {
      indicators.push(priorityColor(`[${task.priority.charAt(0).toUpperCase()}]`));
    }

    if (showComplexity) {
      indicators.push(chalk.gray(`[C${task.complexity}]`));
    }

    if (indicators.length > 0) {
      formattedTask += ' ' + indicators.join(' ');
    }

    return formattedTask;
  }

  private formatTask(
    task: Task, 
    options: { showPriority: boolean; showComplexity: boolean }
  ): string {
    const { showPriority, showComplexity } = options;

    const statusColor = this.getStatusColor(task.status);
    const priorityColor = this.getPriorityColor(task.priority);

    let formattedTask = chalk.bold(task.title) + '\n';
    formattedTask += `ID: ${task.id.substring(0, 8)}`;

    if (showPriority) {
      formattedTask += ` | ${priorityColor(task.priority)}`;
    }

    if (showComplexity) {
      formattedTask += ` | Complexity: ${task.complexity}`;
    }

    return formattedTask;
  }

  private getStatusColor(status: TaskStatus): any {
    switch (status) {
      case TaskStatus.DONE:
        return chalk.green;
      case TaskStatus.IN_PROGRESS:
        return chalk.blue;
      case TaskStatus.REVIEW:
        return chalk.cyan;
      case TaskStatus.TODO:
        return chalk.yellow;
      case TaskStatus.BLOCKED:
        return chalk.red;
      case TaskStatus.BACKLOG:
      default:
        return chalk.gray;
    }
  }

  private getPriorityColor(priority: TaskPriority): any {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return chalk.red.bold;
      case TaskPriority.HIGH:
        return chalk.red;
      case TaskPriority.MEDIUM:
        return chalk.yellow;
      case TaskPriority.LOW:
        return chalk.green;
      case TaskPriority.BACKLOG:
      default:
        return chalk.gray;
    }
  }

  private padCenter(text: string, width: number): string {
    const padding = width - text.length;
    if (padding <= 0) return text;

    const leftPadding = Math.floor(padding / 2);
    const rightPadding = padding - leftPadding;

    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }
}

import chalk from 'chalk';
import { TaskManager } from './taskManager.js';
import { Task, TaskPriority, TaskStatus } from '../core/types.js';

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
  } = {}): string {
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

    tasksByStatus.forEach((statusTasks, status) => {
      tasksByStatus.set(
        status, 
        statusTasks.sort((a, b) => {
          const priorityOrder: Record<TaskPriority, number> = {
            [TaskPriority.CRITICAL]: 0,
            [TaskPriority.HIGH]: 1,
            [TaskPriority.MEDIUM]: 2,
            [TaskPriority.LOW]: 3,
            [TaskPriority.BACKLOG]: 4
          };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
      );
    });

    const terminalWidth = process.stdout.columns || 100;
    const numColumns = Object.keys(TaskStatus).length;
    const columnWidth = Math.floor((terminalWidth - (numColumns * 2)) / numColumns);

    const totalTasks = tasks.length;
    const doneTasks = tasksByStatus.get(TaskStatus.DONE)?.length || 0;
    const progressPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    let output = '';
    
    output += '\n' + chalk.bold.blue('╔═══════════════════════════════════════════════════════════════╗') + '\n';
    output += chalk.bold.blue('║ ') + chalk.bold.white('TASK BOARD') + chalk.bold.blue(' '.repeat(terminalWidth - 13) + '║') + '\n';
    output += chalk.bold.blue('╚═══════════════════════════════════════════════════════════════╝') + '\n\n';
    
    output += chalk.white(`Total Tasks: ${totalTasks} | Progress: ${progressPercentage}% complete\n\n`);

    const headers = Object.values(TaskStatus).map(status => {
      const count = tasksByStatus.get(status)?.length || 0;
      return `${this.formatStatusText(status)} (${count})`;
    });

    headers.forEach((header, index) => {
      const paddedHeader = this.padCenter(header, columnWidth);
      output += chalk.bold.white(paddedHeader);

      if (index < headers.length - 1) {
        output += ' │ ';
      }
    });
    
    output += '\n' + '─'.repeat(terminalWidth) + '\n';

    const maxTasks = Math.max(...Array.from(tasksByStatus.values()).map(tasks => tasks.length), 1);
    const maxTasksToShow = Math.min(maxTasks, 20); 

    
    for (let i = 0; i < maxTasksToShow; i++) {
      Object.values(TaskStatus).forEach((status, statusIndex) => {
        const statusTasks = tasksByStatus.get(status) || [];
        const task = statusTasks[i];

        if (task) {
          let taskDisplay = compact 
            ? this.formatTaskCompact(task, { showPriority, showComplexity })
            : this.formatTaskEnhanced(task, { showPriority, showComplexity, columnWidth });

          output += taskDisplay;
        } else {
          output += ' '.repeat(columnWidth);
        }

        if (statusIndex < Object.values(TaskStatus).length - 1) {
          output += ' │ ';
        }
      });
      output += '\n';
      
      if (i < maxTasksToShow - 1) {
        Object.values(TaskStatus).forEach((_, statusIndex) => {
          output += '─'.repeat(columnWidth);
          if (statusIndex < Object.values(TaskStatus).length - 1) {
            output += '─┼─';
          }
        });
        output += '\n';
      }
    }

    const hiddenTasks = maxTasks - maxTasksToShow;
    if (hiddenTasks > 0) {
      output += '\n' + chalk.italic.gray(`... and ${hiddenTasks} more tasks not shown. Use filters to narrow results.`) + '\n';
    }

    output += '═'.repeat(terminalWidth) + '\n';
    
    if (showPriority) {
      output += chalk.bold('\nPriority: ');
      output += chalk.red('● CRITICAL ') + chalk.yellow('● HIGH ') + chalk.blue('● MEDIUM ') + chalk.green('● LOW ') + chalk.gray('● BACKLOG\n');
    }
    
    if (filterPriority || filterTag) {
      output += chalk.italic('\nActive Filters: ');
      if (filterPriority) output += chalk.white(`Priority=${filterPriority} `);
      if (filterTag) output += chalk.white(`Tag=${filterTag} `);
      output += '\n';
    }
    
    return output;
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

  displayDashboard(): string {
    const allTasks = this.taskManager.getTasks();
    const totalTasks = allTasks.length;
    let output = '';

    if (totalTasks === 0) {
      return chalk.yellow('\nNo tasks found. Create tasks with the "create-task" command.\n');
    }

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
    const recentTasks = [...allTasks]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);

    
    const tagCounts = new Map<string, number>();
    allTasks.forEach(task => {
      task.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    
    const completedTasks = tasksByStatus.get(TaskStatus.DONE) || 0;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    
    const progressBarWidth = 50;
    const filledWidth = Math.round((progressPercentage / 100) * progressBarWidth);
    const progressBar = '[' + '█'.repeat(filledWidth) + '·'.repeat(progressBarWidth - filledWidth) + ']';

    
    output += '\n' + chalk.bold.blue('╔══════════════════════════════════════════════════════════╗') + '\n';
    output += chalk.bold.blue('║ ') + chalk.bold.white('PROJECT DASHBOARD') + chalk.bold.blue(' '.repeat(31) + '║') + '\n';
    output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝') + '\n\n';

    
    output += chalk.bold.white('📊 Project Overview') + '\n';
    output += chalk.white('─'.repeat(80)) + '\n';
    output += chalk.white(`Total Tasks: ${totalTasks}`) + '\n';
    output += chalk.white(`Progress: ${progressPercentage}% complete`) + '\n';
    output += chalk.white(`${progressBar} ${progressPercentage}%`) + '\n\n';
    
    
    output += chalk.bold.white('📋 Task Status') + '\n';
    output += chalk.white('─'.repeat(80)) + '\n';
    
    
    tasksByStatus.forEach((count, status) => {
      const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
      const barWidth = Math.round((count / totalTasks) * 40);
      const statusColor = this.getStatusColor(status);
      const bar = '█'.repeat(barWidth);
      output += `${statusColor(status.padEnd(12))}: ${count.toString().padStart(3)} (${percentage.padStart(4)}%) ${chalk.white(bar)}\n`;
    });
    output += '\n';
    
    
    output += chalk.bold.white('🔥 Task Priority') + '\n';
    output += chalk.white('─'.repeat(80)) + '\n';
    
    
    tasksByPriority.forEach((count, priority) => {
      const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
      const barWidth = Math.round((count / totalTasks) * 40);
      const priorityColor = this.getPriorityColor(priority);
      const bar = '█'.repeat(barWidth);
      output += `${priorityColor(priority.padEnd(12))}: ${count.toString().padStart(3)} (${percentage.padStart(4)}%) ${chalk.white(bar)}\n`;
    });
    output += '\n';
    
    
    if (topTags.length > 0) {
      output += chalk.bold.white('🏷️ Top Tags') + '\n';
      output += chalk.white('─'.repeat(80)) + '\n';
      
      topTags.forEach(([tag, count]) => {
        const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
        output += `${chalk.cyan(tag.padEnd(15))}: ${count.toString().padStart(3)} (${percentage.padStart(4)}%)\n`;
      });
      output += '\n';
    }

    
    if (tasksNeedingAttention.length > 0) {
      output += chalk.bold.yellow('⚠️ Tasks Needing Attention') + '\n';
      output += chalk.white('─'.repeat(80)) + '\n';
      
      tasksNeedingAttention.slice(0, 5).forEach((task, index) => {
        const statusColor = this.getStatusColor(task.status);
        const priorityColor = this.getPriorityColor(task.priority);
        
        output += `${index + 1}. ${chalk.bold.white(task.title)}\n`;
        output += `   ID: ${chalk.gray(task.id)} | ${statusColor(task.status)} | ${priorityColor(task.priority)}\n`;
        
        
        if (task.tags.length > 0) {
          output += `   Tags: ${task.tags.map(tag => chalk.cyan(tag)).join(', ')}\n`;
        }
        
        if (index < tasksNeedingAttention.length - 1) {
          output += '\n';
        }
      });
      
      if (tasksNeedingAttention.length > 5) {
        output += chalk.gray(`\n...and ${tasksNeedingAttention.length - 5} more tasks needing attention.\n`);
      }
      output += '\n';
    }

    
    if (recentTasks.length > 0) {
      output += chalk.bold.white('🕒 Recent Activity') + '\n';
      output += chalk.white('─'.repeat(80)) + '\n';
      
      recentTasks.forEach((task, index) => {
        const statusColor = this.getStatusColor(task.status);
        const date = new Date(task.updatedAt).toLocaleString();
        
        output += `${chalk.bold.white(task.title)} ${chalk.gray(`(${date})`)}\n`;
        output += `   ID: ${chalk.gray(task.id)} | ${statusColor(task.status)} | Updated: ${task.updatedAt !== task.createdAt ? 'Yes' : 'No'}\n`;
        
        if (index < recentTasks.length - 1) {
          output += '\n';
        }
      });
    }

    return output;
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

  private formatTaskEnhanced(
    task: Task, 
    options: { 
      showPriority: boolean; 
      showComplexity: boolean;
      columnWidth: number;
    }
  ): string {
    const { showPriority, showComplexity, columnWidth } = options;
    
    
    const maxTitleLength = columnWidth - 6;
    
    
    let title = task.title;
    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength - 3) + '...';
    }
    
    
    let taskDisplay = '';
    
    
    if (showPriority) {
      taskDisplay += this.getPriorityIndicator(task.priority) + ' ';
    }
    
    
    taskDisplay += chalk.bold(title);
    
    
    if (showComplexity && task.complexity) {
      const complexityIndicator = this.getComplexityIndicator(task.complexity);
      taskDisplay += ' ' + complexityIndicator;
    }
    
    
    const shortId = task.id.split('-').pop() || task.id;
    taskDisplay += ' ' + chalk.gray(`#${shortId}`);
    
    
    if (taskDisplay.length > columnWidth) {
      taskDisplay = taskDisplay.substring(0, columnWidth - 3) + '...';
    } else {
      taskDisplay = taskDisplay.padEnd(columnWidth);
    }
    
    return taskDisplay;
  }

  private getPriorityIndicator(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return chalk.bgRed.white('!');
      case TaskPriority.HIGH:
        return chalk.red('●');
      case TaskPriority.MEDIUM:
        return chalk.yellow('●');
      case TaskPriority.LOW:
        return chalk.blue('●');
      case TaskPriority.BACKLOG:
        return chalk.gray('●');
      default:
        return ' ';
    }
  }

  private getComplexityIndicator(complexity: number): string {
    if (complexity <= 3) {
      return chalk.green(`⦿${complexity}`);
    } else if (complexity <= 6) {
      return chalk.yellow(`⦿${complexity}`);
    } else {
      return chalk.red(`⦿${complexity}`);
    }
  }

  private formatStatusText(status: TaskStatus): string {
    const statusColor = this.getStatusColor(status);
    return statusColor(status.toUpperCase());
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

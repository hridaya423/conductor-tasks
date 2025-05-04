import { TaskPriority, TaskStatus } from './types.js';
const DEFAULT_CONFIG = {
    useEmoji: true,
    useProgressBars: true,
    includeMeta: true,
    colorize: true,
    showTimestamps: true,
    compactMode: false,
    includeSubtasks: true,
    taskDetailsLevel: 'standard'
};
export class MarkdownRenderer {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    renderTasksToMarkdown(tasks, projectName = 'Project Tasks', lastUpdated) {
        let markdown = `# ${projectName}\n\n`;
        if (this.config.includeMeta) {
            markdown += this.renderMetadata(tasks, lastUpdated);
        }
        markdown += this.renderSummary(tasks);
        const tasksByStatus = this.groupTasksByStatus(tasks);
        for (const status of Object.values(TaskStatus)) {
            const tasksForStatus = tasksByStatus.get(status) || [];
            if (tasksForStatus.length === 0)
                continue;
            markdown += this.renderStatusSection(status, tasksForStatus, tasks);
        }
        return markdown;
    }
    renderMetadata(tasks, lastUpdated) {
        const now = lastUpdated || new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US');
        let markdown = '## Metadata\n\n';
        markdown += `- **Last Updated**: ${dateStr} at ${timeStr}\n`;
        markdown += `- **Total Tasks**: ${tasks.size}\n`;
        const statusCounts = new Map();
        const priorityCounts = new Map();
        for (const task of tasks.values()) {
            const statusCount = statusCounts.get(task.status) || 0;
            statusCounts.set(task.status, statusCount + 1);
            const priorityCount = priorityCounts.get(task.priority) || 0;
            priorityCounts.set(task.priority, priorityCount + 1);
        }
        markdown += '- **Status Breakdown**:\n';
        for (const [status, count] of statusCounts.entries()) {
            const emoji = this.getStatusEmoji(status);
            markdown += `  - ${emoji} ${status}: ${count}\n`;
        }
        markdown += '- **Priority Breakdown**:\n';
        for (const priority of [
            TaskPriority.CRITICAL,
            TaskPriority.HIGH,
            TaskPriority.MEDIUM,
            TaskPriority.LOW,
            TaskPriority.BACKLOG
        ]) {
            const count = priorityCounts.get(priority) || 0;
            if (count > 0) {
                const emoji = this.getPriorityEmoji(priority);
                markdown += `  - ${emoji} ${priority}: ${count}\n`;
            }
        }
        markdown += '\n';
        return markdown;
    }
    renderSummary(tasks) {
        let markdown = '## Overview\n\n';
        const statusCounts = {
            [TaskStatus.BACKLOG]: 0,
            [TaskStatus.TODO]: 0,
            [TaskStatus.IN_PROGRESS]: 0,
            [TaskStatus.REVIEW]: 0,
            [TaskStatus.DONE]: 0,
            [TaskStatus.BLOCKED]: 0
        };
        const topLevelTasks = Array.from(tasks.values()).filter(task => !task.parent);
        const totalTopLevelTasks = topLevelTasks.length;
        for (const task of topLevelTasks) {
            statusCounts[task.status]++;
        }
        if (this.config.useProgressBars) {
            const doneCount = statusCounts[TaskStatus.DONE];
            const totalCount = totalTopLevelTasks;
            const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
            markdown += `### Overall Progress: ${progressPercent}%\n\n`;
            const progressBarLength = 30;
            const filledLength = Math.round((progressPercent / 100) * progressBarLength);
            const emptyLength = progressBarLength - filledLength;
            const filledChar = '█';
            const emptyChar = '░';
            const progressBar = filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
            markdown += `\`${progressBar}\` ${doneCount}/${totalCount} tasks complete\n\n`;
            markdown += '### Status Breakdown\n\n';
            for (const status of Object.values(TaskStatus)) {
                const count = statusCounts[status];
                const statusPercent = totalTopLevelTasks > 0 ? Math.round((count / totalTopLevelTasks) * 100) : 0;
                const statusEmoji = this.getStatusEmoji(status);
                const miniBarLength = 15;
                const miniFilled = Math.round((statusPercent / 100) * miniBarLength);
                const miniEmpty = miniBarLength - miniFilled;
                const miniBar = filledChar.repeat(miniFilled) + emptyChar.repeat(miniEmpty);
                markdown += `${statusEmoji} **${status}**: \`${miniBar}\` ${count} tasks (${statusPercent}%)\n`;
            }
            markdown += '\n';
        }
        return markdown;
    }
    renderStatusSection(status, tasks, allTasks) {
        const emoji = this.getStatusEmoji(status);
        let markdown = `## ${emoji} ${this.formatStatus(status)}\n\n`;
        const sortedTasks = this.sortTasksByPriority(tasks);
        for (const task of sortedTasks) {
            if (task.parent)
                continue;
            markdown += this.renderTask(task, allTasks);
        }
        return markdown;
    }
    renderTask(task, allTasks) {
        const priorityEmoji = this.getPriorityEmoji(task.priority);
        let markdown = '';
        markdown += `### ${priorityEmoji} ${task.title} (${task.id})\n\n`;
        markdown += this.renderTaskMetadata(task);
        if (task.description && task.description.trim()) {
            const indentedDescription = task.description
                .split('\n')
                .map(line => line.trim() ? `> ${line}` : '')
                .join('\n');
            markdown += `${indentedDescription}\n\n`;
        }
        if (this.config.useProgressBars && task.subtasks && task.subtasks.length > 0) {
            markdown += this.renderTaskProgressBar(task, allTasks);
        }
        if (task.dependencies && task.dependencies.length > 0) {
            markdown += '**Dependencies:**\n';
            for (const depId of task.dependencies) {
                const dep = allTasks.get(depId);
                if (dep) {
                    const depPriorityEmoji = this.getPriorityEmoji(dep.priority);
                    const depStatusEmoji = this.getStatusEmoji(dep.status);
                    markdown += `- ${depPriorityEmoji} ${depStatusEmoji} [${dep.title}] (${depId})\n`;
                }
            }
            markdown += '\n';
        }
        if (this.config.includeSubtasks && task.subtasks && task.subtasks.length > 0) {
            markdown += '**Subtasks:**\n';
            const useCollapsible = task.subtasks.length > 3 && !this.config.compactMode;
            if (useCollapsible) {
                markdown += '<details>\n<summary>Show Subtasks</summary>\n\n';
            }
            for (const subId of task.subtasks) {
                const sub = allTasks.get(subId);
                if (sub) {
                    const subPriorityEmoji = this.getPriorityEmoji(sub.priority);
                    const subStatusEmoji = this.getStatusEmoji(sub.status);
                    markdown += `- ${subPriorityEmoji} ${subStatusEmoji} **${sub.title}** (${subId})\n`;
                    if (this.config.taskDetailsLevel === 'verbose' && sub.description && sub.description.trim()) {
                        const truncatedDesc = sub.description.length > 100
                            ? sub.description.substring(0, 97) + '...'
                            : sub.description;
                        markdown += `  *${truncatedDesc.replace(/\n/g, ' ')}*\n`;
                    }
                }
            }
            if (useCollapsible) {
                markdown += '</details>\n\n';
            }
            else {
                markdown += '\n';
            }
        }
        if (task.notes && task.notes.length > 0) {
            const useCollapsible = task.notes.length > 2 && !this.config.compactMode;
            markdown += '**Notes:**\n';
            if (useCollapsible) {
                markdown += '<details>\n<summary>Show Notes</summary>\n\n';
            }
            const sortedNotes = [...task.notes].sort((a, b) => b.timestamp - a.timestamp);
            for (const note of sortedNotes) {
                markdown += this.renderNote(note);
            }
            if (useCollapsible) {
                markdown += '</details>\n\n';
            }
            else {
                markdown += '\n';
            }
        }
        markdown += '---\n\n';
        return markdown;
    }
    renderTaskMetadata(task) {
        let markdown = '';
        markdown += `**Priority:** ${task.priority}`;
        const complexityStars = '★'.repeat(Math.min(task.complexity, 5)) +
            '☆'.repeat(Math.max(0, 5 - Math.min(task.complexity, 5)));
        markdown += ` | **Complexity:** ${complexityStars} (${task.complexity}/10)`;
        if (task.estimatedEffort) {
            markdown += ` | **Est:** ${task.estimatedEffort}`;
        }
        if (task.actualEffort) {
            markdown += ` | **Actual:** ${task.actualEffort}`;
        }
        if (task.assignee) {
            markdown += ` | **Assignee:** ${task.assignee}`;
        }
        if (this.config.showTimestamps) {
            const createdDate = new Date(task.createdAt).toLocaleDateString();
            markdown += ` | **Created:** ${createdDate}`;
            if (task.updatedAt > task.createdAt) {
                const updatedDate = new Date(task.updatedAt).toLocaleDateString();
                markdown += ` | **Updated:** ${updatedDate}`;
            }
        }
        markdown += '\n\n';
        if (task.tags && task.tags.length > 0) {
            markdown += `Tags: ${task.tags.map(tag => `\`${tag}\``).join(' ')}\n\n`;
        }
        return markdown;
    }
    renderTaskProgressBar(task, allTasks) {
        let markdown = '';
        let completedCount = 0;
        let totalCount = 0;
        if (task.subtasks) {
            totalCount = task.subtasks.length;
            for (const subId of task.subtasks) {
                const sub = allTasks.get(subId);
                if (sub && sub.status === TaskStatus.DONE) {
                    completedCount++;
                }
            }
        }
        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const progressBarLength = 20;
        const filledLength = Math.round((progressPercent / 100) * progressBarLength);
        const emptyLength = progressBarLength - filledLength;
        const filledChar = '█';
        const emptyChar = '░';
        const progressBar = filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
        markdown += `**Progress:** \`${progressBar}\` ${progressPercent}% (${completedCount}/${totalCount} subtasks)\n\n`;
        return markdown;
    }
    renderNote(note) {
        const date = new Date(note.timestamp).toLocaleString();
        const typeEmoji = this.getNoteTypeEmoji(note.type);
        return `- ${typeEmoji} **${note.type}** (${date}, ${note.author}): ${note.content}\n`;
    }
    getStatusEmoji(status) {
        if (!this.config.useEmoji)
            return '';
        switch (status) {
            case TaskStatus.BACKLOG: return '📝';
            case TaskStatus.TODO: return '📋';
            case TaskStatus.IN_PROGRESS: return '⚙️';
            case TaskStatus.REVIEW: return '👁️';
            case TaskStatus.BLOCKED: return '🚫';
            case TaskStatus.DONE: return '✅';
            default: return '';
        }
    }
    getPriorityEmoji(priority) {
        if (!this.config.useEmoji)
            return '';
        switch (priority) {
            case TaskPriority.CRITICAL: return '🔴';
            case TaskPriority.HIGH: return '🟠';
            case TaskPriority.MEDIUM: return '🟡';
            case TaskPriority.LOW: return '🟢';
            case TaskPriority.BACKLOG: return '⚪';
            default: return '';
        }
    }
    getNoteTypeEmoji(type) {
        if (!this.config.useEmoji)
            return '';
        switch (type) {
            case 'progress': return '📈';
            case 'comment': return '💬';
            case 'blocker': return '🚧';
            case 'solution': return '💡';
            default: return '📌';
        }
    }
    formatStatus(status) {
        switch (status) {
            case TaskStatus.BACKLOG: return 'Backlog';
            case TaskStatus.TODO: return 'To Do';
            case TaskStatus.IN_PROGRESS: return 'In Progress';
            case TaskStatus.REVIEW: return 'In Review';
            case TaskStatus.BLOCKED: return 'Blocked';
            case TaskStatus.DONE: return 'Done';
            default: return status;
        }
    }
    groupTasksByStatus(tasks) {
        const tasksByStatus = new Map();
        for (const status of Object.values(TaskStatus)) {
            tasksByStatus.set(status, []);
        }
        for (const task of tasks.values()) {
            const tasksForStatus = tasksByStatus.get(task.status) || [];
            tasksForStatus.push(task);
            tasksByStatus.set(task.status, tasksForStatus);
        }
        return tasksByStatus;
    }
    sortTasksByPriority(tasks) {
        const priorityOrder = {
            [TaskPriority.CRITICAL]: 0,
            [TaskPriority.HIGH]: 1,
            [TaskPriority.MEDIUM]: 2,
            [TaskPriority.LOW]: 3,
            [TaskPriority.BACKLOG]: 4
        };
        return [...tasks].sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff === 0) {
                return b.complexity - a.complexity;
            }
            return priorityDiff;
        });
    }
    renderTasksToHtml(tasks, projectName = 'Project Tasks') {
        return '';
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
}
export default new MarkdownRenderer();
//# sourceMappingURL=markdownRenderer.js.map
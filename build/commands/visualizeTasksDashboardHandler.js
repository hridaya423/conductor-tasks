import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus, TaskPriority } from "../core/types.js";
export const VisualizeTasksDashboardSchema = {}; // No parameters
export async function visualizeTasksDashboardHandler(taskManager, params) {
    const notInitialized = checkTaskManagerInitialized(taskManager);
    if (notInitialized)
        return notInitialized;
    try {
        logger.info('Visualizing tasks dashboard');
        const allTasks = taskManager.getTasks({});
        if (allTasks.length === 0) {
            logger.info('No tasks found for dashboard visualization');
            return {
                content: [
                    {
                        type: "text",
                        text: "No tasks found in the system."
                    }
                ]
            };
        }
        // Calculate stats (same as original)
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(task => task.status === TaskStatus.DONE).length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const statusCounts = {
            [TaskStatus.BACKLOG]: 0,
            [TaskStatus.TODO]: 0,
            [TaskStatus.IN_PROGRESS]: 0,
            [TaskStatus.REVIEW]: 0,
            [TaskStatus.DONE]: 0,
            [TaskStatus.BLOCKED]: 0
        };
        const priorityCounts = {
            [TaskPriority.CRITICAL]: 0,
            [TaskPriority.HIGH]: 0,
            [TaskPriority.MEDIUM]: 0,
            [TaskPriority.LOW]: 0,
            [TaskPriority.BACKLOG]: 0
        };
        allTasks.forEach(task => {
            statusCounts[task.status]++;
            priorityCounts[task.priority]++;
        });
        // Format response (same as original)
        let dashboard = '# Task Dashboard\n\n';
        dashboard += '## Overall Progress\n\n';
        dashboard += `${completedTasks}/${totalTasks} tasks complete (${completionPercentage}%)\n\n`;
        const progressBarLength = 30;
        const filledLength = Math.round((completionPercentage / 100) * progressBarLength);
        dashboard += '`';
        dashboard += '█'.repeat(filledLength);
        dashboard += '░'.repeat(progressBarLength - filledLength);
        dashboard += '`\n\n';
        dashboard += '## Status Breakdown\n\n';
        dashboard += '| Status | Count | Percentage |\n';
        dashboard += '|--------|-------|------------|\n';
        Object.entries(statusCounts).forEach(([status, count]) => {
            const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
            dashboard += `| ${status} | ${count} | ${percentage}% |\n`;
        });
        dashboard += '\n';
        dashboard += '## Priority Breakdown\n\n';
        dashboard += '| Priority | Count | Percentage |\n';
        dashboard += '|----------|-------|------------|\n';
        Object.entries(priorityCounts).forEach(([priority, count]) => {
            const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
            dashboard += `| ${priority} | ${count} | ${percentage}% |\n`;
        });
        dashboard += '\n';
        dashboard += '## Recent Activity (Last 5 Updated)\n\n';
        const recentTasks = [...allTasks]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5);
        if (recentTasks.length > 0) {
            recentTasks.forEach(task => {
                const updatedDate = new Date(task.updatedAt).toLocaleString();
                dashboard += `- **${task.title}** (${task.id})\n`;
                dashboard += `  Status: ${task.status}, Updated: ${updatedDate}\n\n`;
            });
        }
        else {
            dashboard += 'No recent activity found.\n\n';
        }
        logger.info(`Generated dashboard with ${totalTasks} total tasks.`);
        return {
            content: [
                {
                    type: "text",
                    text: dashboard
                }
            ]
        };
    }
    catch (error) {
        logger.error('Error displaying dashboard:', { error });
        return {
            content: [
                {
                    type: "text",
                    text: `Error displaying dashboard: ${error.message || String(error)}`
                }
            ]
        };
    }
}
//# sourceMappingURL=visualizeTasksDashboardHandler.js.map
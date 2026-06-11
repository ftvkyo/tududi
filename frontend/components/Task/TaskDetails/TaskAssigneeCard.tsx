import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import TaskAssigneeSection from '../TaskForm/TaskAssigneeSection';
import { formatUserName, getUserInitials } from '../../../utils/userService';

interface TaskAssigneeCardProps {
    task: Task;
    onUpdate: (assigneeId: number | null) => Promise<void>;
}

const TaskAssigneeCard: React.FC<TaskAssigneeCardProps> = ({ task, onUpdate }) => {
    const { t } = useTranslation();

    if (!task.uid) return null;

    const assignee = task.Assignee ?? null;

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <UserIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{t('task.assignee', 'Assignee')}</span>
                </div>

                {assignee ? (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs font-semibold flex-shrink-0">
                            {getUserInitials(assignee)}
                        </span>
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {formatUserName(assignee)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {assignee.email}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        {t('task.unassigned', 'Unassigned')}
                    </p>
                )}

                <TaskAssigneeSection
                    taskUid={task.uid}
                    assigneeId={task.assigned_to_id ?? null}
                    onChange={onUpdate}
                />
            </div>
        </div>
    );
};

export default TaskAssigneeCard;

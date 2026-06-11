import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
    fetchAssignableUsers,
    formatUserName,
    getUserInitials,
    UserItem,
} from '../../../utils/userService';

interface TaskAssigneeSectionProps {
    taskUid: string;
    assigneeId?: number | null;
    onChange: (userId: number | null) => void;
}

const TaskAssigneeSection: React.FC<TaskAssigneeSectionProps> = ({
    taskUid,
    assigneeId,
    onChange,
}) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedUser = users.find((u) => u.id === assigneeId) ?? null;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchAssignableUsers(taskUid)
            .then((data) => {
                if (!cancelled) setUsers(data);
            })
            .catch(() => {
                if (!cancelled) setUsers([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [taskUid]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                open &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const canAssign = (user: UserItem) =>
        !user.access_level || user.access_level === 'rw';

    const handleSelect = (user: UserItem | null) => {
        if (user && !canAssign(user)) return;
        onChange(user ? user.id : null);
        setOpen(false);
    };

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                className="w-full inline-flex justify-between items-center rounded border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => !loading && setOpen(!open)}
                disabled={loading}
            >
                <span className="flex items-center gap-2 truncate">
                    {loading ? (
                        <span className="text-gray-400">{t('common.loading', 'Loading...')}</span>
                    ) : selectedUser ? (
                        <>
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs font-semibold flex-shrink-0">
                                {getUserInitials(selectedUser)}
                            </span>
                            <span className="truncate">{formatUserName(selectedUser)}</span>
                        </>
                    ) : (
                        <>
                            <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('task.unassigned', 'Unassigned')}
                            </span>
                        </>
                    )}
                </span>
                <ChevronDownIcon
                    className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="absolute mt-1 w-full z-50 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 max-h-56 overflow-auto">
                    <div className="p-1">
                        {/* Unassign option */}
                        <button
                            type="button"
                            onClick={() => handleSelect(null)}
                            className="block w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <XMarkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('task.unassigned', 'Unassigned')}
                                    </span>
                                </div>
                                {!assigneeId && (
                                    <CheckIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                )}
                            </div>
                        </button>

                        {users.length === 0 && !loading && (
                            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 text-center">
                                {t('task.noAssignableUsers', 'No users available')}
                            </div>
                        )}

                        {users.map((user) => {
                            const writeable = canAssign(user);
                            return (
                                <div
                                    key={user.id}
                                    title={writeable ? undefined : t('task.assigneeReadOnly', 'This user has read-only access and cannot be assigned')}
                                    className={writeable ? undefined : 'cursor-not-allowed'}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(user)}
                                        disabled={!writeable}
                                        className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                                            writeable
                                                ? 'hover:bg-gray-100 dark:hover:bg-gray-600'
                                                : 'opacity-40 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs font-semibold flex-shrink-0">
                                                    {getUserInitials(user)}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="truncate text-gray-900 dark:text-gray-100 font-medium">
                                                        {formatUserName(user)}
                                                    </div>
                                                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                            {assigneeId === user.id && (
                                                <CheckIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskAssigneeSection;

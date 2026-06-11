const { Project, Task, User } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');

async function validateProjectAccess(projectId, userId) {
    if (!projectId || !projectId.toString().trim()) {
        return null;
    }

    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) {
        throw new Error('Invalid project.');
    }

    const projectAccess = await permissionsService.getAccess(
        userId,
        'project',
        project.uid
    );
    const isOwner = project.user_id === userId;
    const canWrite =
        isOwner || projectAccess === 'rw' || projectAccess === 'admin';

    if (!canWrite) {
        throw new Error('Forbidden');
    }

    return projectId;
}

async function validateParentTaskAccess(parentTaskId, userId) {
    if (!parentTaskId || !parentTaskId.toString().trim()) {
        return null;
    }

    const parentTask = await Task.findOne({
        where: { id: parentTaskId, user_id: userId },
    });
    if (!parentTask) {
        const anyTask = await Task.findOne({
            where: { id: parentTaskId },
        });
        if (anyTask) {
            throw new Error(
                `Invalid parent task. Parent task exists but belongs to a different user (parent user_id: ${anyTask.user_id}, current user_id: ${userId}).`
            );
        } else {
            throw new Error(
                `Invalid parent task. Parent task with id ${parentTaskId} not found.`
            );
        }
    }

    const parentAccess = await permissionsService.getAccess(
        userId,
        'task',
        parentTask.uid
    );
    const isOwner = parentTask.user_id === userId;
    const canWrite =
        isOwner || parentAccess === 'rw' || parentAccess === 'admin';

    if (!canWrite) {
        throw new Error('Invalid parent task. Insufficient permissions.');
    }

    return parentTaskId;
}

/**
 * Validates that defer_until date is not after the due_date for regular tasks,
 * or after the recurrence_end_date for recurring task instances.
 *
 * @param {string|Date|null} deferUntil - The defer until date
 * @param {string|Date|null} dueDate - The task due date
 * @param {string|Date|null|undefined} recurringParentEndDate - The parent task's recurrence end date
 *        undefined = not a recurring instance (apply strict validation)
 *        null = recurring instance with no end date (allow any defer_until)
 *        date = recurring instance with end date (validate against end date)
 * @throws {Error} If defer_until is after the applicable end date
 *
 * Validation rules:
 * - If no defer_until or due_date: validation passes
 * - If recurringParentEndDate is undefined (not provided): regular task, defer_until must be <= due_date
 * - If recurringParentEndDate is null: infinite recurrence, any defer_until is allowed
 * - If recurringParentEndDate is a date: defer_until must be <= end date
 */
function validateDeferUntilAndDueDate(
    deferUntil,
    dueDate,
    recurringParentEndDate = undefined
) {
    // Both must be present to validate
    if (!deferUntil || !dueDate) {
        return;
    }

    const deferDate = new Date(deferUntil);
    const dueDateObj = new Date(dueDate);

    // Check if dates are valid
    if (isNaN(deferDate.getTime()) || isNaN(dueDateObj.getTime())) {
        return;
    }

    // Check if this is a recurring instance (parameter was explicitly passed)
    if (recurringParentEndDate !== undefined) {
        // If parent has null end date, it's infinite recurrence - allow any defer_until
        if (recurringParentEndDate === null) {
            return;
        }

        // Parent has an end date - validate against it
        const endDate = new Date(recurringParentEndDate);
        if (!isNaN(endDate.getTime())) {
            if (deferDate > endDate) {
                throw new Error(
                    'Defer until date cannot be after the recurring task end date.'
                );
            }
            // Validation passes - defer can be after due_date but within recurrence bounds
            return;
        }

        // Invalid end date but has parent - treat as infinite recurrence
        return;
    }

    // Not a recurring instance - apply strict validation.
    // Due dates are date-only (no time picker), so treat them as end-of-day
    // so that any defer_until time on the same calendar day is allowed.
    const dueDateEndOfDay = new Date(dueDateObj);
    dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
    if (deferDate > dueDateEndOfDay) {
        throw new Error('Defer until date cannot be after the due date.');
    }
}

/**
 * Validate that the given user is allowed to be an assignee for the task.
 * The assignee must already have read or write access to the task or its project.
 * On task creation the task uid is not yet known, so pass projectId instead.
 *
 * @param {number|string|null|undefined} assigneeId - Numeric user id from request body
 * @param {object} opts - { taskUid?: string, projectId?: number }
 * @returns {number|null} The numeric assignee id, or null for unassign
 * @throws {Error} If the assignee has no access
 */
async function validateAssigneeAccess(assigneeId, opts = {}) {
    if (
        assigneeId === null ||
        assigneeId === undefined ||
        assigneeId === '' ||
        assigneeId === 0
    ) {
        return null;
    }

    const numericId =
        typeof assigneeId === 'number' ? assigneeId : parseInt(assigneeId, 10);
    if (isNaN(numericId)) {
        throw new Error('Invalid assignee id.');
    }

    const assignee = await User.findByPk(numericId, { attributes: ['id'] });
    if (!assignee) {
        throw new Error('Assignee not found.');
    }

    const { ACCESS } = permissionsService;
    const canWrite = (level) =>
        level === ACCESS.RW || level === ACCESS.ADMIN;

    if (opts.taskUid) {
        const access = await permissionsService.getAccess(
            numericId,
            'task',
            opts.taskUid
        );
        if (!canWrite(access)) {
            throw new Error(
                'Assignee does not have write access to this task.'
            );
        }
    } else if (opts.projectId) {
        const project = await Project.findByPk(opts.projectId, {
            attributes: ['uid', 'user_id'],
        });
        if (project) {
            const isOwner = project.user_id === numericId;
            if (!isOwner) {
                const access = await permissionsService.getAccess(
                    numericId,
                    'project',
                    project.uid
                );
                if (!canWrite(access)) {
                    throw new Error(
                        'Assignee does not have write access to this task.'
                    );
                }
            }
        }
    }

    return numericId;
}

module.exports = {
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
    validateAssigneeAccess,
};

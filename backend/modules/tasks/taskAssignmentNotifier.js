const { Notification, User } = require('../../models');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

/**
 * Fire a `task_assigned` notification when a task is assigned to someone other
 * than the actor who made the change.  Best-effort: errors are logged but never
 * propagate to the caller.
 *
 * @param {object} opts
 * @param {string}  opts.taskUid      - Task uid
 * @param {string}  opts.taskName     - Task display name
 * @param {number}  opts.assigneeId   - Numeric id of the user being assigned
 * @param {number}  opts.actorId      - Numeric id of the user who made the change
 */
async function notifyAssignment({ taskUid, taskName, assigneeId, actorId }) {
    try {
        // Don't notify when someone assigns a task to themselves
        if (!assigneeId || assigneeId === actorId) return;

        const assignee = await User.findByPk(assigneeId, {
            attributes: [
                'id',
                'email',
                'name',
                'surname',
                'notification_preferences',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });
        if (!assignee) return;

        if (!shouldSendInAppNotification(assignee, 'task_assigned')) return;

        const actor = await User.findByPk(actorId, {
            attributes: ['name', 'surname', 'email'],
        });
        const actorName = actor
            ? actor.name && actor.surname
                ? `${actor.name} ${actor.surname}`
                : actor.name || actor.email
            : 'Someone';

        const assigneeName =
            assignee.name && assignee.surname
                ? `${assignee.name} ${assignee.surname}`
                : assignee.name || assignee.email;

        const sources = [];
        if (shouldSendTelegramNotification(assignee, 'task_assigned')) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: assigneeId,
            type: 'task_assigned',
            level: 'info',
            title: 'Task assigned to you',
            message: `${actorName} assigned "${taskName}" to ${assigneeName}.`,
            data: { taskUid, taskName, assignedBy: actorName },
            sources,
        });
    } catch (err) {
        logError('Error sending task assignment notification:', err);
    }
}

module.exports = { notifyAssignment };

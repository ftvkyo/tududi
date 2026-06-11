const { logError } = require('../../../services/logService');
const { logTaskUpdate, logEvent, logAssigneeChange } = require('../taskEventService');
const { User } = require('../../../models');

function captureOldValues(task) {
    return {
        name: task.name,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        defer_until: task.defer_until,
        project_id: task.project_id,
        assigned_to_id: task.assigned_to_id || null,
        note: task.note,
        recurrence_type: task.recurrence_type,
        recurrence_interval: task.recurrence_interval,
        recurrence_end_date: task.recurrence_end_date,
        recurrence_weekday: task.recurrence_weekday,
        recurrence_month_day: task.recurrence_month_day,
        recurrence_week_of_month: task.recurrence_week_of_month,
        completion_based: task.completion_based,
        tags: task.Tags
            ? task.Tags.map((tag) => ({ id: tag.id, name: tag.name }))
            : [],
    };
}

async function logTaskChanges(task, oldValues, reqBody, tagsData, userId) {
    try {
        const changes = {};
        const fields = [
            'name',
            'status',
            'priority',
            'project_id',
            'note',
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        fields.forEach((field) => {
            if (
                reqBody[field] !== undefined &&
                reqBody[field] !== oldValues[field]
            ) {
                changes[field] = {
                    oldValue: oldValues[field],
                    newValue: reqBody[field],
                };
            }
        });

        if (reqBody.due_date !== undefined) {
            const oldDateStr = oldValues.due_date
                ? oldValues.due_date.toISOString().split('T')[0]
                : null;
            const newDateStr = reqBody.due_date || null;

            if (oldDateStr !== newDateStr) {
                changes.due_date = {
                    oldValue: oldValues.due_date,
                    newValue: reqBody.due_date,
                };
            }
        }

        if (reqBody.defer_until !== undefined) {
            const oldDeferStr = oldValues.defer_until
                ? oldValues.defer_until.toISOString()
                : null;
            const newDeferStr = reqBody.defer_until || null;

            if (oldDeferStr !== newDeferStr) {
                changes.defer_until = {
                    oldValue: oldValues.defer_until,
                    newValue: reqBody.defer_until,
                };
            }
        }

        if (Object.keys(changes).length > 0) {
            await logTaskUpdate(task.id, userId, changes, { source: 'web' });
        }

        if (
            reqBody.assigned_to_id !== undefined &&
            reqBody.assigned_to_id !== oldValues.assigned_to_id
        ) {
            const oldId = oldValues.assigned_to_id;
            const newId = reqBody.assigned_to_id || null;

            // Resolve display names for the timeline
            let oldName = null;
            let newName = null;
            try {
                if (oldId) {
                    const oldUser = await User.findByPk(oldId, {
                        attributes: ['name', 'surname', 'email'],
                    });
                    if (oldUser) {
                        oldName =
                            oldUser.name && oldUser.surname
                                ? `${oldUser.name} ${oldUser.surname}`
                                : oldUser.name || oldUser.email;
                    }
                }
                if (newId) {
                    const newUser = await User.findByPk(newId, {
                        attributes: ['name', 'surname', 'email'],
                    });
                    if (newUser) {
                        newName =
                            newUser.name && newUser.surname
                                ? `${newUser.name} ${newUser.surname}`
                                : newUser.name || newUser.email;
                    }
                }
            } catch (_) {
                // Name resolution is best-effort; don't block the event
            }

            await logAssigneeChange(task.id, userId, oldId, newId, {
                source: 'web',
                fromName: oldName,
                toName: newName,
            });
        }

        if (tagsData) {
            const newTags = tagsData.map((tag) => ({
                id: tag.id,
                name: tag.name,
            }));
            const oldTagNames = oldValues.tags.map((tag) => tag.name).sort();
            const newTagNames = newTags.map((tag) => tag.name).sort();

            if (JSON.stringify(oldTagNames) !== JSON.stringify(newTagNames)) {
                await logEvent({
                    taskId: task.id,
                    userId: userId,
                    eventType: 'tags_changed',
                    fieldName: 'tags',
                    oldValue: oldValues.tags,
                    newValue: newTags,
                    metadata: { source: 'web', action: 'tags_update' },
                });
            }
        }
    } catch (eventError) {
        logError('Error logging task update events:', eventError);
    }
}

module.exports = {
    captureOldValues,
    logTaskChanges,
};

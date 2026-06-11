'use strict';

const request = require('supertest');
const app = require('../../app');
const { Task, Project, TaskEvent, Notification, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Assignment', () => {
    let owner, collaborator, stranger, ownerAgent, collaboratorAgent, project, task;

    beforeEach(async () => {
        owner = await createTestUser({ email: `owner_${Date.now()}@example.com` });
        collaborator = await createTestUser({ email: `collab_${Date.now()}@example.com` });
        stranger = await createTestUser({ email: `stranger_${Date.now()}@example.com` });

        ownerAgent = request.agent(app);
        collaboratorAgent = request.agent(app);
        await ownerAgent.post('/api/login').send({ email: owner.email, password: 'password123' });
        await collaboratorAgent.post('/api/login').send({ email: collaborator.email, password: 'password123' });

        const projectRes = await ownerAgent.post('/api/project').send({ name: 'Test Project' });
        project = projectRes.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: collaborator.email,
            access_level: 'rw',
        });

        const taskRes = await ownerAgent.post('/api/task').send({ name: 'Test Task', project_id: project.id });
        task = taskRes.body;
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('PATCH /api/task/:uid — assigning', () => {
        it('assigns a collaborator successfully and returns the Assignee object', async () => {
            const res = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: collaborator.id });

            expect(res.status).toBe(200);
            expect(res.body.Assignee).toBeDefined();
            expect(res.body.Assignee.id).toBe(collaborator.id);
            expect(res.body.Assignee.email).toBe(collaborator.email);
        });

        it('rejects assigning a user with no access with 403', async () => {
            const res = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: stranger.id });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/access/i);
        });

        it('unassigns when assigned_to_id is null', async () => {
            await ownerAgent.patch(`/api/task/${task.uid}`).send({ assigned_to_id: collaborator.id });

            const res = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: null });

            expect(res.status).toBe(200);
            expect(res.body.Assignee).toBeNull();
        });

        it('allows self-assignment without error', async () => {
            const res = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: owner.id });

            expect(res.status).toBe(200);
            expect(res.body.Assignee.id).toBe(owner.id);
        });
    });

    describe('task history', () => {
        it('creates an assignee_changed TaskEvent when the assignee is set', async () => {
            await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: collaborator.id });

            const dbTask = await Task.findOne({ where: { uid: task.uid } });
            const event = await TaskEvent.findOne({
                where: { task_id: dbTask.id, event_type: 'assignee_changed' },
            });

            expect(event).not.toBeNull();
            expect(event.field_name).toBe('assigned_to_id');
        });

        it('creates an assignee_changed TaskEvent when the assignee is cleared', async () => {
            await ownerAgent.patch(`/api/task/${task.uid}`).send({ assigned_to_id: collaborator.id });

            await ownerAgent.patch(`/api/task/${task.uid}`).send({ assigned_to_id: null });

            const dbTask = await Task.findOne({ where: { uid: task.uid } });
            const events = await TaskEvent.findAll({
                where: { task_id: dbTask.id, event_type: 'assignee_changed' },
            });

            expect(events.length).toBe(2);
        });
    });

    describe('notifications', () => {
        it('creates a task_assigned notification for the assignee', async () => {
            await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: collaborator.id });

            const notification = await Notification.findOne({
                where: { user_id: collaborator.id, type: 'task_assigned' },
            });

            expect(notification).not.toBeNull();
        });

        it('does not create a notification for self-assignment', async () => {
            await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ assigned_to_id: owner.id });

            const notification = await Notification.findOne({
                where: { user_id: owner.id, type: 'task_assigned' },
            });

            expect(notification).toBeNull();
        });
    });

    describe('GET /api/task/:uid/assignable-users', () => {
        it('returns the owner and collaborators but not strangers', async () => {
            const res = await ownerAgent.get(`/api/task/${task.uid}/assignable-users`);

            expect(res.status).toBe(200);
            const ids = res.body.users.map((u) => u.id);
            expect(ids).toContain(owner.id);
            expect(ids).toContain(collaborator.id);
            expect(ids).not.toContain(stranger.id);
        });

        it('returns 403 for a user with no access to the task', async () => {
            const strangerAgent = request.agent(app);
            await strangerAgent.post('/api/login').send({ email: stranger.email, password: 'password123' });

            const res = await strangerAgent.get(`/api/task/${task.uid}/assignable-users`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/tasks?assignee=', () => {
        let assignedTask, unassignedTask;

        beforeEach(async () => {
            const t1 = await ownerAgent.post('/api/task').send({ name: 'Assigned Task', project_id: project.id });
            assignedTask = t1.body;
            await ownerAgent.patch(`/api/task/${assignedTask.uid}`).send({ assigned_to_id: collaborator.id });

            const t2 = await ownerAgent.post('/api/task').send({ name: 'Unassigned Task', project_id: project.id });
            unassignedTask = t2.body;
        });

        it('assignee=me returns only tasks assigned to the requesting user', async () => {
            const res = await collaboratorAgent.get('/api/tasks?assignee=me');

            expect(res.status).toBe(200);
            const uids = res.body.tasks.map((t) => t.uid);
            expect(uids).toContain(assignedTask.uid);
            expect(uids).not.toContain(unassignedTask.uid);
        });

        it('assignee=unassigned excludes tasks that have an assignee', async () => {
            const res = await ownerAgent.get('/api/tasks?assignee=unassigned');

            expect(res.status).toBe(200);
            const uids = res.body.tasks.map((t) => t.uid);
            expect(uids).not.toContain(assignedTask.uid);
            expect(uids).toContain(unassignedTask.uid);
        });
    });
});

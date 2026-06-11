'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('tasks');
        if (!tableDescription.assigned_to_id) {
            await queryInterface.addColumn('tasks', 'assigned_to_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: null,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            });
            await queryInterface.addIndex('tasks', ['assigned_to_id'], {
                name: 'tasks_assigned_to_id',
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tasks', 'assigned_to_id');
    },
};

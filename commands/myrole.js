const { SlashCommandBuilder } = require('discord.js');

const { roles } = require('./roles');
const { readAssignments, findAssignment } = require('../utils/assignmentsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrole')
        .setDescription('Rappelle ton role en DM.'),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Commande disponible uniquement en serveur.', ephemeral: true });
        }

        const assignments = readAssignments();
        const entry = findAssignment(assignments, interaction.user.id);
        if (!entry) {
            return interaction.reply({ content: 'Tu n es pas dans la partie en cours.', ephemeral: true });
        }

        const roleData = roles.find(r => r.name === entry.role) || null;
        const lines = [
            `Ton role actuel: ${entry.role}`,
            `Ton role initial: ${entry.initialRole || entry.role}`,
        ];
        if (roleData && roleData.roledesc) {
            lines.push(`Pouvoir: ${roleData.roledesc}`);
        }
        const message = lines.join('\n');

        try {
            await interaction.user.send(message);
            return interaction.reply({ content: 'Je t ai renvoye ton role en DM.', ephemeral: true });
        } catch {
            return interaction.reply({ content: `DM impossible. Voici ton role:\n${message}`, ephemeral: true });
        }
    },
};

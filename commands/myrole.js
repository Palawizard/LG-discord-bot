const { SlashCommandBuilder } = require('discord.js');

const { findRoleByName, getRoleDisplayName } = require('./roles');
const { readAssignments, findAssignment } = require('../utils/assignmentsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrole')
        .setDescription('Rappelle ton rôle en DM.'),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Commande disponible uniquement sur un serveur.', ephemeral: true });
        }

        const assignments = readAssignments();
        const entry = findAssignment(assignments, interaction.user.id);
        if (!entry) {
            return interaction.reply({ content: 'Tu n\'es pas dans la partie en cours.', ephemeral: true });
        }

        const roleData = findRoleByName(entry.role);
        const currentLabel = getRoleDisplayName(entry.role);
        const initialLabel = getRoleDisplayName(entry.initialRole || entry.role);
        const lines = [
            `Ton rôle actuel : ${currentLabel}`,
            `Ton rôle initial : ${initialLabel}`,
        ];
        if (roleData && roleData.roledesc) {
            lines.push(`Pouvoir : ${roleData.roledesc}`);
        }
        const message = lines.join('\n');

        try {
            await interaction.user.send(message);
            return interaction.reply({ content: 'Je t\'ai renvoyé ton rôle en DM.', ephemeral: true });
        } catch {
            return interaction.reply({ content: `DM impossible. Voici ton rôle :\n${message}`, ephemeral: true });
        }
    },
};

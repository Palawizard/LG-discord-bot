const { SlashCommandBuilder } = require('discord.js');

const { readAssignments } = require('../utils/assignmentsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alive')
        .setDescription('Affiche la liste des joueurs vivants.'),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Commande disponible uniquement sur un serveur.', ephemeral: true });
        }

        const assignments = readAssignments();
        const living = assignments.filter(a => a.role !== 'Mort');

        if (!living.length) {
            return interaction.reply({ content: 'Aucun joueur vivant.', ephemeral: false });
        }

        const lines = await Promise.all(
            living.map(async entry => {
                const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
                return member ? `- ${member.displayName}` : `- <@${entry.userId}>`;
            })
        );

        const msg = `Joueurs vivants (${living.length}) :\n${lines.join('\n')}`;
        return interaction.reply({ content: msg, ephemeral: false });
    },
};

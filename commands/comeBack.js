const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { readAssignments } = require('../utils/assignmentsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comeback')
        .setDescription('Ramene tous les joueurs vers le canal vocal Village.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n avez pas la permission d utiliser cette commande.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const assignments = readAssignments();
        for (const assignment of assignments) {
            const member = await interaction.guild.members.fetch(assignment.userId).catch(() => null);
            if (member && member.voice.channel) {
                await member.voice.setChannel(CHANNEL_IDS.VILLAGE_VOICE).catch(console.error);
            }
        }

        await interaction.editReply({ content: 'Tous les joueurs ont ete ramenes au canal Village.' });
    },
};

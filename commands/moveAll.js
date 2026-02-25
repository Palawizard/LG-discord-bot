const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS } = require('../config/discordIds');
const { movePlayersToRoleChannels } = require('../utils/voiceMove');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move-all')
        .setDescription('Deplace tout le monde vers leurs canaux selon leurs roles.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n avez pas la permission d utiliser cette commande.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        await movePlayersToRoleChannels(interaction.guild);

        await interaction.editReply({ content: 'Tout le monde a ete deplace vers ses canaux assignes.' });
    },
};

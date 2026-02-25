const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS } = require('../config/discordIds');
const { movePlayersToVillage } = require('../utils/voiceMove');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comeback')
        .setDescription('Ramène tous les joueurs vers le canal vocal Village.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        await movePlayersToVillage(interaction.guild);

        await interaction.editReply({ content: 'Tous les joueurs ont été ramenés au canal Village.' });
    },
};

const { SlashCommandBuilder } = require('discord.js');

const { CHANNEL_IDS } = require('../config/discordIds');
const { getRoleDisplayName } = require('./roles');
const { eliminatePlayer } = require('../utils/playerLifecycle');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leavegame')
        .setDescription('Permet de quitter la partie correctement.'),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande peut uniquement être utilisée dans un serveur.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.user;
        const result = await eliminatePlayer(
            interaction.guild,
            targetUser.id,
            'Tu as quitte la partie. Tu es maintenant considere comme mort.'
        );

        if (!result.ok) {
            await interaction.editReply({ content: 'Tu n\'as actuellement aucun rôle assigné dans la partie.' });
            return;
        }

        const generalChannel = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT).catch(() => null);
        if (generalChannel) {
            const roleLabel = getRoleDisplayName(result.previousRole);
            generalChannel.send(`${targetUser.username} a quitté. Rôle initial : ${roleLabel}.`);
        }

        await interaction.editReply({ content: 'Tu as quitté la partie.' });
    },
};

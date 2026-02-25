const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { getRoleDisplayName } = require('./roles');
const { eliminatePlayer } = require('../utils/playerLifecycle');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickplayer')
        .setDescription('Expulse un joueur de la partie (GM uniquement).')
        .addUserOption(o =>
            o.setName('player')
                .setDescription('Joueur à expulser')
                .setRequired(true))
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('Raison (facultatif)')),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Commande réservée au Game Master.', ephemeral: true });
        }

        if (!interaction.guild) {
            return interaction.reply({ content: 'À utiliser dans un serveur.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('player');
        const reason = interaction.options.getString('reason') || 'Expulsé par le GM';

        const result = await eliminatePlayer(
            interaction.guild,
            targetUser.id,
            `Tu as été expulsé de la partie : ${reason}`
        );

        if (!result.ok) {
            return interaction.reply({ content: 'Ce joueur n\'est pas dans la partie.', ephemeral: true });
        }

        const general = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT).catch(() => null);
        if (general) {
            const roleLabel = getRoleDisplayName(result.previousRole);
            general.send(`☠️ <@${targetUser.id}> a été expulsé par le Game Master (rôle : ${roleLabel}).`);
        }

        await interaction.reply({ content: 'Joueur expulsé avec succès.', ephemeral: true });
    },
};

const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { eliminatePlayer } = require('../utils/playerLifecycle');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickplayer')
        .setDescription('Expulse un joueur de la partie (GM uniquement).')
        .addUserOption(o =>
            o.setName('player')
                .setDescription('Joueur a expulser')
                .setRequired(true))
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('Raison (facultatif)')),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Commande reservee au Game Master.', ephemeral: true });
        }

        if (!interaction.guild) {
            return interaction.reply({ content: 'A utiliser dans un serveur.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('player');
        const reason = interaction.options.getString('reason') || 'Expulse par le GM';

        const result = await eliminatePlayer(
            interaction.guild,
            targetUser.id,
            `Tu as ete expulse de la partie: ${reason}`
        );

        if (!result.ok) {
            return interaction.reply({ content: 'Ce joueur n est pas dans la partie.', ephemeral: true });
        }

        const general = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT).catch(() => null);
        if (general) {
            general.send(`☠️ <@${targetUser.id}> a ete expulse par le Game Master (role: ${result.previousRole}).`);
        }

        await interaction.reply({ content: 'Joueur expulse avec succes.', ephemeral: true });
    },
};

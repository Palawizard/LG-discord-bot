const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { readAssignments } = require('../utils/assignmentsStore');
const { PHASES, readGameState } = require('../utils/gameStateStore');
const { readVotesSession, writeVotesSession, withVotesLock } = require('../utils/votesStore');
const { scheduleVoteReminder } = require('../utils/voteReminder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startvote')
        .setDescription('Demarre une session de vote interactive.')
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('Type de vote')
                .setRequired(true)
                .addChoices(
                    { name: 'Normal', value: 'normal' },
                    { name: 'Maire', value: 'maire' }
                ))
        .addIntegerOption(opt =>
            opt.setName('time')
                .setDescription('Duree du vote en secondes (facultatif)')),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Vous n avez pas la permission.', ephemeral: true });
        }

        const gameState = readGameState();
        if (gameState.phase !== PHASES.DAY) {
            return interaction.reply({
                content: `Le vote peut etre lance uniquement en phase Jour (phase actuelle: ${gameState.phase}).`,
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const assignments = readAssignments();
        const livingEntries = assignments.filter(a => a.role !== 'Mort');

        if (livingEntries.length === 0) {
            return interaction.editReply('Aucun joueur vivant, vote annule.');
        }

        if (livingEntries.length > 25) {
            return interaction.editReply('Plus de 25 vivants: utilisez plutot la commande /vote.');
        }

        const voteType = interaction.options.getString('type');
        const delay = interaction.options.getInteger('time');

        const startResult = await withVotesLock(() => {
            const previous = readVotesSession();
            if (previous.isVotingActive) {
                return { ok: false, message: 'Un vote est deja en cours. Utilisez /endvote avant de relancer.' };
            }

            const preservedCrow = previous.crowVote && previous.crowVote.extraVotes > 0
                ? previous.crowVote
                : { userId: null, extraVotes: 0 };

            writeVotesSession({
                isVotingActive: true,
                voteType,
                votes: {},
                crowVote: preservedCrow,
                masterId: interaction.user.id,
                endTime: delay ? Date.now() + delay * 1000 : null,
                phaseBeforeVote: gameState.phase,
            });

            return { ok: true };
        });

        if (!startResult.ok) {
            return interaction.editReply(startResult.message);
        }

        const voteEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(voteType === 'maire' ? 'Election du Maire' : 'Vote du Village')
            .setDescription('Choisissez un joueur dans le menu.\nBouton rouge: annuler votre vote.')
            .setFooter({ text: delay ? `Temps: ${delay}s` : 'Pas de limite de temps' })
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId('vote_select')
            .setPlaceholder('Choisir un joueur...')
            .addOptions(
                await Promise.all(
                    livingEntries.map(async entry => {
                        const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
                        return {
                            label: member ? member.displayName : `(inconnu ${entry.userId})`,
                            value: entry.userId,
                        };
                    })
                )
            );

        const cancelBtn = new ButtonBuilder()
            .setCustomId('vote_cancel')
            .setLabel('Annuler mon vote')
            .setStyle(ButtonStyle.Danger);

        const voteRow = new ActionRowBuilder().addComponents(select);
        const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

        const general = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT);
        await general.send({ embeds: [voteEmbed], components: [voteRow, cancelRow] });

        const hostEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('Panneau host du vote')
            .setDescription('Actions rapides pour gerer le vote en cours.')
            .addFields(
                { name: 'Terminer', value: 'Cloture et publie les resultats.', inline: true },
                { name: 'Extensions', value: 'Ajoute du temps sans relancer le vote.', inline: true },
                { name: 'Annuler', value: 'Stoppe le vote sans resultat.', inline: true }
            )
            .setTimestamp();

        const hostControls = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('votehost_end')
                .setLabel('Terminer')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('votehost_extend_30')
                .setLabel('+30s')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('votehost_extend_60')
                .setLabel('+60s')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('votehost_cancel')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.followUp({
            content: 'Vote lance. Utilisez ce panneau pour le controler.',
            embeds: [hostEmbed],
            components: [hostControls],
            ephemeral: true,
        });

        if (delay) {
            scheduleVoteReminder(interaction.client, delay * 1000);
        }

        await interaction.editReply('Le vote a ete lance.');
    },
};

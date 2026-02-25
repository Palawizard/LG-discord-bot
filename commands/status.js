const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { ROLE_IDS } = require('../config/discordIds');
const { readAssignments } = require('../utils/assignmentsStore');
const { readVotesSession } = require('../utils/votesStore');
const { readGameState, PHASE_LABELS } = require('../utils/gameStateStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Affiche un résumé de l\'état de partie (hôte/GM).'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Commande réservée au Game Master.', ephemeral: true });
        }

        const assignments = readAssignments();
        const aliveCount = assignments.filter(a => a.role !== 'Mort').length;
        const deadCount = assignments.length - aliveCount;

        const votes = readVotesSession();
        const gameState = readGameState();

        const remaining = votes.isVotingActive && votes.endTime
            ? `${Math.max(0, Math.ceil((votes.endTime - Date.now()) / 1000))}s`
            : 'Aucune limite';

        const embed = new EmbedBuilder()
            .setColor(0x1ABC9C)
            .setTitle('État de partie')
            .addFields(
                { name: 'Phase', value: PHASE_LABELS[gameState.phase] || gameState.phase, inline: true },
                { name: 'Hôte', value: gameState.hostId ? `<@${gameState.hostId}>` : 'Non défini', inline: true },
                { name: 'Joueurs', value: `${assignments.length} total`, inline: true },
                { name: 'Vivants', value: `${aliveCount}`, inline: true },
                { name: 'Morts', value: `${deadCount}`, inline: true },
                {
                    name: 'Vote',
                    value: votes.isVotingActive
                        ? `Actif (${votes.voteType || 'inconnu'})`
                        : 'Inactif',
                    inline: true,
                },
                { name: 'Votes saisis', value: `${Object.keys(votes.votes || {}).length}`, inline: true },
                { name: 'Temps restant (vote)', value: remaining, inline: true },
                {
                    name: 'Corbeau',
                    value: votes.crowVote?.userId
                        ? `<@${votes.crowVote.userId}> (+${votes.crowVote.extraVotes})`
                        : 'Aucun',
                    inline: true,
                }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

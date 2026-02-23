const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS } = require('../config/discordIds');
const { readVotesSession } = require('../utils/votesStore');
const { PHASES, PHASE_LABELS, readGameState, setPhase } = require('../utils/gameStateStore');

const phaseChoices = [
    { name: 'Setup', value: PHASES.SETUP },
    { name: 'Nuit', value: PHASES.NIGHT },
    { name: 'Jour', value: PHASES.DAY },
    { name: 'Vote', value: PHASES.VOTE },
    { name: 'Fin', value: PHASES.END },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('phase')
        .setDescription('Affiche ou modifie la phase de partie (GM).')
        .addStringOption(option =>
            option.setName('etat')
                .setDescription('Nouvelle phase')
                .setRequired(false)
                .addChoices(...phaseChoices)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Commande reservee au Game Master.', ephemeral: true });
        }

        const requested = interaction.options.getString('etat');
        const current = readGameState();
        if (!requested) {
            return interaction.reply({
                content: `Phase actuelle: ${PHASE_LABELS[current.phase] || current.phase}.`,
                ephemeral: true,
            });
        }

        const votes = readVotesSession();
        if (requested === PHASES.VOTE && !votes.isVotingActive) {
            return interaction.reply({
                content: 'Impossible de passer en phase Vote sans session active. Lancez /startvote.',
                ephemeral: true,
            });
        }

        if (requested !== PHASES.VOTE && votes.isVotingActive) {
            return interaction.reply({
                content: 'Un vote est actif. Terminez ou annulez le vote avant de changer de phase.',
                ephemeral: true,
            });
        }

        await setPhase(requested, { hostId: current.hostId }).catch(console.error);

        return interaction.reply({
            content: `Phase mise a jour: ${PHASE_LABELS[requested] || requested}.`,
            ephemeral: true,
        });
    },
};

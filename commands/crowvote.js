const { SlashCommandBuilder } = require('discord.js');
const { readVotesSession, writeVotesSession, withVotesLock } = require('../utils/votesStore');

const GM_ROLE_ID    = '1204504643846012990';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crowvote')
        .setDescription('Désigne la cible du Corbeau (+2 voix au prochain vote normal).')
        .addUserOption(o =>
            o.setName('user')
             .setDescription('Cible visée')
             .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });

        const target = interaction.options.getUser('user');

        const result = await withVotesLock(() => {
            const session = readVotesSession();
            if (session.isVotingActive) {
                return { ok: false, message: 'Un vote est déjà en cours. Recommence après /endvote.' };
            }

            session.crowVote = { userId: target.id, extraVotes: 2 };
            writeVotesSession(session);
            return { ok: true };
        });
        if (!result.ok) {
            return interaction.reply({ content: result.message, ephemeral: true });
        }

        // Confirmation seulement à l’utilisateur, pas d’annonce publique
        await interaction.reply({
            content: `Corbeau armé : <@${target.id}> recevra +2 voix lors du prochain **vote normal**.`,
            ephemeral: true
        });
    }
};

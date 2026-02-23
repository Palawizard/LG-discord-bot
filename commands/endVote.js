const { SlashCommandBuilder } = require('discord.js');
const { readVotesSession, writeVotesSession, withVotesLock } = require('../utils/votesStore');
const GM_ROLE_ID    = '1204504643846012990';
const MAIRE_ROLE_ID = '1204502456768397442';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endvote')
        .setDescription('Clôture le vote et affiche les résultats.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });

        const result = await withVotesLock(() => {
            const session = readVotesSession();
            if (!session.isVotingActive) {
                return { ok: false, message: 'Aucun vote actif.' };
            }

            /* --- comptage des voix --- */
            const counts = {};
            Object.values(session.votes).forEach(uid => {
                counts[uid] = (counts[uid] || 0) + 1;
            });

            /* --- bonus Corbeau si vote NORMAL --- */
            let corbMsg = '';
            if (session.voteType === 'normal'
                && session.crowVote?.userId
                && session.crowVote.extraVotes > 0) {
                const id = session.crowVote.userId;
                counts[id] = (counts[id] || 0) + session.crowVote.extraVotes;
                corbMsg = `(+2 voix du Corbeau pour <@${id}>)`;
            }

            const scores = Object.values(counts);
            const max = scores.length ? Math.max(...scores) : null;
            const top = max === null ? [] : Object.keys(counts).filter(uid => counts[uid] === max);

            /* --- mise à jour votes.json --- */
            // • On remet votes et isVotingActive à zéro
            // • On NE réinitialise crowVote que si le vote était NORMAL
            const newSession = {
                isVotingActive: false,
                voteType: null,
                votes: {},
                crowVote: session.voteType === 'normal'
                          ? { userId: null, extraVotes: 0 }
                          : session.crowVote,
                masterId: null,
                endTime: null
            };
            writeVotesSession(newSession);

            return { ok: true, counts, corbMsg, top, voteType: session.voteType };
        });

        if (!result.ok) {
            return interaction.reply({ content: result.message, ephemeral: true });
        }

        /* --- construction du message résultat --- */
        let msg = '📊 **Résultats du vote**\n';
        for (const [uid, n] of Object.entries(result.counts))
            msg += `• <@${uid}> : ${n} voix\n`;
        if (result.corbMsg) msg += result.corbMsg + '\n';

        if (result.top.length) {
            msg += '\n👑 Le(s) plus voté(s) : ' + result.top.map(id => `<@${id}>`).join(', ');
            if (result.voteType === 'maire') {
                for (const id of result.top) {
                    const m = await interaction.guild.members.fetch(id);
                    m.roles.add(MAIRE_ROLE_ID).catch(console.error);
                }
                msg += '\nLe rôle **Maire** a été attribué.';
            }
        } else msg += '\nAucun vote exprimé.';

        await interaction.reply({ content: msg, ephemeral: false });
    }
};

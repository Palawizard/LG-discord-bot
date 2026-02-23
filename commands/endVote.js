const { SlashCommandBuilder } = require('discord.js');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { PHASES, setPhase } = require('../utils/gameStateStore');
const { readVotesSession, writeVotesSession, withVotesLock } = require('../utils/votesStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endvote')
        .setDescription('Cloture le vote et affiche les resultats.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            return interaction.reply({ content: 'Permission refusee.', ephemeral: true });
        }

        const result = await withVotesLock(() => {
            const session = readVotesSession();
            if (!session.isVotingActive) {
                return { ok: false, message: 'Aucun vote actif.' };
            }

            const counts = {};
            Object.values(session.votes).forEach(uid => {
                counts[uid] = (counts[uid] || 0) + 1;
            });

            let crowMessage = '';
            if (
                session.voteType === 'normal' &&
                session.crowVote?.userId &&
                session.crowVote.extraVotes > 0
            ) {
                const id = session.crowVote.userId;
                counts[id] = (counts[id] || 0) + session.crowVote.extraVotes;
                crowMessage = `(+2 voix du Corbeau pour <@${id}>)`;
            }

            const scores = Object.values(counts);
            const max = scores.length ? Math.max(...scores) : null;
            const top = max === null
                ? []
                : Object.keys(counts).filter(uid => counts[uid] === max);

            const phaseAfterVote = session.phaseBeforeVote || PHASES.DAY;

            writeVotesSession({
                isVotingActive: false,
                voteType: null,
                votes: {},
                crowVote: session.voteType === 'normal'
                    ? { userId: null, extraVotes: 0 }
                    : session.crowVote,
                masterId: null,
                endTime: null,
                phaseBeforeVote: null,
            });

            return {
                ok: true,
                counts,
                crowMessage,
                top,
                voteType: session.voteType,
                phaseAfterVote,
            };
        });

        if (!result.ok) {
            return interaction.reply({ content: result.message, ephemeral: true });
        }

        await setPhase(result.phaseAfterVote).catch(console.error);

        let msg = 'Resultats du vote\n';
        for (const [uid, n] of Object.entries(result.counts)) {
            msg += `- <@${uid}> : ${n} voix\n`;
        }
        if (result.crowMessage) msg += `${result.crowMessage}\n`;

        if (result.top.length) {
            msg += `\nPlus vote(s) : ${result.top.map(id => `<@${id}>`).join(', ')}`;
            if (result.voteType === 'maire') {
                for (const id of result.top) {
                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    if (member) {
                        member.roles.add(ROLE_IDS.MAYOR).catch(console.error);
                    }
                }
                msg += '\nLe role Maire a ete attribue.';
            }
        } else {
            msg += '\nAucun vote exprime.';
        }

        const general = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT).catch(() => null);
        if (general) {
            await general.send({ content: msg });
        } else {
            await interaction.channel.send({ content: msg }).catch(() => {});
        }

        await interaction.reply({ content: 'Vote termine. Resultats publies.', ephemeral: true });
    },
};

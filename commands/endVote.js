const { SlashCommandBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const votesFilePath = path.join(__dirname, '../votes.json');
const GM_ROLE_ID    = '1204504643846012990';
const MAIRE_ROLE_ID = '1204502456768397442';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endvote')
        .setDescription('Clôture le vote et affiche les résultats.'),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });

        if (!fs.existsSync(votesFilePath))
            return interaction.reply({ content: 'Aucun vote actif.', ephemeral: true });

        const session = JSON.parse(fs.readFileSync(votesFilePath, 'utf8'));
        if (!session.isVotingActive)
            return interaction.reply({ content: 'Aucun vote actif.', ephemeral: true });

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

        /* --- construction du message résultat --- */
        let msg = '📊 **Résultats du vote**\n';
        for (const [uid, n] of Object.entries(counts))
            msg += `• <@${uid}> : ${n} voix\n`;
        if (corbMsg) msg += corbMsg + '\n';

        const max = Math.max(...Object.values(counts));
        const top = Object.keys(counts).filter(uid => counts[uid] === max);

        if (top.length) {
            msg += '\n👑 Le(s) plus voté(s) : ' + top.map(id => `<@${id}>`).join(', ');
            if (session.voteType === 'maire') {
                for (const id of top) {
                    const m = await interaction.guild.members.fetch(id);
                    m.roles.add(MAIRE_ROLE_ID).catch(console.error);
                }
                msg += '\nLe rôle **Maire** a été attribué.';
            }
        } else msg += '\nAucun vote exprimé.';

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
        fs.writeFileSync(votesFilePath, JSON.stringify(newSession, null, 2), 'utf8');

        await interaction.reply({ content: msg, ephemeral: false });
    }
};

const { SlashCommandBuilder } = require('@discordjs/builders');
const fs   = require('fs');
const path = require('path');

const votesFilePath = path.join(__dirname, '../votes.json');
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

        /* --- lecture / création votes.json --- */
        let session = { isVotingActive: false, crowVote: { userId: null, extraVotes: 0 } };
        if (fs.existsSync(votesFilePath)) {
            try { session = JSON.parse(fs.readFileSync(votesFilePath, 'utf8')); }
            catch { /* ignore */ }
            if (session.isVotingActive)
                return interaction.reply({ content: 'Un vote est déjà en cours. Recommence après /endvote.', ephemeral: true });
        }

        session.crowVote = { userId: target.id, extraVotes: 2 };
        fs.writeFileSync(votesFilePath, JSON.stringify(session, null, 2), 'utf8');

        // Confirmation seulement à l’utilisateur, pas d’annonce publique
        await interaction.reply({
            content: `Corbeau armé : <@${target.id}> recevra +2 voix lors du prochain **vote normal**.`,
            ephemeral: true
        });
    }
};

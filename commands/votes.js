const { SlashCommandBuilder } = require('discord.js');
const { readVotesSession, writeVotesSession, withVotesLock } = require('../utils/votesStore');
const { ROLE_IDS } = require('../config/discordIds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote pour un joueur ou annule ton vote.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription("L'utilisateur pour lequel voter. Laisse vide pour annuler ton vote.")
                .setRequired(false)), // Rendre l'option non requise
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const voterId = interaction.user.id;

        if (targetUser === null) { // Si aucune option n'est fournie, considérer cela comme une tentative d'annulation
            const res = await withVotesLock(() => {
                const votingSession = readVotesSession();
                if (!votingSession.isVotingActive) {
                    return { content: 'Il n’y a pas de vote actif en ce moment.', ephemeral: true };
                }

                if (votingSession.votes[voterId]) {
                    delete votingSession.votes[voterId];
                    writeVotesSession(votingSession);
                    return { content: 'Ton vote a été annulé.', ephemeral: false };
                }

                return { content: "Tu n'as pas voté ou ton vote a déjà été annulé.", ephemeral: false };
            });

            await interaction.reply({ content: res.content, ephemeral: res.ephemeral });
            return;
        }

        // Vérifie si le votant et le voté sont vivants
        const voterMember = await interaction.guild.members.fetch(voterId);
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const vivantRoleId = ROLE_IDS.ALIVE;

        if (!voterMember.roles.cache.has(vivantRoleId) || !targetMember.roles.cache.has(vivantRoleId)) {
            await interaction.reply({ content: 'Le votant et le voté doivent être vivants pour participer au vote.', ephemeral: false });
            return;
        }

        const res = await withVotesLock(() => {
            const votingSession = readVotesSession();
            if (!votingSession.isVotingActive) {
                return { content: 'Il n’y a pas de vote actif en ce moment.', ephemeral: true };
            }

            votingSession.votes[voterId] = targetUser.id;
            writeVotesSession(votingSession);
            return { content: `<@${voterId}> a voté pour <@${targetUser.id}>.`, ephemeral: false };
        });

        await interaction.reply({ content: res.content, ephemeral: res.ephemeral });
    },
};

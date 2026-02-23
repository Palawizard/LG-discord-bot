const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');
const votesFilePath = './votes.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote pour un joueur ou annule ton vote.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription("L'utilisateur pour lequel voter. Tape 'cancel' pour annuler ton vote.")
                .setRequired(false)), // Rendre l'option non requise
    async execute(interaction) {
        let votingSession;
        try {
            const data = fs.readFileSync(votesFilePath, 'utf8');
            votingSession = JSON.parse(data);
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier de session de vote:', error);
            await interaction.reply({ content: 'Erreur lors de la lecture de la session de vote.', ephemeral: true });
            return;
        }

        if (!votingSession.isVotingActive) {
            await interaction.reply({ content: 'Il n’y a pas de vote actif en ce moment.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const voterId = interaction.user.id;

        if (targetUser === null) { // Si aucune option n'est fournie, considérer cela comme une tentative d'annulation
            if (votingSession.votes[voterId]) {
                delete votingSession.votes[voterId];
                fs.writeFileSync(votesFilePath, JSON.stringify(votingSession, null, 2), 'utf8');
                await interaction.reply({ content: `Ton vote a été annulé.`, ephemeral: false });
            } else {
                await interaction.reply({ content: `Tu n'as pas voté ou ton vote a déjà été annulé.`, ephemeral: false });
            }
            return;
        }

        // Vérifie si le votant et le voté sont vivants
        const voterMember = await interaction.guild.members.fetch(voterId);
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const vivantRoleId = '1204495004203094016'; // ID du rôle "Vivant"

        if (!voterMember.roles.cache.has(vivantRoleId) || !targetMember.roles.cache.has(vivantRoleId)) {
            await interaction.reply({ content: 'Le votant et le voté doivent être vivants pour participer au vote.', ephemeral: false });
            return;
        }

        // Procède à la logique de vote
        votingSession.votes[voterId] = targetUser.id;
        try {
            fs.writeFileSync(votesFilePath, JSON.stringify(votingSession, null, 2), 'utf8');
            await interaction.reply({ content: `<@${voterId}> a voté pour <@${targetUser.id}>.`, ephemeral: false });
        } catch (error) {
            console.error('Erreur lors de l’enregistrement du vote:', error);
            await interaction.reply({ content: 'Erreur lors de l’enregistrement du vote. Veuillez réessayer.', ephemeral: false });
        }
    },
};

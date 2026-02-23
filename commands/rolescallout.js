const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');
const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolescallout')
        .setDescription('Annonce les rôles utilisés dans la partie en cours.'),
    async execute(interaction) {
        // Assurez-vous que cette commande ne peut être utilisée que par le Game Master ou un rôle spécifique
        const allowedRoleId = ROLE_IDS.GM;
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });

        const roleAssignmentsPath = path.join(__dirname, '../roleAssignments.json'); // Ajustez le chemin selon votre configuration
        fs.readFile(roleAssignmentsPath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Erreur lors de la lecture du fichier des attributions de rôles:', err);
                await interaction.editReply({ content: 'Erreur lors de la récupération des attributions de rôles.' });
                return;
            }

            let assignments;
            try {
                assignments = JSON.parse(data);
            } catch (parseErr) {
                console.error('roleAssignments.json invalide :', parseErr);
                await interaction.editReply({ content: 'Le fichier roleAssignments.json est invalide.' });
                return;
            }
            const roleCounts = assignments.reduce((acc, curr) => {
                acc[curr.role] = (acc[curr.role] || 0) + 1;
                return acc;
            }, {});

            let messageContent = 'Partie lancée. Il y a dans la partie les rôles suivant :\n';
            Object.entries(roleCounts).forEach(([role, count]) => {
                messageContent += `- ${role} (${count})\n`;
            });

            // Récupérer le canal #général et envoyer le message
            const generalChannel = await interaction.guild.channels.cache.find(channel => channel.id === CHANNEL_IDS.GENERAL_TEXT && channel.type === ChannelType.GuildText);
            if (generalChannel) {
                generalChannel.send(messageContent);
                await interaction.editReply({ content: 'Les rôles ont été annoncés dans #général.' });
            } else {
                await interaction.editReply({ content: 'Impossible de trouver le canal #général.' });
            }
        });
    },
};

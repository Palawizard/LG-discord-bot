const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolescallout')
        .setDescription('Annonce les rôles utilisés dans la partie en cours.'),
    async execute(interaction) {
        // Assurez-vous que cette commande ne peut être utilisée que par le Game Master ou un rôle spécifique
        const allowedRoleId = '1204504643846012990'; // ID du rôle autorisé à utiliser cette commande, ajustez selon vos besoins
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }

        const roleAssignmentsPath = path.join(__dirname, '../roleAssignments.json'); // Ajustez le chemin selon votre configuration
        fs.readFile(roleAssignmentsPath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Erreur lors de la lecture du fichier des attributions de rôles:', err);
                await interaction.reply({ content: 'Erreur lors de la récupération des attributions de rôles.', ephemeral: true });
                return;
            }

            const assignments = JSON.parse(data);
            const roleCounts = assignments.reduce((acc, curr) => {
                acc[curr.role] = (acc[curr.role] || 0) + 1;
                return acc;
            }, {});

            let messageContent = 'Partie lancée. Il y a dans la partie les rôles suivant :\n';
            Object.entries(roleCounts).forEach(([role, count]) => {
                messageContent += `- ${role} (${count})\n`;
            });

            // Récupérer le canal #général et envoyer le message
            const generalChannel = await interaction.guild.channels.cache.find(channel => channel.id === '1204493774072324120' && channel.type === ChannelType.GuildText);
            if (generalChannel) {
                generalChannel.send(messageContent);
                await interaction.reply({ content: 'Les rôles ont été annoncés dans #général.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Impossible de trouver le canal #général.', ephemeral: true });
            }
        });
    },
};

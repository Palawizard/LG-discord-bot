const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endgame')
        .setDescription('Termine le jeu en supprimant les rôles et en déplaçant tout le monde vers le Village.')
        .setDefaultMemberPermissions(0), // Assurez-vous que seuls les utilisateurs avec des permissions spécifiques peuvent utiliser cette commande
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const allowedRoleId = '1204504643846012990';
        const vivantRoleId = '1204495004203094016';
        const mortRoleId = '1204494784585146378';
        const villageChannelId = '1204493774072324121';
        const maireRoleId = '1204502456768397442';
		const loversFilePath = path.join(__dirname, 'lovers.json');

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            await interaction.editReply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.' });
            return;
        }

        if (!interaction.guild) {
            await interaction.editReply({ content: 'Cette commande ne peut être utilisée que dans un serveur.' });
            return;
        }

        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json');

        fs.readFile(assignmentsFilePath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Échec de la lecture du fichier des attributions :', err);
                await interaction.editReply({ content: 'Échec de la lecture des attributions de rôles à partir du fichier.' });
                return;
            }

            const assignments = JSON.parse(data);

            // Séparation des loups et des autres rôles
            const loups = assignments.filter(a => a.initialRole === 'Loups' || a.initialRole === 'Loup Blanc');
            const autres = assignments.filter(a => a.initialRole !== 'Loups' && a.initialRole !== 'Loup Blanc');

            // Suppression des rôles et déplacement des joueurs
            await Promise.all(assignments.map(async (assignment) => {
                try {
                    const member = await interaction.guild.members.fetch(assignment.userId);
                    await member.roles.remove([vivantRoleId, mortRoleId, maireRoleId]).catch(console.error);
                    if (member.voice.channelId) {
                        await member.voice.setChannel(villageChannelId).catch(console.error);
                    }
                } catch (error) {
                    console.error(`Échec du traitement de l'attribution pour l'ID utilisateur ${assignment.userId}:`, error);
                }
            }));

            // Réinitialisation du fichier des attributions
            fs.writeFile(assignmentsFilePath, JSON.stringify([], null, 2), 'utf8', err => {
                if (err) console.error('Échec de la réinitialisation du fichier des attributions:', err);
            });
			
			// Réinitialisation de la liste des amoureux
			fs.writeFile(loversFilePath, JSON.stringify([], null, 2), 'utf8', err => {
            if (err) {
                console.error('Échec de la réinitialisation de la liste des amoureux:', err);
            } else {
                console.log('La liste des amoureux a été réinitialisée.');
            }
			});

            // Construction et envoi du message final
            const generalChannel = await interaction.guild.channels.fetch('1204493774072324120');
            generalChannel.send(constructRoleMessage(loups, autres)).catch(console.error);

            await interaction.editReply({ content: 'Le jeu est terminé. Les rôles ont été supprimés et les joueurs déplacés vers le Village.' });
        });
    },
};

function constructRoleMessage(loups, autres) {
    let message = '**Fin du jeu. Voici les rôles initiaux de tout le monde :**\n\n**Loups :**\n';
    loups.forEach(loup => message += `- <@${loup.userId}> était ${loup.initialRole}\n`);
    message += '\n**Autres :**\n';
    autres.forEach(autre => message += `- <@${autre.userId}> était ${autre.initialRole}\n`);
    return message;
}

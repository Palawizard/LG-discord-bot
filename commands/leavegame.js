const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const allRoles = require('./roles.js').roles; // Ajustez le chemin selon votre configuration

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leavegame')
        .setDescription('Permet de quitter la partie correctement'),
    async execute(interaction) {
        
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande peut uniquement être utilisée dans un serveur.', ephemeral: true });
            return;
        }

        const targetUser = interaction.user;
        const generalChannelId = '1204493774072324120';
        const vivantRoleId = '1204495004203094016';
        const mortRoleId = '1204494784585146378';
		const maireRoleId = '1204502456768397442';
        const mortChannelId = allRoles.find(role => role.name === 'Mort').channelId;

        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json');

        fs.readFile(assignmentsFilePath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Échec de la lecture du fichier des attributions :', err);
                await interaction.reply({ content: 'Échec de la lecture des attributions de rôles à partir du fichier.', ephemeral: true });
                return;
            }

            let assignments = JSON.parse(data);
            const playerAssignment = assignments.find(assignment => assignment.userId === targetUser.id);
            if (playerAssignment) {
                const member = await interaction.guild.members.fetch(targetUser.id);
                const originalChannelId = member.voice.channelId;

                // Retirez le rôle "Vivant" et attribuez le rôle "Mort"
                await member.roles.remove(vivantRoleId).catch(console.error);
				await member.roles.remove(maireRoleId).catch(console.error);
                await member.roles.add(mortRoleId).catch(console.error);

                // Déplacez temporairement le joueur vers le canal "Mort" et retour après 1 seconde
                if (originalChannelId && mortChannelId && member.voice.channel) {
                    await member.voice.setChannel(mortChannelId).catch(console.error);
                    setTimeout(() => {
                        member.voice.setChannel(originalChannelId).catch(console.error);
                    }, 1000);
                }

                // Annonce dans le salon général avec le rôle initial
                const generalChannel = await interaction.guild.channels.fetch(generalChannelId);
                generalChannel.send(`${targetUser.username} a quitté. Rôle initial: ${playerAssignment.role}.`);

                // Mise à jour du rôle dans le fichier assignments
                assignments = assignments.map(assignment => {
                    if (assignment.userId === targetUser.id) {
                        return { ...assignment, role: 'Mort', channelId: mortChannelId };
                    }
                    return assignment;
                });
                fs.writeFile(assignmentsFilePath, JSON.stringify(assignments, null, 2), 'utf8', err => {
                    if (err) console.error('Erreur lors de la mise à jour du fichier des attributions.', err);
                });

                await interaction.reply({ content: `bye bye`, ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ce joueur n’a actuellement aucun rôle assigné dans le jeu.', ephemeral: true });
            }
        });
    },
};

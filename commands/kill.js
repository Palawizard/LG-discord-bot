const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const allRoles = require('./roles.js').roles; // Adjust the path as needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kill')
        .setDescription('Élimine un joueur du jeu, le marquant comme "Mort".')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Le joueur à éliminer')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison de l\'élimination')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has('1204504643846012990')) {
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande peut uniquement être utilisée dans un serveur.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('player');
        const reason = interaction.options.getString('raison') || 'Aucune raison donnée';
        const vivantRoleId = '1204495004203094016';
        const mortRoleId = '1204494784585146378';
        const maireRoleId = '1204502456768397442';
        const mortChannelId = allRoles.find(role => role.name === 'Mort').channelId;

        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json');
        const deathNoticesFilePath = path.join(__dirname, '../deathNotices.json'); // Ensure this path is correct

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

                // Remove "Vivant" and "Maire" roles, add "Mort" role
                await member.roles.remove([vivantRoleId, maireRoleId]).catch(console.error);
                await member.roles.add(mortRoleId).catch(console.error);
				
				// Déplacez temporairement le joueur vers le canal "Mort" et retour après 1 seconde
                if (originalChannelId && mortChannelId && member.voice.channel) {
                    await member.voice.setChannel(mortChannelId).catch(console.error);
                    setTimeout(() => {
                        member.voice.setChannel(originalChannelId).catch(console.error);
                    }, 1000);
                }

                targetUser.send(`Tu es mort ! La raison de ta mort est : ${reason}`).catch(err => console.log(`Failed to send DM to ${targetUser.username}: ${err}`));
				
				// Prepare the death notice for later announcement
                const deathNotice = {
                    username: targetUser.username,
                    role: playerAssignment.role,
                    reason: reason
                };

                // Read the current death notices, add the new one, then write back to the file
                fs.readFile(deathNoticesFilePath, 'utf8', (err, data) => {
                    let deathNotices = [];
                    if (!err && data) {
                        deathNotices = JSON.parse(data);
                    }
                    deathNotices.push(deathNotice);
                    fs.writeFile(deathNoticesFilePath, JSON.stringify(deathNotices, null, 2), 'utf8', err => {
                        if (err) {
                            console.error('Failed to update death notices.', err);
                        }
                    });
                });

                // Update the role in the assignments file
                assignments = assignments.map(assignment => {
                    if (assignment.userId === targetUser.id) {
                        return { ...assignment, role: 'Mort', channelId: mortChannelId };
                    }
                    return assignment;
                });
                fs.writeFile(assignmentsFilePath, JSON.stringify(assignments, null, 2), 'utf8', err => {
                    if (err) console.error('Erreur lors de la mise à jour du fichier des attributions.', err);
                });

                await interaction.reply({ content: `${targetUser.username} a été marqué comme "Mort".`, ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ce joueur n’a actuellement aucun rôle assigné dans le jeu.', ephemeral: true });
            }
        });
    },
};

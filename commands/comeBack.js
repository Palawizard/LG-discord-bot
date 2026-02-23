const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comeback')
        .setDescription('Ramène tous ceux ayant un rôle vers le canal vocal "Village".'),
    async execute(interaction) {
		// ID of the role that is allowed to use the command
        const allowedRoleId = '1204504643846012990';

        // Check if the user has the required role
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            // If the user does not have the role, reply with an error message
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return; // Stop the execution of the command here
        }
        await interaction.deferReply({ ephemeral: true });
        
        const villageChannelId = '1204493774072324121';
        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json');
        fs.readFile(assignmentsFilePath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Échec de la lecture du fichier des attributions:', err);
                await interaction.editReply({ content: 'Échec de la lecture des attributions de rôles à partir du fichier.' });
                return;
            }

            const assignments = JSON.parse(data);

            for (const assignment of assignments) {
                const member = await interaction.guild.members.fetch(assignment.userId).catch(console.error);
                if (member && member.voice.channel) {
                    await member.voice.setChannel(villageChannelId).catch(console.error);
                }
            }

            await interaction.editReply({ content: 'Tous les joueurs ont été ramenés au canal Village.' });
        });
    },
};
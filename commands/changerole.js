const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');
const rolesData = require('./roles').roles; // Adjust the path as needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changerole')
        .setDescription('Change le rôle de jeu et son channelId correspondant pour un utilisateur.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription("L'utilisateur pour lequel changer le rôle")
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Le nouveau rôle à assigner')
                .setRequired(true)),
    async execute(interaction) {
        const allowedRoleId = '1204504643846012990';

        // Check if the member has the required role
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            // If the member does not have the role, reply with an error message
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }
        const user = interaction.options.getUser('user');
        const roleName = interaction.options.getString('role');

        const role = rolesData.find(r => r.name === roleName);
        if (!role) {
            await interaction.reply({ content: `Le rôle "${roleName}" n'a pas été trouvé.`, ephemeral: true });
            return;
        }

        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json'); // Adjust the path as needed
        fs.readFile(assignmentsFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Échec de la lecture du fichier des attributions :', err);
                interaction.reply({ content: 'Échec de la lecture des attributions de rôles à partir du fichier.', ephemeral: true });
                return;
            }

            let assignments = JSON.parse(data);
            const index = assignments.findIndex(assignment => assignment.userId === user.id);
            if (index !== -1) {
                // Here we update both the role and initialRole to the new role
                assignments[index].role = roleName;
                assignments[index].initialRole = roleName; // Update this line to also change the initialRole
                assignments[index].channelId = role.channelId;
            } else {
                assignments.push({ userId: user.id, role: roleName, initialRole: roleName, channelId: role.channelId }); // Make sure to include initialRole here as well
            }

            fs.writeFile(assignmentsFilePath, JSON.stringify(assignments, null, 2), 'utf8', err => {
                if (err) {
                    console.error('Échec de la mise à jour du fichier des attributions :', err);
                    interaction.reply({ content: 'Échec de la mise à jour du fichier des attributions de rôles.', ephemeral: true });
                    return;
                }

                interaction.reply({ content: `Le rôle "${roleName}" et son canal ont été assignés à ${user.username}.`, ephemeral: true });
            });
        });
    },
};

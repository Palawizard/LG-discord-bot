const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Affiche une liste des joueurs avec leurs rôles.'),
    async execute(interaction) {
		const allowedRoleId = '1204504643846012990';

        // Vérifie si le membre a le rôle requis
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            // Si le membre n'a pas le rôle, répond avec un message d'erreur
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }
        // Assure que la commande est exécutée dans une guilde
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande peut uniquement être utilisée dans un serveur.', ephemeral: true });
            return;
        }

        const assignmentsFilePath = path.join(__dirname, '../roleAssignments.json'); // Ajustez le chemin selon votre configuration

        fs.readFile(assignmentsFilePath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Échec de la lecture du fichier des attributions :', err);
                await interaction.reply({ content: 'Échec de la lecture des attributions de rôles à partir du fichier.', ephemeral: true });
                return;
            }

            const assignments = JSON.parse(data);
            let messageContent = 'Rôles des joueurs :\n';

            // Collecte toutes les promesses pour la récupération des membres
            const fetchPromises = assignments.map(assignment =>
                interaction.guild.members.fetch(assignment.userId)
                    .then(member => `${member.toString()}: ${assignment.role}`)
                    .catch(console.error)
            );

            // Attend que toutes les récupérations soient terminées
            Promise.all(fetchPromises).then(results => {
                // Combine toutes les mentions des membres récupérés avec leurs rôles dans le message
                messageContent += results.join('\n');
                interaction.reply({ content: messageContent, ephemeral: true }); // Retirez ephemeral: true si vous voulez que ce soit visible par tous
            });
        });
    },
};

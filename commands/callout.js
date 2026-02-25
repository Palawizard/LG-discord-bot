const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ROLE_IDS } = require('../config/discordIds');
const { getRoleDisplayName } = require('./roles');
const deathNoticesFilePath = path.join(__dirname, '../deathNotices.json'); // Adjust path as needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('callout')
        .setDescription('Annonce les joueurs éliminés.'),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }
        
        fs.readFile(deathNoticesFilePath, 'utf8', async (err, data) => {
            if (err || !data) {
                console.error('Failed to read death notices:', err);
                await interaction.reply({ content: 'Aucune annonce de mort à faire.', ephemeral: true });
                return;
            }

            let deathNotices;
            try {
                deathNotices = JSON.parse(data);
            } catch (parseErr) {
                console.error('deathNotices.json invalide :', parseErr);
                await interaction.reply({ content: 'Le fichier des annonces de mort est invalide.', ephemeral: true });
                return;
            }
            if (deathNotices.length === 0) {
                await interaction.reply({ content: 'Aucune annonce de mort à faire.', ephemeral: true });
                return;
            }

            const announcements = deathNotices
                .map(notice => {
                    const roleLabel = getRoleDisplayName(notice.role);
                    return `${notice.username} a été éliminé(e). Rôle initial : ${roleLabel}. Raison : ${notice.reason}`;
                })
                .join('\n');
            await interaction.reply(announcements);

            // Optionally clear the file after calling out
            fs.writeFile(deathNoticesFilePath, JSON.stringify([], null, 2), 'utf8', err => {
                if (err) console.error('Failed to clear death notices.', err);
            });
        });
    },
};

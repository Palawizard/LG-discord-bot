const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { ROLE_IDS } = require('../config/discordIds');
const { eliminatePlayer } = require('../utils/playerLifecycle');

const deathNoticesFilePath = path.join(__dirname, '../deathNotices.json');

function readDeathNotices() {
    if (!fs.existsSync(deathNoticesFilePath)) return [];
    try {
        const raw = JSON.parse(fs.readFileSync(deathNoticesFilePath, 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function writeDeathNotices(notices) {
    fs.writeFileSync(deathNoticesFilePath, JSON.stringify(notices, null, 2), 'utf8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kill')
        .setDescription('Elimine un joueur du jeu, en le marquant Mort.')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Le joueur a eliminer')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison de l elimination')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n avez pas la permission d utiliser cette commande.', ephemeral: true });
            return;
        }
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande peut uniquement etre utilisee dans un serveur.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('player');
        const reason = interaction.options.getString('raison') || 'Aucune raison donnee';

        const result = await eliminatePlayer(
            interaction.guild,
            targetUser.id,
            `Tu es mort. Raison: ${reason}`
        );

        if (!result.ok) {
            await interaction.editReply({ content: 'Ce joueur n a actuellement aucun role assigne dans le jeu.' });
            return;
        }

        const notices = readDeathNotices();
        notices.push({
            username: targetUser.username,
            role: result.previousRole,
            reason,
        });
        writeDeathNotices(notices);

        await interaction.editReply({ content: `${targetUser.username} a ete marque comme Mort.` });
    },
};

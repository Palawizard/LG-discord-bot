const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const loversFilePath = path.join(__dirname, 'lovers.json'); // Adjust the path as necessary
const roleAssignmentsFilePath = path.join(__dirname, '../roleAssignments.json'); // Adjust the path as necessary
const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { buildCupidonPanelEmbed, buildCupidonPanelComponents } = require('../utils/userPanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cupidon')
        .setDescription('Commandes pour gérer les actions des amoureux.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajoute un joueur à la liste des amoureux.')
                .addUserOption(option => option.setName('player').setDescription('Le joueur à ajouter').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Rejoint le salon vocal des amoureux.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Retourne dans le salon vocal de son rôle.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Affiche de l\'aide pour la commande cupidon.')),
    async execute(interaction) {
        ensureLoversFileExists();
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await addLover(interaction);
                break;
            case 'join':
                await joinLoversVC(interaction);
                break;
            case 'leave':
                await leaveLoversVC(interaction);
                break;
            case 'help':
                await showHelp(interaction);
                break;
        }
    },
};

async function addLover(interaction) {
    if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
        await interaction.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
        return;
    }
    
    const player = interaction.options.getUser('player');
    const loversList = readLoversFile();
    
    if (!loversList.some(lover => lover.userId === player.id)) {
        loversList.push({ userId: player.id });
        writeLoversFile(loversList);
        let dmSent = true;
        try {
            await player.send({
                embeds: [buildCupidonPanelEmbed()],
                components: buildCupidonPanelComponents(),
            });
        } catch {
            dmSent = false;
        }

        const baseMessage = `${player.username} a ete ajoute(e) a la liste des amoureux.`;
        const msg = dmSent
            ? baseMessage
            : `${baseMessage} (DM fermes pour le panneau amoureux).`;
        await interaction.reply({ content: msg, ephemeral: false });
    } else {
        await interaction.reply({ content: `${player.username} est déjà dans la liste des amoureux.`, ephemeral: true });
    }
}

async function joinLoversVC(interaction) {
    const loversList = readLoversFile();
    if (!loversList.some(lover => lover.userId === interaction.user.id)) {
        await interaction.reply({ content: 'Vous n\'êtes pas dans la liste des amoureux.', ephemeral: true });
        return;
    }
    
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (member.voice.channelId === CHANNEL_IDS.VILLAGE_VOICE) {
        await interaction.reply({ content: 'Vous devez quitter le salon Village avant de rejoindre celui des amoureux.', ephemeral: true });
        return;
    }
    
    await member.voice.setChannel(CHANNEL_IDS.LOVERS_VOICE);
    await interaction.reply({ content: 'Bienvenue dans le salon des amoureux.', ephemeral: true });
}

async function leaveLoversVC(interaction) {
    const loversList = readLoversFile();
    if (!loversList.some(lover => lover.userId === interaction.user.id)) {
        await interaction.reply({ content: 'Vous n\'êtes pas dans la liste des amoureux.', ephemeral: true });
        return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id);
    let roleAssignments;
    try {
        roleAssignments = JSON.parse(fs.readFileSync(roleAssignmentsFilePath, 'utf8'));
    } catch (parseErr) {
        console.error('roleAssignments.json invalide :', parseErr);
        await interaction.reply({ content: 'Le fichier roleAssignments.json est invalide.', ephemeral: true });
        return;
    }
    const userAssignment = roleAssignments.find(assignment => assignment.userId === member.id);
    
    if (userAssignment && userAssignment.channelId) {
        await member.voice.setChannel(userAssignment.channelId);
        await interaction.reply({ content: 'Vous avez été ramené à votre salon vocal d\'origine.', ephemeral: true });
    } else {
        await interaction.reply({ content: 'Votre salon vocal d\'origine n\'a pas été trouvé.', ephemeral: true });
    }
}

async function showHelp(interaction) {
    const helpMessage = '**/cupidon add** - Ajoute un joueur à la liste des amoureux. (Admin uniquement)\n' +
                        '**/cupidon join** - Rejoint le salon des amoureux. (Amoureux uniquement)\n' +
                        '**/cupidon leave** - Retourne dans le salon vocal de son rôle. (Amoureux uniquement)\n' +
                        '**/cupidon help** - Affiche ce message d\'aide.';
    await interaction.reply({ content: helpMessage, ephemeral: true });
}

function ensureLoversFileExists() {
    if (!fs.existsSync(loversFilePath)) {
        fs.writeFileSync(loversFilePath, JSON.stringify([], null, 2), 'utf8');
    }
}

function readLoversFile() {
    try {
        const data = fs.readFileSync(loversFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLoversFile(data) {
    fs.writeFileSync(loversFilePath, JSON.stringify(data, null, 2), 'utf8');
}

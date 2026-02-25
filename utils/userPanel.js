const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const USER_PANEL_IDS = {
    MYROLE: 'userpanel_myrole',
    ALIVE: 'userpanel_alive',
    ROLESLIST: 'userpanel_roleslist',
    LEAVEGAME: 'userpanel_leavegame',
};

const CUPIDON_PANEL_IDS = {
    JOIN: 'cupidonpanel_join',
    LEAVE: 'cupidonpanel_leave',
    HELP: 'cupidonpanel_help',
};

function buildUserPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x2B6CB0)
        .setTitle('Panneau joueur')
        .setDescription('Utilise ces boutons pour les commandes rapides.')
        .addFields(
            { name: 'Mon role', value: 'Rappel de ton role et pouvoir', inline: true },
            { name: 'Vivants', value: 'Liste des joueurs vivants', inline: true },
            { name: 'Roles', value: 'Liste des roles disponibles', inline: true },
            { name: 'Quitter', value: 'Quitter la partie proprement', inline: true }
        )
        .setFooter({ text: 'Disponible pendant la partie.' })
        .setTimestamp();
}

function buildUserPanelComponents() {
    const rowOne = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(USER_PANEL_IDS.MYROLE)
            .setLabel('Mon role')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(USER_PANEL_IDS.ALIVE)
            .setLabel('Vivants')
            .setStyle(ButtonStyle.Secondary)
    );

    const rowTwo = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(USER_PANEL_IDS.ROLESLIST)
            .setLabel('Roles')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(USER_PANEL_IDS.LEAVEGAME)
            .setLabel('Quitter')
            .setStyle(ButtonStyle.Danger)
    );

    return [rowOne, rowTwo];
}

function buildCupidonPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0xC05621)
        .setTitle('Panneau amoureux')
        .setDescription('Commandes reservees aux amoureux.')
        .addFields(
            { name: 'Rejoindre', value: 'Rejoindre le vocal des amoureux', inline: true },
            { name: 'Quitter', value: 'Retourner au vocal de ton role', inline: true },
            { name: 'Aide', value: 'Rappel des commandes', inline: true }
        )
        .setFooter({ text: 'Disponible si Cupidon t a choisi.' })
        .setTimestamp();
}

function buildCupidonPanelComponents() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(CUPIDON_PANEL_IDS.JOIN)
            .setLabel('Rejoindre')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(CUPIDON_PANEL_IDS.LEAVE)
            .setLabel('Quitter')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(CUPIDON_PANEL_IDS.HELP)
            .setLabel('Aide')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

module.exports = {
    USER_PANEL_IDS,
    CUPIDON_PANEL_IDS,
    buildUserPanelEmbed,
    buildUserPanelComponents,
    buildCupidonPanelEmbed,
    buildCupidonPanelComponents,
};

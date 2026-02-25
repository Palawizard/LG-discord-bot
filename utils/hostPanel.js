const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

const HOST_PANEL_IDS = {
    GAME_MENU: 'hostpanel_game_menu',
    VOTE_MENU: 'hostpanel_vote_menu',
    PLAYER_MENU: 'hostpanel_player_menu',
    MISC_MENU: 'hostpanel_misc_menu',
};

function buildHostPanelEmbed(hostUserId) {
    const embed = new EmbedBuilder()
        .setColor(0x2D7D46)
        .setTitle('Panneau host - Gestion de partie')
        .setDescription('Utilise les menus ci-dessous pour gerer la partie sans taper de commandes.')
        .addFields(
            { name: 'Vote', value: 'Lancer un vote + Corbeau', inline: true },
            { name: 'Joueurs', value: 'Kill/kick/changerole', inline: true },
            { name: 'Infos', value: 'Etat, phase, roles, annonces', inline: true }
        )
        .setFooter({ text: 'Reserve au host et aux GM.' })
        .setTimestamp();

    if (hostUserId) {
        embed.addFields({ name: 'Host', value: `<@${hostUserId}>`, inline: true });
    }

    return embed;
}

function buildHostPanelComponents() {
    const gameMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.GAME_MENU)
        .setPlaceholder('Actions de partie...')
        .addOptions(
            { label: 'Etat de partie', value: 'status' },
            { label: 'Annoncer roles utilises', value: 'rolescallout' },
            { label: 'Phase -> Nuit', value: 'phase_night' },
            { label: 'Phase -> Jour', value: 'phase_day' },
            { label: 'Annoncer morts', value: 'callout' },
            { label: 'Finir la partie', value: 'endgame' },
            { label: 'Aide commandes', value: 'help' }
        );

    const voteMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.VOTE_MENU)
        .setPlaceholder('Actions de vote...')
        .addOptions(
            { label: 'Start vote normal', value: 'startvote_normal' },
            { label: 'Start vote maire', value: 'startvote_maire' },
            { label: 'Corbeau: designer cible', value: 'crowvote' }
        );

    const playerMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.PLAYER_MENU)
        .setPlaceholder('Actions joueurs...')
        .addOptions(
            { label: 'Kill joueur', value: 'kill' },
            { label: 'Kick joueur', value: 'kick' },
            { label: 'Changer role joueur', value: 'changerole' },
            { label: 'Liste des vivants', value: 'alive' },
            { label: 'Roles des joueurs', value: 'roles' },
            { label: 'Cupidon: ajouter amoureux', value: 'cupidon_add' }
        );

    const miscMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.MISC_MENU)
        .setPlaceholder('Divers...')
        .addOptions(
            { label: 'Enregistrer les gagnants', value: 'win' }
        );

    return [
        new ActionRowBuilder().addComponents(gameMenu),
        new ActionRowBuilder().addComponents(voteMenu),
        new ActionRowBuilder().addComponents(playerMenu),
        new ActionRowBuilder().addComponents(miscMenu),
    ];
}

module.exports = {
    HOST_PANEL_IDS,
    buildHostPanelEmbed,
    buildHostPanelComponents,
};

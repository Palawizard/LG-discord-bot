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
            { name: 'Vote', value: 'Start/fin/annuler/etendre + Corbeau', inline: true },
            { name: 'Joueurs', value: 'Kill/kick/changerole/deplacements', inline: true },
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
            { label: 'Phase (voir)', value: 'phase_show' },
            { label: 'Phase -> Setup', value: 'phase_setup' },
            { label: 'Phase -> Nuit', value: 'phase_night' },
            { label: 'Phase -> Jour', value: 'phase_day' },
            { label: 'Phase -> Vote', value: 'phase_vote' },
            { label: 'Phase -> Fin', value: 'phase_end' },
            { label: 'Annoncer morts', value: 'callout' },
            { label: 'Annoncer roles utilises', value: 'rolescallout' },
            { label: 'Finir la partie', value: 'endgame' },
            { label: 'Aide commandes', value: 'help' }
        );

    const voteMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.VOTE_MENU)
        .setPlaceholder('Actions de vote...')
        .addOptions(
            { label: 'Start vote normal', value: 'startvote_normal' },
            { label: 'Start vote maire', value: 'startvote_maire' },
            { label: 'Finir le vote', value: 'endvote' },
            { label: 'Annuler le vote', value: 'cancelvote' },
            { label: 'Etendre +30s', value: 'extend_30' },
            { label: 'Etendre +60s', value: 'extend_60' },
            { label: 'Etendre (custom)', value: 'extend_custom' },
            { label: 'Corbeau: designer cible', value: 'crowvote' }
        );

    const playerMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.PLAYER_MENU)
        .setPlaceholder('Actions joueurs...')
        .addOptions(
            { label: 'Kill joueur', value: 'kill' },
            { label: 'Kick joueur', value: 'kick' },
            { label: 'Changer role joueur', value: 'changerole' },
            { label: 'Deplacer tout le monde', value: 'move_all' },
            { label: 'Ramener au village', value: 'comeback' },
            { label: 'Liste des vivants', value: 'alive' },
            { label: 'Roles des joueurs', value: 'roles' },
            { label: 'Liste des roles', value: 'roleslist' },
            { label: 'Voter', value: 'vote' },
            { label: 'Annuler mon vote', value: 'vote_cancel' },
            { label: 'Mon role (DM)', value: 'myrole' },
            { label: 'Quitter la partie', value: 'leavegame' },
            { label: 'Cupidon: ajouter amoureux', value: 'cupidon_add' },
            { label: 'Cupidon: rejoindre salon', value: 'cupidon_join' },
            { label: 'Cupidon: quitter salon', value: 'cupidon_leave' },
            { label: 'Cupidon: aide', value: 'cupidon_help' }
        );

    const miscMenu = new StringSelectMenuBuilder()
        .setCustomId(HOST_PANEL_IDS.MISC_MENU)
        .setPlaceholder('Divers...')
        .addOptions(
            { label: 'Enregistrer les gagnants', value: 'win' },
            { label: 'File: ouvrir', value: 'file_open' },
            { label: 'File: fermer', value: 'file_close' },
            { label: 'File: deplacer', value: 'file_move' }
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

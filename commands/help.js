const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche une liste des commandes disponibles et leurs descriptions.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Aide du Bot')
            .setDescription('Voici les commandes que vous pouvez utiliser :')
            .addFields(
                { name: 'Commandes Générales', value: '**/vote**: Vote pour un joueur ou annulez votre vote.\n**/roleslist**: Affiche une liste des rôles disponibles.\n**/leavegame**: Permet de quitter la partie correctement.' },
                { name: 'Commandes Administrateur', value: "**/comeback**: Ramène tous les joueurs au salon Village.\n**/changerole**: Change le rôle d’un joueur.\n**/crowvote**: Ajoute 2 votes supplémentaires à un utilisateur.\n**/endgame**: Termine le jeu et affiche les rôles de tous les joueurs.\n**/endvote**: Termine la session de vote actuelle.\n**/kill**: Élimine un joueur du jeu.\n**/startvote**: Commence une nouvelle session de vote avec option de durée.\n**/move-all**: Déplace tous les joueurs vers leurs canaux assignés.\n**/roles**: Affiche la liste des joueurs avec leurs rôles.\n**/startgame**: Démarre une nouvelle partie avec option du nombre de loups et empêche l'entrée au salon Village." }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

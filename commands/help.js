const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Aide du bot LG')
            .addFields(
                {
                    name: 'Commandes joueurs',
                    value: [
                        '`/vote` Voter (ou annuler en laissant vide).',
                        '`/alive` Liste des joueurs vivants.',
                        '`/myrole` Rappel de ton rôle en DM.',
                        '`/leavegame` Quitter la partie.',
                        '`/roleslist` Voir les rôles disponibles.',
                    ].join('\n'),
                },
                {
                    name: 'Commandes hôte / GM',
                    value: [
                        '`/startgame` Lancer une partie (`mode_test_solo` pour tester seul).',
                        '`/startvote` Lancer un vote (panneau hôte inclus).',
                        '`/endvote` Terminer le vote.',
                        '`/phase` Voir ou changer la phase.',
                        '`/status` État rapide de la partie.',
                        '`/kill`, `/kickplayer`, `/endgame`, `/move-all`, `/comeback`',
                    ].join('\n'),
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

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
                        '`/myrole` Rappel de ton role en DM.',
                        '`/leavegame` Quitter la partie.',
                        '`/roleslist` Voir les roles disponibles.',
                    ].join('\n'),
                },
                {
                    name: 'Commandes host / GM',
                    value: [
                        '`/startgame` Lancer une partie.',
                        '`/startvote` Lancer un vote (panel host inclus).',
                        '`/endvote` Terminer le vote.',
                        '`/phase` Voir ou changer la phase.',
                        '`/status` Etat rapide de la partie.',
                        '`/kill`, `/kickplayer`, `/endgame`, `/move-all`, `/comeback`',
                    ].join('\n'),
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

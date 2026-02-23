const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const rolesData = require('./roles').roles; // Assurez-vous que le chemin est correct

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleslist')
        .setDescription('Affiche une liste des rôles disponibles dans un embed.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Liste des Rôles Disponibles')
            .setDescription('Voici une liste des rôles que vous pouvez obtenir dans le jeu :');

        rolesData.forEach(role => {
            embed.addFields({ name: role.name, value: role.roledesc, inline: true });
        });

        await interaction.reply({ embeds: [embed] });
    },
};

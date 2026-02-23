const { SlashCommandBuilder } = require('@discordjs/builders');
const allRoles = require('D:/Autre/Desktop/discord bot/commands/roles.js').roles;
const { ChannelType } = require('discord.js');
const fs = require('fs');
const assignmentsFilePath = './roleAssignments.json'; // Spécifiez votre chemin de fichier ici
const votesFilePath = './votes.json'; // Chemin vers le fichier votes.json


module.exports = {
    data: new SlashCommandBuilder()
        .setName('startgame')
        .setDescription('Démarre une nouvelle partie de Loup-garou.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le canal vocal')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('host')
                .setDescription("L'utilisateur qui sera l'hôte du jeu")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('nombre_loups')
                .setDescription('Le nombre de loups pour la partie')
                .setRequired(true)),
    async execute(interaction) {
		// ID of the role that is allowed to use the command
        const allowedRoleId = '1204504643846012990';

        // Check if the user has the required role
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            // If the user does not have the role, reply with an error message
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return; // Stop the execution of the command here
        }
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const hostUser = interaction.options.getUser('host');
        const numberOfWolves = interaction.options.getInteger('nombre_loups');

        if (!channel || channel.type !== ChannelType.GuildVoice) {
            await interaction.editReply("Veuillez fournir un canal vocal valide.");
            return;
        }

        let members = Array.from(channel.members.values());
        members = members.filter(member => member.id !== hostUser.id);

        const vivantRoleId = '1204495004203094016'; // Assurez-vous que cet ID est correct
        members.forEach(member => {
            member.roles.add(vivantRoleId).catch(console.error);
        });

        let rolesToExclude = ['Loups', 'Loup Blanc', 'Mort'];
        let nonWolfRoles = allRoles.filter(role => !rolesToExclude.includes(role.name));
        let shuffledNonWolfRoles = nonWolfRoles.sort(() => Math.random() - 0.5);
        let rolesToAssign = shuffledNonWolfRoles.slice(0, members.length - numberOfWolves);

        for (let i = 0; i < numberOfWolves; i++) {
            rolesToAssign.push(allRoles.find(role => role.name === 'Loups'));
        }

        rolesToAssign = rolesToAssign.sort(() => Math.random() - 0.5);

        const assignments = await Promise.all(members.map(async (member, index) => {
            const assignedRole = rolesToAssign[index];
            let dmMessage = assignedRole.name === 'Loups' ? 'Tu fais partie des loups.' : `Tu es ${assignedRole.name}.`;
            if (assignedRole.roledesc) {
                dmMessage += ` ${assignedRole.roledesc}`;
            }
            await member.send(dmMessage).catch(err => console.error(`Échec de l'envoi du DM à ${member.user.tag}.`, err));

            return {
                userId: member.user.id,
                role: assignedRole.name,
                initialRole: assignedRole.name, // Conserve le rôle initial pour utilisation ultérieure
                channelId: assignedRole.channelId,
            };
        }));

        fs.writeFile(assignmentsFilePath, JSON.stringify(assignments, null, 2), 'utf8', err => {
            if (err) {
                console.error("Une erreur s'est produite lors de l'écriture de l'objet JSON dans le fichier.", err);
                interaction.followUp({ content: "Échec de la sauvegarde des attributions de rôles dans le fichier.", ephemeral: true }).catch(console.error);
            } else {
                interaction.followUp({ content: "Les attributions de rôles ont été sauvegardées dans le fichier avec succès.", ephemeral: true }).catch(console.error);
            }
        });

        let votingSession = { masterId: hostUser.id, isVotingActive: false, votes: {}, crowVote: { userId: null, extraVotes: 0 }};
        fs.writeFileSync(votesFilePath, JSON.stringify(votingSession, null, 2), 'utf8', err => {
            if (err) {
                console.error("Une erreur s'est produite lors de l'écriture dans votes.json", err);
            }
        });

        const villageChannelId = '1204493774072324121';
        const villageChannel = await interaction.guild.channels.fetch(villageChannelId);

        await interaction.editReply({ content: 'La partie de Loup-garou a commencé, et les rôles ont été attribués ! Vérifie le canal pour les détails.' });
    },
};

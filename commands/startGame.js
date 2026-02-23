const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const allRoles = require('./roles.js').roles;
const { ROLE_IDS } = require('../config/discordIds');
const { writeAssignments } = require('../utils/assignmentsStore');
const { writeVotesSession } = require('../utils/votesStore');
const { PHASES, readGameState, setPhase } = require('../utils/gameStateStore');

const deathNoticesPath = path.join(__dirname, '../deathNotices.json');
const pendingKillsPath = path.join(__dirname, '../pendingKills.json');
const loversFilePath = path.join(__dirname, 'lovers.json');

function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function writeJsonFile(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startgame')
        .setDescription('Demarre une nouvelle partie de Loup-garou.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le canal vocal')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('host')
                .setDescription("L'utilisateur qui sera l'hote du jeu")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('nombre_loups')
                .setDescription('Le nombre de loups pour la partie')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.reply({ content: 'Vous n avez pas la permission d utiliser cette commande.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const gameState = readGameState();
        if (![PHASES.SETUP, PHASES.END].includes(gameState.phase)) {
            await interaction.editReply('Une partie est deja en cours. Utilisez /endgame avant /startgame.');
            return;
        }

        const channel = interaction.options.getChannel('channel');
        const hostUser = interaction.options.getUser('host');
        const numberOfWolves = interaction.options.getInteger('nombre_loups');

        if (!channel || channel.type !== ChannelType.GuildVoice) {
            await interaction.editReply('Veuillez fournir un canal vocal valide.');
            return;
        }

        let members = Array.from(channel.members.values());
        members = members.filter(member => member.id !== hostUser.id);
        if (members.length === 0) {
            await interaction.editReply('Aucun joueur a assigner (hors hote).');
            return;
        }

        if (numberOfWolves < 0 || numberOfWolves > members.length) {
            await interaction.editReply('Le nombre de loups doit etre compris entre 0 et le nombre de joueurs.');
            return;
        }

        await Promise.all(
            members.map(member => member.roles.add(ROLE_IDS.ALIVE).catch(console.error))
        );

        const rolesToExclude = ['Loups', 'Loup Blanc', 'Mort'];
        const nonWolfRoles = allRoles.filter(role => !rolesToExclude.includes(role.name));
        const wolfRole = allRoles.find(role => role.name === 'Loups');

        if (!wolfRole) {
            await interaction.editReply("Le role 'Loups' est introuvable dans la configuration.");
            return;
        }

        const requiredNonWolves = members.length - numberOfWolves;
        if (requiredNonWolves > nonWolfRoles.length) {
            await interaction.editReply(`Pas assez de roles non-loups configures (${nonWolfRoles.length}) pour ${requiredNonWolves} joueurs.`);
            return;
        }

        const shuffledNonWolfRoles = shuffleArray(nonWolfRoles);
        let rolesToAssign = shuffledNonWolfRoles.slice(0, requiredNonWolves);
        for (let i = 0; i < numberOfWolves; i++) {
            rolesToAssign.push(wolfRole);
        }
        rolesToAssign = shuffleArray(rolesToAssign);

        const assignmentResults = await Promise.all(
            members.map(async (member, index) => {
                const assignedRole = rolesToAssign[index];
                let dmMessage = assignedRole.name === 'Loups' ? 'Tu fais partie des loups.' : `Tu es ${assignedRole.name}.`;
                if (assignedRole.roledesc) {
                    dmMessage += ` ${assignedRole.roledesc}`;
                }

                let dmSent = true;
                try {
                    await member.send(dmMessage);
                } catch {
                    dmSent = false;
                }

                return {
                    assignment: {
                        userId: member.user.id,
                        role: assignedRole.name,
                        initialRole: assignedRole.name,
                        channelId: assignedRole.channelId,
                    },
                    dmSent,
                };
            })
        );

        const assignments = assignmentResults.map(r => r.assignment);
        const dmFailures = assignmentResults.filter(r => !r.dmSent).length;

        writeAssignments(assignments);
        writeJsonFile(deathNoticesPath, []);
        writeJsonFile(pendingKillsPath, []);
        writeJsonFile(loversFilePath, []);

        writeVotesSession({
            masterId: hostUser.id,
            isVotingActive: false,
            votes: {},
            crowVote: { userId: null, extraVotes: 0 },
            voteType: null,
            endTime: null,
            phaseBeforeVote: null,
        });

        await setPhase(PHASES.DAY, {
            hostId: hostUser.id,
            startedAt: Date.now(),
        });

        let msg = 'La partie a commence, roles attribues et etat reset.';
        if (dmFailures > 0) {
            msg += ` ${dmFailures} joueur(s) ont les DM fermes.`;
        }
        await interaction.editReply({ content: msg });
    },
};

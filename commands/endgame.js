const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { readAssignments, writeAssignments } = require('../utils/assignmentsStore');
const { writeVotesSession } = require('../utils/votesStore');
const { PHASES, setPhase } = require('../utils/gameStateStore');

const loversFilePath = path.join(__dirname, 'lovers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endgame')
        .setDescription('Termine la partie et remet les joueurs dans un etat neutre.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.member.roles.cache.has(ROLE_IDS.GM)) {
            await interaction.editReply({ content: 'Vous n avez pas la permission d utiliser cette commande.' });
            return;
        }

        if (!interaction.guild) {
            await interaction.editReply({ content: 'Cette commande peut uniquement etre utilisee dans un serveur.' });
            return;
        }

        const assignments = readAssignments();
        const loups = assignments.filter(a => a.initialRole === 'Loups' || a.initialRole === 'Loup Blanc');
        const autres = assignments.filter(a => a.initialRole !== 'Loups' && a.initialRole !== 'Loup Blanc');

        await Promise.all(
            assignments.map(async assignment => {
                const member = await interaction.guild.members.fetch(assignment.userId).catch(() => null);
                if (!member) return;
                await member.roles.remove([ROLE_IDS.ALIVE, ROLE_IDS.DEAD, ROLE_IDS.MAYOR]).catch(console.error);
                if (member.voice.channelId) {
                    await member.voice.setChannel(CHANNEL_IDS.VILLAGE_VOICE).catch(console.error);
                }
            })
        );

        writeAssignments([]);
        fs.writeFileSync(loversFilePath, JSON.stringify([], null, 2), 'utf8');

        writeVotesSession({
            isVotingActive: false,
            voteType: null,
            votes: {},
            crowVote: { userId: null, extraVotes: 0 },
            masterId: null,
            endTime: null,
            phaseBeforeVote: null,
        });

        await setPhase(PHASES.END, { hostId: null, startedAt: null }).catch(console.error);

        const generalChannel = await interaction.guild.channels.fetch(CHANNEL_IDS.GENERAL_TEXT).catch(() => null);
        if (generalChannel) {
            generalChannel.send(constructRoleMessage(loups, autres)).catch(console.error);
        }

        await interaction.editReply({ content: 'Le jeu est termine. Roles nettoyes et joueurs replaces au Village.' });
    },
};

function constructRoleMessage(loups, autres) {
    let message = '**Fin du jeu. Roles initiaux :**\n\n**Loups :**\n';
    loups.forEach(loup => { message += `- <@${loup.userId}> etait ${loup.initialRole}\n`; });
    message += '\n**Autres :**\n';
    autres.forEach(autre => { message += `- <@${autre.userId}> etait ${autre.initialRole}\n`; });
    return message;
}

const { CHANNEL_IDS } = require('../config/discordIds');
const { readAssignments } = require('./assignmentsStore');

async function movePlayersToRoleChannels(guild) {
    const assignments = readAssignments();
    let moved = 0;

    for (const assignment of assignments) {
        const member = await guild.members.fetch(assignment.userId).catch(() => null);
        if (!member || !assignment.channelId || !member.voice.channel) continue;
        await member.voice.setChannel(assignment.channelId).catch(console.error);
        moved += 1;
    }

    return moved;
}

async function movePlayersToVillage(guild) {
    const assignments = readAssignments();
    let moved = 0;

    for (const assignment of assignments) {
        const member = await guild.members.fetch(assignment.userId).catch(() => null);
        if (!member || !member.voice.channel) continue;
        await member.voice.setChannel(CHANNEL_IDS.VILLAGE_VOICE).catch(console.error);
        moved += 1;
    }

    return moved;
}

module.exports = {
    movePlayersToRoleChannels,
    movePlayersToVillage,
};

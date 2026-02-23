const { ROLE_IDS, CHANNEL_IDS } = require('../config/discordIds');
const { readAssignments, writeAssignments, findAssignment } = require('./assignmentsStore');

async function applyDiscordDeadState(guild, userId, dmMessage = null) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return null;

    await member.roles.remove([ROLE_IDS.ALIVE, ROLE_IDS.MAYOR]).catch(console.error);
    await member.roles.add(ROLE_IDS.DEAD).catch(console.error);

    const originalVoiceId = member.voice.channelId;
    if (originalVoiceId && member.voice.channel) {
        await member.voice.setChannel(CHANNEL_IDS.DEAD_VOICE).catch(console.error);
        setTimeout(() => {
            member.voice.setChannel(originalVoiceId).catch(console.error);
        }, 1000);
    }

    if (dmMessage) {
        member.send(dmMessage).catch(() => {});
    }

    return member;
}

function markAssignmentDead(assignments, userId) {
    return assignments.map(assignment => (
        assignment.userId === userId
            ? { ...assignment, role: 'Mort', channelId: CHANNEL_IDS.DEAD_VOICE }
            : assignment
    ));
}

async function eliminatePlayer(guild, userId, dmMessage = null) {
    const assignments = readAssignments();
    const entry = findAssignment(assignments, userId);

    if (!entry) {
        return { ok: false, reason: 'NOT_IN_GAME' };
    }

    await applyDiscordDeadState(guild, userId, dmMessage);

    const updated = markAssignmentDead(assignments, userId);
    writeAssignments(updated);

    return {
        ok: true,
        previousRole: entry.role,
    };
}

module.exports = {
    eliminatePlayer,
    applyDiscordDeadState,
    markAssignmentDead,
};

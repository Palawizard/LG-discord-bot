const { readVotesSession, withVotesLock } = require('./votesStore');

function scheduleVoteReminder(client, delayMs) {
    if (!Number.isFinite(delayMs) || delayMs <= 0) return;

    setTimeout(async () => {
        const latest = await withVotesLock(() => readVotesSession());

        if (!latest.isVotingActive || !latest.masterId || !latest.endTime) {
            return;
        }

        const remainingMs = latest.endTime - Date.now();
        if (remainingMs > 1200) {
            return;
        }

        const gm = await client.users.fetch(latest.masterId).catch(() => null);
        if (!gm) return;

        gm.send('Le temps du vote est écoulé. Termine le vote via le panneau hôte ou /endvote.')
            .catch(() => {});
    }, delayMs);
}

module.exports = {
    scheduleVoteReminder,
};

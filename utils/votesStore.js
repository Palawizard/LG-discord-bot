const fs = require('fs');
const path = require('path');

const votesFilePath = path.join(__dirname, '..', 'votes.json');

let votesQueue = Promise.resolve();

function defaultSession() {
    return {
        isVotingActive: false,
        voteType: null,
        votes: {},
        crowVote: { userId: null, extraVotes: 0 },
        masterId: null,
        endTime: null,
        phaseBeforeVote: null,
    };
}

function normalizeSession(raw) {
    const base = defaultSession();
    const src = raw && typeof raw === 'object' ? raw : {};
    const crow = src.crowVote && typeof src.crowVote === 'object' ? src.crowVote : {};

    return {
        ...base,
        ...src,
        votes: src.votes && typeof src.votes === 'object' ? src.votes : {},
        phaseBeforeVote: typeof src.phaseBeforeVote === 'string' ? src.phaseBeforeVote : null,
        crowVote: {
            userId: typeof crow.userId === 'string' ? crow.userId : null,
            extraVotes: Number.isInteger(crow.extraVotes) ? crow.extraVotes : 0,
        },
    };
}

function readVotesSession() {
    if (!fs.existsSync(votesFilePath)) return defaultSession();
    try {
        const raw = JSON.parse(fs.readFileSync(votesFilePath, 'utf8'));
        return normalizeSession(raw);
    } catch {
        return defaultSession();
    }
}

function writeVotesSession(session) {
    fs.writeFileSync(votesFilePath, JSON.stringify(normalizeSession(session), null, 2), 'utf8');
}

function withVotesLock(task) {
    const run = votesQueue.then(() => task());
    votesQueue = run.catch(() => {});
    return run;
}

module.exports = {
    readVotesSession,
    writeVotesSession,
    withVotesLock,
};

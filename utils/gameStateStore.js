const fs = require('fs');
const path = require('path');

const gameStatePath = path.join(__dirname, '..', 'gameState.json');

const PHASES = {
    SETUP: 'setup',
    NIGHT: 'nuit',
    DAY: 'jour',
    VOTE: 'vote',
    END: 'end',
};

const PHASE_LABELS = {
    [PHASES.SETUP]: 'Setup',
    [PHASES.NIGHT]: 'Nuit',
    [PHASES.DAY]: 'Jour',
    [PHASES.VOTE]: 'Vote',
    [PHASES.END]: 'Fin',
};

let stateQueue = Promise.resolve();

function defaultGameState() {
    return {
        phase: PHASES.SETUP,
        hostId: null,
        startedAt: null,
        updatedAt: Date.now(),
    };
}

function isValidPhase(phase) {
    return Object.values(PHASES).includes(phase);
}

function normalizeGameState(raw) {
    const base = defaultGameState();
    const src = raw && typeof raw === 'object' ? raw : {};

    return {
        ...base,
        ...src,
        phase: isValidPhase(src.phase) ? src.phase : base.phase,
        hostId: typeof src.hostId === 'string' ? src.hostId : null,
        startedAt: Number.isFinite(src.startedAt) ? src.startedAt : null,
        updatedAt: Number.isFinite(src.updatedAt) ? src.updatedAt : Date.now(),
    };
}

function readGameState() {
    if (!fs.existsSync(gameStatePath)) return defaultGameState();
    try {
        const raw = JSON.parse(fs.readFileSync(gameStatePath, 'utf8'));
        return normalizeGameState(raw);
    } catch {
        return defaultGameState();
    }
}

function writeGameState(state) {
    const normalized = normalizeGameState({
        ...state,
        updatedAt: Date.now(),
    });
    fs.writeFileSync(gameStatePath, JSON.stringify(normalized, null, 2), 'utf8');
}

function withGameStateLock(task) {
    const run = stateQueue.then(() => task());
    stateQueue = run.catch(() => {});
    return run;
}

function setPhase(phase, patch = {}) {
    if (!isValidPhase(phase)) {
        throw new Error(`Invalid game phase: ${phase}`);
    }

    return withGameStateLock(() => {
        const current = readGameState();
        const next = {
            ...current,
            ...patch,
            phase,
        };
        writeGameState(next);
        return next;
    });
}

module.exports = {
    PHASES,
    PHASE_LABELS,
    isValidPhase,
    readGameState,
    writeGameState,
    withGameStateLock,
    setPhase,
};

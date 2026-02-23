const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
require('dotenv').config({ quiet: true });

const { ROLE_IDS, CHANNEL_IDS } = require('./config/discordIds');
const { readAssignments } = require('./utils/assignmentsStore');
const { readVotesSession, writeVotesSession, withVotesLock } = require('./utils/votesStore');
const { scheduleVoteReminder } = require('./utils/voteReminder');
const { PHASES, PHASE_LABELS, readGameState, setPhase } = require('./utils/gameStateStore');

const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error('Missing DISCORD_TOKEN in environment (.env).');
}

const commandsDir = path.join(__dirname, 'commands');
const crashlogsDir = path.join(__dirname, 'crashlogs');
const queuesPath = path.join(__dirname, 'queues.json');

const COMMAND_PHASE_RULES = {
    startgame: [PHASES.SETUP, PHASES.END],
    endgame: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    startvote: [PHASES.DAY],
    endvote: [PHASES.VOTE],
    vote: [PHASES.VOTE],
    crowvote: [PHASES.NIGHT, PHASES.DAY],
    kill: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    kickplayer: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    leavegame: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    'move-all': [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    comeback: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    roles: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    rolescallout: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    changerole: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    cupidon: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    file: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    callout: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    win: [PHASES.END],
    alive: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
    myrole: [PHASES.NIGHT, PHASES.DAY, PHASES.VOTE],
};

function isAlivePlayer(userId) {
    const arr = readAssignments();
    const entry = arr.find(a => a.userId === userId);
    return Boolean(entry && entry.role !== 'Mort');
}

async function replyInteraction(interaction, msg, ephemeral = true) {
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: msg, ephemeral });
    }
    return interaction.reply({ content: msg, ephemeral });
}

async function isCommandAllowedInPhase(interaction) {
    const commandName = interaction.commandName;
    const allowedPhases = COMMAND_PHASE_RULES[commandName];
    if (!allowedPhases) return true;

    const gameState = readGameState();
    if (allowedPhases.includes(gameState.phase)) {
        return true;
    }

    const phaseLabel = PHASE_LABELS[gameState.phase] || gameState.phase;
    const allowedLabel = allowedPhases
        .map(p => PHASE_LABELS[p] || p)
        .join(', ');
    await interaction.reply({
        content: `Commande indisponible en phase ${phaseLabel}. Phases autorisees: ${allowedLabel}.`,
        ephemeral: true,
    });
    return false;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

if (!fs.existsSync(crashlogsDir)) fs.mkdirSync(crashlogsDir);

client.commands = new Collection();
for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') && f !== 'roles.js')) {
    const cmd = require(path.join(commandsDir, file));
    if (cmd.data) client.commands.set(cmd.data.name, cmd);
}

client.once('clientReady', () => console.log('Bot pret.'));

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'vote_select') {
        if (!isAlivePlayer(interaction.user.id)) {
            return interaction.reply({ content: 'Seuls les joueurs vivants peuvent voter.', ephemeral: true });
        }

        const result = await withVotesLock(() => {
            const session = readVotesSession();
            if (!session.isVotingActive) return { content: 'Pas de vote actif.' };

            const targetId = interaction.values[0];
            if (!isAlivePlayer(targetId)) return { content: 'La cible n est plus vivante.' };

            session.votes[interaction.user.id] = targetId;
            writeVotesSession(session);
            return { content: `Vote enregistre pour <@${targetId}>.` };
        });

        return interaction.reply({ content: result.content, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'vote_cancel') {
        if (!isAlivePlayer(interaction.user.id)) {
            return interaction.reply({ content: 'Commande reservee aux joueurs vivants.', ephemeral: true });
        }

        const result = await withVotesLock(() => {
            const session = readVotesSession();
            if (!session.isVotingActive) return { content: 'Pas de vote actif.' };

            if (session.votes[interaction.user.id]) {
                delete session.votes[interaction.user.id];
                writeVotesSession(session);
                return { content: 'Ton vote a ete annule.' };
            }

            return { content: 'Tu n avais pas encore vote.' };
        });

        return interaction.reply({ content: result.content, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('votehost_')) {
        const [prefix, action, amount] = interaction.customId.split('_');
        if (prefix !== 'votehost') return;

        const snapshot = await withVotesLock(() => readVotesSession());
        if (!snapshot.isVotingActive) {
            return interaction.reply({ content: 'Aucun vote actif.', ephemeral: true });
        }

        const hasGmRole = interaction.member.roles.cache.has(ROLE_IDS.GM);
        if (interaction.user.id !== snapshot.masterId && !hasGmRole) {
            return interaction.reply({ content: 'Ce panneau est reserve au host du vote.', ephemeral: true });
        }

        if (action === 'end') {
            const endVoteCmd = client.commands.get('endvote');
            if (!endVoteCmd) {
                return interaction.reply({ content: 'Commande /endvote introuvable.', ephemeral: true });
            }
            return endVoteCmd.execute(interaction);
        }

        if (action === 'cancel') {
            const cancelResult = await withVotesLock(() => {
                const session = readVotesSession();
                if (!session.isVotingActive) {
                    return { ok: false, message: 'Aucun vote actif.' };
                }

                const phaseAfterVote = session.phaseBeforeVote || PHASES.DAY;
                writeVotesSession({
                    isVotingActive: false,
                    voteType: null,
                    votes: {},
                    crowVote: session.crowVote,
                    masterId: null,
                    endTime: null,
                    phaseBeforeVote: null,
                });

                return { ok: true, phaseAfterVote };
            });

            if (!cancelResult.ok) {
                return interaction.reply({ content: cancelResult.message, ephemeral: true });
            }

            await setPhase(cancelResult.phaseAfterVote).catch(console.error);
            return interaction.reply({ content: 'Vote annule.', ephemeral: true });
        }

        if (action === 'extend') {
            const seconds = Number.parseInt(amount, 10);
            if (!Number.isInteger(seconds) || seconds <= 0) {
                return interaction.reply({ content: 'Extension invalide.', ephemeral: true });
            }

            const extendResult = await withVotesLock(() => {
                const session = readVotesSession();
                if (!session.isVotingActive) return { ok: false, message: 'Aucun vote actif.' };

                const now = Date.now();
                const base = session.endTime && session.endTime > now ? session.endTime : now;
                session.endTime = base + seconds * 1000;
                writeVotesSession(session);
                return { ok: true, remainingMs: session.endTime - now };
            });

            if (!extendResult.ok) {
                return interaction.reply({ content: extendResult.message, ephemeral: true });
            }

            scheduleVoteReminder(interaction.client, extendResult.remainingMs);

            const remainingSeconds = Math.ceil(extendResult.remainingMs / 1000);
            return interaction.reply({
                content: `Vote etendu de ${seconds}s. Temps restant: ${remainingSeconds}s.`,
                ephemeral: true,
            });
        }

        return interaction.reply({ content: 'Action inconnue.', ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('queue_')) {
        if (!fs.existsSync(queuesPath)) {
            return interaction.reply({ content: 'Aucune file.', ephemeral: true });
        }

        let state;
        try {
            state = JSON.parse(fs.readFileSync(queuesPath, 'utf8'));
        } catch {
            return interaction.reply({ content: 'Le fichier des files est invalide.', ephemeral: true });
        }

        const [, act, qId] = interaction.customId.split('_');
        const queue = state.queues?.[qId];
        if (!queue) {
            return interaction.reply({ content: 'File introuvable.', ephemeral: true });
        }

        const already = Object.values(state.queues).some(q => q.queue.includes(interaction.user.id));
        if (act === 'join' && already) {
            return interaction.reply({ content: 'Tu es deja inscrit dans une file.', ephemeral: true });
        }

        if (act === 'join') {
            if (!queue.open) {
                return interaction.reply({ content: 'Inscriptions fermees.', ephemeral: true });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (member.voice.channelId !== CHANNEL_IDS.WAITING_VOICE) {
                return interaction.reply({ content: 'Va dans le vocal d attente pour t inscrire.', ephemeral: true });
            }

            queue.queue.push(interaction.user.id);
            fs.writeFileSync(queuesPath, JSON.stringify(state, null, 2), 'utf8');
        } else if (act === 'leave') {
            queue.queue = queue.queue.filter(uid => uid !== interaction.user.id);
            fs.writeFileSync(queuesPath, JSON.stringify(state, null, 2), 'utf8');
        } else if (act === 'pos') {
            const pos = queue.queue.indexOf(interaction.user.id);
            if (pos === -1) {
                return interaction.reply({ content: 'Tu n es pas dans la file.', ephemeral: true });
            }
            return interaction.reply({ content: `Ta position: #${pos + 1}`, ephemeral: true });
        }

        if (act === 'join' || act === 'leave') {
            const ch = await interaction.guild.channels.fetch(CHANNEL_IDS.QUEUE_DISPLAY_TEXT);
            const msg = await ch.messages.fetch(queue.messageId);

            const newEmbed = EmbedBuilder.from(msg.embeds[0])
                .setDescription(`File en cours: **${queue.queue.length}** joueur(s) en attente.\n${
                    queue.open ? 'Clique sur Rejoindre depuis le vocal d attente.' : 'Inscriptions fermees.'
                }`)
                .setTimestamp();

            await msg.edit({ embeds: [newEmbed] });

            const txt = act === 'join'
                ? `Inscription validee. Position #${queue.queue.length}.`
                : 'Tu as quitte la file.';
            return interaction.reply({ content: txt, ephemeral: true });
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    const allowedInPhase = await isCommandAllowedInPhase(interaction);
    if (!allowedInPhase) return;

    try {
        await cmd.execute(interaction);
    } catch (err) {
        console.error(err);
        await replyInteraction(interaction, 'Erreur pendant la commande.', true);
    }
});

process.on('uncaughtException', err => {
    const p = path.join(crashlogsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}_crash.txt`);
    fs.writeFileSync(p, err.stack || err.toString());
    console.error('Uncaught:', err);
});

process.on('unhandledRejection', (reason, p) => {
    const f = path.join(crashlogsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}_promise.txt`);
    fs.writeFileSync(f, `${p}\n\n${reason}`);
    console.error('Promise:', p, 'reason:', reason);
});

client.login(token);

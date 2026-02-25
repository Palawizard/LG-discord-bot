const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    Collection,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
require('dotenv').config({ quiet: true });

const { ROLE_IDS, CHANNEL_IDS } = require('./config/discordIds');
const { HOST_PANEL_IDS } = require('./utils/hostPanel');
const { USER_PANEL_IDS, CUPIDON_PANEL_IDS } = require('./utils/userPanel');
const { roles: allRoles } = require('./commands/roles');
const { readAssignments } = require('./utils/assignmentsStore');
const { movePlayersToRoleChannels, movePlayersToVillage } = require('./utils/voiceMove');
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
    endgame: [PHASES.NIGHT, PHASES.DAY],
    startvote: [PHASES.DAY],
    endvote: [PHASES.DAY],
    vote: [PHASES.DAY],
    crowvote: [PHASES.NIGHT, PHASES.DAY],
    kill: [PHASES.NIGHT, PHASES.DAY],
    kickplayer: [PHASES.NIGHT, PHASES.DAY],
    leavegame: [PHASES.NIGHT, PHASES.DAY],
    'move-all': [PHASES.NIGHT, PHASES.DAY],
    comeback: [PHASES.NIGHT, PHASES.DAY],
    roles: [PHASES.NIGHT, PHASES.DAY],
    rolescallout: [PHASES.NIGHT, PHASES.DAY],
    changerole: [PHASES.NIGHT, PHASES.DAY],
    cupidon: [PHASES.NIGHT, PHASES.DAY],
    callout: [PHASES.NIGHT, PHASES.DAY],
    win: [PHASES.END],
    alive: [PHASES.NIGHT, PHASES.DAY],
    myrole: [PHASES.NIGHT, PHASES.DAY],
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

function normalizeReplyOptions(options, isDm) {
    if (!isDm || !options || typeof options === 'string') return options;
    if (!Object.prototype.hasOwnProperty.call(options, 'ephemeral')) return options;
    return { ...options, ephemeral: false };
}

async function resolvePanelGuild(interaction) {
    if (interaction.guild) return interaction.guild;

    const envGuildId = process.env.DISCORD_GUILD_ID;
    if (envGuildId) {
        return interaction.client.guilds.fetch(envGuildId).catch(() => null);
    }

    const cached = interaction.client.guilds.cache.first();
    if (cached) return cached;

    const fetched = await interaction.client.guilds.fetch().catch(() => null);
    return fetched ? fetched.first() : null;
}

function applyPanelReplyWrappers(ctx, baseInteraction, isDm) {
    ctx.reply = options => baseInteraction.reply(normalizeReplyOptions(options, isDm));
    ctx.deferReply = options => baseInteraction.deferReply(normalizeReplyOptions(options, isDm));
    ctx.editReply = options => baseInteraction.editReply(normalizeReplyOptions(options, isDm));
    ctx.followUp = options => baseInteraction.followUp(normalizeReplyOptions(options, isDm));
    return ctx;
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

function isHostOrGm(interaction) {
    const state = readGameState();
    const isHost = state.hostId && interaction.user.id === state.hostId;
    const isGm = interaction.member?.roles?.cache?.has(ROLE_IDS.GM);
    return Boolean(isHost || isGm);
}

async function ensureHostPanelAccess(interaction) {
    if (isHostOrGm(interaction)) return true;
    await interaction.reply({ content: 'Panneau reserve au host ou aux GM.', ephemeral: true });
    return false;
}

async function isActionAllowedInPhase(interaction, commandName) {
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
        content: `Action indisponible en phase ${phaseLabel}. Phases autorisees: ${allowedLabel}.`,
        ephemeral: true,
    });
    return false;
}

async function handlePhaseMovement(guild, phase) {
    if (!guild) return;
    if (phase === PHASES.NIGHT) {
        await movePlayersToRoleChannels(guild);
    } else if (phase === PHASES.DAY) {
        await movePlayersToVillage(guild);
    }
}

function buildPanelOptions(overrides = {}) {
    const {
        users = {},
        strings = {},
        integers = {},
        booleans = {},
        channels = {},
        subcommand = null,
    } = overrides;

    return {
        getUser: name => users[name] || null,
        getString: name => strings[name] || null,
        getInteger: name => (Number.isInteger(integers[name]) ? integers[name] : null),
        getBoolean: name => (typeof booleans[name] === 'boolean' ? booleans[name] : null),
        getChannel: name => channels[name] || null,
        getSubcommand: () => subcommand,
    };
}

function createPanelContext(interaction, commandName, overrides) {
    const ctx = Object.create(interaction);
    ctx.commandName = commandName;
    ctx.options = buildPanelOptions(overrides);
    return ctx;
}

async function runPanelCommand(interaction, commandName, overrides) {
    const allowed = await isActionAllowedInPhase(interaction, commandName);
    if (!allowed) return null;

    const command = client.commands.get(commandName);
    if (!command) {
        await interaction.reply({ content: `Commande /${commandName} introuvable.`, ephemeral: true });
        return null;
    }

    const ctx = createPanelContext(interaction, commandName, overrides);
    try {
        await command.execute(ctx);
    } catch (err) {
        console.error(err);
        await replyInteraction(interaction, 'Erreur pendant la commande.', true);
    }

    return null;
}

async function runUserPanelCommand(interaction, commandName, overrides = {}) {
    const base = interaction;
    const isDm = !base.guild;
    const guild = await resolvePanelGuild(base);
    if (!guild) {
        return base.reply({
            content: 'Impossible de trouver le serveur. Verifie DISCORD_GUILD_ID.',
            ephemeral: false,
        });
    }

    const ctx = createPanelContext(base, commandName, overrides);
    Object.defineProperty(ctx, 'guild', {
        value: guild,
        configurable: true,
    });
    applyPanelReplyWrappers(ctx, base, isDm);

    const allowed = await isActionAllowedInPhase(ctx, commandName);
    if (!allowed) return null;

    const command = client.commands.get(commandName);
    if (!command) {
        await ctx.reply({ content: `Commande /${commandName} introuvable.`, ephemeral: true });
        return null;
    }

    try {
        await command.execute(ctx);
    } catch (err) {
        console.error(err);
        await replyInteraction(ctx, 'Erreur pendant la commande.', true);
    }

    return null;
}

async function cancelVote(interaction) {
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
        await interaction.reply({ content: cancelResult.message, ephemeral: true });
        return;
    }

    await setPhase(cancelResult.phaseAfterVote).catch(console.error);
    await handlePhaseMovement(interaction.guild, cancelResult.phaseAfterVote);
    await interaction.reply({ content: 'Vote annule.', ephemeral: true });
}

async function extendVote(interaction, seconds) {
    if (!Number.isInteger(seconds) || seconds <= 0) {
        await interaction.reply({ content: 'Extension invalide.', ephemeral: true });
        return;
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
        await interaction.reply({ content: extendResult.message, ephemeral: true });
        return;
    }

    scheduleVoteReminder(interaction.client, extendResult.remainingMs);

    const remainingSeconds = Math.ceil(extendResult.remainingMs / 1000);
    await interaction.reply({
        content: `Vote etendu de ${seconds}s. Temps restant: ${remainingSeconds}s.`,
        ephemeral: true,
    });
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

    if (interaction.isButton() && Object.values(USER_PANEL_IDS).includes(interaction.customId)) {
        if (interaction.customId === USER_PANEL_IDS.MYROLE) {
            return runUserPanelCommand(interaction, 'myrole');
        }
        if (interaction.customId === USER_PANEL_IDS.ALIVE) {
            return runUserPanelCommand(interaction, 'alive');
        }
        if (interaction.customId === USER_PANEL_IDS.ROLESLIST) {
            return runUserPanelCommand(interaction, 'roleslist');
        }
        if (interaction.customId === USER_PANEL_IDS.LEAVEGAME) {
            return runUserPanelCommand(interaction, 'leavegame');
        }
    }

    if (interaction.isButton() && Object.values(CUPIDON_PANEL_IDS).includes(interaction.customId)) {
        if (interaction.customId === CUPIDON_PANEL_IDS.JOIN) {
            return runUserPanelCommand(interaction, 'cupidon', { subcommand: 'join' });
        }
        if (interaction.customId === CUPIDON_PANEL_IDS.LEAVE) {
            return runUserPanelCommand(interaction, 'cupidon', { subcommand: 'leave' });
        }
        if (interaction.customId === CUPIDON_PANEL_IDS.HELP) {
            return runUserPanelCommand(interaction, 'cupidon', { subcommand: 'help' });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('hostpanel_role_change:')) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const userId = interaction.customId.split(':')[1];
        const roleName = interaction.values[0];
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) {
            return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
        }
        return runPanelCommand(interaction, 'changerole', {
            users: { user },
            strings: { role: roleName },
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === HOST_PANEL_IDS.GAME_MENU) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const action = interaction.values[0];

        if (action === 'status') return runPanelCommand(interaction, 'status');
        if (action === 'phase_night') {
            return runPanelCommand(interaction, 'phase', { strings: { etat: PHASES.NIGHT } });
        }
        if (action === 'phase_day') {
            return runPanelCommand(interaction, 'phase', { strings: { etat: PHASES.DAY } });
        }
        if (action === 'callout') return runPanelCommand(interaction, 'callout');
        if (action === 'rolescallout') return runPanelCommand(interaction, 'rolescallout');
        if (action === 'endgame') return runPanelCommand(interaction, 'endgame');
        if (action === 'help') return runPanelCommand(interaction, 'help');

        return interaction.reply({ content: 'Action inconnue.', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === HOST_PANEL_IDS.VOTE_MENU) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const action = interaction.values[0];

        if (action === 'startvote_normal' || action === 'startvote_maire') {
            const voteType = action === 'startvote_maire' ? 'maire' : 'normal';
            const modal = new ModalBuilder()
                .setCustomId(`hostpanel_startvote:${voteType}`)
                .setTitle('Lancer un vote');
            const timeInput = new TextInputBuilder()
                .setCustomId('vote_time')
                .setLabel('Duree du vote (secondes, optionnel)')
                .setPlaceholder('Ex: 90')
                .setRequired(false)
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
            return interaction.showModal(modal);
        }

        if (action === 'crowvote') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_crowvote')
                    .setPlaceholder('Choisir une cible...')
                    .setMinValues(1)
                    .setMaxValues(1)
            );
            return interaction.reply({
                content: 'Choisis la cible du Corbeau.',
                components: [row],
                ephemeral: true,
            });
        }

        return interaction.reply({ content: 'Action inconnue.', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === HOST_PANEL_IDS.PLAYER_MENU) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const action = interaction.values[0];

        if (action === 'kill') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_kill')
                    .setPlaceholder('Choisir un joueur...')
                    .setMinValues(1)
                    .setMaxValues(1)
            );
            return interaction.reply({
                content: 'Choisis le joueur a eliminer.',
                components: [row],
                ephemeral: true,
            });
        }
        if (action === 'kick') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_kick')
                    .setPlaceholder('Choisir un joueur...')
                    .setMinValues(1)
                    .setMaxValues(1)
            );
            return interaction.reply({
                content: 'Choisis le joueur a expulser.',
                components: [row],
                ephemeral: true,
            });
        }
        if (action === 'changerole') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_change_role')
                    .setPlaceholder('Choisir un joueur...')
                    .setMinValues(1)
                    .setMaxValues(1)
            );
            return interaction.reply({
                content: 'Choisis le joueur dont tu veux changer le role.',
                components: [row],
                ephemeral: true,
            });
        }
        if (action === 'alive') return runPanelCommand(interaction, 'alive');
        if (action === 'roles') return runPanelCommand(interaction, 'roles');
        if (action === 'cupidon_add') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_cupidon_add')
                    .setPlaceholder('Choisir un joueur...')
                    .setMinValues(1)
                    .setMaxValues(1)
            );
            return interaction.reply({
                content: 'Choisis le joueur a ajouter aux amoureux.',
                components: [row],
                ephemeral: true,
            });
        }

        return interaction.reply({ content: 'Action inconnue.', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === HOST_PANEL_IDS.MISC_MENU) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const action = interaction.values[0];

        if (action === 'win') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('hostpanel_user_win')
                    .setPlaceholder('Choisir les gagnants...')
                    .setMinValues(1)
                    .setMaxValues(10)
            );
            return interaction.reply({
                content: 'Selectionne jusqu a 10 gagnants.',
                components: [row],
                ephemeral: true,
            });
        }
        return interaction.reply({ content: 'Action inconnue.', ephemeral: true });
    }

    if (interaction.isUserSelectMenu()) {
        if (!await ensureHostPanelAccess(interaction)) return;
        const targetIds = interaction.values;
        const firstId = targetIds[0];

        if (interaction.customId === 'hostpanel_user_kill') {
            const modal = new ModalBuilder()
                .setCustomId(`hostpanel_kill_reason:${firstId}`)
                .setTitle('Eliminer un joueur');
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Raison (optionnel)')
                .setRequired(false)
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'hostpanel_user_kick') {
            const modal = new ModalBuilder()
                .setCustomId(`hostpanel_kick_reason:${firstId}`)
                .setTitle('Expulser un joueur');
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Raison (optionnel)')
                .setRequired(false)
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'hostpanel_user_crowvote') {
            const user = interaction.users.get(firstId);
            if (!user) {
                return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
            }
            return runPanelCommand(interaction, 'crowvote', { users: { user } });
        }

        if (interaction.customId === 'hostpanel_user_cupidon_add') {
            const user = interaction.users.get(firstId);
            if (!user) {
                return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
            }
            return runPanelCommand(interaction, 'cupidon', {
                subcommand: 'add',
                users: { player: user },
            });
        }

        if (interaction.customId === 'hostpanel_user_change_role') {
            const roleOptions = allRoles.map(role => {
                const desc = role.roledesc ? role.roledesc.replace(/\s+/g, ' ').slice(0, 90) : null;
                return desc
                    ? { label: role.name, value: role.name, description: desc }
                    : { label: role.name, value: role.name };
            });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`hostpanel_role_change:${firstId}`)
                    .setPlaceholder('Choisir un role...')
                    .addOptions(roleOptions)
            );
            return interaction.reply({
                content: `Choisis le role pour <@${firstId}>.`,
                components: [row],
                ephemeral: true,
            });
        }

        if (interaction.customId === 'hostpanel_user_win') {
            const users = {};
            targetIds.slice(0, 10).forEach((id, index) => {
                const user = interaction.users.get(id);
                if (user) users[`joueur${index + 1}`] = user;
            });
            return runPanelCommand(interaction, 'win', { users });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('hostpanel_')) {
        if (!await ensureHostPanelAccess(interaction)) return;

        if (interaction.customId.startsWith('hostpanel_startvote:')) {
            const voteType = interaction.customId.split(':')[1];
            const raw = interaction.fields.getTextInputValue('vote_time').trim();
            const time = raw ? Number.parseInt(raw, 10) : null;
            if (raw && (!Number.isInteger(time) || time <= 0)) {
                return interaction.reply({ content: 'Duree invalide.', ephemeral: true });
            }
            return runPanelCommand(interaction, 'startvote', {
                strings: { type: voteType },
                integers: time ? { time } : {},
            });
        }

        if (interaction.customId.startsWith('hostpanel_kill_reason:')) {
            const userId = interaction.customId.split(':')[1];
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            if (!user) {
                return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
            }
            const reason = interaction.fields.getTextInputValue('reason').trim();
            return runPanelCommand(interaction, 'kill', {
                users: { player: user },
                strings: reason ? { raison: reason } : {},
            });
        }

        if (interaction.customId.startsWith('hostpanel_kick_reason:')) {
            const userId = interaction.customId.split(':')[1];
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            if (!user) {
                return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
            }
            const reason = interaction.fields.getTextInputValue('reason').trim();
            return runPanelCommand(interaction, 'kickplayer', {
                users: { player: user },
                strings: reason ? { reason } : {},
            });
        }
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
            return cancelVote(interaction);
        }

        if (action === 'extend') {
            const seconds = Number.parseInt(amount, 10);
            return extendVote(interaction, seconds);
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

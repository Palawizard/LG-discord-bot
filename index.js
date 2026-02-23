/* =====================  index.js (version complète)  ===================== */
const fs   = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error('Missing DISCORD_TOKEN in environment (.env).');
}

/* -------- Helper : le joueur est‑il vivant ? -------- */
function isAlivePlayer(userId) {
    const assignmentsPath = path.join(__dirname, 'roleAssignments.json');
    if (!fs.existsSync(assignmentsPath)) return false;
    try {
        const arr = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
        const e   = arr.find(a => a.userId === userId);
        return e && e.role !== 'Mort';
    } catch { return false; }
}

/* -------------------- Client Discord -------------------- */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

/* Crée le dossier crashlogs s’il n’existe pas */
if (!fs.existsSync('./crashlogs')) fs.mkdirSync('./crashlogs');

/* Chargement des commandes slash */
client.commands = new Collection();
for (const file of fs.readdirSync('./commands').filter(f => f.endsWith('.js') && f !== 'roles.js')) {
    const cmd = require(`./commands/${file}`);
    if (cmd.data) client.commands.set(cmd.data.name, cmd);
}

client.once('ready', () => console.log('🤖 Bot prêt !'));

/* -------------------- Gestion des interactions -------------------- */
client.on('interactionCreate', async interaction => {

    /* ===== 1) Sélecteur du vote ===== */
    if (interaction.isStringSelectMenu() && interaction.customId === 'vote_select') {
        if (!isAlivePlayer(interaction.user.id))
            return interaction.reply({ content: 'Seuls les joueurs vivants peuvent voter.', ephemeral: true });

        const votesPath = path.join(__dirname, 'votes.json');
        if (!fs.existsSync(votesPath))
            return interaction.reply({ content: 'Pas de vote actif.', ephemeral: true });

        const session = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
        if (!session.isVotingActive)
            return interaction.reply({ content: 'Le vote est clos.', ephemeral: true });

        session.votes[interaction.user.id] = interaction.values[0];
        fs.writeFileSync(votesPath, JSON.stringify(session, null, 2), 'utf8');
        return interaction.reply({ content: `✅ Vote enregistré pour <@${interaction.values[0]}>.`, ephemeral: true });
    }

    /* ===== 2) Bouton “Annuler mon vote” ===== */
    if (interaction.isButton() && interaction.customId === 'vote_cancel') {
        if (!isAlivePlayer(interaction.user.id))
            return interaction.reply({ content: 'Commande réservée aux joueurs vivants.', ephemeral: true });

        const votesPath = path.join(__dirname, 'votes.json');
        if (!fs.existsSync(votesPath))
            return interaction.reply({ content: 'Pas de vote actif.', ephemeral: true });

        const session = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
        if (!session.isVotingActive)
            return interaction.reply({ content: 'Le vote est clos.', ephemeral: true });

        if (session.votes[interaction.user.id]) {
            delete session.votes[interaction.user.id];
            fs.writeFileSync(votesPath, JSON.stringify(session, null, 2), 'utf8');
            return interaction.reply({ content: '🗑️ Ton vote a été annulé.', ephemeral: true });
        }
        return interaction.reply({ content: 'Tu n’avais pas encore voté.', ephemeral: true });
    }

/* ===== 3) Boutons File d’attente ===== */
else if (interaction.isButton() && interaction.customId.startsWith('queue_')) {
    const DATA_PATH      = path.join(__dirname, 'queues.json');
    const WAIT_VC_ID     = '1371903618390954185';
    const DISPLAY_CH_ID  = '1371152214193864876';

    if (!fs.existsSync(DATA_PATH))
        return interaction.reply({ content: 'Aucune file.', ephemeral: true });

    const state      = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const [ , act, qId ] = interaction.customId.split('_');
    const queue      = state.queues?.[qId];
    if (!queue)
        return interaction.reply({ content: 'File introuvable.', ephemeral: true });

    /* ---- empêcher multi‑file ---- */
    const already = Object.values(state.queues)
        .some(q => q.queue.includes(interaction.user.id));
    if (act === 'join' && already)
        return interaction.reply({ content: 'Tu es déjà inscrit dans une autre file.', ephemeral: true });

    /* ---- JOIN ---- */
    if (act === 'join') {
        if (!queue.open)
            return interaction.reply({ content: 'Inscriptions fermées.', ephemeral: true });

        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (member.voice.channelId !== WAIT_VC_ID)
            return interaction.reply({ content: 'Va dans le vocal d’attente pour t’inscrire.', ephemeral: true });

        queue.queue.push(interaction.user.id);
        fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), 'utf8');
    }

    /* ---- LEAVE ---- */
    else if (act === 'leave') {
        queue.queue = queue.queue.filter(uid => uid !== interaction.user.id);
        fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), 'utf8');
    }

    /* ---- POSITION ---- */
    else if (act === 'pos') {
        const pos = queue.queue.indexOf(interaction.user.id);
        if (pos === -1)
            return interaction.reply({ content: 'Tu n’es pas dans la file.', ephemeral: true });
        return interaction.reply({ content: `Ta position : #${pos + 1}`, ephemeral: true });
    }

    /* ---- mise à jour embed après join/leave ---- */
if (act === 'join' || act === 'leave') {
    const ch  = await interaction.guild.channels.fetch(DISPLAY_CH_ID);
    const msg = await ch.messages.fetch(queue.messageId);

    const newEmbed = EmbedBuilder.from(msg.embeds[0])            // ← conversion
        .setDescription(`File en cours : **${queue.queue.length}** joueur(s) en attente.\n`
                      + (queue.open
                          ? 'Clique sur **Rejoindre** depuis le vocal d’attente.'
                          : '⛔️ Inscriptions fermées.'))
        .setTimestamp();

    await msg.edit({ embeds: [newEmbed] });

    const txt = act === 'join'
        ? `Inscription validée ! Position #${queue.queue.length}.`
        : 'Tu as quitté la file.';
    return interaction.reply({ content: txt, ephemeral: true });
}

}


    /* ===== 4) Commandes slash ===== */
    if (!interaction.isCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try { await cmd.execute(interaction); }
    catch (err) {
        console.error(err);
        const msg = { content: 'Erreur pendant la commande !', ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.followUp(msg);
        else interaction.reply(msg);
    }
});

/* -------------------- Logs de crash -------------------- */
process.on('uncaughtException', err => {
    const p = `./crashlogs/${new Date().toISOString().replace(/[:.]/g, '-')}_crash.txt`;
    fs.writeFileSync(p, err.stack || err.toString());
    console.error('❌ Uncaught :', err);
});
process.on('unhandledRejection', (reason, p) => {
    const f = `./crashlogs/${new Date().toISOString().replace(/[:.]/g, '-')}_promise.txt`;
    fs.writeFileSync(f, `${p}\n\n${reason}`);
    console.error('❌ Promise :', p, 'reason:', reason);
});

/* -------------------- Connexion -------------------- */
client.login(token);

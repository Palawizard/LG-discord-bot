/***********************************************************************
 * /file                                                               *
 *  open channel:<vocal>      → crée une file (#file‑inscriptions)     *
 *  close id:<n>              → ferme la file                          *
 *  move  id:<n>              → déplace les 15 premiers                *
 **********************************************************************/
const { SlashCommandBuilder, EmbedBuilder,
        ActionRowBuilder, ButtonBuilder, ChannelType } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DATA_PATH       = path.join(__dirname, '../queues.json');
const WAITING_VC_ID   = '1371903618390954185';     // vocal d’attente
const DISPLAY_CH_ID   = '1371918291362381824';     // salon texte où poster l’embed
const GM_ROLE_ID      = '1204504643846012990';

/* ---------- helpers JSON ---------- */
function load() {
    if (!fs.existsSync(DATA_PATH))
        fs.writeFileSync(DATA_PATH, JSON.stringify({ lastId: 0, queues: {} }, null, 2));
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
        const fallback = { lastId: 0, queues: {} };
        fs.writeFileSync(DATA_PATH, JSON.stringify(fallback, null, 2), 'utf8');
        return fallback;
    }
}
function save(state) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), 'utf8');
}
function buildEmbed(id, qLen, open = true) {
    return new EmbedBuilder()
        .setColor(open ? 0x2ECC71 : 0xE74C3C)
        .setTitle(`⏳ File d’attente #${id}`)
        .setDescription(`File en cours : **${qLen}** joueur(s) en attente.\n`
                      + (open ? 'Clique sur **Rejoindre** depuis le vocal d’attente.'
                              : '⛔️ Inscriptions fermées.'))
        .setFooter({ text: `ID #${id}` })
        .setTimestamp();
}
function buildRow(id, disabled = false) {
    const mk = (customId, label, style) =>
        new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled);
    return new ActionRowBuilder().addComponents(
        mk(`queue_join_${id}`, 'Rejoindre', 1),
        mk(`queue_leave_${id}`, 'Quitter',   4),
        mk(`queue_pos_${id}`,   'Position',  2)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('file')
        .setDescription('Gestion des files d’attente.')
        .addSubcommand(sc =>
            sc.setName('open')
              .setDescription('Ouvre une nouvelle file')
              .addChannelOption(o =>
                  o.setName('channel')
                   .setDescription('Salon vocal destination')
                   .setRequired(true)))
        .addSubcommand(sc =>
            sc.setName('close')
              .setDescription('Ferme la file')
              .addIntegerOption(o =>
                  o.setName('id')
                   .setDescription('ID de la file')
                   .setRequired(true)))
        .addSubcommand(sc =>
            sc.setName('move')
              .setDescription('Déplace les 15 premiers')
              .addIntegerOption(o =>
                  o.setName('id')
                   .setDescription('ID de la file')
                   .setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const state = load();

        /* ----- Permissions GM pour open/close/move ----- */
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Commande réservée au Game Master.', ephemeral: true });

        /* =================== OPEN =================== */
        if (sub === 'open') {
            const dest = interaction.options.getChannel('channel');
            if (!dest || dest.type !== ChannelType.GuildVoice)
                return interaction.reply({ content: 'Choisissez un salon vocal valide.', ephemeral: true });

            const id = ++state.lastId;
            const display = await interaction.guild.channels.fetch(DISPLAY_CH_ID);
            const embed   = buildEmbed(id, 0, true);
            const row     = buildRow(id);

            const msg = await display.send({ embeds: [embed], components: [row] });

            state.queues[id] = { open: true, destId: dest.id, messageId: msg.id, queue: [] };
            save(state);

            return interaction.reply({ content: `File #${id} ouverte !`, ephemeral: true });
        }

        /* validate id */
        const qId = interaction.options.getInteger('id').toString();
        const queue = state.queues[qId];
        if (!queue) return interaction.reply({ content: 'ID de file invalide.', ephemeral: true });

        /* =================== CLOSE ================== */
        if (sub === 'close') {
            queue.open = false; save(state);

            const ch  = await interaction.guild.channels.fetch(DISPLAY_CH_ID);
            const msg = await ch.messages.fetch(queue.messageId);
            await msg.edit({ embeds: [buildEmbed(qId, queue.queue.length, false)],
                             components: [buildRow(qId, true)] });

            return interaction.reply({ content: `File #${qId} fermée.`, ephemeral: true });
        }

        /* =================== MOVE =================== */
        if (sub === 'move') {
            const toMove   = queue.queue.slice(0, 15);
            if (!toMove.length)
                return interaction.reply({ content: 'La file est vide.', ephemeral: true });

            const fails = [];
            for (const uid of toMove) {
                try {
                    const m = await interaction.guild.members.fetch(uid);
                    if (m.voice.channel) await m.voice.setChannel(queue.destId);
                    else fails.push(uid);
                } catch { fails.push(uid); }
            }
            queue.queue = queue.queue.slice(toMove.length).concat(fails);
            save(state);

            /* maj embed */
            const ch  = await interaction.guild.channels.fetch(DISPLAY_CH_ID);
            const msg = await ch.messages.fetch(queue.messageId);
            await msg.edit({ embeds: [buildEmbed(qId, queue.queue.length, queue.open)] });

            let txt = `Déplacé : ${toMove.length - fails.length}.`;
            if (fails.length) txt += ` ${fails.length} échec(s).`;
            return interaction.reply({ content: txt, ephemeral: true });
        }
    }
};

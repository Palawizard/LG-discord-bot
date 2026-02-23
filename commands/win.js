// commands/win.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const SCORES_PATH     = path.join(__dirname, '../scores.json');
const BOARD_META_PATH = path.join(__dirname, '../scoreboard.json');  // pour stocker l’ID du message du classement
const BOARD_CHANNEL_ID = '1371104389212930180';
const GM_ROLE_ID      = '1204504643846012990';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('win')
        .setDescription('Ajoute une victoire aux joueurs gagnants et met à jour le classement.')
        .addUserOption(o => o.setName('joueur1').setDescription('Premier joueur gagnant').setRequired(true))
        .addUserOption(o => o.setName('joueur2').setDescription('Deuxième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur3').setDescription('Troisième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur4').setDescription('Quatrième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur5').setDescription('Cinquième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur6').setDescription('Sixième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur7').setDescription('Septième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur8').setDescription('Huitième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur9').setDescription('Neuvième joueur gagnant').setRequired(false))
        .addUserOption(o => o.setName('joueur10').setDescription('Dixième joueur gagnant').setRequired(false)),

    async execute(interaction) {

        /* ─────────── Permissions ─────────── */
        if (!interaction.member.roles.cache.has(GM_ROLE_ID)) {
            await interaction.reply({ content: 'Vous n’avez pas la permission d’utiliser cette commande.', ephemeral: true });
            return;
        }

        /* ─────────── Liste des gagnants ─────────── */
        const winners = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`joueur${i}`);
            if (user && !winners.find(u => u.id === user.id)) winners.push(user);   // évite les doublons
        }

        /* ─────────── Lecture / création scores.json ─────────── */
        let scores = [];
        if (fs.existsSync(SCORES_PATH)) {
            try { scores = JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8')); }
            catch (e) { console.error('scores.json illisible :', e); }
        }

        /* ─────────── MAJ des scores ─────────── */
        winners.forEach(user => {
            const entry = scores.find(s => s.userId === user.id);
            if (entry) {
                entry.wins += 1;
                entry.username = user.username;          // rafraîchit le pseudo
            } else {
                scores.push({ userId: user.id, username: user.username, wins: 1 });
            }
        });

        /* ─────────── Sauvegarde scores.json ─────────── */
        try { fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2), 'utf8'); }
        catch (e) {
            console.error('Impossible de sauver scores.json :', e);
            await interaction.reply({ content: 'Erreur lors de la mise à jour des scores.', ephemeral: true });
            return;
        }

        /* ─────────── Construction de l’embed classement ─────────── */
        const sorted = [...scores].sort((a, b) => b.wins - a.wins);
        const description = sorted
            .map((s, i) => `**${i + 1}. <@${s.userId}> — ${s.wins} victoire${s.wins > 1 ? 's' : ''}**`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Classement des victoires')
            .setDescription(description)
            .setTimestamp();

        /* ─────────── Publication / édition du leaderboard ─────────── */
        const boardChannel = await interaction.guild.channels.fetch(BOARD_CHANNEL_ID).catch(() => null);
        if (!boardChannel) {
            await interaction.reply({ content: 'Canal du classement introuvable !', ephemeral: true });
            return;
        }

        let boardMeta = {};
        if (fs.existsSync(BOARD_META_PATH)) {
            try { boardMeta = JSON.parse(fs.readFileSync(BOARD_META_PATH, 'utf8')); }
            catch { boardMeta = {}; }
        }

        try {
            if (boardMeta.messageId) {
                // On tente d’éditer le message existant
                const msg = await boardChannel.messages.fetch(boardMeta.messageId);
                await msg.edit({ embeds: [embed] });
            } else {
                // Pas encore de message -> on envoie et on sauvegarde l’ID
                const msg = await boardChannel.send({ embeds: [embed] });
                boardMeta.messageId = msg.id;
                fs.writeFileSync(BOARD_META_PATH, JSON.stringify(boardMeta, null, 2), 'utf8');
            }
        } catch (err) {
            console.warn('Impossible de modifier le message du classement (probablement supprimé). Ré‑envoi…', err);
            const msg = await boardChannel.send({ embeds: [embed] });
            boardMeta.messageId = msg.id;
            fs.writeFileSync(BOARD_META_PATH, JSON.stringify(boardMeta, null, 2), 'utf8');
        }

        /* ─────────── Réponse à la commande ─────────── */
        let reply = '✅ Victoire enregistrée pour :\n';
        winners.forEach(u => {
            const entry = scores.find(s => s.userId === u.id);
            reply += `• **${u.username}** – ${entry.wins} victoire${entry.wins > 1 ? 's' : ''}\n`;
        });
        await interaction.reply({ content: reply, ephemeral: false });
    },
};
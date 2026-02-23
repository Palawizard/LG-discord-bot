/* ====================================================================== */
/*  commands/startvote.js                                                 */
/*  Lance un vote interactif (menu déroulant + bouton “Annuler mon vote”) */
/*  – Conserve un éventuel bonus Corbeau posé via /crowvote               */
/*  – Refuse de démarrer s’il existe déjà un vote actif                   */
/*  – Limite à 25 joueurs (limite Discord pour un StringSelectMenu)       */
/* ====================================================================== */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    EmbedBuilder
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const votesFilePath      = path.join(__dirname, '../votes.json');
const assignmentsPath    = path.join(__dirname, '../roleAssignments.json');

const GM_ROLE_ID         = '1204504643846012990';
const GENERAL_CHANNEL_ID = '1204493774072324120';   // #général

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startvote')
        .setDescription('Démarre une session de vote interactive.')
        .addStringOption(opt =>
            opt.setName('type')
               .setDescription('Type de vote')
               .setRequired(true)
               .addChoices(
                   { name: 'Normal', value: 'normal' },
                   { name: 'Maire',  value: 'maire' }))
        .addIntegerOption(opt =>
            opt.setName('time')
               .setDescription('Durée du vote en secondes (facultatif)')),

    async execute(interaction) {
        /* ---------- Vérification des permissions ---------- */
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Vous n’avez pas la permission.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        /* ---------- Récupération des joueurs encore vivants ---------- */
        let assignments = [];
        try { assignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8')); }
        catch { /* pas de partie / fichier absent */ }

        const vivantEntries = assignments.filter(a => a.role !== 'Mort');
        if (vivantEntries.length === 0)
            return interaction.editReply('Aucun joueur vivant ! Vote annulé.');

        if (vivantEntries.length > 25)
            return interaction.editReply('Plus de 25 vivants : utilisez plutôt la commande /vote.');

        /* ---------- Vérifier s’il existe déjà un vote actif ---------- */
        let previous = {};
        if (fs.existsSync(votesFilePath)) {
            try { previous = JSON.parse(fs.readFileSync(votesFilePath, 'utf8')); }
            catch { previous = {}; }
            if (previous.isVotingActive)
                return interaction.editReply('Un vote est déjà en cours. Utilisez /endvote avant de relancer.');
        }

        /* ---------- Conserver un éventuel bonus Corbeau ---------- */
        const preservedCrow = previous.crowVote && previous.crowVote.extraVotes > 0
                              ? previous.crowVote
                              : { userId: null, extraVotes: 0 };

        /* ---------- Création de la nouvelle session ---------- */
        const voteType = interaction.options.getString('type');
        const delay    = interaction.options.getInteger('time');

        const votingSession = {
            isVotingActive: true,
            voteType,                         // "normal" ou "maire"
            votes: {},                        // { voterId: targetId }
            crowVote: preservedCrow,          // bonus Corbeau conservé
            masterId: interaction.user.id,    // GM
            endTime: delay ? Date.now() + delay * 1_000 : null
        };
        fs.writeFileSync(votesFilePath, JSON.stringify(votingSession, null, 2), 'utf8');

        /* ---------- Construction de l’embed ---------- */
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🗳️ ${voteType === 'maire' ? 'Élection du Maire' : 'Vote du Village'}`)
            .setDescription('Choisissez un joueur dans le menu ci‑dessous.\n'
                           + 'Bouton rouge : annuler votre vote.')
            .setFooter({ text: delay ? `Temps : ${delay}s` : 'Pas de limite de temps' })
            .setTimestamp();

        /* ---------- Menu déroulant des cibles ---------- */
        const select = new StringSelectMenuBuilder()
            .setCustomId('vote_select')
            .setPlaceholder('Choisir un joueur…')
            .addOptions(
                await Promise.all(
                    vivantEntries.map(async entry => {
                        const member = await interaction.guild.members
                                                .fetch(entry.userId).catch(() => null);
                        return {
                            label: member ? member.displayName
                                           : `(inconnu ${entry.userId})`,
                            value: entry.userId
                        };
                    })
                )
            );

        /* ---------- Bouton Annuler ---------- */
        const cancelBtn = new ButtonBuilder()
            .setCustomId('vote_cancel')
            .setLabel('Annuler mon vote')
            .setStyle(4); // Danger

        /* ---------- Envoi dans #général ---------- */
        const rowSelect = new ActionRowBuilder().addComponents(select);
        const rowButton = new ActionRowBuilder().addComponents(cancelBtn);

        const general = await interaction.guild.channels.fetch(GENERAL_CHANNEL_ID);
        await general.send({ embeds: [embed], components: [rowSelect, rowButton] });

        await interaction.editReply('Le vote a été lancé !');

        /* ---------- Timer (rappel au GM) ---------- */
        if (delay) {
            setTimeout(async () => {
                const latest = JSON.parse(fs.readFileSync(votesFilePath, 'utf8'));
                if (latest.isVotingActive) {
                    const gm = await interaction.client.users.fetch(latest.masterId);
                    gm.send('⏰ Le temps du vote est écoulé ! Utilise /endvote pour conclure.')
                      .catch(console.error);
                }
            }, delay * 1_000);
        }
    }
};

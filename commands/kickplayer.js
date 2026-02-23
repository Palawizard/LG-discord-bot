const { SlashCommandBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const allRoles        = require('./roles.js').roles;          // chemin relatif = même dossier
const GM_ROLE_ID      = '1204504643846012990';                // rôle Game Master
const GENERAL_ID      = '1204493774072324120';                // #général
const VIVANT_ROLE_ID  = '1204495004203094016';
const MORT_ROLE_ID    = '1204494784585146378';
const MAIRE_ROLE_ID   = '1204502456768397442';
const MORT_CHANNEL_ID = allRoles.find(r => r.name === 'Mort').channelId;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickplayer')
        .setDescription('Expulse (tue) un joueur de la partie (GM uniquement).')
        .addUserOption(o =>
            o.setName('player')
             .setDescription('Joueur à expulser')
             .setRequired(true))
        .addStringOption(o =>
            o.setName('reason')
             .setDescription('Raison (facultatif)')),

    async execute(interaction) {

        /* ---------- Vérif de permission ---------- */
        if (!interaction.member.roles.cache.has(GM_ROLE_ID))
            return interaction.reply({ content: 'Commande réservée au Game Master.', ephemeral: true });

        if (!interaction.guild)
            return interaction.reply({ content: 'À utiliser dans un serveur.', ephemeral: true });

        const targetUser = interaction.options.getUser('player');
        const reason     = interaction.options.getString('reason') || 'Expulsé par le GM';

        const assignmentsPath = path.join(__dirname, '../roleAssignments.json');

        fs.readFile(assignmentsPath, 'utf8', async (err, data) => {
            if (err) {
                console.error('Lecture roleAssignments.json échouée :', err);
                return interaction.reply({ content: 'Erreur interne (lecture fichier).', ephemeral: true });
            }

            let assignments = JSON.parse(data);
            const entry     = assignments.find(a => a.userId === targetUser.id);

            if (!entry)
                return interaction.reply({ content: 'Ce joueur n’est pas dans la partie.', ephemeral: true });

            /* ---------- Opérations Discord ---------- */
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member)
                return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });

            // rôles
            await member.roles.remove([VIVANT_ROLE_ID, MAIRE_ROLE_ID]).catch(console.error);
            await member.roles.add(MORT_ROLE_ID).catch(console.error);

            // déplacement vocal : vers « Mort » puis retour
            const originalVocal = member.voice.channelId;
            if (originalVocal && member.voice.channel) {
                await member.voice.setChannel(MORT_CHANNEL_ID).catch(console.error);
                setTimeout(() => {
                    member.voice.setChannel(originalVocal).catch(console.error);
                }, 1000);
            }

            // DM au joueur
            member.send(`Tu as été expulsé de la partie : ${reason}`).catch(() => {});

            /* ---------- Mise à jour assignments.json ---------- */
            assignments = assignments.map(a =>
                a.userId === targetUser.id
                    ? { ...a, role: 'Mort', channelId: MORT_CHANNEL_ID }
                    : a
            );
            fs.writeFileSync(assignmentsPath, JSON.stringify(assignments, null, 2), 'utf8');

            /* ---------- Annonce publique ---------- */
            const general = await interaction.guild.channels.fetch(GENERAL_ID);
            general.send(`☠️ <@${targetUser.id}> a été **expulsé** par le Game Master (rôle initial : ${entry.role}).`);

            /* ---------- Réponse au GM ---------- */
            await interaction.reply({ content: 'Joueur expulsé avec succès.', ephemeral: true });
        });
    }
};

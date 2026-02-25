const roles = [
    { name: 'Chaman', channelId: '1204496939807150190', roledesc: 'Tu peux parler avec les morts.' },
    { name: 'Cupidon', channelId: '1204494507341783070', roledesc: 'Tu peux lier deux destins dans le village.' },
    { name: 'Voyante', channelId: '1204494586433642566', roledesc: "Chaque nuit, tu peux découvrir le rôle d'un joueur." },
    { name: 'Garde', channelId: '1204494691089780776', roledesc: 'Tu peux protéger une personne chaque nuit.' },
    {
        name: 'Sorciere',
        displayName: 'Sorcière',
        channelId: '1204494550530261112',
        roledesc: 'Une fois par partie, tu peux sauver la victime des loups. Tu peux aussi éliminer un joueur.',
    },
    {
        name: 'Corbeau',
        channelId: '1204494725667880960',
        roledesc: 'Tu peux ajouter 2 voix à la personne de ton choix pour le prochain vote, un tour sur trois. (Non utilisable au premier tour)',
    },
    { name: 'Chasseur', channelId: '1204494466573140008', roledesc: 'Quand tu meurs, tu peux tuer la personne de ton choix.' },
    { name: 'Mort', channelId: '1204494646265520211', roledesc: 'Décédé.' },
    {
        name: 'Tiguida',
        channelId: '1205555942104502385',
        roledesc: 'Un tour sur trois, tu peux manger du maquillage et bouffer du parfum. Tu sens tellement bon que tu ne peux pas être voté lors du vote du village.',
    },
    {
        name: 'Terroriste',
        channelId: '1205555057463136347',
        roledesc: 'Si tu te fais éliminer le premier jour par le vote du village, tu gagnes la partie. Sinon, tu deviens un simple villageois.',
    },
    {
        name: 'Enfant sauvage',
        channelId: '1205554854756487228',
        roledesc: 'Tu choisis un joueur en début de partie. Si ce joueur est tué par un loup, tu deviens un loup.',
    },
    {
        name: 'Assassin',
        channelId: '1205554512727908362',
        roledesc: 'Tu peux tuer deux personnes pendant la partie, et tu ne peux pas te faire voter par les loups.',
    },
    {
        name: 'Renard',
        channelId: '1205554112348029018',
        roledesc: "Tu demandes au Game Master si trois personnes sont des loups. Si l'un d'entre eux en est un, tu peux réutiliser ton pouvoir au prochain tour. Sinon, tu deviens un simple villageois.",
    },
    // Loups
    {
        name: 'Loups',
        channelId: '1204494366970744894',
        roledesc: "Tu peux te réunir la nuit avec le ou les autres loups afin d'éliminer un villageois.",
    },
    { name: 'Loup Blanc', channelId: '1204494366970744894', roledesc: 'Pas encore implémenté.' },
    // Add more roles as needed
];

function findRoleByName(roleName) {
    return roles.find(role => role.name === roleName) || null;
}

function getRoleDisplayName(roleName) {
    const role = findRoleByName(roleName);
    return role?.displayName || role?.name || roleName;
}

module.exports = {
    roles,
    findRoleByName,
    getRoleDisplayName,
};

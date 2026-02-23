const fs = require('fs');
const path = require('path');

const assignmentsPath = path.join(__dirname, '..', 'roleAssignments.json');

function readAssignments() {
    if (!fs.existsSync(assignmentsPath)) return [];

    try {
        const raw = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function writeAssignments(assignments) {
    const safe = Array.isArray(assignments) ? assignments : [];
    fs.writeFileSync(assignmentsPath, JSON.stringify(safe, null, 2), 'utf8');
}

function findAssignment(assignments, userId) {
    if (!Array.isArray(assignments)) return null;
    return assignments.find(a => a && a.userId === userId) || null;
}

module.exports = {
    assignmentsPath,
    readAssignments,
    writeAssignments,
    findAssignment,
};

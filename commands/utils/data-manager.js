import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadGuildData(guildId) {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

export function saveGuildData(guildId, data) {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

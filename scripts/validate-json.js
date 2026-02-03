
import fs from 'fs';

try {
    const users = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
    console.log(`Loaded ${users.length} users.`);

    users.forEach((u, i) => {
        const id = parseInt(u.id);
        if (isNaN(id)) {
            console.error(`❌ Row ${i} has invalid ID: ${u.id}`);
        }
        if (typeof u.id !== 'number') {
            console.warn(`⚠️ Row ${i} ID is type ${typeof u.id}: ${u.id}`);
        }
    });
    console.log('✅ Users check complete.');

} catch (e) {
    console.error(e);
}

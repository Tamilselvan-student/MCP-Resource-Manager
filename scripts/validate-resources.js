
import fs from 'fs';

try {
    const resources = JSON.parse(fs.readFileSync('resources_dump.json', 'utf8'));
    console.log(`Loaded ${resources.length} resources.`);

    resources.forEach((r, i) => {
        const id = parseInt(r.id);
        if (isNaN(id)) {
            console.error(`❌ Resource ${i} has invalid ID: ${r.id}`);
        }
        if (id > 2147483647) {
            console.error(`❌ Resource ${i} ID too large for INT4: ${id}`);
        }

        // Check created_by
        if (typeof r.created_by !== 'string') {
            console.warn(`⚠️ Resource ${i} created_by is ${typeof r.created_by}:`, r.created_by);
        }
    });
    console.log('✅ Resources check complete.');

} catch (e) {
    console.error(e);
}

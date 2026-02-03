#!/usr/bin/env node

/**
 * Script to update all references from id/user_id to uuid
 * This is a comprehensive migration for the UUID schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
    // SQL queries - SELECT statements
    { from: /SELECT\s+id,\s+user_id,/gi, to: 'SELECT uuid,' },
    { from: /SELECT\s+user_id,/gi, to: 'SELECT uuid,' },
    { from: /SELECT\s+id\s+FROM\s+users/gi, to: 'SELECT uuid FROM users' },

    // SQL queries - WHERE clauses
    { from: /WHERE\s+id\s*=\s*\$1/gi, to: 'WHERE uuid = $1' },
    { from: /WHERE\s+user_id\s*=\s*\$1/gi, to: 'WHERE uuid = $1' },
    { from: /WHERE\s+user_id\s*=\s*\$2/gi, to: 'WHERE uuid = $2' },

    // SQL queries - INSERT statements
    { from: /INSERT\s+INTO\s+users\s*\(\s*user_id,/gi, to: 'INSERT INTO users (username,' },
    { from: /INSERT\s+INTO\s+admin_grants\s*\(\s*user_id,/gi, to: 'INSERT INTO admin_grants (user_uuid,' },

    // JavaScript/TypeScript object access
    { from: /targetUser\.user_id/g, to: 'targetUser.uuid' },
    { from: /targetUser\.id/g, to: 'targetUser.uuid' },
    { from: /user\.user_id/g, to: 'user.uuid' },
    { from: /user\.id(?!entity)/g, to: 'user.uuid' }, // Avoid replacing "user.identity"
    { from: /newUser\.id/g, to: 'newUser.uuid' },
    { from: /u\.user_id/g, to: 'u.uuid' },

    // Function parameters and variables
    { from: /const\s+userId\s*=\s*`user:/g, to: '// Removed user_id generation: const userId = `user:' },

    // Comments
    { from: /user_id\s+\(string/gi, to: 'uuid (string' },
    { from: /Use\s+user_id/gi, to: 'Use uuid' },
];

const filesToUpdate = [
    'src/chat/command-executor.ts',
    'src/chat/nlp-parser.ts',
    'src/server.ts',
];

function updateFile(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let changeCount = 0;

    for (const { from, to } of replacements) {
        const matches = content.match(from);
        if (matches) {
            changeCount += matches.length;
            content = content.replace(from, to);
        }
    }

    if (changeCount > 0) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Updated ${filePath} (${changeCount} changes)`);
    } else {
        console.log(`ℹ️  No changes needed in ${filePath}`);
    }
}

console.log('🔧 Starting UUID migration...\n');

for (const file of filesToUpdate) {
    updateFile(file);
}

console.log('\n✅ Migration complete!');
console.log('\n⚠️  IMPORTANT: Review the changes and run `npm run build` to compile.');

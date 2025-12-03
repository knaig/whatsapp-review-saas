// extract_env.js
// Usage: node extract_env.js [path-to-env]
// If no path is provided, defaults to './.env.local'
// Prints a JSON object of key/value pairs to stdout.

const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, { encoding: 'utf8' });
    const lines = content.split(/\r?\n/);
    const env = {};
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue; // skip empty/comment lines
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue; // malformed line
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

const envPath = process.argv[2] || path.resolve(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
    console.error(`File not found: ${envPath}`);
    process.exit(1);
}

const envObj = parseEnvFile(envPath);
console.log(JSON.stringify(envObj, null, 2));

// Adds a strict Content-Security-Policy to build/index.html after `react-scripts build`.
// Inline scripts emitted by the build are allowed by hash only, and the app may only
// connect to its own origin and to the API / Socket.IO origins it was built for.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../build/index.html');
let html = fs.readFileSync(file, 'utf8');

const scriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(([, code]) => `'sha256-${crypto.createHash('sha256').update(code).digest('base64')}'`);

const origins = new Set();
for (const url of [process.env.REACT_APP_API_URL || 'http://localhost:3001/api', process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001']) {
  const { origin, protocol } = new URL(url);
  origins.add(origin);
  origins.add(origin.replace(protocol, protocol === 'https:' ? 'wss:' : 'ws:'));
}

const policy = [
  "default-src 'self'",
  `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${[...origins].join(' ')}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
fs.writeFileSync(file, html);
console.log('Content-Security-Policy added to build/index.html');

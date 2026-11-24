import fs from 'node:fs';import assert from 'node:assert/strict';
const sw=fs.readFileSync('sw.js','utf8');for(const [,p] of sw.matchAll(/'\.\/([^']+)'/g))assert.ok(fs.existsSync(p),'Missing PWA asset: '+p);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));for(const i of manifest.icons)assert.ok(fs.existsSync(i.src),'Missing icon: '+i.src);

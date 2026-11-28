import fs from 'node:fs';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const assetPath=p=>fileURLToPath(new URL(p,root));
assert.equal(assetPath('css/app.css?v=148'),assetPath('css/app.css'));
assert.equal(assetPath('css/app.css#theme'),assetPath('css/app.css'));
assert.ok(!fs.existsSync(assetPath('css/__missing_asset__.css?v=148')));
const sw=fs.readFileSync('sw.js','utf8');for(const [,p] of sw.matchAll(/'\.\/([^']+)'/g))assert.ok(fs.existsSync(assetPath(p)),'Missing PWA asset: '+p);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));for(const i of manifest.icons)assert.ok(fs.existsSync(assetPath(i.src)),'Missing icon: '+i.src);

assert.match(sw,/const MARKET_CACHE=/);
assert.match(sw,/if\(!publicMarket\)return/);
assert.match(sw,/\|\|Response\.error\(\)\)\)/);

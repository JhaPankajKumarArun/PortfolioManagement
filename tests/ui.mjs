import assert from 'node:assert/strict';
import {renderView,showSheet,hideSheet} from '../js/ui/views.mjs';
const nodes=Object.fromEntries(['#app','#ttl','#rfb','#sheet'].map(k=>[k,{classList:{toggle(){}}}]));
const document={querySelector:k=>nodes[k],querySelectorAll:()=>[]};
renderView({document,tab:'tax',html:'test',busy:false});assert.equal(nodes['#app'].innerHTML,'test');assert.equal(nodes['#ttl'].textContent,'Tax');showSheet(document,'hello');assert.match(nodes['#sheet'].innerHTML,/hello/);hideSheet(document);assert.equal(nodes['#sheet'].innerHTML,'');

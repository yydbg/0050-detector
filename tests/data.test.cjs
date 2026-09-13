const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),E=require('../site/engine.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('site/data.js','utf8'),sandbox);const d=E.validate(sandbox.window.MARKET_DATA);const a=E.enrich(d.rows);
for(const n of E.MAS){assert.ok(E.detect(a,a.length-1,n));}
console.log('PASS: published dataset',d.rows.length,'bars, last date',d.rows.at(-1).date);

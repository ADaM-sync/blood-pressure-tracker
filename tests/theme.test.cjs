const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../theme.js'),'utf8');

function setup({saved=null,dark=false,blocked=false}={}) {
  const root = {dataset:{}};
  const meta = {};
  const button = {attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this[k]=fn;}};
  const doc = {documentElement:root,querySelector:()=>meta,getElementById:()=>button,
    addEventListener(k,fn){this[k]=fn;}};
  const media = {matches:dark,addEventListener(k,fn){this[k]=fn;}};
  const values = new Map(saved ? [['bp-tracker-theme',saved]] : []);
  const storage = {getItem(k){if(blocked)throw Error('blocked');return values.get(k);},
    setItem(k,v){if(blocked)throw Error('blocked');values.set(k,v);}};
  vm.runInNewContext(source,{window:{matchMedia:()=>media},document:doc,localStorage:storage});
  return {root,meta,button,doc,media,values};
}

test('first launch follows system and keeps following it until manually changed',()=>{
  const s=setup({dark:true});
  assert.equal(s.root.dataset.theme,'dark');
  assert.equal(s.meta.content,'#101C16');
  s.doc.DOMContentLoaded();
  assert.equal(s.button.attributes['aria-pressed'],'true');
  s.media.change({matches:false});
  assert.equal(s.root.dataset.theme,'light');
  assert.equal(s.button.attributes['aria-pressed'],'false');
});

test('saved choice wins over system, clicking persists the next theme',()=>{
  const s=setup({dark:false,saved:'dark'});
  s.doc.DOMContentLoaded();
  assert.equal(s.root.dataset.theme,'dark');
  s.media.change({matches:false});
  assert.equal(s.root.dataset.theme,'dark');
  s.button.click();
  assert.equal(s.root.dataset.theme,'light');
  assert.equal(s.values.get('bp-tracker-theme'),'light');
  assert.equal(s.meta.content,'#EAF4EC');
  s.button.click();
  assert.equal(s.values.get('bp-tracker-theme'),'dark');
});

test('unavailable storage does not prevent launch or toggling',()=>{
  const s=setup({blocked:true});s.doc.DOMContentLoaded();s.button.click();
  assert.equal(s.root.dataset.theme,'dark');
  s.media.change({matches:false});
  assert.equal(s.root.dataset.theme,'dark');
});

test('unknown stored value falls back to the system appearance',()=>{
  assert.equal(setup({saved:'invalid',dark:true}).root.dataset.theme,'dark');
});

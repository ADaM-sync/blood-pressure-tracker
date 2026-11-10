const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('online navigation serves new installation metadata rather than stale cached HTML',async()=>{
  const handlers={}; const stored=new Map([['./index.html',new Response('old metadata')]]);
  const cache={match:async key=>stored.get(key.url||key),put:async(key,value)=>stored.set(key.url||key,value)};
  let offline=false;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8'),{
    self:{location:{origin:'https://example.com'},addEventListener:(key,fn)=>handlers[key]=fn},
    caches:{open:async()=>cache},URL,Response,
    fetch:async()=>{if(offline)throw Error('offline');return new Response('new metadata');}
  });
  const request={url:'https://example.com/?v=3.1',method:'GET',mode:'navigate'};
  let response;
  handlers.fetch({request,respondWith:p=>response=p});
  assert.equal(await (await response).text(),'new metadata');
  offline=true;
  handlers.fetch({request:{...request,url:'https://example.com/other'},respondWith:p=>response=p});
  assert.equal(await (await response).text(),'new metadata');
});

test('installed app has a bounded startup fallback and device-specific real PNG links',()=>{
  const splash={hidden:true};const added=[];let dismiss;
  const links=['portrait','landscape'].map(o=>({href:`https://example.com/${o}-light.png?v=3.1`,media:`(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: ${o})`}));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ios-install.js'),'utf8'),{
    window:{navigator:{standalone:true},matchMedia:()=>({matches:true}),setTimeout:fn=>dismiss=fn},
    document:{getElementById:()=>splash,querySelectorAll:()=>links,createElement:()=>({}),head:{appendChild:link=>added.push(link)}}
  });
  assert.equal(splash.hidden,false);
  assert.equal(added.length,2);
  assert.ok(added.every(link=>link.href.startsWith('https://')&&link.rel==='apple-touch-startup-image'));
  dismiss();assert.equal(splash.hidden,true);
});

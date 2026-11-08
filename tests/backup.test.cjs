const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const sample = {
  id: 1, date: '2026-11-09', time: '08:05', systolic: 120,
  diastolic: 80, pulse: 72, notes: 'صباح الخير 🌿\nA "note" <script>test</script>',
  createdAt: '2026-11-09T05:05:00.000Z'
};
const backup = readings => JSON.stringify({ app: 'BPTracker', version: 1, readings });

function setup() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false, textContent: '', dataset: {}, files: [],
      listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }
    });
    return elements.get(id);
  };
  const downloads = [];
  let blob;
  const context = vm.createContext({
    document: {
      getElementById: element,
      body: { appendChild() {} },
      createElement() { return { click() { downloads.push(this.download); }, remove() {} }; }
    },
    navigator: {}, window: {}, console: { log() {}, error() {} }, Blob,
    URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() {}, alert() {}, confirm: () => true
  });
  // Avoid opening a browser database at load time; the production handlers remain intact.
  vm.runInContext(source.replace(/^initializeApp\(\);$/m, ''), context);
  return { context, element, downloads, getBlob: () => blob };
}

test('readable JSON round trip preserves dates, pulse, multiline and Unicode notes, but not local IDs', () => {
  const { context } = setup();
  const [reading] = context.parseBackup(backup([sample]));
  const { id, ...expected } = sample;
  assert.deepEqual(JSON.parse(JSON.stringify(reading)), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(context.parseBackup(backup([reading])))), [expected]);
});

test('accepts UTF-8 BOM and empty backups', () => {
  const { context } = setup();
  assert.equal(context.parseBackup('\uFEFF' + backup([sample])).length, 1);
  assert.equal(context.parseBackup(backup([])).length, 0);
});

test('rejects malformed, unrelated, future-version and oversized record sets', () => {
  const { context } = setup();
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({app:'BPTracker',version:2,readings:[]}),
    backup(Array(50001).fill(sample))]) assert.throws(() => context.parseBackup(text));
});

test('rejects every invalid record before any import begins', () => {
  const { context } = setup();
  for (const change of [
    { date:'2026-02-29' }, {date:'2026-13-01'}, {date:'2026-04-31'},
    {time:'24:00'}, {time:'08:60'}, {time:'8:05'}, {systolic:'120'},
    {systolic:49}, {diastolic:201}, {pulse:19}, {pulse:72.5},
    {notes:null}, {createdAt:'invalid'}, {createdAt:'2026-02-30T05:05:00.000Z'}
  ]) assert.throws(() => context.parseBackup(backup([sample, {...sample,...change}])));
  assert.doesNotThrow(() => context.parseBackup(backup([{...sample,date:'2024-02-29'}])));
});

test('duplicate keys ignore device IDs and retain distinct notes and creation times', () => {
  const { context } = setup();
  assert.equal(context.readingFingerprint(sample), context.readingFingerprint({...sample,id:999}));
  assert.notEqual(context.readingFingerprint(sample), context.readingFingerprint({...sample,notes:'Different'}));
  assert.notEqual(context.readingFingerprint(sample), context.readingFingerprint({...sample,createdAt:'2026-11-09T05:06:00.000Z'}));
});

test('export handler downloads all readings as an importable file without IDs', async () => {
  const s = setup();
  s.context.seed = [sample, {...sample, id:2, date:'2025-01-01'}];
  vm.runInContext('getAllReadings = async () => seed', s.context);
  await s.element('exportButton').listeners.click();
  const text = await s.getBlob().text();
  const data = JSON.parse(text);
  assert.equal(data.readings.length, 2);
  assert.equal(data.readings[0].id, undefined);
  assert.equal(s.context.parseBackup(text).length, 2);
  assert.match(s.downloads[0], /^bp-tracker-backup-.*\.json$/);
  assert.equal(s.element('exportButton').disabled, false);
});

test('invalid or oversized files and cancellation never reach database writes', async () => {
  const s = setup();
  s.context.writes = 0;
  vm.runInContext('mergeBackupReadings = async () => { writes++; }', s.context);
  for (const file of [
    {size:10*1024*1024+1, text:async()=>backup([sample])},
    {size:100, text:async()=>'{'},
    {size:100, text:async()=>backup([sample,{...sample,pulse:0}])},
    {size:100, text:async()=>backup([])}
  ]) {
    s.element('importFile').files = [file];
    await s.element('importFile').listeners.change();
  }
  s.context.confirm = () => false;
  s.element('importFile').files = [{size:100,text:async()=>backup([sample])}];
  await s.element('importFile').listeners.change();
  assert.equal(s.context.writes, 0);
  assert.equal(s.element('importFile').value, '');
  assert.equal(s.element('importButton').disabled, false);
});

test('import success refreshes history and reports counts; failures report no writes', async () => {
  const s = setup();
  s.context.incoming = null;
  vm.runInContext(`
    mergeBackupReadings = async readings => { incoming = readings; return {added:1,skipped:2}; };
    refreshApp = async () => {};
  `, s.context);
  s.element('importFile').files = [{size:100,text:async()=>backup([sample])}];
  await s.element('importFile').listeners.change();
  assert.equal(s.context.incoming[0].id, undefined);
  assert.match(s.element('backupStatus').textContent, /1 added, 2 duplicate/);
  vm.runInContext('mergeBackupReadings = async () => { throw new Error("storage full"); }', s.context);
  await s.element('importFile').listeners.change();
  assert.match(s.element('backupStatus').textContent, /No readings were added/);
  assert.equal(s.element('importButton').disabled, false);
});

test('merge skips duplicates in the database and within a file, and waits for commit', async () => {
  const s = setup();
  const inserted = [];
  const request = { result:[sample] };
  const transaction = {objectStore: () => ({
    getAll: () => request,
    add: reading => inserted.push(reading)
  })};
  s.context.database = { transaction: () => transaction };
  vm.runInContext('db = database', s.context);
  const changed = {...sample, notes:'A separate reading'};
  let resolved = false;
  const pending = s.context.mergeBackupReadings(s.context.parseBackup(backup([sample,changed,changed])))
    .then(result => { resolved = true; return result; });
  request.onsuccess();
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].id, undefined);
  transaction.oncomplete();
  assert.deepEqual(JSON.parse(JSON.stringify(await pending)), {added:1,skipped:2});
});

test('an aborted database transaction rejects instead of reporting a partial success', async () => {
  const s = setup();
  const request = { result:[] };
  const transaction = {error: new Error('Quota exceeded'), objectStore: () => ({
    getAll: () => request, add() {}
  })};
  s.context.database = {transaction: () => transaction};
  vm.runInContext('db = database', s.context);
  const pending = s.context.mergeBackupReadings([sample]);
  request.onsuccess();
  transaction.onabort();
  await assert.rejects(pending, /Quota exceeded/);
});

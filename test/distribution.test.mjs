import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const extension=path.join(root,'extension'),manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
assert.equal(manifest.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
assert.equal(manifest.manifest_version,3);assert.equal(manifest.side_panel.default_path,'sidepanel.html');
assert.deepEqual([...manifest.permissions].sort(),['activeTab','scripting','sidePanel','storage'].sort());
assert.equal(manifest.externally_connectable,undefined);assert.equal(manifest.content_scripts,undefined);
for(const name of fs.readdirSync(extension)){
  const source=fs.readFileSync(path.join(extension,name),'utf8');
  assert.ok(!/EDGE_BRIDGE|runtime-config|\/bridge\/|8769|\/Users\/|OpenWebUIRuntime/.test(source),'No private desktop or broker dependency: '+name);
  if(name.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(extension,name)]);
}
const html=fs.readFileSync(path.join(extension,'sidepanel.html'),'utf8');
assert.ok(!/<iframe\b/i.test(html));
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(extension,match[1])),'Bundled asset exists: '+match[1]);
let options,behavior,network=0;
const background=vm.createContext({chrome:{sidePanel:{setOptions:async x=>{options=x;},setPanelBehavior:async x=>{behavior=x;}}},fetch:()=>{network++;throw Error('No local bridge polling');}});
vm.runInContext(fs.readFileSync(path.join(extension,manifest.background.service_worker),'utf8'),background);
await Promise.resolve();assert.equal(options.path,'sidepanel.html');assert.equal(behavior.openPanelOnActionClick,true);assert.equal(network,0);
console.log('PASS: public standalone runtime, narrow bootstrap, no desktop credentials/dependencies, complete bundled assets, JavaScript syntax');

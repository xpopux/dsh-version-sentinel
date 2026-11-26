import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { makeHandler, locateInstallation, apply } from './index.js';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Host activation locates the actual CLI without tool-only environment variables', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'dsh-host-entry-'));
  try {
    await mkdir(path.join(root,'lib'));
    await writeFile(path.join(root,'lib','bin.js'),'// CLI fixture');
    await writeFile(path.join(root,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh',version:'0.2.3-alpha.2'}));
    assert.equal(locateInstallation(['node','lib/bin.js'],root),root);
    assert.equal(locateInstallation(['node',path.join(root,'lib','bin.js')],os.tmpdir()),root);
    await writeFile(path.join(root,'package.json'),JSON.stringify({name:'unrelated',version:'1.0.0'}));
    assert.throws(()=>locateInstallation(['node','lib/bin.js'],root),/not a verified/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('activation without DSH_INSTALL_DIR registers its route and performs startup check', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'dsh-host-activation-'));
  const originalEntry=process.argv[1], originalEnv=process.env.DSH_INSTALL_DIR, originalFetch=globalThis.fetch;
  const cleanup=[], routes=[], tools=[]; let checks=0;
  try {
    await mkdir(path.join(root,'lib'));
    await writeFile(path.join(root,'lib','bin.js'),'// CLI fixture');
    await writeFile(path.join(root,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh',version:'0.2.3-alpha.2'}));
    process.argv[1]=path.join(root,'lib','bin.js'); delete process.env.DSH_INSTALL_DIR;
    globalThis.fetch=async()=>{checks++;return {ok:true,text:async()=>JSON.stringify({name:'@deepseek-ai/dsh',versions:{},time:{}})};};
    apply({effect(fn){cleanup.push(fn());},webServer:{register(route){routes.push(route);return ()=>{};},getOrigin:()=>origin},tools:{register(tool){tools.push(tool);return ()=>{};}}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(routes[0].path,'/api/local-dsh-update-center'); assert.equal(routes[0].auth,'required');
    assert.equal(tools[0].name,'dsh_update_check'); assert.equal(checks,1);
    assert.equal((await tools[0].execute()).current,'0.2.3-alpha.2');
  } finally {
    for(const dispose of cleanup.reverse()) await dispose?.();
    process.argv[1]=originalEntry; if(originalEnv===undefined) delete process.env.DSH_INSTALL_DIR; else process.env.DSH_INSTALL_DIR=originalEnv;
    globalThis.fetch=originalFetch; await rm(root,{recursive:true,force:true});
  }
});
const origin='http://127.0.0.1:3090',base='/api/local-dsh-update-center';
async function call({method='GET',path=base,owner=true,headers={},body=''}={},service={snapshot:()=>({current:'0.2.3-alpha.2'}),check:async()=>({checked:true}),prepare:async version=>({version})}) {
  const req=Readable.from(body?[Buffer.from(body)]:[]);Object.assign(req,{method,url:path,headers});
  const result={};const res={writeHead(code,headers){result.code=code;result.headers=headers;},end(body){result.body=JSON.parse(body);}};
  await makeHandler(service,()=>origin)(req,res,owner?{principal:{kind:'owner'}}:undefined);return result;
}
const post={origin,'x-dsh-update':'1','content-type':'application/json'};
test('owner state is readable and no-store',async()=>{const r=await call();assert.equal(r.code,200);assert.equal(r.body.current,'0.2.3-alpha.2');assert.equal(r.headers['Cache-Control'],'no-store');});
test('non-owner is denied',async()=>assert.equal((await call({owner:false})).code,403));
test('foreign origin and missing explicit header are denied',async()=>{for(const headers of [{...post,origin:'https://evil.test'},{origin,'content-type':'application/json'},{}]) assert.equal((await call({method:'POST',path:base+'/prepare',headers,body:'{"version":"9.0.0","confirm":true}'})).code,403);});
test('explicit preparation is required and version goes unchanged to service',async()=>{let received;const svc={prepare:async version=>(received=version,{version})};let r=await call({method:'POST',path:base+'/prepare',headers:post,body:'{"version":"1.0.0"}'},svc);assert.equal(r.code,400);assert.equal(received,undefined);r=await call({method:'POST',path:base+'/prepare',headers:post,body:'{"version":"1.0.0","confirm":true}'},svc);assert.equal(r.code,200);assert.equal(received,'1.0.0');});
test('GET cannot prepare',async()=>assert.equal((await call({path:base+'/prepare'})).code,405));
test('bad JSON, unknown action, oversized request and service failure are explicit',async()=>{assert.equal((await call({method:'POST',path:base+'/check',headers:post,body:'bad'})).code,400);assert.equal((await call({method:'POST',path:base+'/other',headers:post,body:'{}'})).code,400);assert.equal((await call({method:'POST',path:base+'/check',headers:post,body:'x'.repeat(3000)})).code,413);const r=await call({method:'POST',path:base+'/check',headers:post,body:'{}'},{check:async()=>{throw Error('offline');}});assert.equal(r.body.error,'offline');});

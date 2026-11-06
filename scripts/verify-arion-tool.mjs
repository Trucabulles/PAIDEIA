import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {knowledgeStore,validateKnowledge} from '../tools/arion-registry-editor/knowledge.mjs';
const root=await mkdtemp(join(tmpdir(),'arion-tool-'));
await mkdir(join(root,'src/features/designer-actions'),{recursive:true});
const original={activities:[],procedures:[]};
await writeFile(join(root,'src/features/designer-actions/designerKnowledge.data.json'),JSON.stringify(original));
const store=knowledgeStore(root);
const updated={activities:[],procedures:[{id:'test',name:'Test',aliases:['test'],summary:'Résumé',steps:['Étape']} ]};
assert.deepEqual(validateKnowledge(updated),[]);
assert.equal((await store.save({previous:original,registry:updated})).ok,true);
await assert.rejects(store.save({previous:original,registry:original}));
assert.deepEqual(await store.read(),updated);
const port=42000+Math.floor(Math.random()*10000);
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['tools/arion-registry-editor/server.mjs'],{env:{...process.env,PAIDEIA_ARION_EDITOR_PORT:String(port),PAIDEIA_ARION_EDITOR_NO_OPEN:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const waitForStatus=async predicate=>{
  for(let attempt=0;attempt<80;attempt+=1){
    try{
      const response=await fetch(`${base}/api/server-status`);
      if(response.ok){const status=await response.json();if(predicate(status))return status;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Le serveur Arion n’a pas atteint l’état attendu.');
};
try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Serveur non démarré')),20000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.on('error',reject);child.on('exit',code=>reject(new Error(`Serveur arrêté ${code}`)));});
  const serverStatus=await (await fetch(`${base}/api/server-status`)).json();
  assert.equal(serverStatus.port,port);
  assert.ok(serverStatus.servers.some(server=>server.pid===child.pid&&server.port===port));
  const understanding=await (await fetch(`${base}/api/understanding`)).json();
  assert.ok(understanding.capabilities.length);
  const workbook=await fetch(`${base}/api/understanding-export`,{method:'POST',body:JSON.stringify(understanding.registry)});
  assert.equal(workbook.status,200);
  const imported=await (await fetch(`${base}/api/understanding-import`,{method:'POST',body:await workbook.arrayBuffer()})).json();
  assert.equal(imported.ok,true,JSON.stringify(imported));
  assert.deepEqual(imported.registry,understanding.registry);
  const knowledge=await (await fetch(`${base}/api/knowledge`)).json();
  assert.ok(knowledge.activities.length);
  assert.deepEqual(validateKnowledge(knowledge),[]);
  const managed=await (await fetch(`${base}/api/managed-documents`)).json();
  assert.ok(managed.documents.length);
  assert.ok(managed.documents.every(document=>document.name.endsWith('.md')&&document.title&&Array.isArray(document.headings)&&typeof document.content==='string'));
  const emptyBatch=await fetch(`${base}/api/managed-documents/batch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:[]})});
  assert.equal(emptyBatch.status,500);
  assert.match((await emptyBatch.json()).errors[0],/Aucun document/);
  const editorSource=await readFile('tools/arion-registry-editor/app.js','utf8');
  assert.match(editorSource,/Tout enregistrer et reconstruire/);
  assert.match(editorSource,/document-manager-sidebar/);
  assert.match(editorSource,/Rechercher un document/);
  assert.match(editorSource,/document-manager-filename/);
  assert.match(editorSource,/readJsonResponse/);
  assert.match(editorSource,/document\.querySelector\('#validate'\)\.hidden = documentationTab/);
  assert.match(editorSource,/document\.querySelector\('#save'\)\.hidden = documentationTab/);
  const restart=await fetch(`${base}/api/server-control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restart',scope:'self'})});
  assert.equal(restart.status,200);
  const restartedStatus=await waitForStatus(status=>status.instanceId!==serverStatus.instanceId);
  assert.equal(restartedStatus.port,port);
  const stop=await fetch(`${base}/api/server-control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',scope:'self'})});
  assert.equal(stop.status,200);
  console.log('Arion outil : XLSX, contenus, catalogue documentaire, sauvegarde globale et cycle serveur vérifiés.');
} finally {
  if (child.exitCode===null) {
    await fetch(`${base}/api/server-control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',scope:'self'})}).catch(()=>child.kill());
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,6000))]);
  }
}
process.exit(0);

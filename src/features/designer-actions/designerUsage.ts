import { useEffect, useRef, useState } from 'react';
import { invokeCommand } from '../../lib/tauri';
import { DESIGNER_CAPABILITIES } from './designerCapabilityRegistry';
import type { DesignerActionIntent } from './designerActionModel';
import { parseDesignerConversationTurn } from './designerActionEngine';
type Usage = {enabled:boolean; entries:Array<{id:string;count:number;last:number}>};
export function useDesignerUsage() {
  const [usage,setUsage] = useState<Usage>({enabled:true,entries:[]});
  const [error,setError] = useState('');
  const current=useRef(usage), ready=useRef(false), writes=useRef(Promise.resolve());
  useEffect(()=>{ let active=true; invokeCommand<Usage>('arion_usage_store',{payload:null}).then(value=>{if(active && typeof value.enabled==='boolean' && Array.isArray(value.entries) && value.entries.every(item=>typeof item.id==='string' && Number.isFinite(item.count) && item.count>=0 && Number.isFinite(item.last))){current.current=value;setUsage(value);ready.current=true;}else if(active)setError('Historique des usages invalide.');}).catch(()=>{if(active)setError('La mémorisation des usages est indisponible.');});return()=>{active=false;};},[]);
  function update(next:Usage) {
    if(!ready.current)return;
    current.current=next;setUsage(next);
    writes.current=writes.current.then(()=>invokeCommand('arion_usage_store',{payload:next})).then(()=>setError('')).catch(()=>setError('Les habitudes n’ont pas pu être enregistrées.'));
  }
  return {
    enabled:usage.enabled,
    error,
    suggestions:usage.enabled ? [...usage.entries].sort((a,b)=>(b.count+Math.max(0,7-(Date.now()-b.last)/86400000))-(a.count+Math.max(0,7-(Date.now()-a.last)/86400000))).flatMap(entry=>DESIGNER_CAPABILITIES.filter(cap=>cap.id===entry.id)).slice(0,5):[],
    clear:()=>update({...current.current,entries:[]}),
    toggle:()=>update({...current.current,enabled:!current.current.enabled}),
    remove:(id:string)=>update({...current.current,entries:current.current.entries.filter(item=>item.id!==id)}),
    record:(intent:DesignerActionIntent)=>{
      if(!current.current.enabled)return;
      const entries=current.current.entries.map(item=>({...item}));
      for(const operation of intent.operations){
        const capability=DESIGNER_CAPABILITIES.find(cap=>cap.operationKinds.length===1 && cap.operationKinds[0]===operation.kind && parseDesignerConversationTurn(cap.command).status === 'incomplete');
        if(!capability)continue;
        const item=entries.find(entry=>entry.id===capability.id);
        if(item){item.count++;item.last=Date.now();}else entries.push({id:capability.id,count:1,last:Date.now()});
      }
      update({...current.current,entries:entries.slice(-100)});
    }
  };
}

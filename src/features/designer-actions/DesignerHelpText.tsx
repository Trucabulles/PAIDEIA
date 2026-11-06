import { Fragment } from 'react';

type TableAlignment = 'left' | 'center' | 'right' | undefined;

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`\n]+`)/g).map((part,index)=> {
    if (/^(?:\*\*|__)/.test(part)) return <strong key={index}>{part.slice(2,-2)}</strong>;
    if (/^`[^`\n]+`$/.test(part)) return <code key={index}>{part.slice(1,-1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function splitTableRow(line: string) {
  const trimmed=line.trim();
  if(!trimmed.includes('|'))return null;
  const cells:string[]=[];
  let cell='', escaped=false, inCode=false, separators=0;
  for(const character of trimmed) {
    if(escaped){cell+=character;escaped=false;continue;}
    if(character==='\\'){cell+=character;escaped=true;continue;}
    if(character==='`'){cell+=character;inCode=!inCode;continue;}
    if(character==='|' && !inCode){cells.push(cell.trim());cell='';separators++;continue;}
    cell+=character;
  }
  cells.push(cell.trim());
  if(!separators)return null;
  if(trimmed.startsWith('|'))cells.shift();
  if(trimmed.endsWith('|') && !trimmed.endsWith('\\|'))cells.pop();
  return cells.map(value=>value.replace(/\\\|/g,'|'));
}

function tableDefinition(lines: string[], index: number) {
  if(index+1>=lines.length)return null;
  const headers=splitTableRow(lines[index]);
  const delimiters=splitTableRow(lines[index+1]);
  if(!headers || !delimiters || headers.length!==delimiters.length || headers.length===0)return null;
  if(!delimiters.every(cell=>/^:?-{3,}:?$/.test(cell.replace(/\s+/g,''))))return null;
  const alignments:TableAlignment[]=delimiters.map(cell=>{
    const normalized=cell.replace(/\s+/g,'');
    if(normalized.startsWith(':') && normalized.endsWith(':'))return 'center';
    if(normalized.endsWith(':'))return 'right';
    if(normalized.startsWith(':'))return 'left';
    return undefined;
  });
  return {headers,alignments};
}

/** A deliberately small Markdown renderer: text-only React nodes, never raw HTML. */
export function DesignerHelpText({text}:{text:string}) {
  const lines=text.replace(/\r/g,'').split('\n');
  const blocks: React.ReactNode[]=[];
  for(let index=0;index<lines.length;) {
    const line=lines[index];
    if(!line.trim()){index++;continue;}
    const fence=line.match(/^\s*```([a-z0-9_-]+)?\s*$/i);
    if(fence) {
      const start=index++;
      const codeLines:string[]=[];
      while(index<lines.length && !/^\s*```\s*$/.test(lines[index]))codeLines.push(lines[index++]);
      if(index<lines.length)index++;
      blocks.push(<pre className="designer-help-code" data-language={fence[1] || undefined} key={start}><code>{codeLines.join('\n')}</code></pre>);
      continue;
    }
    const heading=line.match(/^#{1,6}\s+(.*)$/);
    if(heading){blocks.push(<p className="designer-help-heading" key={index}><strong>{inline(heading[1])}</strong></p>);index++;continue;}
    const table=tableDefinition(lines,index);
    if(table) {
      const start=index;
      index+=2;
      const rows:string[][]=[];
      while(index<lines.length) {
        const row=splitTableRow(lines[index]);
        if(!row || !lines[index].trim())break;
        rows.push(Array.from({length:table.headers.length},(_,cellIndex)=>row[cellIndex] ?? ''));
        index++;
      }
      blocks.push(
        <div className="designer-help-table-scroll" key={start} tabIndex={0}>
          <table>
            <thead><tr>{table.headers.map((cell,cellIndex)=><th className={table.alignments[cellIndex] ? `align-${table.alignments[cellIndex]}` : undefined} key={cellIndex} scope="col">{inline(cell)}</th>)}</tr></thead>
            {rows.length ? <tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td className={table.alignments[cellIndex] ? `align-${table.alignments[cellIndex]}` : undefined} key={cellIndex}>{inline(cell)}</td>)}</tr>)}</tbody> : null}
          </table>
        </div>
      );
      continue;
    }
    if(/^\s*(?:[-*+] |\d+[.)] )/.test(line)) {
      const ordered=/^\s*\d+[.)] /.test(line), start=index, items=[];
      const pattern=ordered?/^\s*\d+[.)] (.*)$/:/^\s*[-*+] (.*)$/;
      while(index<lines.length){const item=lines[index].match(pattern);if(!item)break;items.push(<li key={index}>{inline(item[1])}</li>);index++;}
      blocks.push(ordered?<ol key={start}>{items}</ol>:<ul key={start}>{items}</ul>);continue;
    }
    const start=index, paragraph=[];
    while(index<lines.length && lines[index].trim() && !/^#{1,6}\s|^\s*```|^\s*(?:[-*+] |\d+[.)] )/.test(lines[index]) && !tableDefinition(lines,index))paragraph.push(lines[index++]);
    blocks.push(<p key={start}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="designer-help-text">{blocks}</div>;
}

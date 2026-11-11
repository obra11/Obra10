function asset(path){return globalThis.PrumoAssets?.[path]||new URL(path,document.baseURI).href;}
function decodeText(buffer){
 const bytes=new Uint8Array(buffer);
 if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes.subarray(2));
 if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes.subarray(2));
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\ufeff/,'');}
 catch{return new TextDecoder('windows-1252').decode(bytes);}
}
const libraries=new Map();
function script(path){if(!libraries.has(path))libraries.set(path,new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=asset(path);el.onload=resolve;el.onerror=()=>reject(Error('Não foi possível carregar o leitor Word.'));document.head.append(el);}));return libraries.get(path);}
function twipPx(value){return Number.isFinite(value)?(value/15)+'px':'';}
function colorRef(value){if(value==null||value===false)return '';const c=value>>>0;return 'rgb('+(c&255)+','+((c>>8)&255)+','+((c>>16)&255)+')';}
function clampTwipSpace(value,max=720){if(!Number.isFinite(value))return 0;return Math.max(0,Math.min(max,Math.abs(value)));}
function imageDataUrl(image){
 if(!image?.bytes?.length||!image.mime)return '';
 let text='';const bytes=image.bytes instanceof Uint8Array?image.bytes:new Uint8Array(image.bytes);
 for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);
 return 'data:'+image.mime+';base64,'+btoa(text);
}
function runCss(run){
 const style=[];
 if(run.b)style.push('font-weight:bold');
 if(run.i)style.push('font-style:italic');
 const deco=[];if(run.u)deco.push('underline');if(run.strike||run.dstrike)deco.push('line-through');
 if(deco.length)style.push('text-decoration:'+deco.join(' '));
 if(run.dstrike)style.push('text-decoration-style:double');
 else if(run.uStyle)style.push('text-decoration-style:'+run.uStyle);
 if(run.smallCaps)style.push('font-variant:small-caps');
 if(run.caps)style.push('text-transform:uppercase');
 if(run.hidden)style.push('opacity:.45');
 if(run.va==='super')style.push('vertical-align:super','font-size:smaller');
 else if(run.va==='sub')style.push('vertical-align:sub','font-size:smaller');
 else if(run.position!=null)style.push('vertical-align:'+run.position+'pt');
 if(run.size!=null&&run.va!=='super'&&run.va!=='sub')style.push('font-size:'+run.size+'pt');
 if(run.font)style.push("font-family:'"+String(run.font).replace(/['\\<>]/g,'')+"',Arial,sans-serif");
 const color=colorRef(run.color);if(color)style.push('color:'+color);
 const highlight=colorRef(run.highlight);if(highlight)style.push('background-color:'+highlight);
 if(run.spacing!=null)style.push('letter-spacing:'+run.spacing+'pt');
 return style.join(';');
}
function appendRunText(target,run,text){
 if(!text)return;
 const span=(target.ownerDocument||document).createElement('span');span.textContent=text;
 const css=runCss(run);if(css)span.style.cssText=css;target.append(span);
}
function nextTabStop(stops,pos){
 for(const stop of stops)if(stop>pos+1)return stop;
 return Math.floor(pos/720)*720+720;
}
function appendDocRuns(target,runs,tabStops){
 const doc=target.ownerDocument||document;
 if(!runs?.length){target.append(doc.createElement('br'));return;}
 const stops=(tabStops||[]).map(t=>t.pos).filter(Number.isFinite).sort((a,b)=>a-b);
 let x=0;
 for(const run of runs){
  if(run.image){
   const img=doc.createElement('img');img.alt='';img.src=imageDataUrl(run.image);
   if(run.image.dxa)img.style.width=twipPx(run.image.dxa);if(run.image.dya)img.style.height=twipPx(run.image.dya);
   target.append(img);x+=(run.image.dxa||900);continue;
  }
  if(run.ftnRef!=null||run.endRef!=null||run.comRef!=null||run.tbxRef!=null)continue;
  const text=run.text??'';if(!text)continue;
  const parts=text.split('\t');
  parts.forEach((part,index)=>{
   if(index){
    const stop=nextTabStop(stops,x),gap=Math.max(72,stop-x);
    const tab=doc.createElement('span');tab.className='word-tab';tab.style.cssText='display:inline-block;width:'+(gap/15)+'px;min-width:'+(gap/15)+'px';tab.textContent='\u00a0';
    target.append(tab);x=stop;
   }
   if(!part)return;
   appendRunText(target,run,part);
   const size=run.size||12;x+=Math.max(part.length,1)*size*10;
  });
 }
}
function styleDocParagraph(el,para,{asCell=false}={}){
 const align=['left','center','right','justify'][para.align||0]||'left';el.style.textAlign=align;
 const pp=para.pp;if(!pp)return;
 if(!asCell){
  if(pp.indL)el.style.marginLeft=twipPx(clampTwipSpace(pp.indL,2880));
  if(pp.indR)el.style.marginRight=twipPx(clampTwipSpace(pp.indR,2880));
  if(pp.ind1)el.style.textIndent=twipPx(Math.max(-720,Math.min(1440,pp.ind1)));
  if(pp.spB)el.style.marginTop=twipPx(clampTwipSpace(pp.spB,480));
  if(pp.spA)el.style.marginBottom=twipPx(clampTwipSpace(pp.spA,480));
 }
 if(pp.line){
  if(pp.lineMult)el.style.lineHeight=String(Math.max(.85,Math.min(3,Math.abs(pp.line)/240)));
  else el.style.lineHeight=Math.max(10,Math.min(36,Math.abs(pp.line)/20))+'pt';
 }
 const fill=colorRef(pp.shd);if(fill)el.style.backgroundColor=fill;
 if(!asCell&&pp.borders){
  const side=(key,css)=>{const b=pp.borders[key];if(!b)return;const c=colorRef(b.color)||'#182520';el.style[css]=(Math.min(4,b.width||1))+'pt solid '+c;};
  side('top','borderTop');side('right','borderRight');side('bottom','borderBottom');side('left','borderLeft');
  el.style.padding='4px 6px';
 }
}
function renderDocParagraph(doc,para){
 const p=doc.createElement('p');styleDocParagraph(p,para);
 if(para.list?.marker){const mark=doc.createElement('span');mark.className='word-list-mark';mark.textContent=para.list.marker+' ';p.append(mark);}
 // Tab-separated lines (and table text flattened with tabs) become a compact grid.
 const tabbed=(para.runs||[]).some(r=>(r.text||'').includes('\t'));
 if(tabbed){
  const stops=(para.pp?.tabs||[]).map(t=>t.pos).filter(Number.isFinite).sort((a,b)=>a-b);
  const chunks=[];let bucket=[];
  const flush=()=>{chunks.push(bucket);bucket=[];};
  for(const run of para.runs||[]){
   if(run.image||run.ftnRef!=null||run.endRef!=null||run.comRef!=null||run.tbxRef!=null){bucket.push(run);continue;}
   const parts=(run.text??'').split('\t');
   parts.forEach((part,index)=>{if(index)flush();if(part!=='')bucket.push({...run,text:part});else if(index)bucket.push({text:''});});
  }
  flush();
  if(chunks.length>1){
   p.classList.add('word-tab-line');
   let cols;
   if(stops.length){
    cols=[];let prev=0;
    for(let i=0;i<chunks.length;i++){
     const stop=stops[Math.min(i,stops.length-1)]??(prev+1440);
     const width=Math.max(96,(i<chunks.length-1?stop:Math.max(stop,prev+1440))-prev);
     cols.push((width/15)+'px');prev=i<stops.length?stops[i]:prev+width;
    }
    cols[cols.length-1]='minmax(96px,1fr)';
   }else if(chunks.length===3)cols=['minmax(140px,2.2fr)','minmax(72px,.8fr)','minmax(120px,1.6fr)'];
   else cols=Array(chunks.length).fill('minmax(0,1fr)');
   p.style.display='grid';p.style.gridTemplateColumns=cols.join(' ');p.style.columnGap='12px';p.style.alignItems='start';
   for(const group of chunks){
    const cell=doc.createElement('span');cell.className='word-tab-cell';
    if(!group.length)cell.innerHTML='&nbsp;';else for(const run of group)appendRunText(cell,run,run.text||'');
    p.append(cell);
   }
   return p;
  }
 }
 appendDocRuns(p,para.runs,para.pp?.tabs);return p;
}
function renderDocCellContent(doc,td,paras){
 for(const para of paras){
  if(paras.length===1){styleDocParagraph(td,para,{asCell:true});appendDocRuns(td,para.runs,para.pp?.tabs);continue;}
  const p=renderDocParagraph(doc,para);p.style.margin='0 0 2px';td.append(p);
 }
 if(!td.childNodes.length)td.append(doc.createElement('br'));
}
function cellHasVisibleContent(cell){
 return (cell.paras||[cell]).some(p=>(p.runs||[]).some(r=>r.image||(r.text||'').trim()));
}
function uniqueTableBounds(rows){
 const set=new Set();
 for(const row of rows){
  const w=row.tblw;if(!Array.isArray(w)||w.length<2)continue;
  for(const x of w)if(Number.isFinite(x))set.add(x);
 }
 const bounds=[...set].sort((a,b)=>a-b);
 return bounds.length>=2?bounds:null;
}
function cellColSpan(bounds,left,right){
 if(!bounds)return 1;
 let a=0;while(a<bounds.length&&bounds[a]<left-1)a++;
 let b=a;while(b<bounds.length&&bounds[b]<right-1)b++;
 return Math.max(1,b-a);
}
function renderDocTable(doc,rows,{images=null,shapes=null}={}){
 const table=doc.createElement('table');table.className='word-doc-table';
 const bounds=uniqueTableBounds(rows);
 let gridWidths=null,total=0;
 if(bounds){
  gridWidths=bounds.slice(1).map((x,i)=>Math.max(24,x-bounds[i]));
  total=gridWidths.reduce((n,v)=>n+v,0)||1;
  table.style.width='100%';table.style.tableLayout='fixed';
  const group=doc.createElement('colgroup');
  for(const w of gridWidths){
   const col=doc.createElement('col');
   col.style.width=((w/total)*100).toFixed(2)+'%';
   group.append(col);
  }
  table.append(group);
 }else table.style.width='100%';

 // Vertical merges follow the same cell index only when consecutive rows share that slot.
 const skip=rows.map(row=>row.cells.map(()=>false));
 for(let r=0;r<rows.length;r++){
  for(let c=0;c<rows[r].cells.length;c++){
   if(skip[r][c])continue;
   const merge=rows[r].tblMerge?.[c];
   if(merge?.v==='restart'){
    let span=1;
    for(let rr=r+1;rr<rows.length;rr++){
     const m=rows[rr].tblMerge?.[c];
     if(m?.v==='cont'&&rows[rr].cells[c]){span++;skip[rr][c]=true;}else break;
    }
    rows[r].cells[c]._rowSpan=span;
   }else if(merge?.v==='cont')skip[r][c]=true;
  }
 }

 let floatingImg=images?.[0]||null;
 const shape=shapes?.[0];
 for(let r=0;r<rows.length;r++){
  const row=rows[r],tr=doc.createElement('tr');
  const tw=row.tblw;
  for(let index=0;index<row.cells.length;index++){
   if(skip[r][index])continue;
   const cell=row.cells[index],merge=row.tblMerge?.[index];
   if(merge?.h==='cont')continue;
   const td=doc.createElement('td');
   const shade=colorRef(row.tblShd?.[index]);if(shade)td.style.backgroundColor=shade;
   if(merge?.h==='start'){let span=1;for(let cc=index+1;cc<row.cells.length;cc++){const m=row.tblMerge?.[cc];if(m?.h==='cont')span++;else break;}if(span>1)td.colSpan=span;}
   else if(bounds&&Array.isArray(tw)&&tw.length>index+1){
    const span=cellColSpan(bounds,tw[index],tw[index+1]);
    if(span>1)td.colSpan=span;
   }else if(row.orphan&&bounds)td.colSpan=bounds.length-1;
   if(cell._rowSpan>1)td.rowSpan=cell._rowSpan;
   td.style.verticalAlign='middle';
   // Floating logo (no inline picture char) goes into the first empty vertically merged cell.
   if(floatingImg&&!cellHasVisibleContent(cell)&&(merge?.v==='restart'||cell._rowSpan>1)){
    const img=doc.createElement('img');img.alt='';img.src=imageDataUrl(floatingImg);
    if(shape){img.style.width=twipPx(Math.max(24,shape.xR-shape.xL));img.style.height=twipPx(Math.max(24,shape.yB-shape.yT));}
    else{img.style.maxWidth='100%';img.style.height='auto';}
    td.append(img);floatingImg=null;
   }
   renderDocCellContent(doc,td,cell.paras||[cell]);
   tr.append(td);
  }
  table.append(tr);
 }
 return table;
}
function tableContinues(paras,i){
 let j=i;while(j<paras.length&&paras[j].kind==='p')j++;
 return j<paras.length&&(paras[j].kind==='cell'||paras[j].kind==='rowEnd');
}
function flushOrphanParas(rows,buf,fallbackTblw){
 if(!buf.length)return;
 const useful=buf.filter(p=>(p.runs||[]).some(r=>r.image||(r.text||'').trim()));
 buf.length=0;
 if(!useful.length)return;
 rows.push({
  cells:[{paras:useful,runs:useful[0].runs,align:useful[0].align,pp:useful[0].pp,list:useful[0].list}],
  tblw:fallbackTblw||null,
  orphan:true
 });
}
// Build DOM from docToText.model so DOC keeps tables, lists and run styles like DOCX.
function renderDocModel(doc,model,target){
 const paras=model?.body;if(!Array.isArray(paras)||!paras.length)return false;
 let i=0;
 while(i<paras.length){
  const para=paras[i];
  if(para.kind==='cell'||para.kind==='rowEnd'){
   const rows=[];let lastTblw=null;
   while(i<paras.length&&(paras[i].kind==='cell'||paras[i].kind==='rowEnd'||(paras[i].kind==='p'&&tableContinues(paras,i)))){
    const cells=[],buf=[];
    const flushCell=()=>{if(!buf.length)return;cells.push({paras:buf.slice(),runs:buf[0].runs,align:buf[0].align,pp:buf[0].pp,list:buf[0].list});buf.length=0;};
    let closed=false;
    while(i<paras.length){
     const cur=paras[i];
     if(cur.kind==='p'){buf.push(cur);i++;continue;}
     if(cur.kind==='cell'){
      // Bare paragraphs between rows become their own full-width row.
      if(!cells.length&&buf.length)flushOrphanParas(rows,buf,lastTblw);
      buf.push(cur);flushCell();i++;continue;
     }
     if(cur.kind==='rowEnd'){
      if(!cells.length&&buf.length)flushOrphanParas(rows,buf,lastTblw);
      buf.push(cur);flushCell();
      lastTblw=cur.tblw||lastTblw;
      rows.push({cells,tblw:cur.tblw,tblShd:cur.tblShd,tblMerge:cur.tblMerge});
      i++;closed=true;break;
     }
     break;
    }
    if(!closed){i-=buf.length;break;}
   }
   if(rows.length)target.append(renderDocTable(doc,rows,{images:model._images||null,shapes:model.shapes||null}));
   continue;
  }
  if(para.pp?.pageBreak&&target.childNodes.length){const br=doc.createElement('div');br.style.breakAfter='page';br.style.pageBreakAfter='always';br.style.height='0';target.append(br);}
  if((para.runs||[]).some(r=>(r.text||'').trim()||r.image))target.append(renderDocParagraph(doc,para));
  i++;
 }
 if(model.header?.length){const head=doc.createElement('div');head.className='word-doc-header';for(const para of model.header)if(para.kind==='p'||!para.kind)head.append(renderDocParagraph(doc,para));target.prepend(head);}
 if(model.footer?.length){const foot=doc.createElement('div');foot.className='word-doc-footer';for(const para of model.footer)if(para.kind==='p'||!para.kind)foot.append(renderDocParagraph(doc,para));target.append(foot);}
 return !!target.childNodes.length;
}
export class WordViewer{
 constructor(container,onZoom){this.container=container;this.onZoom=onZoom;this.current=null;}
 async open(file){
  const plain=file.name.toLowerCase().endsWith('.txt'),legacy=plain||file.name.toLowerCase().endsWith('.doc');let html,legacyModel,text='';
  if(plain)text=decodeText(await file.arrayBuffer());
  else if(legacy){
   await script('./vendor/word/doc-reader.js');
   const data=await file.arrayBuffer();
   html=globalThis.docToText.html(data);
   legacyModel=globalThis.docToText.model(data);
   if(legacyModel){
    try{legacyModel._images=globalThis.docToText.images(data)||null;}catch{legacyModel._images=null;}
   }
   if(!html)throw Error('DOC não compatível, danificado ou protegido por senha. Use Word 97–2003 (.doc) ou DOCX.');
  }
  else{await script('./vendor/word/jszip.js');await script('./vendor/word/docx-preview.js');}
  const frame=document.createElement('iframe');frame.title=plain?'Texto':'Documento Word';frame.setAttribute('sandbox','allow-same-origin');
  const ready=new Promise(resolve=>frame.onload=resolve);
  frame.srcdoc=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:; base-uri 'none'; form-action 'none'"><style>*{box-sizing:border-box}html{touch-action:none;background:transparent;color:#182520;font-family:Arial,sans-serif;height:100%}body{touch-action:none;margin:0;padding:14px;overflow:auto;min-height:100%;display:flex;flex-direction:column;align-items:center;background:transparent}.word-note{font:12px Arial;margin:0 0 12px;color:#c8d5c4;align-self:center;text-align:center;text-shadow:0 1px 2px #0008}.word-page{white-space:pre-wrap;background:white;width:794px;min-height:1122px;position:relative;padding:60px;box-shadow:0 2px 8px #0002;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{padding:5px;border:1px solid #a7b4ae;vertical-align:top}img{max-width:100%;height:auto}.docx-wrapper{align-items:center!important;padding:0!important;background:transparent!important;display:flex!important;flex-direction:column!important}#pages{display:flex;flex-direction:column;align-items:center;width:100%}.docx{margin:0 auto 16px!important}a{color:inherit}.word-page-number{position:absolute;right:20px;bottom:12px;font:11px Arial;color:#68726b;white-space:nowrap}.word-body{white-space:normal}.word-body p{margin:0 0 8px;white-space:pre-wrap}.word-page,section.docx{position:relative;margin:0 auto 24px!important}.word-turn-slot{display:flex;justify-content:center;margin:0 auto 24px}.word-plain p{margin:0;font:13px/1.45 Consolas,'Courier New',monospace;tab-size:4}.word-doc-table{width:100%;margin:0 0 10px;border-collapse:collapse;border:1.5px solid #111}.word-doc-table td{border:1px solid #111;padding:3px 6px;white-space:normal;overflow-wrap:anywhere;vertical-align:middle;height:auto;line-height:1.25}.word-doc-table img{max-width:100%;height:auto;display:block;margin:0 auto}.word-list-mark{display:inline-block;min-width:1.6em}.word-tab{display:inline-block}.word-tab-line{white-space:normal!important;margin:0 0 6px!important}.word-tab-cell{min-width:0;overflow-wrap:anywhere}.word-doc-header,.word-doc-footer{font-size:11pt;color:#42594d;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid #c5d0c8}.word-doc-footer{margin:18px 0 0;padding:8px 0 0;border-bottom:0;border-top:1px solid #c5d0c8}</style></head><body><p class="word-note">${plain?'TXT · Texto simples.':legacy?'DOC · Layout, tabelas e formatação do arquivo.':'DOCX · A aparência pode variar conforme as fontes disponíveis.'}</p><div id="pages"></div></body></html>`;
  this.container.append(frame);await ready;
  try{
   const doc=frame.contentDocument,body=doc.getElementById('pages');
   doc.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});
   let lines=null;
   if(plain){
    lines=text.split(/\r\n|\r|\n/);
    const page=doc.createElement('article');page.className='word-page';
    const content=doc.createElement('div');content.className='word-body word-plain';
    for(const line of lines){const p=doc.createElement('p');p.textContent=line||'\u00a0';content.append(p);}
    page.append(content);body.append(page);
   }
   else if(legacy){
    const page=doc.createElement('article');page.className='word-page';const setup=legacyModel?.page;
    if(setup){for(const [key,prop]of [['width','width'],['height','minHeight'],['top','paddingTop'],['bottom','paddingBottom'],['left','paddingLeft'],['right','paddingRight']])if(Number.isFinite(setup[key]))page.style[prop]=setup[key]/15+'px';if(setup.height)page.dataset.pageHeight=setup.height/15;}
    const content=doc.createElement('div');content.className='word-body';
    if(!renderDocModel(doc,legacyModel,content)){
     for(const line of (html.body||'').split('\n')){const p=doc.createElement('p');p.innerHTML=line||'<br>';content.append(p);}
     for(const key of ['headers','footnotes','endnotes','textboxes'])if(html[key]){const section=doc.createElement('p');section.innerHTML=html[key];content.append(section);}
    }
    page.append(content);body.append(page);
   }
   else await globalThis.docx.renderAsync(await file.arrayBuffer(),body,null,{inWrapper:true,ignoreWidth:false,ignoreHeight:false,breakPages:true,ignoreLastRenderedPageBreak:false,useBase64URL:true,renderAltChunks:false,renderHeaders:true,renderFooters:true});
   // Documents are passive content: strip navigation and embedded active elements.
   for(const el of body.querySelectorAll('script,iframe,object,embed,form,link,base'))el.remove();
   for(const el of body.querySelectorAll('*'))for(const attr of [...el.attributes])if(attr.name.startsWith('on')||['href','srcdoc'].includes(attr.name))el.removeAttribute(attr.name);
   let pagination;
   if(lines&&lines.length>20000){
    const page=body.querySelector('.word-page');page.style.minHeight='0';
    pagination={pages:[page],estimated:false};doc.querySelector('.word-note').textContent='TXT · Texto longo, mostrado numa única página.';
   }else{const {paginateWord}=await import(asset('./word-pages.js'));pagination=await paginateWord(body,legacy);}
   this.current={frame,scale:1,pages:pagination.pages,pageNumber:1,fitted:true};if(pagination.estimated&&!plain)doc.querySelector('.word-note').textContent='Paginação aproximada · pode variar conforme as fontes e o layout do Word.';
   doc.addEventListener('scroll',()=>this.updatePage(),{passive:true});this.bindGestures(this.current);this.fit();return this.current;
  }catch(e){frame.remove();throw e;}
 }
 bindGestures(view){
  const doc=view.frame.contentDocument,root=doc.documentElement;
  const pointers=new Map();let previous=[],raf=0;
  const positions=()=>[...pointers.values()].slice(0,2);
  const clampScale=value=>Math.max(.05,Math.min(30,value));
  const zoomAt=(factor,clientX,clientY)=>{
   if(this.current!==view||!Number.isFinite(factor))return;
   const scroll=doc.scrollingElement,oldScale=view.scale,next=clampScale(oldScale*factor);
   if(next===oldScale)return;
   const rect=view.frame.getBoundingClientRect();
   const localX=clientX-rect.left,localY=clientY-rect.top;
   const anchorX=(scroll.scrollLeft+localX)/oldScale,anchorY=(scroll.scrollTop+localY)/oldScale;
   view.scale=next;view.fitted=false;this.applyZoom();
   scroll.scrollLeft=anchorX*next-localX;scroll.scrollTop=anchorY*next-localY;
  };
  const flush=()=>{
   if(raf)cancelAnimationFrame(raf);raf=0;
   const next=positions();
   if(this.current!==view||!next.length||next.length!==previous.length){previous=next;return;}
   const scroll=doc.scrollingElement;
   const center=a=>({x:a.reduce((n,p)=>n+p.x,0)/a.length,y:a.reduce((n,p)=>n+p.y,0)/a.length});
   const from=center(previous),to=center(next);
   if(next.length===2){
    const distance=a=>Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),oldScale=view.scale;
    const factor=distance(next)/Math.max(1,distance(previous));
    const nextScale=clampScale(oldScale*factor);
    const anchorX=(scroll.scrollLeft+from.x)/oldScale,anchorY=(scroll.scrollTop+from.y)/oldScale;
    view.scale=nextScale;view.fitted=false;this.applyZoom();
    scroll.scrollLeft=anchorX*nextScale-to.x;scroll.scrollTop=anchorY*nextScale-to.y;
   }else{view.fitted=false;scroll.scrollLeft+=from.x-to.x;scroll.scrollTop+=from.y-to.y;}
   previous=next;
  };
  root.addEventListener('wheel',e=>{
   // Plain wheel scrolls the document; Ctrl/Meta + wheel zooms, like a browser page.
   if(!(e.ctrlKey||e.metaKey))return;
   e.preventDefault();
   const dy=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*root.clientHeight:e.deltaY;
   zoomAt(Math.exp(-dy*.0022),e.clientX,e.clientY);
  },{passive:false});
  root.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse')return;
   flush();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});previous=positions();
   root.setPointerCapture(e.pointerId);e.preventDefault();
  });
  root.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId))return;e.preventDefault();
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!raf)raf=requestAnimationFrame(flush);
  });
  const finish=e=>{if(!pointers.has(e.pointerId))return;flush();pointers.delete(e.pointerId);previous=positions();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(event,finish);
  view.resetGesture=()=>{if(raf)cancelAnimationFrame(raf);raf=0;pointers.clear();previous=[];};
 }
 rotate(){
  if(!this.current)return;const view=this.current;view.rotation=((view.rotation||0)+1)%4;
  const doc=view.frame.contentDocument;
  for(const page of doc.querySelectorAll('.word-page,section.docx')){
   let slot=page.parentElement;
   if(!slot.classList.contains('word-turn-slot')){slot=doc.createElement('div');slot.className='word-turn-slot';page.before(slot);slot.append(page);}
   const w=page.offsetWidth,h=page.offsetHeight,q=view.rotation;
   Object.assign(slot.style,{position:'relative',width:(q%2?h:w)+'px',height:(q%2?w:h)+'px',marginBottom:'16px'});
   Object.assign(page.style,{position:'absolute',left:'0',top:'0',transformOrigin:'0 0',transform:`translate(${q===1?h:q===2?w:0}px,${q===2?h:q===3?w:0}px) rotate(${q*90}deg)`});
  }
  this.fit();
 }
 search(query){
  if(!this.current)return[];const view=this.current,doc=view.frame.contentDocument,root=doc.getElementById('pages');
  for(const mark of root.querySelectorAll('mark[data-prumo-match]'))mark.replaceWith(...mark.childNodes);root.normalize();
  view.searchQuery=query.trim();view.matches=[];view.matchIndex=-1;const q=view.searchQuery.toLocaleLowerCase();if(!q)return[];
  const walker=doc.createTreeWalker(root,4);let node,all='',previousBlock=null;const spans=[];
  while(node=walker.nextNode()){
   if(node.parentElement.closest('style,script,.word-page-number'))continue;
   const block=node.parentElement.closest('p,td,th,div,article,section');if(previousBlock&&block!==previousBlock)all+='\n';previousBlock=block;
   spans.push({node,start:all.length,end:all.length+node.data.length});all+=node.data;
  }
  const lower=all.toLocaleLowerCase(),matches=[];let at=0;
  while((at=lower.indexOf(q,at))>=0){matches.push({start:at,end:at+q.length,marks:[]});at+=q.length;}
  for(const s of spans){for(let i=matches.length-1;i>=0;i--){const m=matches[i],lo=Math.max(m.start,s.start)-s.start,hi=Math.min(m.end,s.end)-s.start;if(hi<=lo)continue;
    const tail=s.node.splitText(hi),part=s.node.splitText(lo),mark=doc.createElement('mark');mark.dataset.prumoMatch=String(i);mark.style.cssText='background:#ffe572;color:#17251d;';part.replaceWith(mark);mark.append(part);m.marks.unshift(mark);
  }}
  view.matches=matches;if(matches.length)this.focusMatch(0);return matches;
 }
 focusMatch(index){const view=this.current,match=view?.matches?.[index];if(!match)return;view.matchIndex=index;
  for(const [i,m]of view.matches.entries())for(const mark of m.marks){mark.style.background=i===index?'#ffbd59':'#ffe572';mark.style.outline=i===index?'2px solid #a45500':'none';}
  if(view.scale<1){view.scale=1;view.fitted=false;this.applyZoom();}
  match.marks[0]?.scrollIntoView({block:'center',inline:'center'});
 }
 nextMatch(direction=1){const v=this.current;if(v?.matches?.length)this.focusMatch((v.matchIndex+direction+v.matches.length)%v.matches.length);}
 pageHost(page){return page?.parentElement?.classList.contains('word-turn-slot')?page.parentElement:page;}
 fit(){
  if(!this.current)return;
  const view=this.current,doc=view.frame.contentDocument,w=this.container.clientWidth,h=this.container.clientHeight;
  if(w<2||h<2){requestAnimationFrame(()=>this.fit());return;}
  doc.body.style.zoom=1;
  const page=view.pages?.[Math.max(0,(view.pageNumber||1)-1)]||doc.querySelector('.word-page,section.docx');
  const host=this.pageHost(page);if(!host)return;
  const width=host.offsetWidth||794,height=host.offsetHeight||1122;
  // Same as PDF: fit the whole page into the viewport, not only the width.
  view.scale=Math.max(.05,Math.min((w-24)/width,(h-24)/height));
  view.fitted=true;this.applyZoom();this.scrollToCenter();
 }
 zoom(factor,keepCentered=false){if(!this.current||!Number.isFinite(factor))return;this.current.scale=Math.max(.05,Math.min(30,this.current.scale*factor));this.current.fitted=false;this.applyZoom();if(keepCentered)this.scrollToCenter();}
 applyZoom(){this.current.frame.contentDocument.body.style.zoom=this.current.scale;this.onZoom(Math.round(this.current.scale*100));this.updatePage();}
 scrollToCenter(){
  const view=this.current,doc=view?.frame?.contentDocument;if(!doc)return;
  const page=view.pages?.[Math.max(0,(view.pageNumber||1)-1)]||doc.querySelector('.word-page,section.docx');
  if(!page)return;
  const host=this.pageHost(page);
  const top=host.offsetTop-(doc.documentElement.clientHeight-host.offsetHeight)/2;
  const left=(doc.documentElement.scrollWidth-doc.documentElement.clientWidth)/2;
  doc.documentElement.scrollTo({top:Math.max(0,top),left:Math.max(0,left),behavior:'auto'});
 }
 updatePage(){
  const view=this.current;if(!view?.pages?.length)return;
  const midpoint=view.frame.clientHeight/2;let best=Infinity;
  view.pages.forEach((p,i)=>{const r=(p.parentElement.classList.contains('word-turn-slot')?p.parentElement:p).getBoundingClientRect(),d=r.top<=midpoint&&r.bottom>=midpoint?0:Math.min(Math.abs(r.top-midpoint),Math.abs(r.bottom-midpoint));if(d<best){best=d;view.pageNumber=i+1;}});
  const input=document.getElementById('pdf-page');input.value=view.pageNumber;input.max=view.pages.length;document.getElementById('pdf-total').textContent='/ '+view.pages.length;
 }
 go(number){const v=this.current;if(!v?.pages?.length)return;const i=Math.max(0,Math.min(v.pages.length-1,Math.floor(Number(number)||1)-1));v.pageNumber=i+1;document.getElementById('pdf-page').value=i+1;if(v.fitted)this.fit();else{v.pages[i].scrollIntoView({block:'start',inline:'nearest'});this.scrollToCenter();}}
 wrapCanvasText(ctx,text,maxWidth){
  if(!text)return [''];
  if(ctx.measureText(text).width<=maxWidth)return [text];
  const lines=[],words=text.split(/(\s+)/);let current='';
  for(const part of words){
   const next=current+part;
   if(current&&ctx.measureText(next).width>maxWidth){lines.push(current);current=part.replace(/^\s+/,'');}
   else current=next;
  }
  if(current)lines.push(current);
  return lines.length?lines:[''];
 }
 // PNG like PDF: WebView2 print preview paints bitmap pages; SVG+foreignObject often stays blank.
 paintPlainPage(page,win){
  const w=Math.max(1,Math.round(page.offsetWidth||794)),h=Math.max(1,Math.round(page.offsetHeight||1122));
  const dpr=2,canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  const pageStyle=win.getComputedStyle(page);
  const padL=parseFloat(pageStyle.paddingLeft)||0,padT=parseFloat(pageStyle.paddingTop)||0;
  const padR=parseFloat(pageStyle.paddingRight)||0,padB=parseFloat(pageStyle.paddingBottom)||0;
  const maxWidth=Math.max(1,w-padL-padR),bottom=h-padB;
  let y=padT;
  for(const p of page.querySelectorAll('.word-plain p')){
   const cs=win.getComputedStyle(p),fontSize=parseFloat(cs.fontSize)||13;
   const lh=parseFloat(cs.lineHeight)||fontSize*1.45;
   ctx.font=`${cs.fontStyle||'normal'} ${cs.fontWeight||'400'} ${fontSize}px ${cs.fontFamily||"Consolas,'Courier New',monospace"}`;
   ctx.fillStyle=cs.color||'#182520';ctx.textBaseline='top';
   let text=p.textContent;if(text==='\u00a0')text='';
   for(const line of this.wrapCanvasText(ctx,text,maxWidth)){
    if(y+lh>bottom+0.5)return{src:canvas.toDataURL('image/png'),width:w,height:h};
    ctx.fillText(line,padL,y);y+=lh;
   }
  }
  return{src:canvas.toDataURL('image/png'),width:w,height:h};
 }
 async rasterizePages(){
  const view=this.current,doc=view?.frame?.contentDocument,win=doc?.defaultView;if(!doc||!win)throw Error('Abra um documento para imprimir.');
  const pages=view.pages?.length?view.pages:[...doc.querySelectorAll('.word-page,section.docx')];
  if(!pages.length)throw Error('Nenhuma página para imprimir.');
  const previousZoom=doc.body.style.zoom;doc.body.style.zoom=1;
  const images=[];
  try{
   for(const [index,page] of pages.entries()){
    if(page.querySelector('.word-plain')){images.push(this.paintPlainPage(page,win));continue;}
    // DOC/DOCX keep HTML clones; WebView2 print preview shows them when #pdf-print-root is on screen.
    const host=this.pageHost(page),w=Math.max(1,Math.round(host.offsetWidth||page.offsetWidth||794)),h=Math.max(1,Math.round(host.offsetHeight||page.offsetHeight||1122));
    const clone=page.cloneNode(true);for(const badge of clone.querySelectorAll('.word-page-number'))badge.remove();
    Object.assign(clone.style,{margin:'0',boxShadow:'none',position:'relative',width:w+'px',height:h+'px',minHeight:h+'px',maxHeight:h+'px',overflow:'hidden'});
    images.push({html:clone,width:w,height:h,index});
   }
  }finally{doc.body.style.zoom=previousZoom;}
  return images;
 }
 // Rasterize the visible iframe region that maps to a viewport selection (x/y/w/h in viewport coords).
 async captureArea(area,hostRect){
  const view=this.current,frame=view?.frame,doc=frame?.contentDocument;if(!doc)throw Error('Abra um documento do Word para capturar.');
  const box=frame.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  const out=document.createElement('canvas');out.width=Math.max(1,Math.round(area.w*dpr));out.height=Math.max(1,Math.round(area.h*dpr));
  const ctx=out.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);
  const left=(hostRect.left+area.x)-box.left,top=(hostRect.top+area.y)-box.top;
  const zoom=view.scale||1,scroll=doc.scrollingElement;
  const styles=[...doc.querySelectorAll('style')].map(n=>n.textContent).join('\n');
  const shell=doc.createElement('div');
  for(const node of doc.body.childNodes)shell.append(node.cloneNode(true));
  const html=`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${area.w}px;height:${area.h}px;overflow:hidden;background:#fff;">`+
   `<div style="transform:translate(${-left}px,${-top}px);transform-origin:0 0;">`+
   `<div style="transform:translate(${-scroll.scrollLeft}px,${-scroll.scrollTop}px) scale(${zoom});transform-origin:0 0;width:${Math.max(scroll.scrollWidth,doc.body.scrollWidth)/zoom}px;">`+
   `<style>${styles}</style>${shell.innerHTML}</div></div></div>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${out.width}" height="${out.height}"><foreignObject width="${area.w}" height="${area.h}" transform="scale(${dpr})">${html}</foreignObject></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível capturar esta área do Word.'));img.src=url;});
   ctx.drawImage(img,0,0);
  }finally{URL.revokeObjectURL(url);}
  return out;
 }
 suspend(){const saved=this.current;if(saved){saved.resetGesture?.();saved.frame.hidden=true;}this.current=null;return saved;}
 resume(saved){this.current=saved;saved.frame.hidden=false;this.applyZoom();}
 dispose(saved){saved?.resetGesture?.();saved?.frame.remove();if(this.current===saved)this.current=null;}
}

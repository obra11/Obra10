// Browser pagination supplements explicit Word page breaks without flattening runs.
export async function paginateWord(root,legacy=false){
 const doc=root.ownerDocument,win=doc.defaultView;
 await doc.fonts?.ready;
 await Promise.all([...root.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;setTimeout(resolve,3000);}))); 
 // Freeze normal line metrics before CSS zoom: small zoom levels otherwise round
 // font metrics differently and can make already paginated text overflow.
 const metrics=new Map();
 for(const el of root.querySelectorAll('p,td,th')){const cs=win.getComputedStyle(el);if(cs.lineHeight!=='normal')continue;
  const key=[cs.fontFamily,cs.fontSize,cs.fontWeight,cs.fontStyle].join('|');let height=metrics.get(key);
  if(!height){const probe=doc.createElement('div');Object.assign(probe.style,{position:'absolute',visibility:'hidden',fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,fontStyle:cs.fontStyle,lineHeight:'normal'});probe.textContent='Mg';root.append(probe);height=probe.getBoundingClientRect().height;probe.remove();metrics.set(key,height);}
  if(height)el.style.lineHeight=height+'px';
 }
 const pages=[...root.querySelectorAll(legacy?'.word-page':'section.docx')];let added=0;
 for(const source of pages){
  let article=legacy?source.querySelector('.word-body'):source.querySelector(':scope > article');if(!article)continue;
  const style=win.getComputedStyle(source),pageHeight=parseFloat(source.dataset.pageHeight)||parseFloat(style.minHeight)||1122;
  const padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
  const extras=[...source.children].filter(e=>e!==article&&!['absolute','fixed'].includes(win.getComputedStyle(e).position)).reduce((n,e)=>n+e.getBoundingClientRect().height,0);
  const available=Math.max(120,pageHeight-padding-extras-4);
  const template=source.cloneNode(true),queue=[...article.childNodes];article.replaceChildren();
  let page=source;article.style.minHeight='0';article.style.height='auto';
  const newPage=()=>{const next=template.cloneNode(true);next.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));const nextArticle=legacy?next.querySelector('.word-body'):next.querySelector(':scope > article');nextArticle.replaceChildren();nextArticle.style.minHeight='0';nextArticle.style.height='auto';page.after(next);page=next;article=nextArticle;added++;};
  const fits=()=>article.getBoundingClientRect().height<=available+1&&article.scrollHeight<=available+1;
  while(queue.length){
   const node=queue.shift();const hadContent=!!article.textContent.trim()||!!article.querySelector('img,table');article.append(node);
   if(fits())continue;
   node.remove();
   if(node.nodeType===1&&['P','DIV'].includes(node.tagName)&&node.textContent.length>1&&!node.querySelector('img,table,svg')){
    const parts=splitParagraph(node,article,available,doc);
    if(parts){article.append(parts[0]);newPage();queue.unshift(parts[1]);continue;}
   }
   if(node.nodeType===1&&node.tagName==='TABLE'){
    const rows=[...node.querySelectorAll(':scope > tbody > tr,:scope > tr')];
    if(rows.length>1){
     // Split dense tables by rows instead of pushing one oversized row to its own empty page.
     let first=node.cloneNode(true),rest=node.cloneNode(true);
     const a=[...first.querySelectorAll(':scope > tbody > tr,:scope > tr')],b=[...rest.querySelectorAll(':scope > tbody > tr,:scope > tr')];
     if(hadContent)newPage();
     article.append(first);let count=a.length;while(count>1&&!fits()){a[--count].remove();}
     if(count>=1&&fits()){b.slice(0,count).forEach(r=>r.remove());if(b.length){newPage();queue.unshift(rest);}continue;}
     first.remove();
    }
   }
   if(hadContent){newPage();queue.unshift(node);continue;}
   // Keep oversized atomic content visible instead of silently clipping it.
   article.append(node);
  }
 }
 const final=[...root.querySelectorAll(legacy?'.word-page':'section.docx')];
 final.forEach((page,i)=>{page.dataset.pageNumber=String(i+1);const badge=doc.createElement('div');badge.className='word-page-number';badge.textContent=`Página ${i+1} de ${final.length}`;page.append(badge);});
 return {pages:final,estimated:legacy||added>0};
}
function splitParagraph(node,article,available,doc){
 const walker=doc.createTreeWalker(node,4),texts=[];let t,total=0;while(t=walker.nextNode()){texts.push({node:t,start:total});total+=t.length;}if(total<2)return null;
 const endpoint=index=>{for(let i=texts.length-1;i>=0;i--)if(index>=texts[i].start)return[texts[i].node,index-texts[i].start];return[texts[0].node,0];};
 const part=(start,end)=>{const range=doc.createRange();range.setStart(...endpoint(start));range.setEnd(...endpoint(end));const clone=node.cloneNode(false);clone.removeAttribute('id');clone.append(range.cloneContents());return clone;};
 let lo=0,hi=total-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2),probe=part(0,mid);article.append(probe);const fits=article.getBoundingClientRect().height<=available+1&&article.scrollHeight<=available+1;probe.remove();if(fits)lo=mid;else hi=mid-1;}
 if(!lo)return null;const text=node.textContent,space=text.lastIndexOf(' ',lo);if(space>lo*.7)lo=space+1;
 return [part(0,lo),part(lo,total)];
}

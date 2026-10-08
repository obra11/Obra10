function asset(path){return globalThis.PrumoAssets?.[path]||new URL(path,document.baseURI).href;}
export class PdfViewer {
  constructor(container,onChange,onError){
    this.container=container;this.onChange=onChange;this.onError=onError;this.canvas=container.querySelector('canvas');this.measureSvg=container.querySelector('#pdf-measure');this.pointers=new Map();this.rotation=0;this.scale=1;this.x=0;this.y=0;this.measuring=false;this.measurePoints=[];this.measureText='';this.scaleInfo=null;
    container.addEventListener('wheel',e=>{e.preventDefault();const r=container.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    container.addEventListener('pointerdown',e=>{if(this.measuring){this.measureDown={id:e.pointerId,x:e.clientX,y:e.clientY};e.preventDefault();return;}container.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});});
    container.addEventListener('pointermove',e=>{if(this.measuring||!this.pointers.has(e.pointerId))return;const before=[...this.pointers.values()],old=this.pointers.get(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=[...this.pointers.values()];if(before.length===1){this.x+=e.clientX-old.x;this.y+=e.clientY-old.y;}else if(before.length===2){const dist=p=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),r=container.getBoundingClientRect();this.zoom(dist(after)/Math.max(1,dist(before)),(before[0].x+before[1].x)/2-r.left,(before[0].y+before[1].y)/2-r.top);this.x+=(after[0].x+after[1].x-before[0].x-before[1].x)/2;this.y+=(after[0].y+after[1].y-before[0].y-before[1].y)/2;}this.preview();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(event,e=>{if(this.measuring){if(event==='pointerup'&&this.measureDown?.id===e.pointerId&&Math.hypot(e.clientX-this.measureDown.x,e.clientY-this.measureDown.y)<12)this.addMeasurePoint(e.clientX,e.clientY);this.measureDown=null;return;}if(this.pointers.delete(e.pointerId)&&!this.pointers.size)this.scheduleRefinement();});
  }
  async open(file){
    await this.close();
    const lib=await import(asset('./vendor/pdf/pdf.js'));this.lib=lib;lib.GlobalWorkerOptions.workerSrc=asset('./vendor/pdf/pdf.worker.js');
    class BinaryDataFactory {async fetch({kind,filename}){const folder={cMapUrl:'cmaps',standardFontDataUrl:'standard_fonts',wasmUrl:'wasm'}[kind];if(!folder||filename.includes('..'))throw Error('Recurso PDF inválido');const response=await fetch(asset('./vendor/pdf/'+folder+'/'+filename));if(!response.ok)throw Error('Recurso PDF ausente: '+filename);return new Uint8Array(await response.arrayBuffer());}}
    this.loading=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),useWorkerFetch:false,BinaryDataFactory,isEvalSupported:false,useSystemFonts:false,cMapPacked:true});
    this.loading.onPassword=(update,reason)=>{const password=window.prompt(reason===2?'Senha incorreta. Digite novamente:':'Senha deste PDF:');if(password===null)this.loading.destroy();else update(password);};
    this.doc=await this.loading.promise;this.pageNumber=1;this.rotation=0;this.measurePoints=[];this.measureText='';this.searchPages=[];this.searchMatches=[];this.searchIndex=-1;this.searchQuery='';await this.go(1);
  }
  suspend(){
    this.stopPreview();clearTimeout(this.timer);this.timer=0;this.generation=(this.generation||0)+1;this.pageRequest=(this.pageRequest||0)+1;this.searchToken=(this.searchToken||0)+1;this.task?.cancel();
    const state={};for(const key of ['loading','doc','page','pageNumber','rotation','scale','x','y','searchPages','searchIndex','searchMatches','searchQuery','searchNoText'])state[key]=this[key];
    this.loading=null;this.doc=null;this.page=null;this.rendered=null;this.pointers.clear();return state;
  }
  resume(state){Object.assign(this,state);this.canvas.style.transform='';this.changed();}
  async close(){this.stopPreview();this.pointers.clear();clearTimeout(this.timer);this.timer=0;this.generation=(this.generation||0)+1;this.task?.cancel();this.rendered=null;this.canvas.style.transform='';const loading=this.loading;this.loading=null;this.doc=null;this.page=null;if(loading)await loading.destroy();}
  async go(n){if(!this.doc)return;const doc=this.doc;const number=Math.max(1,Math.min(doc.numPages,Math.floor(Number(n)||1)));const request=this.pageRequest=(this.pageRequest||0)+1;this.pageNumber=number;this.measurePoints=[];this.measureText='';const page=await doc.getPage(number);if(doc!==this.doc||request!==this.pageRequest)return;this.page=page;await this.fit();}
  async fit(){if(!this.page)return;const v=this.page.getViewport({scale:1,rotation:(this.page.rotate+this.rotation)%360});this.scale=Math.max(.05,Math.min((this.container.clientWidth-24)/v.width,(this.container.clientHeight-24)/v.height));this.x=(this.container.clientWidth-v.width*this.scale)/2;this.y=(this.container.clientHeight-v.height*this.scale)/2;await this.render();}
  zoom(factor,cx=this.container.clientWidth/2,cy=this.container.clientHeight/2){if(!this.page||!Number.isFinite(factor))return;const next=Math.max(.05,Math.min(30,this.scale*factor));this.x=cx-(cx-this.x)*next/this.scale;this.y=cy-(cy-this.y)*next/this.scale;this.scale=next;this.preview();}
  stopPreview(){if(this.previewFrame)cancelAnimationFrame(this.previewFrame);this.previewFrame=0;}
  applyPreview(){
    if(!this.rendered)return;
    const base=this.rendered,ratio=this.scale/base.scale;
    this.canvas.style.transformOrigin='0 0';
    this.canvas.style.transform=`translate3d(${this.x-base.x*ratio}px,${this.y-base.y*ratio}px,0) scale(${ratio})`;
    this.drawMeasure();
  }
  scheduleRefinement(){
    clearTimeout(this.timer);this.timer=0;
    if(this.pointers.size)return;
    this.timer=setTimeout(()=>{this.timer=0;this.render().catch(this.onError);},140);
  }
  preview(){
    // A gesture only moves the existing GPU layer. Never rerender PDF operators
    // on every pointer event; cancel stale work and refine after input settles.
    if(this.task){this.generation=(this.generation||0)+1;this.task.cancel();this.task=null;}
    if(!this.previewFrame)this.previewFrame=requestAnimationFrame(()=>{this.previewFrame=0;this.applyPreview();this.changed();});
    this.scheduleRefinement();
  }
  changed(){if(this.refreshMeasure)this.refreshMeasure();this.onChange({page:this.pageNumber,pages:this.doc?.numPages||0,zoom:Math.round(this.scale*100),matches:this.searchMatches?.length||0,match:(this.searchIndex??-1)+1,query:this.searchQuery||'',measuring:!!this.measuring,measure:this.measureText||''});}
  async render(){
    if(!this.page)return;if(this.pointers.size&&this.rendered){this.scheduleRefinement();return;}clearTimeout(this.timer);this.timer=0;const gen=this.generation=(this.generation||0)+1;this.task?.cancel();
    const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;
    const padX=Math.ceil(width*.35),padY=Math.ceil(height*.35),bufferWidth=width+2*padX,bufferHeight=height+2*padY;
    const dpr=Math.min(devicePixelRatio||1,Math.sqrt(16000000/(bufferWidth*bufferHeight)));const canvas=document.createElement('canvas');canvas.width=Math.ceil(bufferWidth*dpr);canvas.height=Math.ceil(bufferHeight*dpr);const ctx=canvas.getContext('2d');
    const state={x:this.x+padX,y:this.y+padY,scale:this.scale};const vp=this.page.getViewport({scale:state.scale,rotation:(this.page.rotate+this.rotation)%360});ctx.fillStyle='#e9eef5';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='white';ctx.fillRect(state.x*dpr,state.y*dpr,vp.width*dpr,vp.height*dpr);
    const task=this.task=this.page.render({canvas,canvasContext:ctx,viewport:vp,transform:[dpr,0,0,dpr,state.x*dpr,state.y*dpr],background:'rgba(0,0,0,0)'});
    try {await task.promise;if(gen!==this.generation)return;this.drawSearchHighlights(ctx,vp,state,dpr);this.canvas.width=canvas.width;this.canvas.height=canvas.height;this.canvas.getContext('2d').drawImage(canvas,0,0);this.canvas.style.width=bufferWidth+'px';this.canvas.style.height=bufferHeight+'px';this.rendered=state;this.applyPreview();this.changed();}catch(e){if(e.name!=='RenderingCancelledException')throw e;}finally{if(this.task===task)this.task=null;canvas.width=1;canvas.height=1;}
  }
  async rotate(){this.rotation=(this.rotation+90)%360;await this.fit();}
  drawSearchHighlights(ctx,vp,state,dpr){
    for(const [index,match] of (this.searchMatches||[]).entries()){
      if(match.page!==this.pageNumber)continue;
      ctx.save();ctx.fillStyle=index===this.searchIndex?'rgba(255,153,0,.45)':'rgba(255,224,0,.3)';ctx.strokeStyle='#b65300';ctx.lineWidth=1.5*dpr;
      for(const quad of match.quads){ctx.beginPath();quad.forEach((p,i)=>{const [x,y]=vp.convertToViewportPoint(...p);if(i)ctx.lineTo((state.x+x)*dpr,(state.y+y)*dpr);else ctx.moveTo((state.x+x)*dpr,(state.y+y)*dpr);});ctx.closePath();ctx.fill();if(index===this.searchIndex)ctx.stroke();}ctx.restore();
    }
  }
  async search(query){
    if(!this.doc)return[];const doc=this.doc,token=this.searchToken=(this.searchToken||0)+1,q=query.trim().toLocaleLowerCase();
    this.searchQuery=query.trim();this.searchMatches=[];this.searchIndex=-1;
    if(!q){await this.render();return[];}
    const matches=[];let hasText=false;
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n),text=await page.getTextContent();
      if(token!==this.searchToken||doc!==this.doc)return[];
      let all='';const spans=[];
      for(const item of text.items){if(!item.str)continue;spans.push({start:all.length,end:all.length+item.str.length,item});all+=item.str+(item.hasEOL?'\n':'');}
      hasText ||= !!all.trim();const lower=all.toLocaleLowerCase();let at=0;
      while((at=lower.indexOf(q,at))>=0){
        const end=at+q.length,quads=[];
        for(const s of spans){if(s.end<=at||s.start>=end)continue;const t=s.item.transform,[a,b,c,d,e,f]=t,len=s.item.str.length,unit=Math.hypot(a,b)||1;
          const lo=Math.max(0,at-s.start)/len,hi=Math.min(len,end-s.start)/len,w=s.item.width;
          const point=(fraction,h)=>[e+a/unit*w*fraction+c*h,f+b/unit*w*fraction+d*h];
          const ascent=text.styles[s.item.fontName]?.ascent??.8;
          quads.push([point(lo,ascent-1),point(hi,ascent-1),point(hi,ascent),point(lo,ascent)]);
        }
        if(quads.length)matches.push({page:n,quads});at=end;
      }
      if(n%4===0)await new Promise(requestAnimationFrame);
    }
    if(token!==this.searchToken||doc!==this.doc)return[];
    this.searchNoText=!hasText;this.searchMatches=matches;this.searchPages=[...new Set(matches.map(m=>m.page))];
    if(matches.length)await this.focusMatch(0);else await this.render();return matches;
  }
  async focusMatch(index){
    const match=this.searchMatches?.[index];if(!match||!this.doc)return;this.searchIndex=index;
    const doc=this.doc,page=await doc.getPage(match.page);if(doc!==this.doc)return;this.page=page;this.pageNumber=match.page;
    const vp=page.getViewport({scale:1,rotation:(page.rotate+this.rotation)%360}),points=match.quads.flat().map(p=>vp.convertToViewportPoint(...p));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
    const h=Math.max(1,Math.max(...ys)-Math.min(...ys));this.scale=Math.max(this.scale,Math.min(3,24/h));
    this.x=this.container.clientWidth/2-x*this.scale;this.y=this.container.clientHeight/2-y*this.scale;await this.render();
  }
  async nextMatch(direction=1){if(this.searchMatches?.length)await this.focusMatch((this.searchIndex+direction+this.searchMatches.length)%this.searchMatches.length);}
  setScaleInfo(info){this.scaleInfo=info;this.refreshMeasure();this.changed();}
  toggleMeasure(){this.measuring=!this.measuring;if(!this.measuring){this.measurePoints=[];this.measureText='';}this.drawMeasure();this.changed();return this.measuring;}
  addMeasurePoint(clientX,clientY){const point=this.clientToPdf(clientX,clientY);if(!point)return;const points=this.measurePoints||[];this.measurePoints=points.length>=2?[]:points.slice();this.measurePoints.push(point);this.refreshMeasure();this.drawMeasure();this.changed();}
  clientToPdf(clientX,clientY){if(!this.page||!this.rendered)return null;const rect=this.container.getBoundingClientRect(),ratio=this.scale/this.rendered.scale;const px=(clientX-rect.left-this.x)/ratio,py=(clientY-rect.top-this.y)/ratio;const vp=this.page.getViewport({scale:this.rendered.scale,rotation:(this.page.rotate+this.rotation)%360});const [x,y]=vp.convertToPdfPoint(px,py);if(!Number.isFinite(x)||!Number.isFinite(y))return null;return {x,y};}
  pdfToScreen(pdfX,pdfY){if(!this.page||!this.rendered)return null;const vp=this.page.getViewport({scale:this.rendered.scale,rotation:(this.page.rotate+this.rotation)%360});const [px,py]=vp.convertToViewportPoint(pdfX,pdfY),ratio=this.scale/this.rendered.scale;return {x:this.x+px*ratio,y:this.y+py*ratio};}
  refreshMeasure(){const points=this.measurePoints||[];if(points.length<2){this.measureText=points.length?'Toque no segundo ponto.':'';return;}const dx=points[1].x-points[0].x,dy=points[1].y-points[0].y,length=Math.hypot(dx,dy);const info=this.scaleInfo,onModel=info?.unitsPerPoint>0&&(!info.modelPage||info.modelPage===this.pageNumber);const value=onModel?length*info.unitsPerPoint:length*25.4/72;const unit=onModel?info.unit:'mm no papel';this.measureText=value.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+unit;}
  drawMeasure(){const svg=this.measureSvg;if(!svg)return;const w=this.container.clientWidth,h=this.container.clientHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.replaceChildren();const pts=(this.measurePoints||[]).map(p=>this.pdfToScreen(p.x,p.y)).filter(Boolean);if(!pts.length)return;const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));svg.append(el);};if(pts.length===2)add('line',{x1:pts[0].x,y1:pts[0].y,x2:pts[1].x,y2:pts[1].y,stroke:'#E5192C','stroke-width':2});for(const point of pts)add('circle',{cx:point.x,cy:point.y,r:5,fill:'#E5192C',stroke:'#fff','stroke-width':2});}
}

const {collectSegments,snapToSegments,centimetresPerUnit}=await import(globalThis.PrumoAssets?.['./measure-snap.js']||new URL('./measure-snap.js',import.meta.url).href);
export function distance2D(a,b){return {distance:Math.hypot(b.x-a.x,b.y-a.y),dx:b.x-a.x,dy:b.y-a.y};}
function nearest(list,point){let best=null,distance=Infinity;if(point)for(const item of list||[]){const d=Math.hypot(item.x-point.x,item.y-point.y);if(d<distance){distance=d;best=item;}}return best;}
// Drawings usually share one dimension factor; only mixed drawings take it from the nearest dimension.
export function drawingScaleAt(scales,point){
 const dims=scales?.dims||[],notes=scales?.notes||[],ratios=new Set(dims.map(d=>d.ratio));
 let ratio=!dims.length?1:dims[0].ratio;
 if(ratios.size>1&&point){
  // A single edited dimension text must not decide the factor, so the five closest vote.
  const close=dims.map(d=>[Math.hypot(d.x-point.x,d.y-point.y),d.ratio]).sort((a,b)=>a[0]-b[0]).slice(0,5),votes=new Map();
  for(const [,value] of close)votes.set(value,(votes.get(value)||0)+1);
  ratio=close[0][1];for(const [value,n] of votes)if(n>votes.get(ratio))ratio=value;
 }
 const denominators=new Set(notes.map(n=>n.denominator));
 const denominator=!notes.length?0:denominators.size===1?notes[0].denominator:(nearest(notes,point)||notes[0]).denominator;
 return {ratio,denominator,dimensions:dims.length};
}
// The unit selector names the unit of the dimension values. A drawing in metres whose
// dimensions print centimetres (factor 100) therefore starts in centimetres.
export function dimensionUnit(insunits,scales){
 const base=centimetresPerUnit[insunits];if(!base)return '';
 const count=new Map();for(const d of scales?.dims||[])count.set(d.ratio,(count.get(d.ratio)||0)+1);
 const ratio=[...count].sort((a,b)=>b[1]-a[1])[0]?.[0]||1,target=base/ratio;
 return Object.keys(centimetresPerUnit).find(unit=>Math.abs(centimetresPerUnit[unit]/target-1)<1e-6)||String(insunits);
}
// Printed text on paper is a few millimetres tall, which singles out the drawing unit for a known scale.
export function guessUnit(scales){
 const notes=scales?.notes||[],dims=scales?.dims||[];if(!notes.length)return '';
 const count=new Map();for(const n of notes)count.set(n.denominator,(count.get(n.denominator)||0)+1);
 const denominator=[...count].sort((a,b)=>b[1]-a[1])[0][0];
 const source=dims.some(d=>d.height>0)?dims:notes,heights=source.map(i=>i.height).filter(h=>h>0).sort((a,b)=>a-b);if(!heights.length)return '';
 const height=heights[heights.length>>1],[low,high]=source===dims?[1,6]:[1.5,25];
 const fits=['4','5','6'].filter(unit=>{const paper=height*centimetresPerUnit[unit]*10/denominator;return paper>=low&&paper<=high;});
 return fits.length===1?fits[0]:'';
}
// Factor from drawing units to real size: 1:50 multiplies by 50, 2:1 by 0.5.
const COMMON_SCALES=[.1,.2,.5,1,2,5,10,20,25,50,75,100,125,200,250,500,1000];
export function scaleLabel(factor){const n=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});return factor<1?n(1/factor)+':1':'1:'+n(factor);}
export function scaleOptions(scales){
 const found=[...new Set((scales?.notes||[]).map(n=>n.denominator))].sort((a,b)=>a-b);
 const list=[{value:'auto',label:'Pelas cotas (automática)'}];
 for(const factor of found)list.push({value:String(factor),label:scaleLabel(factor)+' · nota do desenho'});
 for(const factor of COMMON_SCALES)if(!found.includes(factor))list.push({value:String(factor),label:factor===1?'1:1 · tamanho real':scaleLabel(factor)});
 return list;
}
export class DwgMeasure {
 constructor(viewport,renderer){
  this.viewport=viewport;this.renderer=renderer;this.points=[];this.active=false;this.touches=new Map();
  const $=id=>document.getElementById(id);this.button=$('measure');this.panel=$('measure-panel');this.result=$('measure-result');this.svg=$('measure-overlay');this.units=$('measure-unit');this.loupe=$('measure-loupe');this.target=$('measure-target');
  this.scaleInfo=$('measure-scale');this.scaleChoice=$('measure-scale-choice');this.scaleChoice.onchange=()=>this.update();
  this.button.onclick=()=>{this.active=!this.active;if(this.active){const doc=renderer.getDocument();if(this.document!==doc){this.document=doc;const known=dimensionUnit(doc.measurementUnit,doc.drawingScales),guess=known?'':dimensionUnit(guessUnit(doc.drawingScales),doc.drawingScales);this.units.value=known||guess;this.unitGuessed=!!guess;this.scaleChoice.replaceChildren(...scaleOptions(doc.drawingScales).map(o=>new Option(o.label,o.value)));this.scaleChoice.value='auto';}this.segments=collectSegments(doc);}else{this.aim=null;this.previewPoints=null;this.editingIndex=null;}this.update();};
  this.units.onchange=()=>{this.unitGuessed=false;this.update();};$('measure-clear').onclick=()=>{this.points=[];this.previewPoints=null;this.editingIndex=null;this.aim=null;this.update();};
  const ignore=e=>!!e.target.closest('#measure-panel,button,input,select');
  viewport.addEventListener('pointerdown',e=>{
   if(!this.active)return;if(ignore(e)){e.stopPropagation();return;}if(e.button!==0)return;
   e.stopImmediatePropagation();viewport.setPointerCapture(e.pointerId);this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   this.multitouch=this.touches.size>1;if(this.multitouch){this.previewPoints=null;this.editingIndex=null;this.aim=null;this.update();}else{
    const box=viewport.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let nearest=-1,distance=e.pointerType==='touch'?28:18;
    this.points.forEach((point,i)=>{const p=renderer.worldToScreen(point),d=Math.hypot(p.x-x,p.y-y);if(d<distance){nearest=i;distance=d;}});
    this.editingIndex=nearest>=0?nearest:Math.min(this.points.length,1);this.moveAim(e);
   }
  },true);
  viewport.addEventListener('pointermove',e=>{
   if(!this.active||ignore(e))return;
   const previous=[...this.touches.values()];
   if(this.touches.has(e.pointerId)){
    e.stopImmediatePropagation();this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...this.touches.values()];
    if(next.length===2){this.multitouch=true;const dist=p=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),r=viewport.getBoundingClientRect();
     if(dist(previous)>0)renderer.zoom(dist(next)/dist(previous),{x:(previous[0].x+previous[1].x)/2-r.left,y:(previous[0].y+previous[1].y)/2-r.top});
     renderer.panByScreenDelta((next[0].x+next[1].x-previous[0].x-previous[1].x)/2,(next[0].y+next[1].y-previous[0].y-previous[1].y)/2);return;}
   }
   if(!this.multitouch)this.moveAim(e);
  },true);
  viewport.addEventListener('pointerup',e=>{
   if(!this.active||!this.touches.has(e.pointerId))return;e.stopImmediatePropagation();
   if(!this.multitouch){this.moveAim(e,true);if(this.aim?.snap&&this.units.value){this.points[this.editingIndex??Math.min(this.points.length,1)]=this.aim.snap.point;}else if(!this.units.value)this.result.textContent='Confirme a unidade do DWG antes de medir.';}
   this.previewPoints=null;this.editingIndex=null;this.touches.delete(e.pointerId);if(!this.touches.size)this.multitouch=false;this.update();
  },true);
  for(const event of ['pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>{this.touches.delete(e.pointerId);if(!this.touches.size){this.multitouch=false;this.previewPoints=null;this.editingIndex=null;this.update();}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.active=false;this.previewPoints=null;this.editingIndex=null;this.aim=null;this.update();}});
  this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(viewport);
 }
 moveAim(e,immediate=false){const r=this.viewport.getBoundingClientRect();this.pending={x:e.clientX-r.left,y:e.clientY-r.top,radius:e.pointerType==='touch'?24:14};const run=()=>{this.aimFrame=0;const p=this.pending;if(!this.active||!p)return;const world=this.renderer.screenToWorld(p),snap=snapToSegments(this.segments||[],world,p.radius/this.renderer.getViewState().scale);this.aim={screen:p,point:snap?.point||world,snap};this.previewPoints=null;
if(snap&&this.units.value&&!this.multitouch&&(this.touches.size===1||this.points.length===1)){this.previewPoints=[...this.points];this.previewPoints[this.editingIndex??1]=snap.point;}this.update();};if(immediate){cancelAnimationFrame(this.aimFrame);run();}else if(!this.aimFrame)this.aimFrame=requestAnimationFrame(run);}
 refreshSegments(){if(this.active){this.segments=collectSegments(this.renderer.getDocument());this.previewPoints=null;this.aim=null;this.update();}}
 reset(){this.previewPoints=null;this.editingIndex=null;this.active=false;this.points=[];this.aim=null;this.document=null;this.segments=[];this.touches.clear();cancelAnimationFrame(this.aimFrame);this.aimFrame=0;this.update();}
 update(){
  this.button.setAttribute('aria-pressed',String(this.active));this.viewport.classList.toggle('measuring',this.active);this.panel.hidden=!this.active&&!this.points.length;
  const shown=this.previewPoints||this.points,pair=shown.length===2&&shown[0]&&shown[1];
  const scale=drawingScaleAt(this.document?.drawingScales,pair?{x:(shown[0].x+shown[1].x)/2,y:(shown[0].y+shown[1].y)/2}:this.aim?.point||shown[0]);
  const chosen=this.scaleChoice.value==='auto'?0:Number(this.scaleChoice.value),ratio=chosen||scale.ratio;
  const factor=centimetresPerUnit[this.units.value]*ratio,format=n=>(n*factor).toLocaleString('pt-BR',{maximumFractionDigits:2});
  if(!factor)this.result.textContent='Confirme a unidade do DWG para converter em cm.';
  else if(pair){const m=distance2D(...shown);this.result.textContent=`${format(m.distance)} cm · ΔX ${format(m.dx)} cm · ΔY ${format(m.dy)} cm`;}
  else this.result.textContent=this.points.length?'Selecione o segundo ponto da linha':'Selecione o primeiro ponto da linha';
  const notes=[],times=value=>'×'+value.toLocaleString('pt-BR',{maximumFractionDigits:3});
  if(chosen){
   notes.push('Escala escolhida '+scaleLabel(chosen)+' · medida '+times(chosen));
   if(scale.dimensions&&Math.abs(scale.ratio/chosen-1)>.01)notes.push('As cotas deste trecho indicam '+scaleLabel(scale.ratio)+'. Confira.');
  }else{
   if(scale.denominator)notes.push('Nota no desenho: 1:'+scale.denominator.toLocaleString('pt-BR'));
   if(scale.ratio!==1)notes.push('Medida corrigida pelas cotas deste trecho ('+times(scale.ratio)+')');
   else if(scale.dimensions)notes.push('Cotas conferem com o desenho');
  }
  if(this.unitGuessed&&this.units.value)notes.push('Unidade estimada pela escala. Confira.');
  this.scaleInfo.textContent=notes.join(' · ');this.scaleInfo.hidden=!notes.length;
  this.result.title=chosen?'Distância 2D em centímetros, convertida pela escala escolhida.':'Distância 2D em centímetros, na mesma escala das cotas do desenho. Confira a unidade original do arquivo.';this.draw();
 }
 draw(){
  this.svg.replaceChildren();const points=(this.previewPoints||this.points).map(p=>this.renderer.worldToScreen(p));
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);this.svg.append(el);};
  if(points.length===2){const[a,b]=points;add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#082334','stroke-width':5});add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#63f0e5','stroke-width':2,'stroke-dasharray':'7 4'});}
  for(const p of points)add('circle',{cx:p.x,cy:p.y,r:6,fill:'#63f0e5',stroke:'#082334','stroke-width':2});
  this.loupe.hidden=!this.active||!this.aim;if(this.loupe.hidden)return;
  // The panel height varies with the scale notes; keep the loupe below it except in short landscape screens.
  const below=!this.panel.hidden&&!matchMedia('(max-height:500px)').matches;
  this.loupe.style.top=below?Math.max(170,this.panel.getBoundingClientRect().bottom-this.viewport.getBoundingClientRect().top+8)+'px':'';
  const point=this.aim.point,p=this.renderer.worldToScreen(point),color=this.aim.snap?'#63f0e5':'#ffcc70';
  add('path',{d:`M${p.x-10} ${p.y}h20 M${p.x} ${p.y-10}v20`,stroke:color,'stroke-width':2});
  const c=this.loupe.querySelector('canvas'),ctx=c.getContext('2d'),source=this.renderer.canvas,base=this.renderer.renderedView||this.renderer.getViewState();
  const sx=(source.clientWidth/2+(point.x-base.centerX)*base.scale)*source.width/source.clientWidth,sy=(source.clientHeight/2-(point.y-base.centerY)*base.scale)*source.height/source.clientHeight;
  const magnification=3*this.renderer.getViewState().scale/base.scale*2/(source.width/source.clientWidth);
  ctx.fillStyle=this.renderer.getOptions().background;ctx.fillRect(0,0,300,300);ctx.save();ctx.translate(150,150);ctx.scale(magnification,magnification);ctx.drawImage(source,-sx,-sy);ctx.restore();
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(130,150);ctx.lineTo(170,150);ctx.moveTo(150,130);ctx.lineTo(150,170);ctx.stroke();ctx.strokeRect(143,143,14,14);
  this.target.textContent=this.aim.snap?this.aim.snap.label+' · 3×':'Aproxime de uma linha · 3×';
 }
}

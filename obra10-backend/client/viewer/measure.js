const {collectSegments,snapToSegments,centimetresPerUnit}=await import(globalThis.PrumoAssets?.['./measure-snap.js']||new URL('./measure-snap.js',import.meta.url).href);
export function distance2D(a,b){return {distance:Math.hypot(b.x-a.x,b.y-a.y),dx:b.x-a.x,dy:b.y-a.y};}
export class DwgMeasure {
 constructor(viewport,renderer){
  this.viewport=viewport;this.renderer=renderer;this.points=[];this.active=false;this.touches=new Map();
  const $=id=>viewport.querySelector('#'+id);this.button=$('measure');this.panel=$('measure-panel');this.result=$('measure-result');this.hint=$('measure-hint');this.svg=$('measure-overlay');this.units=$('measure-unit');this.scaleSelect=$('measure-scale');this.scaleCustom=$('measure-scale-custom');this.calibrateRow=$('measure-calibrate-row');this.knownInput=$('measure-known');this.knownUnit=$('measure-known-unit');this.calibrateBtn=$('measure-calibrate');this.loupe=$('measure-loupe');this.target=$('measure-target');
  this.restoreScale();
  this.button.onclick=()=>{this.active=!this.active;if(this.active){const doc=renderer.getDocument();if(this.document!==doc){this.document=doc;this.units.value=centimetresPerUnit[doc.measurementUnit]?String(doc.measurementUnit):'';}this.segments=collectSegments(doc);}else{this.aim=null;this.previewPoints=null;this.editingIndex=null;}this.update();};
  this.units.onchange=()=>this.update();
  this.scaleSelect.onchange=()=>{this.syncCustomScale();this.persistScale();this.update();};
  this.scaleCustom.oninput=()=>{this.persistScale();this.update();};
  this.calibrateBtn.onclick=()=>this.calibrateFromCota();
  this.knownInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.calibrateFromCota();}};
  $('measure-clear').onclick=()=>{this.points=[];this.previewPoints=null;this.editingIndex=null;this.aim=null;this.update();};
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
 scaleFactor(){
  const raw=this.scaleSelect?.value==='custom'?Number(this.scaleCustom?.value):Number(this.scaleSelect?.value);
  return Number.isFinite(raw)&&raw>0?raw:1;
 }
 persistScale(){
  try{
    const value=this.scaleSelect.value==='custom'?`custom:${this.scaleCustom.value||''}`:this.scaleSelect.value;
    localStorage.setItem('obra10_dwg_measure_scale',value);
  }catch{/* ignore */}
 }
 restoreScale(){
  let stored='1';
  try{stored=localStorage.getItem('obra10_dwg_measure_scale')||'1';}catch{/* ignore */}
  if(stored.startsWith('custom:')){
    this.scaleSelect.value='custom';
    this.scaleCustom.value=stored.slice(7);
  }else if([...this.scaleSelect.options].some(o=>o.value===stored)){
    this.scaleSelect.value=stored;
  }else{
    this.scaleSelect.value='custom';
    this.scaleCustom.value=stored;
  }
  this.syncCustomScale();
 }
 syncCustomScale(){
  const custom=this.scaleSelect.value==='custom';
  this.scaleCustom.hidden=!custom;
  if(custom&&!this.scaleCustom.value)this.scaleCustom.value='75';
 }
 formatLength(cm){
  const abs=Math.abs(cm);
  if(abs>=100)return `${(cm/100).toLocaleString('pt-BR',{maximumFractionDigits:2})} m`;
  return `${cm.toLocaleString('pt-BR',{maximumFractionDigits:2})} cm`;
 }
 parseKnown(value){
  const raw=String(value||'').trim().replace(/\s/g,'');
  if(!raw)return NaN;
  if(raw.includes(',')&&raw.includes('.'))return Number(raw.replace(/\./g,'').replace(',', '.'));
  return Number(raw.replace(',', '.'));
 }
 knownToCm(value){
  const n=this.parseKnown(value);
  if(!Number.isFinite(n)||n<=0)return NaN;
  const unit=this.knownUnit?.value||'cm';
  if(unit==='m')return n*100;
  if(unit==='mm')return n*0.1;
  return n;
 }
 calibrateFromCota(){
  const shown=this.previewPoints||this.points;
  const factor=centimetresPerUnit[this.units.value];
  if(!factor||shown.length<2||!shown[0]||!shown[1]){
    this.result.textContent='Marque as duas pontas da cota e depois calibre.';
    return;
  }
  const knownCm=this.knownToCm(this.knownInput.value);
  if(!Number.isFinite(knownCm)){
    this.result.textContent='Digite o valor da cota, por exemplo 365,5.';
    return;
  }
  const raw=distance2D(...shown).distance;
  if(!(raw>1e-9))return;
  const factorScale=knownCm/(raw*factor);
  const presets=['1','20','25','50','75','100','125','200','250','500'];
  const match=presets.find(p=>Math.abs(Number(p)-factorScale)/factorScale<0.015);
  if(match){
    this.scaleSelect.value=match;
  }else{
    this.scaleSelect.value='custom';
    this.scaleCustom.value=String(Number(factorScale.toPrecision(6)));
  }
  this.syncCustomScale();
  this.persistScale();
  this.update();
 }
 update(){
  this.button.setAttribute('aria-pressed',String(this.active));this.viewport.classList.toggle('measuring',this.active);this.panel.hidden=!this.active&&!this.points.length;
  const shown=this.previewPoints||this.points;const factor=centimetresPerUnit[this.units.value];const scale=this.scaleFactor();
  const ready=!!(factor&&shown.length===2&&shown[0]&&shown[1]);
  if(this.calibrateRow)this.calibrateRow.hidden=!ready;
  if(!factor)this.result.textContent='Confirme a unidade do DWG para converter em cm.';
  else if(ready){
    const m=distance2D(...shown);
    const fileCm=n=>n*factor;
    const realCm=n=>n*factor*scale;
    this.result.textContent=`${this.formatLength(realCm(m.distance))} · ΔX ${this.formatLength(realCm(m.dx))} · ΔY ${this.formatLength(realCm(m.dy))}`;
    const arquivo=this.formatLength(fileCm(m.distance));
    if(this.hint){
      this.hint.textContent=scale===1
        ?`No arquivo: ${arquivo}. Se a cota do desenho for outra, calibre abaixo. 1:75 da prancha quase nunca se multiplica — as cotas já estão em tamanho real.`
        :`No arquivo: ${arquivo}. Fator ${scale.toLocaleString('pt-BR',{maximumFractionDigits:4})}. Calibre numa cota se ainda divergir.`;
    }
  }
  else {
    this.result.textContent=this.points.length?'Selecione o segundo ponto da linha':'Selecione o primeiro ponto da linha';
    if(this.hint)this.hint.textContent='Marque as duas pontas de uma cota conhecida (ex.: 365,5) e use Calibrar. A escala 1:75 da prancha é de impressão, não do modelo.';
  }
  this.result.title='Calibre numa cota do desenho para acertar o fator.';
  this.draw();
 }
 draw(){
  this.svg.replaceChildren();const points=(this.previewPoints||this.points).map(p=>this.renderer.worldToScreen(p));
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);this.svg.append(el);};
  if(points.length===2){const[a,b]=points;add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#082334','stroke-width':5});add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#63f0e5','stroke-width':2,'stroke-dasharray':'7 4'});}
  for(const p of points)add('circle',{cx:p.x,cy:p.y,r:6,fill:'#63f0e5',stroke:'#082334','stroke-width':2});
  this.loupe.hidden=!this.active||!this.aim;if(this.loupe.hidden)return;
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

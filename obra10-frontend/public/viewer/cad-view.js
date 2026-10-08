import { CadCanvasRenderer, normalizeDwgDatabase, resolveCadColor, cadEntityWorldStrokeWidth, computeCadDocumentBounds } from './vendor/cad-renderer.js';

// The parser keeps the drawing coordinates and authored properties. Canvas is
// redrawn at devicePixelRatio after each short interaction preview.
export function prepareDrawing(database, name) {
  const doc = normalizeDwgDatabase(database, name, undefined, { keepRaw: false });
  doc.measurementUnit = Number(database.header?.INSUNITS || 0);
  doc.displayLineweights = database.header?.LWDISPLAY !== 0;
  const styles = new Map((database.tables.STYLE?.entries || []).filter(s => s?.name).map(s => [s.name, s]));
  const raw = new Map();
  for (const block of database.tables?.BLOCK_RECORD?.entries || []) for (const e of block?.entities || []) if (e) raw.set(e.handle, e);
  for (const e of database.entities || []) if (e) raw.set(e.handle, e);
  const lineweights = [0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106,120,140,158,200,211];
  const decodeWeight = value => value === 29 ? -1 : value === 30 ? -2 : value === 31 ? -3 : lineweights[value] ?? value;
  for(const layer of database.tables?.LAYER?.entries || []) if(layer?.name) {
    for(const key of [layer.name, layer.name.toLowerCase()]) if(doc.layers[key]) doc.layers[key].lineweight = decodeWeight(layer.lineweight);
  }
  const substitutions = new Set();
  const visited = new Set();
  function decorate(entities) {
    for (const entity of entities || []) {
      if (!entity || visited.has(entity)) continue;
      visited.add(entity);
      const source = raw.get(entity.handle);
      if (!source) continue;
      entity.lineweight = decodeWeight(source.lineweight);
      if(source.type==='MULTILEADER' && source.hasMText && !source.hasBlock && source.leaderLineType===1 && source.textAnchor) {
        const color=(value)=>{const c=Number(value)>>>0,method=c>>>24;return method===0xC2?{trueColor:c&0xFFFFFF,colorIndex:undefined}:method===0xC3?{colorIndex:c&0xFFFF}:method===0xC1?{colorIndex:0}:{colorIndex:256};};
        const common={layer:entity.layer,isVisible:entity.isVisible,lineweight:entity.lineweight};
        const children=[];
        const textStyle=(database.tables.STYLE?.entries||[]).find(s=>s.handle===source.textStyleId);
        const font=(textStyle?.font||'Arial').replace(/\.(ttf|otf)$/i,'');
        children.push({...common,...color(source.textColor),type:'MTEXT',kind:'text',text:source.textContent,insertionPoint:{...source.textAnchor},textHeight:source.textHeight,rotation:source.textRotation||0,fontFamily:font,attachmentPoint:source.textAttachmentPoint,lineSpacingFactor:source.textLineSpacingFactor||1});
        for(const section of source.leaderSections||[]) {
          for(const line of section.leaderLines||[]) {
            const points=[...(line.vertices||[])];
            if(section.lastLeaderLinePointSet)points.push(section.lastLeaderLinePoint);
            if(source.doglegEnabled && section.doglegVectorSet && section.lastLeaderLinePointSet){const p=section.lastLeaderLinePoint,v=section.doglegVector,length=section.doglegLength??source.doglegLength??0;points.push({x:p.x+v.x*length,y:p.y+v.y*length});}
            if(points.length>1)children.push({...common,...color(source.leaderLineColor),type:'LWPOLYLINE',kind:'polyline',vertices:points.map(p=>({...p})),isClosed:false});
          }
        }
        // The wrapper does not expose the resolved arrowhead definition.
        children.push({...common,type:'MULTILEADER: ponta de seta não recuperada',kind:'unsupported'});
        const name='@PRUMO_MLEADER_'+source.handle;
        doc.blocks[name]={name,basePoint:{x:0,y:0},entities:children};
        entity.kind='insert';entity.blockName=name;entity.insertionPoint={x:0,y:0};entity.rotation=0;entity.scale={x:1,y:1,z:1};
      }
      if(source.type==='SOLID' && source.corner1 && source.corner2 && source.corner3) {
        // DXF stores corner 3 and 4 in the opposite order to polygon traversal.
        entity.vertices=[source.corner1,source.corner2,source.corner4||source.corner3,source.corner3].map(p=>({...p}));
      }
      if (source.type === 'DIMENSION') {
        const block = doc.blocks[source.name] || doc.blocks[source.name?.toLowerCase()];
        if (block?.entities?.length) {
          // Dimension picture blocks contain the saved arrows, lines and values.
          entity.kind = 'insert';
          entity.blockName = source.name;
          entity.insertionPoint = {...block.basePoint};
          entity.rotation = 0;
          entity.scale = {x:1,y:1,z:1};
        } else entity.missingDimensionPicture = true;
      }
      if (source.type === 'HATCH') {
        entity.hatch = source;
        // Bounds only; actual contours below use exact Canvas arcs/ellipses.
        entity.loops = (source.boundaryPaths || []).map(p => {
          if (!p) return {vertices:[]};
          const vertices = [...(p.vertices || [])].map(v=>({x:v.x,y:v.y}));
          const extent=(c,r)=>{vertices.push({x:c.x-r,y:c.y-r},{x:c.x+r,y:c.y+r});};
          for(let i=0;i<(p.vertices?.length||0);i++) {
            const a=p.vertices[i],b=p.vertices[(i+1)%p.vertices.length],bulge=a.bulge||0;
            if(Math.abs(bulge)>1e-12){const dx=b.x-a.x,dy=b.y-a.y,k=(1-bulge*bulge)/(4*bulge),c={x:(a.x+b.x)/2-dy*k,y:(a.y+b.y)/2+dx*k};extent(c,Math.hypot(a.x-c.x,a.y-c.y));}
          }
          for(const edge of p.edges||[]) {
            if(!edge) continue;
            if(edge.type===1)vertices.push(edge.start,edge.end);
            else if(edge.type===2)extent(edge.center,edge.radius);
            else if(edge.type===3)extent(edge.center,Math.hypot(edge.end.x,edge.end.y));
            else vertices.push(...(edge.controlPoints||[]));
          }
          return {vertices};
        });
        // These three points travel through the renderer's block/view matrices.
        entity.points = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];
      }
      const style = styles.get(source.styleName);
      const font = (style?.font || '').split(/[\\/]/).pop();
      if (/\.shx$/i.test(font)) substitutions.add(font);
      const family = /\.shx$/i.test(font) ? 'Arial' : font.replace(/\.(ttf|otf)$/i, '') || 'Arial';
      entity.fontFamily = family;
      entity.sourceFont = font;
      if(source.type==='MTEXT'&&source.rectWidth>0&&source.textHeight>0)entity.textBoxRatio=source.rectWidth/source.textHeight;
      entity.obliqueAngle = source.obliqueAngle ?? style?.obliqueAngle ?? 0;
      entity.attachmentPoint = source.attachmentPoint;
      entity.lineSpacingFactor = source.lineSpacingFactor || source.lineSpacing || 1;
      if (source.xScale === undefined && style?.widthFactor) entity.xScale = style.widthFactor;
      if (source.textHeight === 0 && style?.fixedTextHeight) entity.textHeight = style.fixedTextHeight;
    }
  }
  decorate(doc.entities);
  for (const block of Object.values(doc.blocks || {})) decorate(block?.entities);
  const orderTables = new Map((database.drawOrders || []).map(t=>[String(t.blockHandle).toUpperCase(),t.entries]));
  const blocksByName = new Map((database.tables?.BLOCK_RECORD?.entries || []).filter(b => b?.name).map(b=>[b.name.toLowerCase(),b]));
  function sortEntities(entities, blockHandle) {
    const entries=orderTables.get(String(blockHandle).toUpperCase());
    if(!entries)return;
    const key=e=>{if(!e)return 0n;const handle=String(e.handle||'0').toUpperCase(),value=entries[handle]??handle;return /^[0-9A-F]+$/.test(value)?BigInt('0x'+value):0n;};
    const keys=new Map(entities.map(e=>[e,key(e)]));
    entities.sort((a,b)=>keys.get(a)<keys.get(b)?-1:keys.get(a)>keys.get(b)?1:0);
  }
  const model=blocksByName.get('*model_space');
  sortEntities(doc.entities,model?.handle || raw.get(doc.entities[0]?.handle)?.ownerBlockRecordSoftId);
  for(const block of new Set(Object.values(doc.blocks||{})))sortEntities(block.entities,blocksByName.get(block.name.toLowerCase())?.handle);
  return { document: doc, substitutedFonts: [...substitutions] };
}

// Bounds of visible model geometry, independent of paper sizes and saved views.
export function drawingFitBounds(doc) {
  const visible=(e,inside=false)=>{
    const layer=inside&&(!e.layer||e.layer==='0')?null:(doc.layers[e.layer]||doc.layers[e.layer?.toLowerCase()]);
    return e.isVisible!==false&&layer?.isVisible!==false&&layer?.isFrozen!==true;
  };
  const blocks={},cache=new Map();
  for(const [key,block]of Object.entries(doc.blocks||{})){
    if(!cache.has(block))cache.set(block,{...block,entities:block.entities.filter(e=>visible(e,true))});
    blocks[key]=cache.get(block);
  }
  return computeCadDocumentBounds({...doc,pages:[],savedView:undefined,blocks,entities:doc.entities.filter(e=>visible(e))});
}

export class CrispCadRenderer extends CadCanvasRenderer {
  // The app handles mouse and multitouch uniformly. The stock renderer only
  // drags one pointer, which would conflict with pinch zoom.
  bindEvents() {}

  setDocument(document) {
    this.boundsCache = new WeakMap();
    this.insertCache = new WeakMap();
    this.layerEntityCache = new WeakMap();
    this.hatchCache = new WeakMap();
    this.wrapCache = new Map();
    this.fontCaps = new Map();
    this.textMetrics = new Map();
    super.setDocument(document);
  }

  suspendDocument(){
    clearTimeout(this.settleTimer);clearTimeout(this.refineTimer);this.refineTimer=0;
    if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.cancelRefinement();
    const state={};for(const key of ['sourceDocument','document','bounds','boundsCache','insertCache','layerEntityCache','hatchCache','wrapCache','fontCaps','textMetrics','imageCache'])state[key]=this[key];
    return state;
  }
  resumeDocument(state){
    this.suspendDocument();Object.assign(this,state);this.fittedToWindow=false;this.renderedView=null;
  }

  setLayerVisibility(name,visible,frozen=false){
    const key=name.toLowerCase();
    for(const doc of [this.getDocument(),this.getSourceDocument()]){
      for(const layer of Object.values(doc?.layers||{}))if(layer.name?.toLowerCase()===key){layer.isVisible=visible;layer.isFrozen=frozen;}
    }
  }

  refreshLayers(){
    // Rebuild transformed block children and cancel any in-flight old frame.
    this.insertCache=new WeakMap();this.layerEntityCache=new WeakMap();
    this.render();
  }

  fitToView(padding=.96) {
    const doc=this.getDocument();
    if(!doc)return super.fitToView(padding,'extents');
    const b=drawingFitBounds(doc);
    if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))return super.fitToView(padding,'extents');
    // Keep geometry clear of the view label and measurement readout.
    const panel=this.canvas.parentElement?.querySelector('#measure-panel:not([hidden])');
    const top=Math.min(this.cssHeight*.3,panel?panel.offsetTop+panel.offsetHeight+12:52);
    const side=Math.min(24,this.cssWidth*.06),bottom=Math.min(24,this.cssHeight*.06);
    const w=Math.max(1,this.cssWidth-2*side),h=Math.max(1,this.cssHeight-top-bottom);
    const scale=this.clampScale(Math.min(w/Math.max(b.maxX-b.minX,1e-9),h/Math.max(b.maxY-b.minY,1e-9))*padding);
    this.fitScale=scale;
    this.view={centerX:b.minX+(b.maxX-b.minX)/2,centerY:b.minY+(b.maxY-b.minY)/2+(top-bottom)/(2*scale),scale};
    this.fittedToWindow=true;this.render();
    // Some DWGs have empty/unsupported objects far from the actual artwork.
    // Refine against the pixels we really drew, without deleting any entities.
    for(let pass=0;pass<2;pass++){
    const ink=this.visibleInkBounds();
    if(ink&&ink.maxX>ink.minX&&ink.maxY>ink.minY){
      const center=this.screenToWorld({x:(ink.minX+ink.maxX)/2,y:(ink.minY+ink.maxY)/2});
      const next=this.clampScale(this.view.scale*Math.min(w/(ink.maxX-ink.minX),h/(ink.maxY-ink.minY))*padding);
      this.fitScale=next;
      this.view={centerX:center.x,centerY:center.y+(top-bottom)/(2*next),scale:next};
      this.render();
    }
    }
    this.emitViewChange();
  }

  visibleInkBounds(){
    const context=this.ctx,cw=this.canvas.width,ch=this.canvas.height;
    if(!cw||!ch)return null;
    // Match the renderer's configured background, not a corner that may contain geometry.
    const probe=document.createElement('canvas');probe.width=probe.height=1;
    const pc=probe.getContext('2d');pc.fillStyle=this.getOptions().background;pc.fillRect(0,0,1,1);
    const bg=pc.getImageData(0,0,1,1).data;
    let data;try{data=context.getImageData(0,0,cw,ch).data;}catch{return null;}
    let minX=cw,minY=ch,maxX=-1,maxY=-1;
    for(let y=0;y<ch;y++)for(let x=0,i=y*cw*4;x<cw;x++,i+=4){
      if(data[i+3]&&Math.max(Math.abs(data[i]-bg[0]),Math.abs(data[i+1]-bg[1]),Math.abs(data[i+2]-bg[2]))>3){
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
    return maxX<0?null:{minX:minX/cw*this.cssWidth,minY:minY/ch*this.cssHeight,maxX:(maxX+1)/cw*this.cssWidth,maxY:(maxY+1)/ch*this.cssHeight};
  }

  render() {
    if(this.interacting && this.renderedView) {
      if(!this.frame) this.frame=requestAnimationFrame(()=>{
        this.frame=0;
        this.previewView();
      });
      if(!this.refineTimer&&!this.refinement)this.refineTimer=setTimeout(()=>{this.refineTimer=0;this.refineProgressively();},24);
      clearTimeout(this.settleTimer);
      this.settleTimer=setTimeout(()=>{
        this.settleTimer=0;
        const target=this.refinement?.view,current=this.getViewState();
        if(target&&(target.scale!==current.scale||target.centerX!==current.centerX||target.centerY!==current.centerY)){
          this.cancelRefinement();clearTimeout(this.refineTimer);this.refineTimer=0;this.refineProgressively();
        }
      },80);
      return this.getStats();
    }
    clearTimeout(this.settleTimer);this.settleTimer=0;
    this.cancelRefinement();
    clearTimeout(this.refineTimer);
    this.refineTimer=0;
    if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
    this.canvas.style.transform='';
    this.frameWidth=this.canvas.clientWidth||1;
    this.frameHeight=this.canvas.clientHeight||1;
    this.visibleUpper=this.screenToWorld({x:-32,y:-32});
    this.visibleLower=this.screenToWorld({x:this.frameWidth+32,y:this.frameHeight+32});
    const stats=super.render();
    this.renderedView=this.getViewState();
    return stats;
  }

  previewView(){
    const base=this.renderedView,view=this.getViewState();if(!base)return;
    const ratio=view.scale/base.scale;
    this.canvas.style.transformOrigin='50% 50%';
    this.canvas.style.transform=ratio===1&&base.centerX===view.centerX&&base.centerY===view.centerY?'':`translate(${(base.centerX-view.centerX)*view.scale}px,${(view.centerY-base.centerY)*view.scale}px) scale(${ratio})`;
  }

  cancelRefinement(){
    if(this.refinement){clearTimeout(this.refinement.timer);this.refinement.channel?.port1.close();this.refinement.channel?.port2.close();}
    this.refinement=null;
  }

  refineProgressively(){
    const doc=this.getDocument();if(!doc||this.refinement)return;
    const buffer=this.backCanvas||(this.backCanvas=document.createElement('canvas'));
    if(buffer.width!==this.canvas.width)buffer.width=this.canvas.width;
    if(buffer.height!==this.canvas.height)buffer.height=this.canvas.height;
    const job={view:this.getViewState(),ctx:buffer.getContext('2d',{willReadFrequently:true}),index:0,cpuMs:0,stats:{total:0,drawn:0,skipped:0,byType:{},unsupported:{},renderElapsedMs:0,backend:'canvas2d'}};
    this.refinement=job;
    job.channel=new MessageChannel();
    const step=()=>{
      if(this.refinement!==job)return;
      const started=performance.now(),old={ctx:this.ctx,view:this.view,stats:this.stats,upper:this.visibleUpper,lower:this.visibleLower};
      this.ctx=job.ctx;this.view=job.view;this.stats=job.stats;
      this.visibleUpper=this.screenToWorld({x:-32,y:-32});this.visibleLower=this.screenToWorld({x:this.cssWidth+32,y:this.cssHeight+32});
      try{
        if(job.index===0){this.clearCanvas();if(this.opts.showPageBounds&&doc.pages?.length)this.drawPageBounds(doc);}
        // Yield between entities so touch input can run while vectors are redrawn.
        do{if(job.index>=doc.entities.length)break;this.drawEntityTracked(doc.entities[job.index++],0);}while(performance.now()-started<6);
      }catch(error){this.cancelRefinement();throw error;}
      finally{this.ctx=old.ctx;this.view=old.view;this.stats=old.stats;this.visibleUpper=old.upper;this.visibleLower=old.lower;}
      job.cpuMs+=performance.now()-started;
      if(job.index<doc.entities.length){job.channel.port2.postMessage(0);return;}
      // Only publish complete frames; never display a partially painted drawing.
      this.ctx.save();this.ctx.setTransform(1,0,0,1,0,0);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.ctx.drawImage(buffer,0,0);this.ctx.restore();
      this.renderedView=job.view;this.stats=job.stats;this.stats.renderElapsedMs=job.cpuMs;this.refinement=null;job.channel.port1.close();job.channel.port2.close();this.previewView();
      this.onStats?.(this.getStats());
      const current=this.getViewState();
      if(current.scale!==job.view.scale||current.centerX!==job.view.centerX||current.centerY!==job.view.centerY)this.refineTimer=setTimeout(()=>{this.refineTimer=0;this.refineProgressively();},0);
    };
    job.channel.port1.onmessage=step;job.channel.port2.postMessage(0);
  }

  get cssWidth(){return this.frameWidth||this.canvas.clientWidth||1;}
  get cssHeight(){return this.frameHeight||this.canvas.clientHeight||1;}
  setViewState(view){this.fittedToWindow=false;super.setViewState(view);}
  resize(){this.frameWidth=this.canvas.clientWidth||1;this.frameHeight=this.canvas.clientHeight||1;super.resize();if(this.fittedToWindow&&this.getDocument())this.fitToView();}

  destroy(){clearTimeout(this.settleTimer);this.cancelRefinement();this.backCanvas=null;clearTimeout(this.refineTimer);if(this.frame)cancelAnimationFrame(this.frame);super.destroy();}

  zoom(factor, point) {
    this.fittedToWindow=false;
    this.interacting=true;
    try {super.zoom(factor,point);} finally {this.interacting=false;}
  }

  panByScreenDelta(x,y) {
    this.fittedToWindow=false;
    this.interacting=true;
    try {super.panByScreenDelta(x,y);} finally {this.interacting=false;}
  }

  drawEntityTracked(entity, depth) {
    if(!entity) return;
    if(this.captureChildren && depth===this.captureChildren.depth+1) this.captureChildren.items.push(entity);
    if (depth > 0 && (!entity.layer || entity.layer === '0') && this.insertLayer) {
      let inherited=this.layerEntityCache?.get(entity);
      if(!inherited || inherited.layer!==this.insertLayer){inherited={...entity,layer:this.insertLayer};this.layerEntityCache?.set(entity,inherited);}
      entity=inherited;
    }
    if(entity.missingDimensionPicture) return this.markSkipped('DIMENSION: bloco de cota ausente');
    // Cache model bounds once. Offscreen vectors do not need Canvas calls on zoom.
    if (entity.kind !== 'text' && entity.kind !== 'image') {
      let bounds = this.boundsCache?.get(entity);
      if (!bounds) {
        bounds = computeCadDocumentBounds({ ...this.getDocument(), pages:[], entities: [entity] });
        this.boundsCache?.set(entity, bounds);
      }
      const upper = this.visibleUpper;
      const lower = this.visibleLower;
      if (Number.isFinite(bounds.minX) && (bounds.maxX < upper.x || bounds.minX > lower.x || bounds.maxY < lower.y || bounds.minY > upper.y)) {
        this.stats.total++; this.stats.skipped++;
        return;
      }
    }
    super.drawEntityTracked(entity, depth);
  }

  resolveWeight(entity) {
    let weight = entity.lineweight;
    if (weight === -2) weight = this.inheritedLineweight;
    if (weight == null || weight < 0) weight = this.lookupLayer(entity.layer)?.lineweight;
    return Number.isFinite(weight) && weight >= 0 ? weight : 25;
  }

  drawInsert(entity, depth) {
    const previous = this.inheritedLineweight;
    const previousLayer = this.insertLayer;
    this.insertLayer = entity.layer;
    this.inheritedLineweight = this.resolveWeight(entity);
    const capture=this.captureChildren;
    try {
      const cached=this.insertCache?.get(entity);
      if(cached) for(const child of cached)this.drawEntityTracked(child,depth+1);
      else {
        const current={depth,items:[]};this.captureChildren=current;
        super.drawInsert(entity,depth);
        if(current.items.length)this.insertCache?.set(entity,current.items);
      }
    } finally { this.captureChildren=capture;this.inheritedLineweight = previous; this.insertLayer = previousLayer; }
  }

  markSkipped(type) {
    this.stats.skipped++;
    this.stats.unsupported[type] = (this.stats.unsupported[type] || 0) + 1;
  }

  drawImage(entity) {
    if(!entity.rasterImage){return entity.rasterMissing?this.markSkipped('IMAGE: arquivo externo ausente'):super.drawImage(entity);}
    const img=entity.rasterImage,[a,b,c]=entity.points.map(p=>this.worldToScreen(p));
    const ctx=this.ctx;ctx.save();
    try {
      ctx.setTransform(this.dpr*(b.x-a.x)/img.naturalWidth,this.dpr*(b.y-a.y)/img.naturalWidth,this.dpr*(c.x-a.x)/img.naturalHeight,this.dpr*(c.y-a.y)/img.naturalHeight,this.dpr*a.x,this.dpr*a.y);
      const s=entity.rasterSource;
      if(s?.clipping && (s.flags&4) && s.clippingBoundaryPath?.length){
        const pts=s.clippingBoundaryPath.map(p=>({x:p.x/s.imageSize.x*img.naturalWidth,y:(1-p.y/s.imageSize.y)*img.naturalHeight}));ctx.beginPath();
        if(s.clipMode===1)ctx.rect(-img.naturalWidth,-img.naturalHeight,img.naturalWidth*3,img.naturalHeight*3);
        if(pts.length===2)ctx.rect(pts[0].x,pts[0].y,pts[1].x-pts[0].x,pts[1].y-pts[0].y);else{ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();}ctx.clip('evenodd');
      }
      ctx.drawImage(img,0,0);this.stats.drawn++;
    } finally {ctx.restore();}
  }

  drawEntity(entity,type,depth){
    if(entity.isCadRaster)return this.drawImage(entity);
    return super.drawEntity(entity,type,depth);
  }

  drawHatch(entity) {
    const h = entity.hatch;
    if (!h?.boundaryPaths?.length || h.gradientFlag || (h.extrusionDirection && (Math.abs(h.extrusionDirection.x)>1e-8 || Math.abs(h.extrusionDirection.y)>1e-8 || h.extrusionDirection.z<0))) return this.markSkipped('HATCH: contorno/degradê/plano não suportado');
    let paths = h.boundaryPaths;
    if (h.hatchStyle === 1) paths = paths.filter(p => p.boundaryPathTypeFlag & 17);
    if (h.hatchStyle === 2) paths = paths.filter(p => p.boundaryPathTypeFlag & 1);
    if (!paths.length) return this.markSkipped('HATCH: ilhas sem classificação');
    const cachedHatch=this.hatchCache?.get(h);
    const path = cachedHatch?.path || new Path2D();
    const samples = cachedHatch?.samples || [];
    const point = p => { if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) throw Error(); samples.push(p); return p; };
    const arc = (c,rx,ry,rotation,start,end,ccw) => {
      point(c);
      if (![rx,ry,rotation,start,end].every(Number.isFinite) || rx<=0 || ry<=0) throw Error();
      path.ellipse(c.x,c.y,rx,ry,rotation,start,end,!ccw);
      // Conservative bounds for pattern coverage (including rotated ellipses).
      const r=Math.max(rx,ry); samples.push({x:c.x-r,y:c.y-r},{x:c.x+r,y:c.y+r});
    };
    try {
      for (const p of cachedHatch ? [] : paths) {
        if (p.vertices?.length) {
          const vs=p.vertices; point(vs[0]); path.moveTo(vs[0].x,vs[0].y);
          for(let i=0;i<vs.length;i++) {
            const a=point(vs[i]),b=point(vs[(i+1)%vs.length]),bulge=a.bulge||0;
            if(Math.abs(bulge)<1e-12) path.lineTo(b.x,b.y);
            else {
              const dx=b.x-a.x,dy=b.y-a.y,k=(1-bulge*bulge)/(4*bulge);
              const c={x:(a.x+b.x)/2-dy*k,y:(a.y+b.y)/2+dx*k};
              const r=Math.hypot(a.x-c.x,a.y-c.y),start=Math.atan2(a.y-c.y,a.x-c.x);
              arc(c,r,r,0,start,start+4*Math.atan(bulge),bulge>0);
            }
          }
        } else if(p.edges?.length) {
          for(let i=0;i<p.edges.length;i++) {
            const e=p.edges[i];
            if(!e) continue;
            if(e.type===1) {point(e.start);point(e.end);if(i===0)path.moveTo(e.start.x,e.start.y);path.lineTo(e.end.x,e.end.y);}
            else if(e.type===2 || e.type===3) {
              const rx=e.type===2?e.radius:Math.hypot(e.end.x,e.end.y),ry=e.type===2?rx:rx*e.lengthOfMinorAxis,rot=e.type===2?0:Math.atan2(e.end.y,e.end.x);
              if(i===0)path.moveTo(e.center.x+rx*Math.cos(e.startAngle)*Math.cos(rot)-ry*Math.sin(e.startAngle)*Math.sin(rot),e.center.y+rx*Math.cos(e.startAngle)*Math.sin(rot)+ry*Math.sin(e.startAngle)*Math.cos(rot));
              arc(e.center,rx,ry,rot,e.startAngle,e.endAngle,e.isCCW!==false);
            } else throw Error();
          }
        } else throw Error();
        path.closePath();
      }
    } catch {return this.markSkipped('HATCH: contorno não suportado');}
    if(!cachedHatch)this.hatchCache?.set(h,{path,samples});
    const [o,x,y]=entity.points.map(p=>this.worldToScreen(p));
    const a=x.x-o.x,b=x.y-o.y,c=y.x-o.x,d=y.y-o.y,det=a*d-b*c;
    if(Math.abs(det)<1e-15)return this.markSkipped('HATCH: transformação degenerada');
    const ctx=this.ctx;
    try {
      this.beginStyledPath(entity,false,false);
      const strokeWidth=ctx.lineWidth;
      ctx.setTransform(this.dpr*a,this.dpr*b,this.dpr*c,this.dpr*d,this.dpr*o.x,this.dpr*o.y);
      ctx.fillStyle=resolveCadColor(entity,this.getDocument(),this.getOptions());
      if(h.solidFill===1) {ctx.fill(path,'evenodd');this.stats.drawn++;return;}
      ctx.clip(path,'evenodd');
      const defs=h.definitionLines;
      if(!defs?.length)return this.markSkipped('HATCH: padrão ausente');
      const inv=(x,y)=>({x:(d*(x-o.x)-c*(y-o.y))/det,y:(a*(y-o.y)-b*(x-o.x))/det});
      const corners=[inv(0,0),inv(this.canvas.clientWidth,0),inv(0,this.canvas.clientHeight),inv(this.canvas.clientWidth,this.canvas.clientHeight)];
      const xs=samples.map(p=>p.x),ys=samples.map(p=>p.y);
      const minX=Math.max(Math.min(...xs),Math.min(...corners.map(p=>p.x))),maxX=Math.min(Math.max(...xs),Math.max(...corners.map(p=>p.x)));
      const minY=Math.max(Math.min(...ys),Math.min(...corners.map(p=>p.y))),maxY=Math.min(Math.max(...ys),Math.max(...corners.map(p=>p.y)));
      if(maxX<minX || maxY<minY)return;
      const box=[{x:minX,y:minY},{x:maxX,y:minY},{x:minX,y:maxY},{x:maxX,y:maxY}];
      let budget=25000;
      for(const def of defs) {
        const ux=Math.cos(def.angle),uy=Math.sin(def.angle),nx=-uy,ny=ux;
        const spacing=def.offset.x*nx+def.offset.y*ny;
        if(!Number.isFinite(spacing)||Math.abs(spacing)<1e-12) {this.markSkipped('HATCH: espaçamento inválido');continue;}
        const ns=box.map(p=>(p.x-def.base.x)*nx+(p.y-def.base.y)*ny);
        const ks=[Math.min(...ns)/spacing,Math.max(...ns)/spacing];
        const lo=Math.floor(Math.min(...ks))-1,hi=Math.ceil(Math.max(...ks))+1;
        if(hi-lo>budget){this.markSkipped('HATCH: padrão denso; amplie para visualizar');continue;}
        ctx.lineWidth=strokeWidth*Math.hypot(a*ux+c*uy,b*ux+d*uy)/Math.abs(det);
        ctx.setLineDash([]);ctx.beginPath();
        for(let k=lo;k<=hi;k++) {
          const px=def.base.x+k*def.offset.x,py=def.base.y+k*def.offset.y;
          const ts=box.map(p=>(p.x-px)*ux+(p.y-py)*uy),start=Math.min(...ts),end=Math.max(...ts);
          const segment=(s,t)=>{ctx.moveTo(px+s*ux,py+s*uy);ctx.lineTo(px+t*ux,py+t*uy);};
          const dash=def.dashLengths||[],period=dash.reduce((s,v)=>s+Math.abs(v),0);
          if(!dash.length) {segment(start,end);budget--;}
          else if(period>1e-12) {
            for(let t=Math.floor(start/period)*period;t<=end;t+=period) {
              let at=t;
              for(const len of dash) {
                if(--budget<0)break;
                if(len>0 && at+len>=start && at<=end)segment(Math.max(start,at),Math.min(end,at+len));
                else if(len===0 && at>=start && at<=end)segment(at,at+ctx.lineWidth);
                at+=Math.abs(len);
              }
              if(budget<0)break;
            }
          }
          if(budget<0)break;
        }
        ctx.stroke();
        if(budget<0){this.markSkipped('HATCH: padrão denso; amplie para visualizar');break;}
      }
      this.stats.drawn++;
    } finally {ctx.restore();}
  }

  beginStyledPath(entity, fill = false, dash = true) {
    super.beginStyledPath(entity, fill, dash);
    // DWG lineweight is 1/100 mm. Display physical lineweights at CSS 96 dpi,
    // while authored polyline widths remain in model units and scale with zoom.
    const physical = this.getDocument()?.displayLineweights===false ? 0 : this.resolveWeight(entity) / 100 * 96 / 25.4;
    const modelWidth = cadEntityWorldStrokeWidth(entity) * Math.abs(this.getViewState().scale);
    this.ctx.lineWidth = Math.max(1 / this.dpr, physical, Number.isFinite(modelWidth) ? modelWidth : 0);
    this.ctx.lineCap = 'butt';
  }

  drawTextAt(entity, point, text, height, angle) {
    const ctx = this.ctx, scale = this.getViewState().scale;
    const pixelHeight = Math.abs(height * scale);
    if (!Number.isFinite(pixelHeight) || pixelHeight <= 0) return;
    const anchor = this.worldToScreen(point);
    const family = JSON.stringify(entity.fontFamily || 'Arial');
    // CAD height is the capital-letter height, not the browser's em square.
    ctx.save();
    let cap=this.fontCaps?.get(family);
    if(!cap){ctx.font = `100px ${family}, Arial, sans-serif`;cap=ctx.measureText('H').actualBoundingBoxAscent || 72;this.fontCaps?.set(family,cap);}
    const fontSize = pixelHeight * 100 / cap;
    let lines = text.split(/\r?\n/);
    const widthFactor = Number.isFinite(entity.xScale) && entity.xScale !== 0 ? entity.xScale : 1;
    if(entity.type==='MTEXT'&&entity.textBoxRatio>0){
      const limit=entity.textBoxRatio*cap/Math.abs(widthFactor);
      this.wrapCache??=new Map();const key=family+'|'+limit+'|'+text;
      if(this.wrapCache.has(key))lines=this.wrapCache.get(key);
      else{ctx.font=`100px ${family}, Arial, sans-serif`;const wrapped=[];
        for(const paragraph of lines){let line='';for(const word of paragraph.split(/(\s+)/)){if(!line||ctx.measureText(line+word).width<=limit)line+=word;else{wrapped.push(line.trimEnd());line=word.trimStart();}while(line.length>1&&ctx.measureText(line).width>limit){let n=1;while(n<line.length&&ctx.measureText(line.slice(0,n+1)).width<=limit)n++;wrapped.push(line.slice(0,n));line=line.slice(n);}}wrapped.push(line);}
        lines=wrapped;this.wrapCache.set(key,lines);
      }
    }
    const metricKey=family+'\n'+lines.join('\n');
    let textWidth=this.textMetrics?.get(metricKey);
    if(textWidth===undefined){
      ctx.font=`100px ${family}, Arial, sans-serif`;
      textWidth=Math.max(...lines.map(line=>{const m=ctx.measureText(line);return Math.max(m.width,(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0));}))+100;
      this.textMetrics?.set(metricKey,textWidth);
    }
    // Conservative circle around all possible alignments, rotations and mirrors.
    const textHeight=lines.length*pixelHeight*1.5*(entity.lineSpacingFactor||1)+fontSize*2;
    const radius=Math.hypot((textWidth*fontSize/100+Math.abs(Math.tan(entity.obliqueAngle||0))*textHeight)*Math.abs(widthFactor),textHeight)+32;
    if(anchor.x+radius<0||anchor.x-radius>this.cssWidth||anchor.y+radius<0||anchor.y-radius>this.cssHeight){ctx.restore();this.stats.skipped++;return;}
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(-angle);
    const flags = entity.generationFlag || 0;
    ctx.scale((flags & 2 ? -1 : 1) * widthFactor, flags & 4 ? -1 : 1);
    if (entity.obliqueAngle) ctx.transform(1, 0, -Math.tan(entity.obliqueAngle), 1, 0, 0);
    ctx.font = `${fontSize}px ${family}, Arial, sans-serif`;
    ctx.fillStyle = resolveCadColor(entity, this.getDocument(), this.getOptions());
    ctx.globalAlpha = Math.max(0, Math.min(1, entity.opacity ?? 1));
    ctx.textAlign = entity.halign === 1 || entity.halign === 4 ? 'center' : entity.halign === 2 ? 'right' : 'left';
    ctx.textBaseline = entity.valign === 1 ? 'bottom' : entity.valign === 2 ? 'middle' : entity.valign === 3 ? 'top' : 'alphabetic';
    if (entity.type === 'MTEXT' && entity.attachmentPoint) {
      const ap = entity.attachmentPoint - 1;
      ctx.textAlign = ['left', 'center', 'right'][ap % 3];
      ctx.textBaseline = ['top', 'middle', 'bottom'][Math.floor(ap / 3)];
    }
    // Use fillText only: inherited stroke widths must never outline the glyphs.
    lines.forEach((line, index) => ctx.fillText(line, 0, index * pixelHeight * 1.5 * (entity.lineSpacingFactor || 1)));
    ctx.restore();
    this.stats.drawn++;
  }
}

// Rotate the display through block transforms; the original entities stay intact.
export function rotatedDocument(source,quarterTurns){
 const turns=((quarterTurns%4)+4)%4;if(!turns)return source;
 const blocks={...source.blocks};let prefix='__prumo_view_rotation_';
 while(Object.keys(blocks).some(key=>key.startsWith(prefix)))prefix+='_';
 const entities=source.entities.map((entity,index)=>{
  const name=prefix+index;blocks[name]={name,basePoint:{x:0,y:0},entities:[entity]};
  return {kind:'insert',type:'INSERT',blockName:name,insertionPoint:{x:0,y:0},rotation:-turns*Math.PI/2,scale:{x:1,y:1,z:1},layer:entity.layer,color:entity.color,isVisible:entity.isVisible};
 });
 return {...source,blocks,entities,pages:[],savedView:undefined};
}

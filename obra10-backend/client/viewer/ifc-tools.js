export class IfcTools{
 constructor(T,renderer,camera,controls,navigation,onChange,root){
  Object.assign(this,{T,renderer,camera,controls,navigation,onChange});this.ray=new T.Raycaster();this.active=false;this.measuring=false;
  const scope=root||document;this.$=id=>scope.querySelector?scope.querySelector('#'+id):null;this.overlay=this.$('ifc-measure-overlay');this.cutOverlay=this.$('ifc-cut-overlay');this.cutHandle=this.$('ifc-cut-handle');if(!this.overlay||!this.cutHandle)return;this.bindCutDrag();
  this.$('ifc-cut').onclick=()=>{if(!this.state)return;this.state.cut=!this.state.cut;this.applyCut();};
  for(const id of ['ifc-cut-axis','ifc-cut-position','ifc-cut-reverse'])this.$(id).oninput=()=>{if(!this.state)return;this.state.axis=this.$('ifc-cut-axis').value;this.state.position=Number(this.$('ifc-cut-position').value);this.state.reverse=this.$('ifc-cut-reverse').checked;this.applyCut();};
  this.$('ifc-measure').onclick=()=>{this.measuring=!this.measuring;navigation.armFocus(false);this.sync();};
  this.$('ifc-measure-clear').onclick=()=>{if(this.state)this.state.points=[];this.draw();};
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(!this.active||!this.measuring)return;e.preventDefault();e.stopImmediatePropagation();this.down={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);},true);
  canvas.addEventListener('pointermove',e=>{if(this.active&&this.measuring){e.preventDefault();e.stopImmediatePropagation();}},true);
  canvas.addEventListener('pointerup',e=>{if(!this.active||!this.measuring)return;e.preventDefault();e.stopImmediatePropagation();if(this.down?.id===e.pointerId&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<15)this.pick(e.clientX,e.clientY);this.down=null;},true);
  canvas.addEventListener('pointercancel',()=>{this.down=null;});
  canvas.addEventListener('dblclick',e=>{if(this.active&&this.measuring){e.preventDefault();e.stopImmediatePropagation();}},true);
  controls.addEventListener('change',()=>this.draw());
  navigation.hitVisible=hit=>this.isVisible(hit.point);
 }
 setModel(group){
  this.finishCutDrag();this.group=group;this.measuring=false;this.down=null;
  if(group){this.bounds=new this.T.Box3().setFromObject(group);this.state=group.userData.prumoTools??={cut:false,axis:'y',position:50,reverse:false,points:[]};}else this.state=null;
  this.applyCut();
 }
 activate(active){if(!active)this.finishCutDrag();this.active=active;if(!active){this.measuring=false;this.down=null;}this.applyCut();}
 isVisible(point){return this.renderer.clippingPlanes.every(p=>p.distanceToPoint(point)>=-1e-7);}
 applyCut(){
  const s=this.state;
  if(this.active&&s?.cut){const normal=new this.T.Vector3();normal[s.axis]=s.reverse?1:-1;const value=this.bounds.min[s.axis]+(this.bounds.max[s.axis]-this.bounds.min[s.axis])*s.position/100;this.renderer.clippingPlanes=[new this.T.Plane(normal,-normal[s.axis]*value)];}
  else this.renderer.clippingPlanes=[];
  this.sync();this.onChange();
 }
 sync(){
  if(!this.$('ifc-cut'))return;
  if(this.measuring)this.$('ifc-hint').textContent='Toque em duas superfícies. Desative Medir para navegar.';else if(this.state?.cut)this.$('ifc-hint').textContent='Arraste a alça dourada ou o plano para posicionar o corte.';else this.navigation.armFocus(false);
  const s=this.state;this.$('ifc-cut').setAttribute('aria-pressed',String(!!s?.cut));this.$('ifc-measure').setAttribute('aria-pressed',String(this.measuring));
  this.$('ifc-cut-controls').hidden=!s?.cut;
  if(s){this.$('ifc-cut-axis').value=s.axis;this.$('ifc-cut-position').value=s.position;this.$('ifc-cut-reverse').checked=s.reverse;this.$('ifc-cut-value').textContent=Math.round(s.position)+'%';}
  this.draw();
 }
 bindCutDrag(){
  const start=e=>{
   if(!this.active||!this.state?.cut||this.cutDrag||e.button>0)return;
   if(e.currentTarget===this.cutOverlay&&this.measuring)return;
   e.preventDefault();e.stopPropagation();
   this.cutDrag={id:e.pointerId,x:e.clientX,y:e.clientY,position:this.state.position,axis:{...this.cutScreenAxis},enabled:this.controls.enabled,element:e.currentTarget};
   this.controls.enabled=false;this.navigation.armFocus(false);e.currentTarget.setPointerCapture(e.pointerId);
   this.cutHandle.classList.add('dragging');
  };
  const move=e=>{
   const drag=this.cutDrag;if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();
   const {x,y}=drag.axis,length=x*x+y*y;
   this.cutPending=Math.max(0,Math.min(100,drag.position+100*((e.clientX-drag.x)*x+(e.clientY-drag.y)*y)/Math.max(1,length)));
   if(!this.cutFrame)this.cutFrame=requestAnimationFrame(()=>{this.cutFrame=0;if(this.cutDrag&&this.state){this.state.position=this.cutPending;this.applyCut();}});
  };
  for(const element of [this.cutHandle,this.cutOverlay]){
   element.addEventListener('pointerdown',start);element.addEventListener('pointermove',move);
   for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,e=>{if(this.cutDrag?.id===e.pointerId){e.stopPropagation();this.finishCutDrag();}});
   element.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();});
  }
  this.cutHandle.addEventListener('keydown',e=>{
   if(!this.state)return;let next=this.state.position;
   if(e.key==='Home')next=0;else if(e.key==='End')next=100;else if(['ArrowUp','ArrowRight'].includes(e.key))next+=e.shiftKey?10:2;else if(['ArrowDown','ArrowLeft'].includes(e.key))next-=e.shiftKey?10:2;else return;
   e.preventDefault();this.state.position=Math.max(0,Math.min(100,next));this.applyCut();
  });
 }
 finishCutDrag(){
  const drag=this.cutDrag;if(!drag)return;
  if(this.cutFrame){cancelAnimationFrame(this.cutFrame);this.cutFrame=0;if(this.state&&Number.isFinite(this.cutPending)){this.state.position=this.cutPending;this.applyCut();}}
  this.cutDrag=null;this.cutPending=null;this.controls.enabled=drag.enabled;this.cutHandle.classList.remove('dragging');
  if(drag.element.hasPointerCapture(drag.id))drag.element.releasePointerCapture(drag.id);
 }
 drawCut(){
  const visible=this.active&&this.state?.cut&&this.bounds;this.cutHandle.hidden=!visible;this.cutOverlay.replaceChildren();if(!visible)return;
  const s=this.state,r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return;this.camera.updateMatrixWorld();
  this.cutOverlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  const center=this.bounds.getCenter(new this.T.Vector3()),axis=s.axis,others=['x','y','z'].filter(a=>a!==axis);
  center[axis]=this.bounds.min[axis]+(this.bounds.max[axis]-this.bounds.min[axis])*s.position/100;
  const screen=p=>{const v=p.clone().project(this.camera);return {x:(v.x+1)*r.width/2,y:(1-v.y)*r.height/2,z:v.z};};
  const middle=screen(center),corners=[[0,0],[1,0],[1,1],[0,1]].map(pair=>{const v=center.clone();others.forEach((a,i)=>v[a]=pair[i]?this.bounds.max[a]:this.bounds.min[a]);return screen(v);});
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);this.cutOverlay.append(el);return el;};
  if(corners.every(p=>p.z>=-1&&p.z<=1&&Number.isFinite(p.x+p.y))){const plane=add('polygon',{points:corners.map(p=>p.x+','+p.y).join(' '),fill:'#edce7220',stroke:'#edce72','stroke-width':1.5,'stroke-dasharray':'7 5'});plane.style.pointerEvents=this.measuring?'none':'all';plane.style.cursor='grab';}
  const low=center.clone(),high=center.clone();low[axis]=this.bounds.min[axis];high[axis]=this.bounds.max[axis];const a=screen(low),b=screen(high);
  let direction={x:b.x-a.x,y:b.y-a.y};
  if(!Number.isFinite(direction.x+direction.y)||Math.hypot(direction.x,direction.y)<40||a.z< -1||b.z< -1)direction={x:0,y:-Math.max(180,r.height*.5)};
  else add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#edce7280','stroke-width':1,'stroke-dasharray':'3 5'});
  this.cutScreenAxis=direction;
  const x=Number.isFinite(middle.x)?Math.max(65,Math.min(r.width-65,middle.x)):r.width/2,y=Number.isFinite(middle.y)?Math.max(150,Math.min(r.height-30,middle.y)):r.height/2;
  this.cutHandle.style.left=x+'px';this.cutHandle.style.top=y+'px';this.cutHandle.textContent='↕ Corte · '+Math.round(s.position)+'%';
  this.cutHandle.setAttribute('aria-valuenow',String(Math.round(s.position)));this.cutHandle.setAttribute('aria-valuetext',Math.round(s.position)+'% · arraste para posicionar');
 }
 pick(x,y){
  if(!this.group)return;const r=this.renderer.domElement.getBoundingClientRect();this.camera.updateMatrixWorld();this.group.updateMatrixWorld(true);
  this.ray.setFromCamera({x:(x-r.left)/r.width*2-1,y:1-(y-r.top)/r.height*2},this.camera);
  const hit=this.ray.intersectObject(this.group,true).find(h=>this.isVisible(h.point));
  if(!hit){this.$('ifc-measure-result').textContent='Toque em uma superfície visível do modelo.';return;}
  let point=hit.point.clone(),best=16;
  // Snap to a visible vertex of the touched face when it is close on screen.
  if(hit.face){const positions=hit.object.geometry.attributes.position;for(const index of [hit.face.a,hit.face.b,hit.face.c]){const vertex=new this.T.Vector3().fromBufferAttribute(positions,index);if(hit.object.isInstancedMesh&&hit.instanceId!==undefined){const matrix=new this.T.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);vertex.applyMatrix4(matrix);}vertex.applyMatrix4(hit.object.matrixWorld);if(!this.isVisible(vertex))continue;const projected=vertex.clone().project(this.camera);const d=Math.hypot(r.left+(projected.x+1)*r.width/2-x,r.top+(1-projected.y)*r.height/2-y);if(d<best){point=vertex;best=d;}}}
  if(this.state.points.length===2)this.state.points=[];this.state.points.push(point.toArray());this.draw();
 }
 draw(){
  if(!this.overlay||!this.$('ifc-measure-info'))return;
  this.drawCut();
  this.overlay.replaceChildren();const points=this.state?.points||[];
  this.$('ifc-measure-info').hidden=!this.active||(!this.measuring&&!points.length);
  if(!this.active)return;
  const result=this.$('ifc-measure-result');
  result.textContent=points.length===2?(new this.T.Vector3().fromArray(points[0]).distanceTo(new this.T.Vector3().fromArray(points[1]))*100).toLocaleString('pt-BR',{maximumFractionDigits:2})+' cm · distância 3D':points.length?'Toque no segundo ponto.':'Toque em dois pontos do modelo · resultado em cm.';
  if(!points.length)return;const r=this.renderer.domElement.getBoundingClientRect();this.camera.updateMatrixWorld();
  const projected=points.map(p=>new this.T.Vector3().fromArray(p).project(this.camera));
  this.overlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);this.overlay.append(el);};
  const screen=p=>({x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2});
  if(projected.length===2&&projected.every(p=>p.z>=-1&&p.z<=1)){const a=screen(projected[0]),b=screen(projected[1]);add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#ffe18b','stroke-width':2,'stroke-dasharray':'6 4'});}
  projected.forEach((p,i)=>{if(p.z< -1||p.z>1||!this.isVisible(new this.T.Vector3().fromArray(points[i])))return;const at=screen(p);add('circle',{cx:at.x,cy:at.y,r:6,fill:'#ffe18b',stroke:'#173c2d','stroke-width':2});});
 }
}

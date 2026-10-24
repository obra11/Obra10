// First-person walk inside the IFC. Scene is Y-up and in metres: the eye stays a fixed height over the floor below it.
export class IfcWalk{
 constructor(T,camera,controls,canvas,tools,navigation,onChange){
  Object.assign(this,{T,camera,controls,canvas,tools,navigation,onChange});
  this.active=false;this.placing=false;this.eye=1.6;this.through=false;this.yaw=0;this.pitch=0;this.goal=null;this.last=0;
  this.keys=new Set();this.stick={x:0,y:0};this.pointers=new Map();this.ray=new T.Raycaster();
  const $=id=>document.getElementById(id);this.$=$;
  $('ifc-walk').onclick=()=>this.active?this.stop():this.start();
  $('ifc-walk-exit').onclick=()=>this.stop();
  $('ifc-walk-through').onclick=()=>{this.through=!this.through;$('ifc-walk-through').setAttribute('aria-pressed',String(this.through));};
  // Tools that drive the orbit camera end the walk first.
  $('ifc-actions').addEventListener('click',e=>{if(this.active&&e.target.closest('#ifc-pan,#ifc-focus,#ifc-cut,#ifc-measure,#ifc-views,#ifc-rotate'))this.stop();},true);
  const host=canvas.parentElement,own=e=>this.walking&&e.target===canvas;
  // While choosing the floor the model still orbits; only a clean tap places the walker.
  host.addEventListener('pointerdown',e=>{if(this.active&&this.placing&&e.target===canvas)this.placeTap=this.placeTap?null:{id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};},true);
  host.addEventListener('pointerup',e=>{const tap=this.placeTap;if(!tap||tap.id!==e.pointerId)return;this.placeTap=null;if(this.active&&this.placing&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=8&&performance.now()-tap.t<500&&this.tapAt(e.clientX,e.clientY)){this.swallow(e);this.tools.tap=null;}},true);
  host.addEventListener('pointerdown',e=>{if(!own(e))return;this.swallow(e);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,t:performance.now()});try{canvas.setPointerCapture(e.pointerId);}catch{}},true);
  host.addEventListener('pointermove',e=>{if(!own(e))return;const p=this.pointers.get(e.pointerId);if(!p)return;this.swallow(e);this.drag(e,p);},true);
  for(const name of ['pointerup','pointercancel'])host.addEventListener(name,e=>{if(!own(e))return;const p=this.pointers.get(e.pointerId);if(!p)return;this.swallow(e);this.pointers.delete(e.pointerId);
   if(name==='pointerup'&&!this.pointers.size&&!p.multi&&Math.hypot(e.clientX-p.x0,e.clientY-p.y0)<=8&&performance.now()-p.t<500)this.tapAt(e.clientX,e.clientY);},true);
  for(const name of ['dblclick','click','contextmenu'])host.addEventListener(name,e=>{if(own(e))this.swallow(e);},true);
  host.addEventListener('wheel',e=>{if(!own(e))return;this.swallow(e);this.nudge(e.deltaY<0?.4:-.4);},{capture:true,passive:false});
  const pad=$('ifc-walk-pad'),knob=pad.firstElementChild;
  const setStick=e=>{const r=pad.getBoundingClientRect(),radius=r.width/2-8;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const len=Math.hypot(x,y);if(len>radius){x*=radius/len;y*=radius/len;}this.stick={x:x/radius,y:y/radius};knob.style.transform=`translate(${x}px,${y}px)`;};
  pad.addEventListener('pointerdown',e=>{e.preventDefault();this.padId=e.pointerId;try{pad.setPointerCapture(e.pointerId);}catch{}setStick(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===this.padId)setStick(e);});
  for(const name of ['pointerup','pointercancel'])pad.addEventListener(name,e=>{if(e.pointerId!==this.padId)return;this.padId=null;this.stick={x:0,y:0};knob.style.transform='';});
  const typing=e=>e.target.closest?.('input,textarea,select,[contenteditable]');
  window.addEventListener('keydown',e=>{if(!this.active||typing(e)||e.ctrlKey||e.metaKey||e.altKey)return;const k=this.key(e);if(!k||k!=='Escape'&&!this.walking)return;e.preventDefault();e.stopImmediatePropagation();if(k==='Escape'){this.stop();return;}this.keys.add(k);},true);
  window.addEventListener('keyup',e=>{const k=this.key(e);if(k)this.keys.delete(k);},true);
  window.addEventListener('blur',()=>this.keys.clear());
 }
 get walking(){return this.active&&!this.placing;}
 key(e){const map={KeyW:'f',ArrowUp:'f',KeyS:'b',ArrowDown:'b',KeyA:'l',KeyD:'r',ArrowLeft:'tl',ArrowRight:'tr',KeyQ:'tl',KeyE:'tr',ShiftLeft:'run',ShiftRight:'run',Escape:'Escape'};return map[e.code]||null;}
 swallow(e){e.preventDefault();e.stopImmediatePropagation();}
 start(){
  if(!this.tools.group)return;
  const tools=this.tools;tools.measuring=false;tools.choosingFace=false;tools.sync();this.navigation.armFocus(false);tools.setParallel?.(null);tools.toggleViews?.(false);
  this.active=true;this.group=tools.group;this.goal=null;this.keys.clear();this.pointers.clear();this.placeTap=null;
  this.camera.up.set(0,1,0);const dir=this.camera.getWorldDirection(new this.T.Vector3());this.yaw=Math.atan2(-dir.x,-dir.z);this.pitch=0;
  this.camera.near=.05;this.camera.updateProjectionMatrix();
  // Already inside the model: stand on the floor right below. Otherwise wait for a tap on the floor.
  const inside=tools.bounds?.containsPoint(this.camera.position),floor=inside?this.floorBelow(this.camera.position,6):null;
  this.placing=!floor;this.controls.enabled=this.placing;
  if(floor){this.camera.position.set(this.camera.position.x,floor.y+this.eye,this.camera.position.z);this.apply();}
  this.ui();this.onChange?.();
 }
 stop(){
  if(!this.active)return;const walked=this.walking;this.active=false;this.placing=false;this.goal=null;this.keys.clear();this.pointers.clear();this.stick={x:0,y:0};this.placeTap=null;
  this.controls.enabled=true;
  if(walked){const forward=this.camera.getWorldDirection(new this.T.Vector3());this.controls.target.copy(this.camera.position).addScaledVector(forward,2);this.controls.update();this.navigation.updateClipping();}
  this.ui();this.onChange?.();
 }
 ui(){
  const $=this.$;$('ifc-walk').setAttribute('aria-pressed',String(this.active));$('ifc-walk-info').hidden=!this.active;$('ifc-walk-pad').hidden=!this.active||this.placing;
  const knob=$('ifc-walk-pad').firstElementChild;knob.style.transform='';
  $('ifc-walk-text').textContent=this.placing?'Toque no piso onde quer ficar':matchMedia('(pointer:fine)').matches?'Arraste para olhar · W A S D ou o círculo andam · toque no piso para ir':'Arraste para olhar · o círculo anda · toque no piso para ir';
 }
 apply(){this.camera.quaternion.setFromEuler(new this.T.Euler(this.pitch,this.yaw,0,'YXZ'));this.camera.updateMatrixWorld();}
 drag(e,p){
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(this.pointers.size>1){
   // Two fingers: spreading them walks forward, pinching walks back.
   for(const q of this.pointers.values())q.multi=true;
   const [a,b]=[...this.pointers.values()],now=Math.hypot(a.x-b.x,a.y-b.y);if(this.pinch!=null)this.nudge((now-this.pinch)*.01);this.pinch=now;return;
  }
  this.pinch=null;if(this.placing)return;
  const k=1.8/Math.max(1,Math.min(this.canvas.clientWidth,this.canvas.clientHeight));
  this.yaw+=dx*k;this.pitch=Math.max(-1.45,Math.min(1.45,this.pitch+dy*k));this.goal=null;this.apply();this.onChange?.();
 }
 nudge(metres){if(!this.active||this.placing)return;const f=this.forward();if(this.move(f.multiplyScalar(metres))){this.settle(1);this.onChange?.();}}
 forward(){return new this.T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));}
 tapAt(x,y){
  const hit=this.tools.hitAt(x,y);if(!hit)return false;
  const p=hit.point.clone(),floor=this.floorBelow(p.clone().add(new this.T.Vector3(0,.3,0)),.4);
  // A tap on a wall goes to the floor just in front of it.
  let spot=floor&&Math.abs(floor.y-p.y)<.05?p:null;
  if(!spot){const back=p.clone().sub(this.camera.position).setY(0);if(back.lengthSq()<1e-8)return false;back.normalize();const near=p.clone().addScaledVector(back,-.4),below=this.floorBelow(near,4);if(!below)return false;spot=below;}
  if(this.placing){
   this.placing=false;this.controls.enabled=false;this.tools.showSelection?.(null);this.camera.up.set(0,1,0);
   const dir=this.camera.getWorldDirection(new this.T.Vector3());this.yaw=Math.atan2(-dir.x,-dir.z);this.pitch=0;
   this.camera.position.set(spot.x,spot.y+this.eye,spot.z);this.camera.near=.05;this.camera.updateProjectionMatrix();this.apply();this.ui();this.onChange?.();return true;
  }
  this.goal=spot;return true;
 }
 step(){
  if(!this.active)return false;if(this.group!==this.tools.group){this.stop();return false;}
  const now=performance.now(),dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;if(this.placing||!dt)return false;
  const k=this.keys;let f=-this.stick.y,s=this.stick.x,turn=0,changed=false;
  if(k.has('f'))f+=1;if(k.has('b'))f-=1;if(k.has('l'))s-=1;if(k.has('r'))s+=1;if(k.has('tl'))turn+=1;if(k.has('tr'))turn-=1;
  if(turn){this.yaw+=turn*1.8*dt;this.apply();changed=true;}
  const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
  const speed=1.5*(k.has('run')?2:1);
  if(f||s){this.goal=null;const fwd=this.forward(),right=new this.T.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));changed=this.move(fwd.multiplyScalar(f*speed*dt).addScaledVector(right,s*speed*dt))||changed;}
  else if(this.goal){
   const to=this.goal.clone().sub(this.camera.position).setY(0),d=to.length();
   if(d<.05)this.goal=null;else if(!this.move(to.multiplyScalar(Math.min(d,2.5*dt)/d)))this.goal=null;else changed=true;
  }
  return this.settle(dt)||changed;
 }
 // Slides along walls by trying the move, then each horizontal axis alone.
 move(delta){
  if(delta.lengthSq()<1e-12)return false;
  const options=this.through?[delta]:[delta,new this.T.Vector3(delta.x,0,0),new this.T.Vector3(0,0,delta.z)];
  for(const d of options){const len=d.length();if(len<1e-6)continue;if(!this.through&&this.blocked(d.clone().divideScalar(len),len))continue;this.camera.position.add(d);this.camera.updateMatrixWorld();return true;}
  return false;
 }
 blocked(dir,len){
  const feet=this.camera.position.y-this.eye;
  return [.55,1.05,1.5].some(h=>{const origin=new this.T.Vector3(this.camera.position.x,feet+h,this.camera.position.z),hit=this.cast(origin,dir,len+.25);return hit&&!this.insideSolid(origin,dir,hit);});
 }
 // Seeing the back of faces both ahead and behind means the walker started inside a wall: let it step out.
 insideSolid(origin,dir,hit){
  if(!this.backFace(hit,dir))return false;
  const back=dir.clone().negate(),behind=this.cast(origin,back,.6);
  return !!behind&&this.backFace(behind,back);
 }
 backFace(hit,dir){
  const n=hit.face?.normal;if(!n)return false;const m=new this.T.Matrix4();
  if(hit.object.isBatchedMesh&&hit.batchId!=null)hit.object.getMatrixAt(hit.batchId,m);m.premultiply(hit.object.matrixWorld);
  return n.clone().applyNormalMatrix(new this.T.Matrix3().getNormalMatrix(m)).dot(dir)>0;
 }
 // Climbs steps up to 50 cm and eases down onto lower floors.
 settle(dt){
  const feet=this.camera.position.y-this.eye,floor=this.floorBelow(new this.T.Vector3(this.camera.position.x,feet+.5,this.camera.position.z),5);
  if(!floor)return false;const diff=floor.y-feet;if(Math.abs(diff)<.001)return false;
  this.camera.position.y+=Math.abs(diff)<.01?diff:diff*Math.min(1,dt*12);this.camera.updateMatrixWorld();return true;
 }
 floorBelow(point,far){return this.cast(point,new this.T.Vector3(0,-1,0),far)?.point||null;}
 cast(origin,dir,far){
  const group=this.tools.group;if(!group)return null;this.ray.set(origin,dir);this.ray.far=far;
  const hits=this.ray.intersectObject(group,true);if(hits.length>1)hits.sort((a,b)=>a.distance-b.distance);
  return hits.find(h=>!h.object.userData?.prumoSection&&!h.object.isLine&&!h.object.isPoints&&!this.tools.isHiddenHit(h)&&this.tools.isVisible(h.point))||null;
 }
}

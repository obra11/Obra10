// First-person walk inside the IFC. Scene is Y-up and in metres: the eye stays a fixed height over the floor below it.
export class IfcWalk{
 constructor(T,camera,controls,canvas,tools,navigation,onChange){
  Object.assign(this,{T,camera,controls,canvas,tools,navigation,onChange});
  this.active=false;this.placing=false;this.mouseSteer=false;this.eye=1.6;this.through=false;this.yaw=0;this.pitch=0;this.goal=null;this.last=0;
  this.keys=new Set();this.stick={x:0,y:0};this.pointers=new Map();this.ray=new T.Raycaster();this.lastMouse=null;
  const $=id=>document.getElementById(id);this.$=$;
  const btn=$('ifc-walk');
  // Hold Caminhar and drag anywhere: analog walk follows the pointer. A tap still enters or leaves.
  btn.addEventListener('pointerdown',e=>{
   if(e.button&&e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   this.btnSteer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,wasActive:this.active};
   try{btn.setPointerCapture(e.pointerId);}catch{}
   if(!this.active)this.start();
  });
  const onSteerMove=e=>{
   const s=this.btnSteer;if(!s||s.id!==e.pointerId)return;
   e.preventDefault();
   if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>10)s.moved=true;
   if(this.walking&&s.moved){this.aimStick(e,s,64);btn.classList.add('steering');this.onChange?.();}
  };
  const endSteer=e=>{
   const s=this.btnSteer;if(!s||s.id!==e.pointerId)return;
   const moved=s.moved,wasActive=s.wasActive;
   this.btnSteer=null;btn.classList.remove('steering');
   if(this.padId==null&&!this.mouseSteer)this.stick={x:0,y:0};
   try{if(btn.hasPointerCapture(e.pointerId))btn.releasePointerCapture(e.pointerId);}catch{}
   if(!moved&&wasActive)this.stop();
  };
  window.addEventListener('pointermove',onSteerMove,{passive:false});
  for(const name of ['pointerup','pointercancel'])window.addEventListener(name,endSteer);
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();});
  btn.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();this.active?this.stop():this.start();});
  $('ifc-walk-exit').onclick=()=>this.stop();
  $('ifc-walk-through').onclick=()=>{this.through=!this.through;$('ifc-walk-through').setAttribute('aria-pressed',String(this.through));};
  // Tools that drive the orbit camera end the walk first.
  $('ifc-actions').addEventListener('click',e=>{if(this.active&&e.target.closest('#ifc-focus,#ifc-cut,#ifc-measure,#ifc-views,#ifc-rotate'))this.stop();},true);
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
  const paintKnob=()=>{const radius=pad.getBoundingClientRect().width/2-8;knob.style.transform=`translate(${this.stick.x*radius}px,${this.stick.y*radius}px)`;};
  // Stick relative to the pad centre (pad sits bottom-centre by default and can be dragged).
  const setStickFromPad=(e,soft=false)=>{
   const r=pad.getBoundingClientRect(),base=r.width/2-8,radius=soft?Math.max(base,Math.min(host.clientWidth,host.clientHeight)*.18):base;
   let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const len=Math.hypot(x,y);if(len>radius){x*=radius/len;y*=radius/len;}
   this.stick={x:x/radius,y:y/radius};paintKnob();this.onChange?.();
  };
  const placePad=(left,top)=>{
   const box=host.getBoundingClientRect(),size=pad.offsetWidth||116;
   const x=Math.max(8,Math.min(box.width-size-8,left)),y=Math.max(8,Math.min(box.height-size-8,top));
   pad.classList.add('pad-moved');pad.style.left=`${x}px`;pad.style.top=`${y}px`;pad.style.right='auto';pad.style.bottom='auto';pad.style.marginLeft='0';
  };
  const resetPadPlace=()=>{pad.classList.remove('pad-moved','pad-dragging');pad.style.left='';pad.style.top='';pad.style.right='';pad.style.bottom='';pad.style.marginLeft='';};
  this.resetPadPlace=resetPadPlace;
  const finePointer=()=>matchMedia('(pointer:fine)').matches;
  const setMouseSteer=(on,e)=>{
   this.mouseSteer=!!on;this.lastMouse=null;
   pad.classList.toggle('mouse-steer',this.mouseSteer);
   pad.setAttribute('aria-pressed',String(this.mouseSteer));
   if(!this.mouseSteer&&!this.btnSteer&&this.padId==null){this.stick={x:0,y:0};knob.style.transform='';}
   else if(this.mouseSteer&&e)setStickFromPad(e,true);
   this.ui();
  };
  pad.addEventListener('pointerdown',e=>{
   if(e.button&&e.button!==0)return;
   e.preventDefault();this.padId=e.pointerId;this.padTap={x:e.clientX,y:e.clientY,moved:false};
   this.padMove=null;
   // Hold briefly then drag to reposition the yellow pad; tap still toggles mouse steer.
   this.padHold=setTimeout(()=>{
    if(this.padId!==e.pointerId||this.padTap?.moved)return;
    const r=pad.getBoundingClientRect(),hb=host.getBoundingClientRect();
    this.padMove={id:e.pointerId,ox:e.clientX,oy:e.clientY,left:r.left-hb.left,top:r.top-hb.top};
    pad.classList.add('pad-dragging');
   },320);
   try{pad.setPointerCapture(e.pointerId);}catch{}
   if(!this.mouseSteer)setStickFromPad(e);
  });
  pad.addEventListener('pointermove',e=>{
   if(e.pointerId!==this.padId)return;
   if(this.padTap&&Math.hypot(e.clientX-this.padTap.x,e.clientY-this.padTap.y)>8)this.padTap.moved=true;
   if(this.padMove&&this.padMove.id===e.pointerId){
    placePad(this.padMove.left+(e.clientX-this.padMove.ox),this.padMove.top+(e.clientY-this.padMove.oy));return;
   }
   if(!this.mouseSteer)setStickFromPad(e);
  });
  for(const name of ['pointerup','pointercancel'])pad.addEventListener(name,e=>{
   if(e.pointerId!==this.padId)return;this.padId=null;
   clearTimeout(this.padHold);this.padHold=null;pad.classList.remove('pad-dragging');
   const movedPad=!!this.padMove;this.padMove=null;
   const tap=this.padTap;this.padTap=null;
   if(movedPad){if(!this.mouseSteer&&!this.btnSteer){this.stick={x:0,y:0};knob.style.transform='';}return;}
   if(finePointer()&&tap&&!tap.moved){setMouseSteer(!this.mouseSteer,e);return;}
   if(!this.mouseSteer){if(!this.btnSteer)this.stick={x:0,y:0};knob.style.transform='';}
  });
  window.addEventListener('pointermove',e=>{
   if(!this.walking||!this.mouseSteer||this.padId!=null)return;
   setStickFromPad(e,true);
  },{passive:true});
  const typing=e=>e.target.closest?.('input,textarea,select,[contenteditable]');
  window.addEventListener('keydown',e=>{if(!this.active||typing(e)||e.ctrlKey||e.metaKey||e.altKey)return;const k=this.key(e);if(!k||k!=='Escape'&&!this.walking)return;e.preventDefault();e.stopImmediatePropagation();if(k==='Escape'){this.stop();return;}this.keys.add(k);},true);
  window.addEventListener('keyup',e=>{const k=this.key(e);if(k)this.keys.delete(k);},true);
  window.addEventListener('blur',()=>this.keys.clear());
 }
 get walking(){return this.active&&!this.placing;}
 key(e){const map={KeyW:'f',ArrowUp:'f',KeyS:'b',ArrowDown:'b',KeyA:'l',KeyD:'r',ArrowLeft:'tl',ArrowRight:'tr',KeyQ:'tl',KeyE:'tr',ShiftLeft:'run',ShiftRight:'run',Escape:'Escape'};return map[e.code]||null;}
 swallow(e){e.preventDefault();e.stopImmediatePropagation();}
 aimStick(e,origin,radius){
  let x=e.clientX-origin.x,y=e.clientY-origin.y;const len=Math.hypot(x,y);
  if(len>radius){x*=radius/len;y*=radius/len;}
  this.stick={x:x/radius,y:y/radius};
 }
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
  this.resetPadPlace?.();this.ui();this.onChange?.();
 }
 stop(){
  if(!this.active)return;const walked=this.walking;this.active=false;this.placing=false;this.mouseSteer=false;this.steerOrigin=null;this.goal=null;this.keys.clear();this.pointers.clear();this.stick={x:0,y:0};this.btnSteer=null;this.placeTap=null;this.lastMouse=null;this.$('ifc-walk').classList.remove('steering');
  const pad=this.$('ifc-walk-pad');pad.classList.remove('mouse-steer');pad.setAttribute('aria-pressed','false');this.resetPadPlace?.();
  this.controls.enabled=true;
  if(walked){const forward=this.camera.getWorldDirection(new this.T.Vector3());this.controls.target.copy(this.camera.position).addScaledVector(forward,2);this.controls.update();this.navigation.updateClipping();}
  this.ui();this.onChange?.();
 }
 ui(){
  const $=this.$;$('ifc-walk').setAttribute('aria-pressed',String(this.active));$('ifc-walk-info').hidden=!this.active;$('ifc-walk-pad').hidden=!this.active||this.placing;
  const pad=$('ifc-walk-pad'),knob=pad.firstElementChild;
  pad.classList.toggle('mouse-steer',this.mouseSteer);pad.setAttribute('aria-pressed',String(this.mouseSteer));
  if(!this.mouseSteer)knob.style.transform='';
  $('ifc-walk-text').textContent=this.placing?'Toque no piso onde quer ficar':this.mouseSteer?'Bolinha ativa: mouse cima/baixo anda · lados giram · clique de novo para soltar · Esc sai':matchMedia('(pointer:fine)').matches?'Clique na bolinha para andar com o mouse · segure e arraste para mover a bolinha · W A S D':'Segure a bolinha para andar · segure um pouco e arraste para movê-la';
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
  // Sticky yellow pad: left/right turns the view; up/down walks. Keys still strafe with A/D.
  if(this.mouseSteer){turn-=this.stick.x;s=0;}
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

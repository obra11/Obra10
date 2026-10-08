// Navigation is relative to the visible model and a movable point of interest.
export class IfcNavigation{
 constructor(THREE,camera,controls,canvas,onHint){
  Object.assign(this,{THREE,camera,controls,canvas,onHint});this.radius=1;this.center=new THREE.Vector3();this.ray=new THREE.Raycaster();
  controls.zoomToCursor=true;controls.screenSpacePanning=true;controls.minTargetRadius=0;controls.maxTargetRadius=Infinity;controls.maxDistance=Infinity;
  controls.dampingFactor=.12;controls.zoomSpeed=1.25;controls.panSpeed=1;controls.rotateSpeed=.65;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  this.setPan(false);controls.addEventListener('change',()=>this.updateClipping());
  canvas.addEventListener('wheel',()=>this.extendTarget(),{capture:true,passive:true});
  canvas.addEventListener('pointerdown',()=>this.extendTarget(),true);
  canvas.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();this.focusAt(e.clientX,e.clientY);});
  canvas.addEventListener('pointerdown',e=>{if(!this.focusArmed)return;e.preventDefault();e.stopImmediatePropagation();this.focusAt(e.clientX,e.clientY);this.armFocus(false);},true);
 }
 setModel(group){
  this.group=group;if(!group)return;
  const box=new this.THREE.Box3().setFromObject(group);box.getCenter(this.center);this.radius=Math.max(box.getSize(new this.THREE.Vector3()).length()/2,1e-6);
  this.controls.minDistance=Math.max(this.radius*1e-8,1e-9);this.updateClipping();
 }
 setPan(enabled){this.pan=enabled;this.controls.mouseButtons.LEFT=enabled?this.THREE.MOUSE.PAN:this.THREE.MOUSE.ROTATE;this.controls.touches.ONE=enabled?this.THREE.TOUCH.PAN:this.THREE.TOUCH.ROTATE;}
 armFocus(enabled){this.focusArmed=enabled;this.onHint?.(enabled?'Toque no modelo para definir o centro de rotação.':this.pan?'Arraste para mover · dois dedos aproximam e deslocam.':'Arraste para orbitar · dois dedos aproximam e deslocam.');}
 extendTarget(){
  // Keep a useful navigation distance ahead of the eye, so dollying can pass
  // through the former orbit center instead of asymptotically stopping there.
  const distance=this.camera.position.distanceTo(this.controls.target);
  if(distance<this.radius*.02){const direction=this.controls.target.clone().sub(this.camera.position).normalize();if(direction.lengthSq()===0)this.camera.getWorldDirection(direction);this.controls.target.copy(this.camera.position).addScaledVector(direction,this.radius*.1);}
 }
 zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;this.extendTarget();const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(1/factor);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
 updateClipping(){
  const distance=this.camera.position.distanceTo(this.controls.target),near=Math.max(1e-8,Math.min(this.radius*1e-4,distance*1e-3));
  const far=Math.max(this.radius*4,this.camera.position.distanceTo(this.center)+this.radius*3,near*1000);
  if(Math.abs(this.camera.near-near)>near*.05||Math.abs(this.camera.far-far)>far*.05){this.camera.near=near;this.camera.far=far;this.camera.updateProjectionMatrix();}
 }
 focusAt(clientX,clientY){
  if(!this.group)return false;const rect=this.canvas.getBoundingClientRect();this.camera.updateMatrixWorld();this.group.updateMatrixWorld(true);
  this.ray.setFromCamera({x:(clientX-rect.left)/rect.width*2-1,y:1-(clientY-rect.top)/rect.height*2},this.camera);
  const hit=this.ray.intersectObject(this.group,true).find(hit=>!this.hitVisible||this.hitVisible(hit));if(!hit){this.onHint?.('Toque sobre uma peça do modelo para focar.');return false;}
  this.controls.target.copy(hit.point);this.controls.update();this.updateClipping();return true;
 }
}

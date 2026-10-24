function visibleSceneBounds(T,root){
 const box=new T.Box3();
 root.traverse(object=>{
  if(object.userData?.prumoSection||!object.geometry)return;
  for(let node=object;node&&node!==root;node=node.parent)if(node.visible===false)return;
  let local=object.boundingBox!==undefined?object.boundingBox:object.geometry.boundingBox;
  if(!local&&object.computeBoundingBox){object.computeBoundingBox();local=object.boundingBox;}
  if(!local){if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();local=object.geometry.boundingBox;}
  if(local&&!local.isEmpty())box.union(local.clone().applyMatrix4(object.matrixWorld));
 });
 return box.isEmpty()?new T.Box3().setFromObject(root):box;
}
export class IfcTools{
 constructor(T,renderer,camera,controls,navigation,onChange){
  Object.assign(this,{T,renderer,camera,controls,navigation,onChange});this.ray=new T.Raycaster();this.active=false;this.measuring=false;
  this.bindParallel();
  this.$=id=>document.getElementById(id);this.overlay=this.$('ifc-measure-overlay');this.cutOverlay=this.$('ifc-cut-overlay');this.cutHandle=this.$('ifc-cut-handle');  this.bindCutDrag();
  this.choosingFace=false;this.rotating=false;this.hidden=new Map();this.capMeshes=[];this.views=new WeakMap();
  this.$('ifc-cut').onclick=()=>{if(!this.state)return;this.state.cut=!this.state.cut;this.choosingFace=false;this.rotating=false;this.applyCut();};
  this.$('ifc-cut-face').onclick=()=>{if(!this.state?.cut)return;this.choosingFace=!this.choosingFace;this.rotating=false;this.sync();};
  this.$('ifc-cut-side').onclick=()=>{if(!this.state?.cut)return;this.ensureBox();if(!this.state.box)return;this.state.box.face=(this.state.box.face+1)%6;this.rotating=false;this.choosingFace=false;this.applyCut();};
  this.$('ifc-cut-rotate').onclick=()=>{if(!this.state?.cut)return;this.rotating=!this.rotating;this.choosingFace=false;this.sync();this.draw();};
  const nudge=delta=>{if(!this.state?.cut)return;this.choosingFace=false;this.ensureBox();if(!this.state.box)return;if(this.rotating)this.state.box.euler[1]+=Math.sign(delta)*15*Math.PI/180;else this.setFaceValue(Math.round(this.faceValue())+delta);this.applyCut();};
  this.$('ifc-cut-minus').onclick=()=>nudge(-1);
  this.$('ifc-cut-plus').onclick=()=>nudge(1);
  this.$('ifc-cut-reset').onclick=()=>this.resetCut();
  this.$('ifc-measure').onclick=()=>{this.measuring=!this.measuring;this.preview=null;this.down=null;this.lineTap=null;navigation.armFocus(false);this.sync();};
  this.$('ifc-measure-clear').onclick=()=>{if(this.state)this.state.points=[];this.preview=null;this.down=null;this.aim=null;this.levelEnds=[];this.levelDrag=null;this.draw();};
  this.level=false;this.levelEnds=[];this.levelDrag=null;this.$('ifc-measure-level').onclick=()=>{this.level=!this.level;this.$('ifc-measure-level').setAttribute('aria-pressed',String(this.level));if(this.state)this.state.points=[];this.preview=null;this.down=null;this.aim=null;this.lineTap=null;this.levelEnds=[];this.levelDrag=null;this.draw();this.sync();};
  const canvas=renderer.domElement;
  this.navPointers=new Set();
  canvas.addEventListener('pointerdown',e=>{if(!this.active||!this.measuring||e.button)return;if(this.down){e.preventDefault();e.stopImmediatePropagation();return;}const editing=this.navPointers.size?-1:this.tipAt(e.clientX,e.clientY,e.pointerType);if(editing<0){this.navPointers.add(e.pointerId);this.lineTap=!this.lineTap&&this.navPointers.size===1&&(this.level||this.lineAt(e.clientX,e.clientY,e.pointerType))?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;if(this.aim){this.aim=null;this.draw();}return;}e.preventDefault();e.stopImmediatePropagation();this.down={id:e.pointerId,editing,x:e.clientX,y:e.clientY,moved:false};try{canvas.setPointerCapture(e.pointerId);}catch{}this.aimAt(e.clientX,e.clientY,editing>=0);},true);
  canvas.addEventListener('pointermove',e=>{if(!this.active||!this.measuring||this.down?.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>6)this.down.moved=true;this.aimAt(e.clientX,e.clientY,this.down.editing>=0);},true);
  canvas.addEventListener('pointerup',e=>{if(!this.active||!this.measuring||this.down?.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const down=this.down;if(down.editing>=0)this.aimAt(e.clientX,e.clientY,true);
   // Leg tips are 10 + leg index. A drag pins the tip to the face; a plain tap on a pinned tip lets the laser find the surface again.
   if(down.editing>=10){const i=down.editing-10;if(down.moved&&this.levelDrag)this.levelEnds[i]=this.levelDrag.point;else if(!down.moved)this.levelEnds[i]=null;this.levelDrag=null;this.onChange?.();}
   else if(this.preview&&this.state){this.state.points=this.preview.map(p=>p.slice());if(this.level)this.levelEnds=[];}
   this.preview=null;this.down=null;this.draw();},true);
  for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,e=>{if(!this.navPointers.delete(e.pointerId))return;const tap=this.lineTap;if(tap?.id!==e.pointerId)return;this.lineTap=null;if(name==='pointerup'&&this.measuring&&this.state&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=8){if(this.level){this.placeLevel(e.clientX,e.clientY);return;}this.state.points=[];this.preview=null;this.aim=null;this.draw();this.sync();}},true);
  canvas.addEventListener('pointercancel',()=>{this.preview=null;this.down=null;this.levelDrag=null;this.draw();});
  canvas.addEventListener('dblclick',e=>{if(this.active&&this.measuring){e.preventDefault();e.stopImmediatePropagation();}},true);
  controls.addEventListener('change',()=>this.draw());
  navigation.hitVisible=hit=>this.isVisible(hit.point);
  this.tap=null;
  canvas.addEventListener('pointerdown',e=>{if(!this.active||this.measuring||navigation.focusArmed||this.cutDrag||e.button)return;if(this.tap){this.tap=null;return;}this.tap={id:e.pointerId,x:e.clientX,y:e.clientY};},true);
  canvas.addEventListener('pointerup',e=>{if(!this.tap||this.tap.id!==e.pointerId)return;const tap=this.tap;this.tap=null;if(this.measuring||navigation.focusArmed||this.cutDrag||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)return;if(this.state?.cut&&this.choosingFace&&this.pickCutFace(e.clientX,e.clientY))this.choosingFace=false;this.showElement(e.clientX,e.clientY);},true);
  canvas.addEventListener('pointercancel',()=>{this.tap=null;});
  this.bindTabDrag();
  this.$('ifc-hide').onclick=e=>{e.stopPropagation();this.hideSelected();};
  this.$('ifc-show-hidden').onclick=()=>this.toggleHiddenList();
  this.$('ifc-storeys').onclick=()=>this.toggleStoreys();
  this.$('ifc-views').onclick=()=>this.toggleViews();
  this.$('ifc-view-list').onclick=e=>{const button=e.target.closest('[data-view]');if(!button)return;this.setView(button.dataset.view);this.toggleViews(false);};
  this.storeyKeys=new Set();
  document.addEventListener('pointerdown',e=>{const panel=this.$('ifc-hidden-panel');if(panel&&!panel.hidden&&!e.target.closest('#ifc-hidden-panel')&&!e.target.closest('#ifc-show-hidden')){panel.hidden=true;this.$('ifc-show-hidden').setAttribute('aria-expanded','false');}const storeys=this.$('ifc-storey-panel');if(storeys&&!storeys.hidden&&!e.target.closest('#ifc-storey-panel')&&!e.target.closest('#ifc-storeys')){storeys.hidden=true;this.$('ifc-storeys').setAttribute('aria-expanded','false');}if(!e.target.closest('#ifc-view-panel')&&!e.target.closest('#ifc-views'))this.toggleViews(false);});
 }
 setModel(group){
  this.finishCutDrag();this.clearSection();this.hidden.clear();this.storeyKeys.clear();this.group=group;this.measuring=false;this.choosingFace=false;this.rotating=false;this.down=null;this.preview=null;this.tap=null;this.lineTap=null;this.navPointers.clear();this.selectionHit=null;this.showSelection(null);this.setParallel(null);this.laserCache=null;this.levelEnds=[];this.levelDrag=null;
  const storeys=this.$('ifc-storey-panel');if(storeys)storeys.hidden=true;this.$('ifc-storeys')?.setAttribute('aria-pressed','false');this.$('ifc-storeys')?.setAttribute('aria-expanded','false');this.toggleViews(false);
  if(group){this.bounds=visibleSceneBounds(this.T,group);this.state=group.userData.prumoTools??={cut:false,axis:'y',position:50,reverse:false,points:[]};}else this.state=null;
  this.applyCut();this.syncHidden();
 }
 activate(active){if(!active){this.finishCutDrag();this.choosingFace=false;this.rotating=false;this.showSelection(null);}this.active=active;if(!active){this.measuring=false;this.down=null;this.preview=null;this.tap=null;this.lineTap=null;this.levelDrag=null;this.navPointers.clear();}this.applyCut();}
 isVisible(point){if(!(this.active&&this.state?.cut&&this.planes?.length))return true;for(const plane of this.planes)if(plane.distanceToPoint(point)<-1e-4)return false;return true;}
 ensureBox(){
  const s=this.state;if(!s||s.box||!this.bounds||this.bounds.isEmpty())return;
  const c=this.bounds.getCenter(new this.T.Vector3()),size=this.bounds.getSize(new this.T.Vector3());
  s.box={center:c.toArray(),base:[Math.max(size.x/2,.05),Math.max(size.y/2,.05),Math.max(size.z/2,.05)],low:[1,1,1],high:[1,1,1],euler:[0,0,0],face:5};
 }
 boxFrame(){
  const box=this.state.box,T=this.T,euler=this._boxE||(this._boxE=new T.Euler()),quat=this._boxQ||(this._boxQ=new T.Quaternion());
  euler.set(box.euler[0]||0,box.euler[1]||0,box.euler[2]||0);quat.setFromEuler(euler);
  if(!this._boxAxes)this._boxAxes=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
  this._boxAxes[0].set(1,0,0).applyQuaternion(quat);this._boxAxes[1].set(0,1,0).applyQuaternion(quat);this._boxAxes[2].set(0,0,1).applyQuaternion(quat);
  return {axes:this._boxAxes,center:(this._boxCenter||(this._boxCenter=new T.Vector3())).fromArray(box.center)};
 }
 faceValue(){const box=this.state?.box;if(!box)return 100;const face=box.face??5,axis=face>>1;const value=(face%2?box.high:box.low)[axis];return (value??0)*100;}
 setFaceValue(percent){const box=this.state?.box;if(!box)return;const face=box.face??5,axis=face>>1,t=Math.max(-400,Math.min(100,percent))/100;if(face%2)box.high[axis]=t;else box.low[axis]=t;}
 faceReach(face){const box=this.state.box,axis=face>>1,t=(face%2?box.high:box.low)[axis];return box.base[axis]*(t>=.999?t+.02:t)+(t>=.999?.01:0);}
 updatePlanes(){
  this.ensureBox();if(!this.state?.box)return;
  if(!this.planes){this.planes=[];for(let i=0;i<6;i++)this.planes.push(new this.T.Plane());}
  const {axes,center}=this.boxFrame(),box=this.state.box;
  for(let face=0;face<6;face++){
   const axis=face>>1,sign=face%2?1:-1,reach=this.faceReach(face),outward=axes[axis].clone().multiplyScalar(sign),point=center.clone().addScaledVector(outward,reach),plane=this.planes[face];
   plane.normal.copy(outward).negate();plane.constant=-plane.normal.dot(point);
  }
  if(!this.plane)this.plane=new this.T.Plane();
  this.plane.copy(this.planes[box.face??5]);
 }
 applyCut(){
  const s=this.state,enabled=!!(this.active&&s?.cut&&this.group&&this.bounds&&!this.bounds.isEmpty());
  this.renderer.localClippingEnabled=enabled;this.renderer.clippingPlanes=[];
  if(!enabled){this.clearSection();this.sync();this.onChange();return;}
  this.updatePlanes();this.assignClip(true);
  const faces=this.cuttingFaces();
  if(faces.length)this.buildSolidCaps(faces);
  else{this.faceKey='';this.clearSolidCaps();}
  this.sync();this.onChange();
 }
 assignClip(enabled){
  if(!this.group)return;this.clipAssigned=enabled;
  const planes=enabled?this.planes:null,seen=new Set();
  this.group.traverse(obj=>{
   if(!obj.material||obj.userData?.prumoSection)return;
   for(const mat of [].concat(obj.material)){if(seen.has(mat)||mat.userData?.prumoStencil)continue;seen.add(mat);mat.clippingPlanes=planes;mat.clipShadows=enabled;mat.needsUpdate=true;}
  });
 }
 cuttingFaces(){
  if(!this.bounds||!this.planes)return [];
  const b=this.bounds,faces=[],point=this._corner||(this._corner=new this.T.Vector3());
  for(let face=0;face<6;face++){
   const plane=this.planes[face];let outside=false;
   for(let i=0;i<8&&!outside;i++){point.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z);if(plane.distanceToPoint(point)<-1e-3)outside=true;}
   if(outside)faces.push(face);
  }
  return faces;
 }
 cutIsModified(){
  const box=this.state?.box;if(!this.state?.cut||!box)return false;
  if((box.euler||[]).some(value=>Math.abs(value)>1e-3))return true;
  return [...box.low,...box.high].some(value=>value<0.999);
 }
 resetCut(){
  if(!this.state?.cut||!this.bounds)return;
  const box=this.state.box;if(!box)return;
  const center=this.bounds.getCenter(new this.T.Vector3()),size=this.bounds.getSize(new this.T.Vector3());
  box.center=center.toArray();
  box.base=[Math.max(size.x/2,.05),Math.max(size.y/2,.05),Math.max(size.z/2,.05)];
  box.low=[1,1,1];box.high=[1,1,1];box.euler=[0,0,0];box.face=5;
  this.rotating=false;this.choosingFace=false;this.applyCut();
 }
 clearSolidCaps(){
  for(const cap of this.capMeshes||[]){cap.removeFromParent();cap.geometry?.dispose();cap.material?.dispose();}
  this.capMeshes=[];
 }
 buildSolidCaps(faces){
  const scene=this.group?.parent;if(!scene)return;
  const key=faces.join(',')+'|'+this.planes.map(p=>[p.normal.x,p.normal.y,p.normal.z,p.constant].map(n=>n.toFixed(4)).join(',')).join(';');
  if(key===this.faceKey&&this.capMeshes.length)return;
  this.faceKey=key;this.clearSolidCaps();this.group.updateMatrixWorld(true);
  const T=this.T,out=[];
  for(const face of faces){
   out.length=0;
   this.group.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData?.prumoSection||!mesh.geometry?.attributes?.position)return;
    for(let node=mesh;node;node=node.parent)if(node.visible===false)return;
    const world=this._capWorld||(this._capWorld=new T.Matrix4()),pieces=mesh.isInstancedMesh||mesh.isBatchedMesh;
    for(let i=0,n=this.pieceCount(mesh);i<n;i++){
     if(this.elementHidden(mesh,i))continue;
     const geometry=this.pieceGeometry(mesh,pieces?i:null);if(!geometry.boundingBox)geometry.computeBoundingBox();
     this.pieceMatrix(mesh,pieces?i:null,world);
     if(this.missesPlane(geometry.boundingBox,world,this.planes[face]))continue;
     this.fillSection(geometry,world,this.planes[face],out);
    }
   });
   if(out.length<9)continue;
   // Section points are in project coordinates; store them around the box center to keep float32 precision.
   const origin=this.bounds.getCenter(new T.Vector3()),local=new Float32Array(out.length);
   for(let k=0;k<out.length;k+=3){local[k]=out[k]-origin.x;local[k+1]=out[k+1]-origin.y;local[k+2]=out[k+2]-origin.z;}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(local,3));
   const mat=new T.MeshBasicMaterial({color:0x808080,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,clippingPlanes:this.planes.filter((_,index)=>index!==face)});
   const cap=new T.Mesh(geo,mat);cap.position.copy(origin);cap.updateMatrixWorld();
   cap.userData.prumoSection=true;cap.userData.prumoCap=true;cap.frustumCulled=false;cap.renderOrder=80;
   scene.add(cap);this.capMeshes.push(cap);
  }
 }
 missesPlane(box,matrix,plane){
  const p=this._capCorner||(this._capCorner=new this.T.Vector3());let pos=false,neg=false;
  for(let i=0;i<8;i++){
   p.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(matrix);
   const d=plane.distanceToPoint(p);if(d>1e-4)pos=true;else if(d<-1e-4)neg=true;
  }
  return pos!==neg;
 }
 fillSection(geometry,matrix,plane,out){
  if(Math.abs(matrix.determinant())<1e-12)return;
  const T=this.T,inv=this._capInv||(this._capInv=new T.Matrix4()),local=this._capPlane||(this._capPlane=new T.Plane());
  inv.copy(matrix).invert();local.copy(plane).applyMatrix4(inv);
  const pos=geometry.attributes.position,index=geometry.index,count=index?index.count:pos.count,at=i=>index?index.getX(i):i;
  const box=geometry.boundingBox,size=Math.max(box.getSize(this._capSize||(this._capSize=new T.Vector3())).length(),1e-4),eps=Math.max(1e-6,size*1e-7),tol=Math.max(1e-5,size*1e-5);
  const nx=local.normal.x,ny=local.normal.y,nz=local.normal.z,nc=local.constant,dist=(x,y,z)=>nx*x+ny*y+nz*z+nc,on=d=>Math.abs(d)<eps;
  const q=p=>Math.round(p[0]/tol)+','+Math.round(p[1]/tol)+','+Math.round(p[2]/tol),tally=new Map();
  const addSeg=(a,b)=>{const ka=q(a),kb=q(b);if(ka===kb)return;const k=ka<kb?ka+'|'+kb:kb+'|'+ka,rec=tally.get(k);if(rec)rec.n++;else tally.set(k,{n:1,a,b,ka,kb});};
  for(let i=0;i+2<count;i+=3){
   const ia=at(i),ib=at(i+1),ic=at(i+2);
   const p=[[pos.getX(ia),pos.getY(ia),pos.getZ(ia)],[pos.getX(ib),pos.getY(ib),pos.getZ(ib)],[pos.getX(ic),pos.getY(ic),pos.getZ(ic)]];
   const d=[dist(...p[0]),dist(...p[1]),dist(...p[2])],pts=[];let edged=false;
   const addPt=pt=>{for(const q of pts)if(Math.abs(q[0]-pt[0])<eps&&Math.abs(q[1]-pt[1])<eps&&Math.abs(q[2]-pt[2])<eps)return;pts.push(pt);};
   for(let e=0;e<3;e++){
    const i0=e,i1=(e+1)%3,d0=d[i0],d1=d[i1];
    if(on(d0)&&on(d1)){addSeg(p[i0],p[i1]);edged=true;}
    else if(d0*d1<0){const t=d0/(d0-d1);addPt([p[i0][0]+(p[i1][0]-p[i0][0])*t,p[i0][1]+(p[i1][1]-p[i0][1])*t,p[i0][2]+(p[i1][2]-p[i0][2])*t]);}
    else if(on(d0)&&d1<-eps)addPt(p[i0]);
    else if(on(d1)&&d0<-eps)addPt(p[i1]);
   }
   if(!edged&&pts.length>=2)addSeg(pts[0],pts[1]);
  }
  const segments=[];for(const rec of tally.values())if(rec.n%2)segments.push(rec);if(!segments.length)return;
  const loops=this.sectionLoops(segments);if(!loops.length)return;
  this.emitSection(loops,local,matrix,out);
 }
 sectionLoops(segments){
  const adj=new Map(),add=(key,item)=>{let list=adj.get(key);if(!list)adj.set(key,list=[]);list.push(item);};
  segments.forEach((seg,id)=>{add(seg.ka,{id,from:seg.a,to:seg.b,key:seg.kb});add(seg.kb,{id,from:seg.b,to:seg.a,key:seg.ka});});
  const used=new Set(),loops=[];
  for(const [start,items] of adj)for(const item of items){
   if(used.has(item.id))continue;used.add(item.id);
   const loop=[item.from,item.to];let prev=start,cur=item.key,guard=0;
   while(cur!==start&&guard++<segments.length+2){
    const opts=adj.get(cur)||[],step=opts.find(o=>!used.has(o.id)&&o.key!==prev)||opts.find(o=>!used.has(o.id));
    if(!step)break;used.add(step.id);loop.push(step.to);prev=cur;cur=step.key;
   }
   if(cur===start&&loop.length>=3)loops.push(loop);
  }
  return loops;
 }
 emitSection(loops,plane,matrix,out){
  const T=this.T,n=plane.normal,tmp=this._capT||(this._capT=new T.Vector3()),u=this._capU||(this._capU=new T.Vector3()),v=this._capV||(this._capV=new T.Vector3()),w=this._capW||(this._capW=new T.Vector3());
  tmp.set(Math.abs(n.x)<0.9?1:0,Math.abs(n.x)<0.9?0:1,0);u.crossVectors(tmp,n).normalize();v.crossVectors(n,u).normalize();
  const dot=(p,axis)=>p[0]*axis.x+p[1]*axis.y+p[2]*axis.z,to2=p=>new T.Vector2(dot(p,u),dot(p,v));
  const area=ring=>{let a=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];a+=p.x*q.y-q.x*p.y;}return a;};
  const contains=(ring,pt)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>pt.y)!==(b.y>pt.y)&&pt.x<(b.x-a.x)*(pt.y-a.y)/(b.y-a.y||1e-12)+a.x)inside=!inside;}return inside;};
  const rings=loops.map(loop=>{const ring=[],src=[];for(const p of loop){const q=to2(p);if(!ring.length||q.distanceToSquared(ring[ring.length-1])>1e-12){ring.push(q);src.push(p);}}if(ring.length>2&&ring[0].distanceToSquared(ring[ring.length-1])<1e-12){ring.pop();src.pop();}return {ring,src,area:area(ring)};}).filter(r=>r.ring.length>=3&&Math.abs(r.area)>1e-10);
  const depth=rings.map((r,i)=>rings.reduce((n,o,j)=>n+(j!==i&&Math.abs(o.area)>Math.abs(r.area)&&contains(o.ring,r.ring[0])?1:0),0));
  const emit=(a,b,c)=>{for(const p of [a,b,c]){w.set(p[0],p[1],p[2]).applyMatrix4(matrix);out.push(w.x,w.y,w.z);}};
  for(let i=0;i<rings.length;i++){
   if(depth[i]%2)continue;
   const holes=[],holeSrc=[];
   for(let j=0;j<rings.length;j++){
    if(depth[j]!==depth[i]+1||!contains(rings[i].ring,rings[j].ring[0]))continue;
    let smaller=false;for(let k=0;k<rings.length;k++)if(k!==i&&depth[k]%2===0&&Math.abs(rings[k].area)<Math.abs(rings[i].area)&&contains(rings[k].ring,rings[j].ring[0]))smaller=true;
    if(smaller)continue;
    let hole=rings[j].ring,src=rings[j].src;if(rings[j].area*rings[i].area>0){hole=hole.slice().reverse();src=src.slice().reverse();}
    holes.push(hole);holeSrc.push(src);
   }
   let contour=rings[i].ring,src=rings[i].src;if(rings[i].area<0){contour=contour.slice().reverse();src=src.slice().reverse();}
   let faces=null;try{faces=T.ShapeUtils.triangulateShape(contour,holes);}catch{}
   if(!faces?.length){for(let t=1;t<src.length-1;t++)emit(src[0],src[t],src[t+1]);}
   else{const all=src.concat(...holeSrc);for(const f of faces)if(all[f[0]]&&all[f[1]]&&all[f[2]])emit(all[f[0]],all[f[1]],all[f[2]]);}
  }
 }
 clearSection(){
  this.assignClip(false);this.faceKey='';this.clearSolidCaps();
 }
 sync(){
  if(this.measuring)this.$('ifc-hint').textContent=this.measureHint();else if(this.state?.cut){const keys=matchMedia('(pointer:fine)').matches;this.$('ifc-hint').textContent=this.rotating?'Arraste para girar a caixa.'+(keys?' As setas do teclado mudam o ângulo de 1 em 1°.':''):this.choosingFace?'Toque na face que alinha a caixa.':'Arraste um lado da caixa. Lado troca a face e Girar muda a direção.'+(keys?' Setas do teclado: ↑ → aumentam e ↓ ← diminuem o corte de 1 em 1%.':'');}else this.navigation.armFocus(false);
  const s=this.state;this.$('ifc-cut').setAttribute('aria-pressed',String(!!s?.cut));this.$('ifc-measure').setAttribute('aria-pressed',String(this.measuring));this.$('ifc-cut-face').setAttribute('aria-pressed',String(!!this.choosingFace));this.$('ifc-cut-rotate')?.setAttribute('aria-pressed',String(!!this.rotating));
  this.$('ifc-cut-controls').hidden=!s?.cut;
  const reset=this.$('ifc-cut-reset');if(reset){reset.hidden=!s?.cut;reset.disabled=!this.cutIsModified();}
  this.cutHandle.title=this.rotating?'↑ → aumentam e ↓ ← diminuem o ângulo · Shift muda de 10 em 10':'↑ → aumentam e ↓ ← diminuem o corte · Shift muda de 10 em 10';
  if(s?.box)this.$('ifc-cut-value').textContent=this.rotating?Math.round((s.box.euler[1]||0)*180/Math.PI)+'°':Math.round(this.faceValue())+'%';
  this.draw();
 }
 bindCutDrag(){
  const start=e=>{
   if(!this.active||!this.state?.cut||this.cutDrag||e.button>0)return;
   e.preventDefault();e.stopImmediatePropagation();
   this.ensureBox();
   this.cutDrag={id:e.pointerId,x:e.clientX,y:e.clientY,position:this.faceValue(),yaw:this.state.box.euler[1]||0,pitch:this.state.box.euler[0]||0,axis:{...this.cutScreenAxis},mode:this.rotating?'rotate':'face',enabled:this.controls.enabled,element:e.currentTarget};
   this.controls.enabled=false;this.navigation.armFocus(false);try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
   this.cutHandle.classList.add('dragging');
  };
  const move=e=>{
   const drag=this.cutDrag;if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();
   if(drag.mode==='rotate')this.cutPending={yaw:drag.yaw-(e.clientX-drag.x)*0.008,pitch:Math.max(-1.2,Math.min(1.2,drag.pitch+(e.clientY-drag.y)*0.008))};
   else{const {x,y}=drag.axis,length=x*x+y*y;this.cutPending=Math.max(-400,Math.min(100,drag.position+100*((e.clientX-drag.x)*x+(e.clientY-drag.y)*y)/Math.max(1,length)));}
   if(!this.cutFrame)this.cutFrame=requestAnimationFrame(()=>{this.cutFrame=0;if(!this.cutDrag||!this.state?.box||this.cutPending==null)return;if(this.cutDrag.mode==='rotate'){this.state.box.euler[1]=this.cutPending.yaw;this.state.box.euler[0]=this.cutPending.pitch;}else this.setFaceValue(this.cutPending);this.applyCut();});
  };
  this.cutHandle.addEventListener('pointerdown',start);this.cutHandle.addEventListener('pointermove',move);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.cutHandle.addEventListener(name,e=>{if(this.cutDrag?.id===e.pointerId){e.stopPropagation();this.finishCutDrag();}});
  this.cutHandle.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();});
  document.addEventListener('keydown',e=>this.cutKey(e));
  const canvas=this.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{
   if(!this.active||!this.state?.cut||this.measuring||this.choosingFace||this.cutDrag||e.button)return;
   if(this.rotating){start(e);return;}
   const face=this.nearestFace(e.clientX,e.clientY,40);if(face<0)return;
   this.state.box.face=face;this.applyCut();start(e);
  },true);
  canvas.addEventListener('pointermove',move,true);
  for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,e=>{if(this.cutDrag?.id===e.pointerId&&this.cutDrag.element===canvas){e.stopPropagation();this.finishCutDrag();}},true);
 }
 cutKey(e){
  if(!this.active||!this.state?.cut||this.cutDrag||e.ctrlKey||e.metaKey||e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const target=e.target;if(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="tab"]')||this.$('capture-editor')?.hidden===false)return;
  this.ensureBox();const box=this.state.box;if(!box)return;
  e.preventDefault();this.choosingFace=false;
  // Every arrow changes only the number shown on the cut handle: up/right raise it, down/left lower it.
  const sign=e.key==='ArrowUp'||e.key==='ArrowRight'?1:-1,step=e.shiftKey?10:1;
  if(this.rotating){
   if(e.key==='Home')box.euler[1]=0;
   else if(e.key!=='End')box.euler[1]=(Math.round((box.euler[1]||0)*180/Math.PI)+sign*step)*Math.PI/180;
  }else this.setFaceValue(e.key==='Home'?0:e.key==='End'?100:Math.round(this.faceValue())+sign*step);
  this.sync();
  // Held keys repeat faster than section caps rebuild, so apply once per frame.
  if(!this.keyFrame)this.keyFrame=requestAnimationFrame(()=>{this.keyFrame=0;if(this.state?.cut)this.applyCut();});
 }
 finishCutDrag(){
  const drag=this.cutDrag;if(!drag)return;
  if(this.cutFrame){cancelAnimationFrame(this.cutFrame);this.cutFrame=0;if(this.state?.box&&this.cutPending!=null){if(drag.mode==='rotate'){this.state.box.euler[1]=this.cutPending.yaw;this.state.box.euler[0]=this.cutPending.pitch;}else this.setFaceValue(this.cutPending);this.applyCut();}}
  this.cutDrag=null;this.cutPending=null;this.controls.enabled=drag.enabled;this.cutHandle.classList.remove('dragging');
  if(drag.element.hasPointerCapture?.(drag.id))drag.element.releasePointerCapture(drag.id);
 }
 nearestFace(clientX,clientY,limit){
  const r=this.renderer.domElement.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let best=-1,dist=limit;
  for(const hit of this.faceHits||[]){const d=Math.hypot(hit.x-x,hit.y-y);if(d<=dist){dist=d;best=hit.face;}}
  return best;
 }
 drawCut(){
  const visible=this.active&&this.state?.cut&&this.bounds;this.cutHandle.hidden=!visible;this.cutOverlay.replaceChildren();this.faceHits=[];if(!visible)return;
  this.ensureBox();if(!this.state.box)return;
  const s=this.state,r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return;this.camera.updateMatrixWorld();
  this.cutOverlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  const screen=p=>{const v=p.clone().project(this.camera);return {x:(v.x+1)*r.width/2,y:(1-v.y)*r.height/2,z:v.z};};
  const {axes,center}=this.boxFrame(),box=s.box,corners=[];
  for(let i=0;i<8;i++){
   const lx=(i&1)?box.base[0]*box.high[0]:-box.base[0]*box.low[0],ly=(i&2)?box.base[1]*box.high[1]:-box.base[1]*box.low[1],lz=(i&4)?box.base[2]*box.high[2]:-box.base[2]*box.low[2];
   corners.push(center.clone().addScaledVector(axes[0],lx).addScaledVector(axes[1],ly).addScaledVector(axes[2],lz));
  }
  const edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);this.cutOverlay.append(el);return el;};
  const projected=corners.map(screen);
  const faceInfo=Array.from({length:6},(_,side)=>{
   const ax=side>>1,sg=side%2?1:-1,dist=(side%2?box.base[ax]*box.high[ax]:box.base[ax]*box.low[ax]);
   const point=center.clone().addScaledVector(axes[ax],sg*dist),outward=axes[ax].clone().multiplyScalar(sg);
   return {point,outward,facesCam:outward.dot(this.camera.position.clone().sub(point))>0.02};
  });
  const cornerFaces=i=>[i&1?1:0,i&2?3:2,i&4?5:4];
  for(const [a,b] of edges){
   const shared=cornerFaces(a).filter(f=>cornerFaces(b).includes(f));
   if(!shared.some(f=>faceInfo[f].facesCam))continue;
   const pa=projected[a],pb=projected[b];if(pa.z<-1||pa.z>1||pb.z<-1||pb.z>1)continue;add('line',{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y,stroke:'#ffe49a','stroke-width':2});
  }
  const face=box.face??5,axis=face>>1,sign=face%2?1:-1,reach=(face%2?box.base[axis]*box.high[axis]:box.base[axis]*box.low[axis]);
  const outward=axes[axis].clone().multiplyScalar(sign),faceCenter=center.clone().addScaledVector(outward,reach);
  const middle=screen(faceCenter),far=screen(faceCenter.clone().addScaledVector(outward,Math.max(box.base[axis]*.35,.2)));
  let direction={x:far.x-middle.x,y:far.y-middle.y};
  if(!Number.isFinite(direction.x+direction.y)||Math.hypot(direction.x,direction.y)<40||middle.z<-1||far.z<-1)direction={x:0,y:-Math.max(180,r.height*.5)};
  this.cutScreenAxis=direction;
  for(let side=0;side<6;side++){
   if(!faceInfo[side].facesCam)continue;
   const at=screen(faceInfo[side].point);
   if(at.z<-1||at.z>1)continue;this.faceHits.push({face:side,x:at.x,y:at.y});
   if(side!==face)add('circle',{cx:at.x,cy:at.y,r:5,fill:'#ffe49a',stroke:'#173c2d','stroke-width':1});
  }
  const x=Number.isFinite(middle.x)?Math.max(28,Math.min(r.width-28,middle.x)):r.width/2,y=Number.isFinite(middle.y)?Math.max(28,Math.min(r.height-48,middle.y)):r.height/2;
  this.cutHandle.style.left=x+'px';this.cutHandle.style.top=y+'px';
  const label=this.rotating?'↻ Girar · '+Math.round((box.euler[1]||0)*180/Math.PI)+'°':'↕ Corte · '+Math.round(this.faceValue())+'%';
  this.cutHandle.textContent=label;this.cutHandle.setAttribute('aria-valuenow',String(Math.round(this.faceValue())));this.cutHandle.setAttribute('aria-valuetext',label);
 }
 resetTab(){
  const tab=this.$('ifc-tab');if(!tab)return;
  tab.style.left='';tab.style.top='';
 }
 bindTabDrag(){
  const tab=this.$('ifc-tab'),grip=this.$('ifc-tab-grip');if(!tab||!grip)return;
  try{sessionStorage.removeItem('prumo-ifc-tab');}catch{}
  this.resetTab();
  let dragged=false;
  const syncCollapse=()=>{const closed=tab.classList.contains('collapsed');grip.setAttribute('aria-expanded',String(!closed));grip.title=closed?'Toque para mostrar as ferramentas · arraste para mover':'Toque para recolher as ferramentas · arraste para mover';grip.setAttribute('aria-label',closed?'Mostrar ferramentas':'Recolher ferramentas');};
  syncCollapse();
  grip.addEventListener('click',e=>{e.stopPropagation();if(dragged){dragged=false;return;}tab.classList.toggle('collapsed');syncCollapse();});
  grip.addEventListener('pointerdown',e=>{
   if(e.button)return;e.preventDefault();e.stopPropagation();dragged=false;
   const host=tab.offsetParent||tab.parentElement,box=host.getBoundingClientRect();
   const startX=e.clientX,startY=e.clientY,originLeft=tab.offsetLeft,originTop=tab.offsetTop;
   const move=ev=>{
    if(!dragged&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<6)return;dragged=true;
    const gap=document.body.classList.contains('viewer-fullscreen')?8:44;
    const maxX=Math.max(8,box.width-tab.offsetWidth-8),maxY=Math.max(8,box.height-tab.offsetHeight-gap);
    tab.style.left=Math.min(maxX,Math.max(8,originLeft+ev.clientX-startX))+'px';
    tab.style.top=Math.min(maxY,Math.max(8,originTop+ev.clientY-startY))+'px';
   };
   const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
   try{grip.setPointerCapture(e.pointerId);}catch{}
  });
 }
 tipAt(x,y,pointerType){
  const points=this.state?.points||[];if(!points.length)return 0;
  this.camera.updateMatrixWorld();const rect=this.renderer.domElement.getBoundingClientRect();let nearest=-1,limit=pointerType==='touch'?48:26;
  const near=(point,i)=>{const s=this.screenOf(point,rect);if(!s.ok)return;const d=Math.hypot(s.x-x,s.y-y);if(d<=limit){nearest=i;limit=d;}};
  points.forEach((point,i)=>near(new this.T.Vector3().fromArray(point),i));
  if(this.level&&points.length===1)this.laser(points[0]).forEach((leg,i)=>{const tip=this.legTip(leg);if(tip)near(tip,10+i);});
  return nearest>=0?nearest:points.length<2&&!this.level?points.length:-1;
 }
 legTip(leg){return leg.target||(leg.to&&leg.cm>=1?leg.to:null);}
 lineAt(x,y,pointerType){
  const points=this.state?.points||[];
  const segments=this.level?(points.length===1?this.laser(points[0]).filter(l=>l.to).map(l=>[l.from,l.to]):[]):points.length===2?[points.map(p=>new this.T.Vector3().fromArray(p))]:[];
  this.camera.updateMatrixWorld();const rect=this.renderer.domElement.getBoundingClientRect(),limit=pointerType==='touch'?22:10;
  return segments.some(([pa,pb])=>{
   const a=this.screenOf(pa,rect),b=this.screenOf(pb,rect);if(!a.ok||!b.ok)return false;
   const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
   return Math.hypot(a.x+dx*t-x,a.y+dy*t-y)<=limit;
  });
 }
 measureHint(){
  if(this.level)return this.state?.points.length?'Arraste a ponta de uma linha até outra face para medir até ela. Toque em qualquer face para mudar o nível.':'Nível: toque em qualquer face. Ele mede até as superfícies em X, Y e Z.';
  return (this.state?.points.length||0)===2?'Arraste o modelo para girar. Arraste uma ponta para ajustar ou toque na linha da medida para medir de novo.':'O ponto prende na linha da face. Perto do esquadro com o outro ponto, a ponta trava em ⊥ e mede reto.';
 }
 pick(x,y){
  const hit=this.hitAt(x,y);
  if(!hit){this.$('ifc-measure-result').textContent='Toque em uma superfície visível do modelo.';return;}
  const snap=this.snapFeature(hit,x,y);
  if(this.state.points.length===2)this.state.points=[];this.state.points.push(snap.point.toArray());this.draw();
 }
 placeLevel(x,y){
  const hit=this.hitAt(x,y);if(!hit||!this.state)return;
  this.state.points=[hit.point.toArray()];this.levelEnds=[];this.preview=null;this.aim=null;this.draw();this.sync();this.onChange?.();
 }
 aimAt(x,y,live=false){
  const hit=this.hitAt(x,y);if(!hit){if(!live){this.aim=null;this.paintLoupe();}return;}
  // The level sits exactly where the face was touched; snapping to an edge would graze the neighbouring faces.
  const snap=this.level?{point:hit.point.clone(),kind:'face'}:this.snapFeature(hit,x,y,live?this.fixedEnd():null);
  this.aim={point:snap.point,kind:snap.kind,edge:snap.edge,perpDir:snap.perpDir,faceLines:snap.faceLines,finger:{x,y}};
  if(live&&this.down?.editing>=10){if(this.down.moved)this.levelDrag={index:this.down.editing-10,point:snap.point.toArray()};}
  else if(live&&this.down&&this.down.editing>=0&&this.down.editing<=(this.state?.points.length||0)){const pts=(this.state?.points||[]).map(p=>p.slice());pts[this.down.editing]=snap.point.toArray();this.preview=pts;}
  this.draw();this.onChange?.();
 }
 hitAt(x,y){
  if(!this.group)return null;const r=this.renderer.domElement.getBoundingClientRect();this.camera.updateMatrixWorld();this.group.updateMatrixWorld(true);
  this.ray.setFromCamera({x:(x-r.left)/r.width*2-1,y:1-(y-r.top)/r.height*2},this.camera);
  const hits=this.ray.intersectObject(this.group,true);
  if(this.measuring)for(const cap of this.capMeshes||[])hits.push(...this.ray.intersectObject(cap,false));
  if(hits.length>1)hits.sort((a,b)=>a.distance-b.distance);
  return hits.find(h=>{if(h.object.userData?.prumoCap)return !!this.measuring&&!this.isHiddenHit(h)&&this.isVisible(h.point);if(h.object.userData?.prumoSection)return false;return !this.isHiddenHit(h)&&this.isVisible(h.point);})||null;
 }
 featureData(geometry){
  if(!geometry?.attributes?.position)return null;
  if(geometry.userData.prumoFeatures)return geometry.userData.prumoFeatures;
  const pos=geometry.attributes.position,index=geometry.index,count=index?index.count:pos.count,at=i=>index?index.getX(i):i;
  const weld=new Map(),points=[];
  const idOf=vi=>{const x=pos.getX(vi),y=pos.getY(vi),z=pos.getZ(vi),k=Math.round(x*1e4)+','+Math.round(y*1e4)+','+Math.round(z*1e4);let id=weld.get(k);if(id===undefined){id=points.length;weld.set(k,id);points.push([x,y,z]);}return id;};
  const edges=new Map();
  for(let i=0;i+2<count;i+=3){
   const ia=idOf(at(i)),ib=idOf(at(i+1)),ic=idOf(at(i+2)),a=points[ia],b=points[ib],c=points[ic];
   const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz);if(len<1e-10)continue;nx/=len;ny/=len;nz/=len;
   for(const [p,q] of [[ia,ib],[ib,ic],[ic,ia]]){
    if(p===q)continue;const k=p<q?p+':'+q:q+':'+p,e=edges.get(k);
    if(!e)edges.set(k,{a:p,b:q,nx,ny,nz,faces:1,crease:false});
    else{e.faces++;if(e.nx*nx+e.ny*ny+e.nz*nz<0.965)e.crease=true;}
   }
  }
  const feature=[],links=new Map();
  for(const e of edges.values())if(e.faces===1||e.crease){feature.push([e.a,e.b]);for(const id of [e.a,e.b]){if(!links.has(id))links.set(id,[]);}}
  for(const [a,b] of feature){links.get(a).push(b);links.get(b).push(a);}
  const corners=[];
  for(const [id,neighbors] of links){
   if(neighbors.length!==2){corners.push(id);continue;}
   const p=points[id],u=points[neighbors[0]],v=points[neighbors[1]];
   let ax=u[0]-p[0],ay=u[1]-p[1],az=u[2]-p[2],bx=v[0]-p[0],by=v[1]-p[1],bz=v[2]-p[2];
   const la=Math.hypot(ax,ay,az)||1,lb=Math.hypot(bx,by,bz)||1,dot=(ax*bx+ay*by+az*bz)/(la*lb);
   if(dot>-0.985)corners.push(id);
  }
  return geometry.userData.prumoFeatures={points,edges:feature,corners};
 }
 meshMatrix(hit){return this.pieceMatrix(hit.object,hit.instanceId,this._meshMatrix||(this._meshMatrix=new this.T.Matrix4()));}
 pieceCount(mesh){return mesh.isBatchedMesh?mesh.userData.ifcIds?.length??0:mesh.isInstancedMesh?mesh.count:1;}
 pieceMatrix(mesh,index,target){
  if((mesh.isInstancedMesh||mesh.isBatchedMesh)&&index!=null){mesh.getMatrixAt(index,target);return target.premultiply(mesh.matrixWorld);}
  return target.copy(mesh.matrixWorld);
 }
 pieceGeometry(mesh,index){
  if(!mesh.isBatchedMesh||index==null)return mesh.geometry;
  const T=this.T,id=mesh.getGeometryIdAt(index);let views=this.views.get(mesh);if(!views)this.views.set(mesh,views=new Map());
  let view=views.get(id);
  if(!view){
   // Shares the batch vertex buffers; only the index range of this geometry is viewed.
   const range=mesh.getGeometryRangeAt(id),source=mesh.geometry;view=new T.BufferGeometry();
   view.setAttribute('position',source.attributes.position);view.setAttribute('normal',source.attributes.normal);
   view.setIndex(new T.BufferAttribute(source.index.array.subarray(range.indexStart,range.indexStart+range.indexCount),1));
   view.boundingBox=mesh.getBoundingBoxAt(id,new T.Box3());views.set(id,view);
  }
  return view;
 }
 snapVisible(point){return this.isVisible(point)||!!(this.state?.cut&&this.plane&&Math.abs(this.plane.distanceToPoint(point))<1e-3);}
 screenOf(point,rect){
  const p=this._ndc||(this._ndc=new this.T.Vector3());p.copy(point).project(this.camera);
  return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,ok:p.z>=-1&&p.z<=1};
 }
 closestOnRay(a,b){
  const v=this._edge||(this._edge=new this.T.Vector3()),out=this._onEdge||(this._onEdge=new this.T.Vector3()),ray=this.ray.ray,o=ray.origin,d=ray.direction;
  v.subVectors(b,a);const w0x=a.x-o.x,w0y=a.y-o.y,w0z=a.z-o.z,b1=d.x*v.x+d.y*v.y+d.z*v.z,c=v.lengthSq(),dv=d.x*w0x+d.y*w0y+d.z*w0z,e=v.x*w0x+v.y*w0y+v.z*w0z,den=c-b1*b1;
  const t=Math.max(0,Math.min(1,den<1e-10?0:(b1*dv-e)/den));
  out.copy(a).addScaledVector(v,t);return t;
 }
 fixedEnd(){
  const d=this.down,points=this.state?.points||[];if(!d||d.editing<0||d.editing>1||(d.editing===0&&points.length<2))return null;
  const other=points[1-d.editing];return other?new this.T.Vector3().fromArray(other):null;
 }
 samePiece(point,normal,hit){
  const r=this._perpRay||(this._perpRay=new this.T.Raycaster());r.set(point.clone().addScaledVector(normal,.01),normal.clone().negate());r.far=.02;
  return r.intersectObject(hit.object,false).some(h=>(h.instanceId??h.batchId)===hit.instanceId&&h.point.distanceTo(point)<.005);
 }
 snapFeature(hit,x,y,fixed=null){
  const data=this.featureData(this.pieceGeometry(hit.object,hit.instanceId));
  if(!data)return {point:hit.point.clone(),kind:'quina'};
  const matrix=this.meshMatrix(hit),rect=this.renderer.domElement.getBoundingClientRect(),T=this.T;
  const wa=this._wa||(this._wa=new T.Vector3()),wb=this._wb||(this._wb=new T.Vector3());
  const world=id=>wa.fromArray(data.points[id]).applyMatrix4(matrix);
  let edgeList=data.edges,cornerList=data.corners,faceMode=false;
  if(hit.face){
   const n=hit.face.normal,inv=this._inv||(this._inv=new T.Matrix4()),local=this._local||(this._local=new T.Vector3());
   inv.copy(matrix).invert();local.copy(hit.point).applyMatrix4(inv);
   const dist=p=>Math.abs(n.x*(p[0]-local.x)+n.y*(p[1]-local.y)+n.z*(p[2]-local.z));
   const selected=[],ids=new Set();
   for(const pair of data.edges){const a=data.points[pair[0]],b=data.points[pair[1]];if(dist(a)>0.004||dist(b)>0.004)continue;selected.push(pair);ids.add(pair[0]);ids.add(pair[1]);}
   if(selected.length){edgeList=selected;cornerList=[...ids].filter(id=>data.corners.includes(id));faceMode=true;}
  }
  const depth=Math.max(1e-3,hit.point.distanceTo(this.camera.position));
  const worldPerPixel=2*Math.tan(this.camera.fov*Math.PI/360)*depth/Math.max(1,rect.height);
  const nearHit=(point,pixels)=>point.distanceTo(hit.point)<=pixels*worldPerPixel;
  const edgeLimit=faceMode?220:96,cornerLimit=faceMode?160:150,bias=faceMode?28:22;
  let bestC=null,bestCd=Infinity,bestE=null,bestEd=Infinity,bestEdge=null;const faceLines=[],segs=[];
  const considerCorner=point=>{if(!this.snapVisible(point)||!nearHit(point,cornerLimit))return;const s=this.screenOf(point,rect);if(!s.ok)return;const d=Math.hypot(s.x-x,s.y-y);if(d<bestCd){bestCd=d;bestC=point.clone();}};
  for(const id of cornerList)considerCorner(world(id).clone());
  for(const [ia,ib] of edgeList){
   const a=world(ia).clone(),b=wb.fromArray(data.points[ib]).applyMatrix4(matrix).clone();
   if(faceMode)faceLines.push([a,b]);segs.push([a,b]);
   if(this.state?.cut&&this.plane){const da=this.plane.distanceToPoint(a),db=this.plane.distanceToPoint(b);if(da*db<0)considerCorner(a.clone().lerp(b,da/(da-db)));}
   const t=this.closestOnRay(a,b),point=this._onEdge.clone();
   if(!this.snapVisible(point)||!nearHit(point,edgeLimit))continue;
   const s=this.screenOf(point,rect);if(!s.ok)continue;const d=Math.hypot(s.x-x,s.y-y);
   if(d<bestEd){bestEd=d;bestE=point.clone();bestEdge=[a,b,t];}
  }
  const pack=extra=>({...extra,faceLines:faceMode?faceLines:null});
  const cornerOk=bestC&&bestCd<=cornerLimit,edgeOk=bestE&&bestEd<=edgeLimit;
  // With the other end fixed, the foot of the perpendicular on this edge or face gives the straight, shortest measure.
  if(fixed){
   let perp=null,perpD=Infinity;
   const consider=(point,dir,edge)=>{if(point.distanceTo(fixed)<1e-4||!this.snapVisible(point))return;const s=this.screenOf(point,rect);if(!s.ok)return;const d=Math.hypot(s.x-x,s.y-y);if(d<perpD){perpD=d;perp={point:point.clone(),kind:'perp',edge,perpDir:dir};}};
   for(const [a,b] of segs){const v=b.clone().sub(a),len2=v.lengthSq();if(len2<1e-10)continue;const t=fixed.clone().sub(a).dot(v)/len2;if(t<=1e-3||t>=1-1e-3)continue;consider(a.clone().addScaledVector(v,t),v.normalize(),[a,b]);}
   if(hit.face){
    const n=hit.face.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(matrix)).normalize(),q=fixed.clone().addScaledVector(n,-fixed.clone().sub(hit.point).dot(n));
    if(this.samePiece(q,n,hit))consider(q,new T.Vector3().crossVectors(n,Math.abs(n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),null);
   }
   if(perp&&perpD<=36&&(!cornerOk||perpD<=bestCd+12))return pack(perp);
  }
  if(cornerOk&&(!edgeOk||bestCd-bias<=bestEd))return pack({point:bestC,kind:'quina'});
  if(edgeOk)return pack({point:bestE,kind:'aresta',edge:bestEdge.slice(0,2)});
  if(bestC)return pack({point:bestC,kind:'quina'});
  if(bestE)return pack({point:bestE,kind:'aresta',edge:bestEdge.slice(0,2)});
  return pack({point:hit.point.clone(),kind:'quina'});
 }
 pickCutFace(x,y){
  const hit=this.hitAt(x,y);if(!hit?.face||!this.state)return false;
  this.ensureBox();if(!this.state.box)return false;
  const n=hit.face.normal.clone(),instance=new this.T.Matrix4();
  n.transformDirection(this.pieceMatrix(hit.object,hit.instanceId,instance)).normalize();
  if(n.dot(new this.T.Vector3().subVectors(this.camera.position,hit.point))<0)n.negate();
  const quat=new this.T.Quaternion().setFromUnitVectors(new this.T.Vector3(0,0,1),n),euler=new this.T.Euler().setFromQuaternion(quat);
  const box=this.state.box;box.euler=[euler.x,euler.y,euler.z];box.face=5;
  const center=new this.T.Vector3().fromArray(box.center),dist=Math.max(.05,n.dot(hit.point)-n.dot(center));
  box.base[2]=Math.max(box.base[2],dist);box.high[2]=Math.max(.05,Math.min(1,dist/box.base[2]));
  this.choosingFace=false;this.rotating=false;this.applyCut();return true;
 }
 normalSpan(normal){
  const b=this.bounds,xs=[b.min.x,b.max.x],ys=[b.min.y,b.max.y],zs=[b.min.z,b.max.z];let min=Infinity,max=-Infinity;
  for(const x of xs)for(const y of ys)for(const z of zs){const d=normal.x*x+normal.y*y+normal.z*z;if(d<min)min=d;if(d>max)max=d;}
  return {min,max};
 }
 planePoints(){
  const T=this.T,b=this.bounds,plane=this.plane;if(!b||!plane)return [];
  const min=b.min,max=b.max,corners=[];for(let i=0;i<8;i++)corners.push(new T.Vector3(i&1?max.x:min.x,i&2?max.y:min.y,i&4?max.z:min.z));
  const edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],pts=[];
  for(const [a,c] of edges){const da=plane.distanceToPoint(corners[a]),dc=plane.distanceToPoint(corners[c]);if(da*dc>1e-7)continue;const denom=da-dc;if(Math.abs(denom)<1e-9)continue;pts.push(corners[a].clone().lerp(corners[c],da/denom));}
  if(pts.length<3)return pts;
  const center=pts.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/pts.length),n=plane.normal,ref=Math.abs(n.x)<.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
  const x=new T.Vector3().crossVectors(n,ref).normalize(),y=new T.Vector3().crossVectors(n,x);
  return pts.sort((p,q)=>Math.atan2(p.clone().sub(center).dot(y),p.clone().sub(center).dot(x))-Math.atan2(q.clone().sub(center).dot(y),q.clone().sub(center).dot(x)));
 }
 grabFrame(){
  if(!this.measuring)return;const src=this.renderer?.domElement;if(!src?.width)return;
  if(!this.shot)this.shot=document.createElement('canvas');
  if(this.shot.width!==src.width||this.shot.height!==src.height){this.shot.width=src.width;this.shot.height=src.height;}
  this.shot.getContext('2d').drawImage(src,0,0);this.shotReady=true;if(this.aim)this.paintLoupe();
 }
 paintLoupe(){
  const loupe=this.$('ifc-loupe');if(!loupe)return;
  if(!this.active||!this.measuring||!this.aim){loupe.hidden=true;return;}
  loupe.hidden=false;
  const view=loupe.offsetParent?.getBoundingClientRect();
  const tab=this.$('ifc-tab');
  const tabBox=tab&&!tab.hidden?tab.getBoundingClientRect():null;
  if(view){
   const onLeft=!tabBox||tabBox.left+tabBox.width/2<view.left+view.width/2;
   if(onLeft){loupe.style.left='auto';loupe.style.right='14px';}
   else{loupe.style.left='14px';loupe.style.right='auto';}
   loupe.style.top='64px';
  }
  const host=this.renderer.domElement.getBoundingClientRect();
  const c=loupe.querySelector('canvas'),ctx=c.getContext('2d'),gl=this.renderer.domElement,ratio=gl.width/Math.max(1,gl.clientWidth);
  const focus=this.aim.point.clone().project(this.camera);
  const fx=focus.z>=-1&&focus.z<=1?host.left+(focus.x+1)*host.width/2:host.left+host.width/2,fy=focus.z>=-1&&focus.z<=1?host.top+(1-focus.y)*host.height/2:host.top+host.height/2;
  const cropX=(fx-host.left)*ratio,cropY=(fy-host.top)*ratio,zoom=4,size=c.width/zoom;
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#10261c';ctx.fillRect(0,0,c.width,c.height);
  if(this.shotReady)ctx.drawImage(this.shot,cropX-size/2,cropY-size/2,size,size,0,0,c.width,c.height);
  ctx.strokeStyle='#ffe49a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(c.width/2-18,c.height/2);ctx.lineTo(c.width/2+18,c.height/2);ctx.moveTo(c.width/2,c.height/2-18);ctx.lineTo(c.width/2,c.height/2+18);ctx.stroke();ctx.strokeRect(c.width/2-8,c.height/2-8,16,16);
  this.$('ifc-loupe-label').textContent=this.measureLabel();
 }
 measureLabel(){
  const points=this.preview||this.state?.points||[];
  if(this.level){if(this.levelDrag&&points.length===1){const leg=this.laser(points[0])[this.levelDrag.index];return leg.axis+' '+this.cm(leg.cm)+' cm';}return points.length?'Ponto do nível':'Toque o ponto do nível';}
  if(points.length<2)return points.length?'2º ponto':'1º ponto';
  const cm=new this.T.Vector3().fromArray(points[0]).distanceTo(new this.T.Vector3().fromArray(points[1]))*100;
  return (this.down&&this.aim?.kind==='perp'?'⊥ ':'')+this.cm(cm)+' cm';
 }
 cm(value){return value.toLocaleString('pt-BR',{maximumFractionDigits:2});}
 // Scene Y is up: IFC X = x, IFC Y = -z and IFC Z (height) = y. Colors follow the origin axes.
 // A tip dragged to another face measures along the same axis up to that face's point.
 laser(point){
  const ends=this.preview?[]:this.levelEnds.slice(0,6);if(this.levelDrag)ends[this.levelDrag.index]=this.levelDrag.point;
  const key=point.join()+'|'+JSON.stringify(this.state?.cut?this.state.box:null)+'|'+this.hidden.size+'|'+JSON.stringify(ends);
  if(this.laserCache?.key===key)return this.laserCache.legs;
  const T=this.T,p=new T.Vector3().fromArray(point);this.group?.updateMatrixWorld(true);
  // Start a hair off the picked face, toward the camera, so the face itself reads as 0 on its own side.
  const origin=p.clone().addScaledVector(this.camera.getWorldDirection(new T.Vector3()),-.002);
  const colors={X:'#ff6b5e',Y:'#5eb4ff',Z:'#7ee06d'};
  const legs=[['X',[1,0,0]],['X',[-1,0,0]],['Y',[0,0,-1]],['Y',[0,0,1]],['Z',[0,1,0]],['Z',[0,-1,0]]].map(([axis,v],i)=>{
   const dir=new T.Vector3(...v);
   if(ends[i]){const target=new T.Vector3().fromArray(ends[i]),cm=Math.max(0,target.clone().sub(p).dot(dir))*100;return {axis,color:colors[axis],from:p,to:p.clone().addScaledVector(dir,cm/100),cm,target};}
   const hit=this.castRay(origin,dir),to=hit?.point.clone()||null;
   return {axis,color:colors[axis],from:p,to,cm:to?Math.max(0,to.clone().sub(p).dot(dir))*100:null};
  });
  this.laserCache={key,legs};return legs;
 }
 castRay(origin,dir){
  if(!this.group)return null;this.ray.set(origin,dir);
  const hits=this.ray.intersectObject(this.group,true);for(const cap of this.capMeshes||[])hits.push(...this.ray.intersectObject(cap,false));
  if(hits.length>1)hits.sort((a,b)=>a.distance-b.distance);
  return hits.find(h=>!h.object.userData?.prumoSection&&!h.object.isLine&&!this.isHiddenHit(h)&&this.isVisible(h.point))||null;
 }
 // A side with no surface leaves the axis open: its total is only a minimum.
 laserTotals(legs){
  const total=axis=>{const pair=legs.filter(l=>l.axis===axis),found=pair.filter(l=>l.cm!=null),cm=found.reduce((s,l)=>s+l.cm,0),open=found.length<2;return !found.length||open&&cm<1?null:{cm,open};};
  const [x,y,z]=['X','Y','Z'].map(total);
  return {X:x,Y:y,Z:z,slope:x&&y&&z?{cm:Math.hypot(x.cm,y.cm,z.cm),open:x.open||y.open||z.open}:null};
 }
 laserText(total){return total?(total.open?'≥ ':'')+this.cm(total.cm):'—';}
 draw(){
  this.drawCut();
  this.overlay.replaceChildren();const points=this.preview||this.state?.points||[];
  this.$('ifc-measure-info').hidden=!this.active||(!this.measuring&&!points.length);
  if(!this.active){this.paintLoupe();return;}
  const result=this.$('ifc-measure-result');
  const legs=this.level&&points.length===1?this.laser(points[0]):null;
  if(legs){const t=this.laserTotals(legs),v=n=>this.laserText(n);result.textContent=`X ${v(t.X)} · Y ${v(t.Y)} · Z ${v(t.Z)} · Inclinada ${v(t.slope)} cm`;}
  else result.textContent=this.measureLabel();
  if(this.measuring)this.$('ifc-hint').textContent=this.measureHint();
  result.title=this.level?'Nível: X, Y e Z vão de uma superfície à outra passando pelo ponto. Inclinada é a diagonal entre as três medidas. ≥ indica que um dos lados não encontrou superfície; — indica que nenhum lado encontrou. Arraste a ponta de uma linha até outra face para medir até ela; toque na ponta movida para voltar à primeira superfície.':points.length===2?'Arraste uma ponta para movê-la ou toque na linha para medir de novo. Fora da medida, o modelo gira normalmente.':points.length?'Toque ou arraste o segundo ponto na linha da face.':'Toque o primeiro ponto na linha da face.';
  const r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height){this.paintLoupe();return;}this.camera.updateMatrixWorld();
  this.overlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);this.overlay.append(el);};
  const screen=p=>({x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2});
  if(points.length){const projected=points.map(p=>new this.T.Vector3().fromArray(p).project(this.camera));
   if(projected.length===2&&projected.every(p=>p.z>=-1&&p.z<=1)){const a=screen(projected[0]),b=screen(projected[1]);add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#ffe18b','stroke-width':2,'stroke-dasharray':'6 4'});}
   (legs||[]).forEach((leg,i)=>{
    if(!this.legTip(leg))return;const pa=leg.from.clone().project(this.camera),pb=leg.to.clone().project(this.camera);if(pa.z<-1||pa.z>1||pb.z<-1||pb.z>1)return;
    const sa=screen(pa),sb=screen(pb),grabbed=this.down?.editing===10+i;add('line',{x1:sa.x,y1:sa.y,x2:sb.x,y2:sb.y,stroke:leg.color,'stroke-width':2.5});
    const pt=leg.target?.clone().project(this.camera);
    if(pt&&pt.z>=-1&&pt.z<=1&&leg.target.distanceTo(leg.to)>.01){const st=screen(pt);add('line',{x1:sb.x,y1:sb.y,x2:st.x,y2:st.y,stroke:leg.color,'stroke-width':1.5,'stroke-dasharray':'4 3'});add('circle',{cx:sb.x,cy:sb.y,r:3,fill:leg.color});add('circle',{cx:st.x,cy:st.y,r:grabbed?8:5.5,fill:leg.color,stroke:'#0d1d16','stroke-width':2});}
    else add('circle',{cx:sb.x,cy:sb.y,r:grabbed?8:5,fill:leg.color,stroke:'#0d1d16','stroke-width':leg.target?2:1.5});
    if(leg.cm<1)return;
    const label=leg.axis+' '+this.cm(leg.cm)+' cm',mx=(sa.x+sb.x)/2,my=(sa.y+sb.y)/2,w=label.length*6.6+12;
    add('rect',{x:mx-w/2,y:my-10,width:w,height:20,rx:10,fill:'#0d1d16e6',stroke:leg.color,'stroke-width':1.2});
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',mx);text.setAttribute('y',my+4);text.setAttribute('text-anchor','middle');text.setAttribute('fill',leg.color);text.setAttribute('font-size','11.5');text.setAttribute('font-weight','700');text.textContent=label;this.overlay.append(text);
   });
   if(legs&&projected[0].z>=-1&&projected[0].z<=1){
    const t=this.laserTotals(legs),rows=[['X',t.X,'#ff6b5e'],['Y',t.Y,'#5eb4ff'],['Z',t.Z,'#7ee06d'],['Inclinada',t.slope,'#ffe18b']].map(([n,v,c])=>[n+' '+(v?this.laserText(v)+' cm':'—'),c]);
    const w=Math.max(...rows.map(([s])=>s.length))*6.8+20,h=rows.length*17+10,x=(r.width-w)/2,y=r.height-h-(this.$('ifc-info')?.offsetHeight||36)-10;
    add('rect',{x,y,width:w,height:h,rx:9,fill:'#0b1a13eb',stroke:'#e0c46d88','stroke-width':1});
    rows.forEach(([s,c],i)=>{const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',x+10);text.setAttribute('y',y+19+i*17);text.setAttribute('fill',c);text.setAttribute('font-size','12');text.setAttribute('font-weight','700');text.textContent=s;this.overlay.append(text);});
   }
   projected.forEach((p,i)=>{if(p.z< -1||p.z>1||!this.isVisible(new this.T.Vector3().fromArray(points[i])))return;const at=screen(p);add('circle',{cx:at.x,cy:at.y,r:this.down?.editing===i?9:6,fill:'#ffe18b',stroke:'#173c2d','stroke-width':2});});
  }
  if(this.measuring&&this.aim?.faceLines){for(const [a,b] of this.aim.faceLines){const pa=a.clone().project(this.camera),pb=b.clone().project(this.camera);if(pa.z<-1||pa.z>1||pb.z<-1||pb.z>1)continue;const sa=screen(pa),sb=screen(pb);add('line',{x1:sa.x,y1:sa.y,x2:sb.x,y2:sb.y,stroke:'#ffe49a99','stroke-width':1.5,'data-aim':1});}}
  if(this.measuring&&this.aim?.edge){const seg=this.aim.edge.map(p=>p.clone().project(this.camera));if(seg.every(p=>p.z>=-1&&p.z<=1)){const a=screen(seg[0]),b=screen(seg[1]);add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#ffe49a','stroke-width':3,'data-aim':1});}}
  const fixed=this.aim?.kind==='perp'&&this.aim.perpDir?this.fixedEnd():null;
  if(this.measuring&&fixed){const q=this.aim.point,pq=q.clone().project(this.camera);if(pq.z>=-1&&pq.z<=1){
   const at=screen(pq),span=Math.max(.01,q.distanceTo(fixed)*.1),toward=v=>{const s=screen(q.clone().addScaledVector(v,span).project(this.camera)),dx=s.x-at.x,dy=s.y-at.y,l=Math.hypot(dx,dy)||1;return {x:dx/l,y:dy/l};};
   const u=toward(this.aim.perpDir),w=toward(fixed.clone().sub(q).normalize()),k=11;
   add('path',{d:`M${at.x+u.x*k} ${at.y+u.y*k}L${at.x+(u.x+w.x)*k} ${at.y+(u.y+w.y)*k}L${at.x+w.x*k} ${at.y+w.y*k}`,fill:'none',stroke:'#7ee0ff','stroke-width':2,'data-aim':1});
  }}
  if(this.measuring&&this.aim?.point){const p=this.aim.point.clone().project(this.camera);if(p.z>=-1&&p.z<=1){const at=screen(p);add('path',{d:`M${at.x-12} ${at.y}h24 M${at.x} ${at.y-12}v24`,stroke:'#ffe49a','stroke-width':2,'data-aim':1});}}
  this.paintLoupe();
 }
 instanceKey(mesh,index){
  const ids=mesh.userData?.ifcIds,id=ids?ids[index??0]:null;
  let model=mesh;while(model.parent&&model.parent!==this.group)model=model.parent;
  return model.uuid+':'+(id!=null?String(id):mesh.uuid+':'+index);
 }
 isHiddenHit(hit){return this.elementHidden(hit.object,hit.instanceId??0);}
 applyHidden(){
  if(!this.group)return;
  const T=this.T,scale=new T.Vector3(1e-6,1e-6,1e-6),next=new T.Matrix4(),pos=new T.Vector3(),quat=new T.Quaternion(),size=new T.Vector3();
  this.group.traverse(mesh=>{
   const ids=mesh.userData?.ifcIds;if(!ids||!mesh.isMesh||mesh.userData?.prumoSection)return;
   if(mesh.isBatchedMesh){for(let i=0;i<ids.length;i++)mesh.setVisibleAt(i,!this.elementHidden(mesh,i));}
   else if(mesh.isInstancedMesh){
    if(!mesh.userData.ifcBase){const saved=[];for(let i=0;i<mesh.count;i++){const m=new T.Matrix4();mesh.getMatrixAt(i,m);saved.push(m);}mesh.userData.ifcBase=saved;}
    mesh.userData.ifcBase.forEach((m,i)=>{if(this.elementHidden(mesh,i)){m.decompose(pos,quat,size);next.compose(pos,quat,scale);mesh.setMatrixAt(i,next);}else mesh.setMatrixAt(i,m);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
   }else mesh.visible=!this.elementHidden(mesh,0);
  });
 }
 elementHidden(mesh,index){return !!this.hidden?.has(this.instanceKey(mesh,index))||this.storeyHides(mesh,index);}
 storeyHides(mesh,index){
  if(!this.storeyKeys.size)return false;
  let model=mesh;while(model&&model.parent&&model.parent!==this.group)model=model.parent;
  const storeys=model?.userData?.storeys;
  if(!storeys?.length)return false;
  const id=mesh.userData?.ifcIds?.[index??0];
  return !this.storeyKeys.has(model.uuid+':'+model.userData.storeyOf?.[id]);
 }
 storeyRows(){
  const rows=[];
  for(const model of this.group?.children||[]){
   if(!model.userData?.ifcModel)continue;
   for(const storey of model.userData.storeys||[])rows.push({key:model.uuid+':'+storey.id,label:storey.label,file:model.userData.fileName||'',elevation:storey.elevation});
  }
  return rows;
 }
 toggleStoreys(){
  const panel=this.$('ifc-storey-panel'),button=this.$('ifc-storeys');if(!panel||!button)return;
  const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
  if(!open)return;
  this.renderStoreys();this.placeStoreyPanel();
 }
 renderStoreys(){
  const list=this.$('ifc-storey-list');if(!list)return;list.replaceChildren();
  const rows=this.storeyRows();
  if(!rows.length){const note=document.createElement('li');note.textContent='Este IFC não informa pavimentos.';list.append(note);return;}
  const files=new Set(rows.map(row=>row.file));
  const add=(label,key,meta)=>{
   const item=document.createElement('li'),button=document.createElement('button'),light=document.createElement('i'),text=document.createElement('span');
   button.type='button';light.setAttribute('aria-hidden','true');text.textContent=label;
   if(meta){const small=document.createElement('small');small.textContent=meta;text.append(small);}
   button.setAttribute('aria-pressed',String(key?this.storeyKeys.has(key):!this.storeyKeys.size));
   button.onclick=()=>this.selectStorey(key);
   button.append(light,text);item.append(button);list.append(item);
  };
  add('Todos',null,'');
  for(const row of rows)add(row.label,row.key,files.size>1?row.file:'');
 }
 selectStorey(key){
  if(!key)this.storeyKeys.clear();
  else if(this.storeyKeys.has(key))this.storeyKeys.delete(key);
  else this.storeyKeys.add(key);
  this.$('ifc-storeys')?.setAttribute('aria-pressed',String(this.storeyKeys.size>0));
  this.applyHidden();
  if(this.selectionHit&&this.isHiddenHit(this.selectionHit)){this.selectionHit=null;this.showSelection(null);}
  if(this.state?.cut)this.applyCut();else this.onChange?.();
  this.renderStoreys();
 }
 toggleViews(open){
  const panel=this.$('ifc-view-panel'),button=this.$('ifc-views');if(!panel||!button)return;
  const show=open??panel.hidden;if(show===!panel.hidden)return;
  panel.hidden=!show;button.setAttribute('aria-expanded',String(show));
  if(show)this.placeStoreyPanel(panel,button);
 }
 viewBounds(){
  const model=visibleSceneBounds(this.T,this.group);
  if(!(this.active&&this.state?.cut&&this.state.box))return model;
  // With a cut, frame only what is left inside the cut box.
  const {axes,center}=this.boxFrame(),box=new this.T.Box3(),p=new this.T.Vector3();
  for(let i=0;i<8;i++){p.copy(center);for(let a=0;a<3;a++)p.addScaledVector(axes[a],(i>>a)&1?this.faceReach(2*a+1):-this.faceReach(2*a));box.expandByPoint(p);}
  const kept=box.intersect(model.clone());return kept.isEmpty()?model:kept;
 }
 setView(name){
  const dirs={iso:[1,.8,1],top:[0,1,1e-4],front:[0,0,1],right:[1,0,0],back:[0,0,-1],left:[-1,0,0]};
  if(!this.group||!dirs[name])return;
  const T=this.T,box=this.viewBounds();if(box.isEmpty())return;
  const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),dir=new T.Vector3(...dirs[name]).normalize();
  const half=Math.tan(this.camera.fov*Math.PI/360),aspect=this.camera.aspect||1;let frame,depth;
  if(name==='iso'){const span=new T.Vector3(1,0,-1).normalize(),up=new T.Vector3().crossVectors(dir,span).normalize();let w=0,h=0;for(let i=0;i<8;i++){const p=new T.Vector3(i&1?size.x:-size.x,i&2?size.y:-size.y,i&4?size.z:-size.z).multiplyScalar(.5);w=Math.max(w,Math.abs(p.dot(span)));h=Math.max(h,Math.abs(p.dot(up)));}frame=Math.max(h/half,w/(half*aspect))*1.1;depth=size.length();}
  else{const [w,h,d]=name==='top'?[size.x,size.z,size.y]:name==='front'||name==='back'?[size.x,size.y,size.z]:[size.z,size.y,size.x];frame=Math.max(h/2/half,w/2/(half*aspect))*1.12;depth=d;}
  // The camera stays outside the model so turning back to perspective does not start inside it.
  const distance=Math.max(frame+depth/2,1e-3);
  const place=()=>{this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(dir,distance);this.controls.update();};
  // Damping would keep spinning with the leftover orbit; consume it before placing the camera.
  const damping=this.controls.enableDamping;this.camera.up.set(0,1,0);this.setParallel(null);this.controls.enableDamping=false;place();place();this.controls.enableDamping=damping;
  this.setParallel(dir,Math.max(frame,1e-3)/distance);
  this.navigation.updateClipping?.();this.onChange?.();
 }
 bindParallel(){
  const T=this.T,camera=this.camera,controls=this.controls,perspective=T.PerspectiveCamera.prototype.updateProjectionMatrix;
  camera.updateProjectionMatrix=function(){
   const view=this.userData.parallel;if(!view)return perspective.call(this);
   const h=Math.max(1e-6,this.position.distanceTo(controls.target))*Math.tan(this.fov*Math.PI/360)*view.scale/this.zoom,w=h*this.aspect,depth=Math.max(this.far,1);
   this.projectionMatrix.makeOrthographic(-w,w,h,-h,-depth,depth);this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  };
  const fromCamera=T.Raycaster.prototype.setFromCamera;
  T.Raycaster.prototype.setFromCamera=function(coords,cam){
   if(!cam.userData?.parallel)return fromCamera.call(this,coords,cam);
   cam.updateMatrixWorld();this.ray.origin.set(coords.x,coords.y,-1).unproject(cam);this.ray.direction.set(0,0,-1).transformDirection(cam.matrixWorld);this.camera=cam;
  };
  // OrbitControls treats this camera as perspective: pan and zoom to cursor are corrected for the parallel scale.
  const pan=controls._pan?.bind(controls),zoomAt=controls._updateZoomParameters?.bind(controls);
  if(pan)controls._pan=(x,y)=>{const s=camera.userData.parallel?.scale||1;pan(x*s,y*s);};
  if(zoomAt)controls._updateZoomParameters=(x,y)=>{
   zoomAt(x,y);if(!camera.userData.parallel||!controls._performCursorZoom)return;
   camera.updateMatrixWorld();const depth=controls.target.clone().project(camera).z;
   controls._dollyDirection.set(controls._mouse.x,controls._mouse.y,depth).unproject(camera).sub(camera.position).normalize();
  };
  controls.addEventListener('change',()=>{
   const view=camera.userData.parallel;if(!view)return;
   const dir=camera.position.clone().sub(controls.target).normalize();
   if(dir.dot(view.dir)<Math.cos(Math.PI/360))this.setParallel(null);else camera.updateProjectionMatrix();
  });
 }
 setParallel(dir,scale=1){
  this.camera.userData.parallel=dir?{dir:dir.clone(),scale}:null;this.camera.updateProjectionMatrix();
 }
 placeStoreyPanel(panel=this.$('ifc-storey-panel'),button=this.$('ifc-storeys')){
  if(!panel||!button)return;
  const host=panel.offsetParent||panel.parentElement,hb=host.getBoundingClientRect(),bb=button.getBoundingClientRect();
  const width=Math.min(240,Math.max(180,hb.width-16));panel.style.width=width+'px';
  let left=bb.left-hb.left;if(left+width>hb.width-8)left=Math.max(8,hb.width-width-8);
  panel.style.left=left+'px';panel.style.top=Math.max(8,bb.bottom-hb.top+8)+'px';
 }
 hideSelected(){
  const hit=this.selectionHit;if(!hit)return;
  const data=hit.object.userData,index=hit.instanceId,named=index!=null&&data.ifcNames;
  const name=named?data.ifcNames[index]:data.ifcName,type=named?data.ifcTypes?.[index]:data.ifcType;
  this.hidden.set(this.instanceKey(hit.object,index??0),{name:name||type||'Elemento',type:name&&type&&type!==name?type:''});
  this.applyHidden();this.selectionHit=null;this.showSelection(null);this.faceKey='';
  if(this.state?.cut)this.applyCut();else this.onChange?.();
  this.syncHidden();
 }
 showOne(key){
  if(!this.hidden.delete(key))return;
  this.applyHidden();this.faceKey='';
  if(this.state?.cut)this.applyCut();else this.onChange?.();
  this.syncHidden();
 }
 toggleHiddenList(){
  const panel=this.$('ifc-hidden-panel'),button=this.$('ifc-show-hidden');
  if(!panel||!this.hidden.size){if(panel)panel.hidden=true;button?.setAttribute('aria-expanded','false');return;}
  panel.hidden=!panel.hidden;button?.setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden){this.renderHiddenList();this.placeHiddenList();}
 }
 renderHiddenList(){
  const list=this.$('ifc-hidden-list');if(!list)return;list.replaceChildren();
  for(const [key,info] of this.hidden){
   const item=document.createElement('li'),button=document.createElement('button'),light=document.createElement('i'),label=document.createElement('span');
   button.type='button';light.setAttribute('aria-hidden','true');label.textContent=info.name||'Elemento';
   if(info.type){const meta=document.createElement('small');meta.textContent=info.type;label.append(meta);}
   button.title='Mostrar este elemento';button.append(light,label);button.onclick=()=>this.showOne(key);
   item.append(button);list.append(item);
  }
 }
 placeHiddenList(){
  const panel=this.$('ifc-hidden-panel'),button=this.$('ifc-show-hidden');if(!panel||!button)return;
  const host=panel.offsetParent||panel.parentElement,hb=host.getBoundingClientRect(),bb=button.getBoundingClientRect();
  const width=Math.min(240,Math.max(160,hb.width-16));panel.style.width=width+'px';
  let left=bb.right-hb.left+8;if(left+width>hb.width-8)left=Math.max(8,bb.left-hb.left-width-8);
  panel.style.left=left+'px';panel.style.top=Math.max(8,bb.top-hb.top)+'px';
 }
 syncHidden(){
  const button=this.$('ifc-show-hidden'),panel=this.$('ifc-hidden-panel');
  if(button)button.hidden=!this.hidden.size;
  if(!panel)return;
  if(!this.hidden.size){panel.hidden=true;button?.setAttribute('aria-expanded','false');return;}
  if(!panel.hidden)this.renderHiddenList();
 }
 showElement(x,y){
  if(!this.group)return;const r=this.renderer.domElement.getBoundingClientRect();this.camera.updateMatrixWorld();this.group.updateMatrixWorld(true);
  this.ray.setFromCamera({x:(x-r.left)/r.width*2-1,y:1-(y-r.top)/r.height*2},this.camera);
  const hit=this.ray.intersectObject(this.group,true).find(h=>!h.object.userData?.prumoSection&&!this.isHiddenHit(h)&&this.isVisible(h.point));
  if(!hit){this.selectionHit=null;this.showSelection(null);return;}
  this.selectionHit=hit;
  const data=hit.object.userData,index=hit.instanceId,named=index!=null&&data.ifcNames;
  const name=named?data.ifcNames[index]:data.ifcName,type=named?data.ifcTypes?.[index]:data.ifcType,volume=named?data.ifcVolumes?.[index]:data.ifcVolume;
  let file='';for(let node=hit.object;node;node=node.parent)if(node.userData?.fileName){file=node.userData.fileName;break;}
  this.showSelection({name:name||type||'Elemento',type:name&&type&&type!==name?type:'',file,volume,x,y});
 }
 showSelection(info){
  const box=this.$('ifc-selection'),tag=this.$('ifc-name-tag');
  if(!info){if(box)box.hidden=true;if(tag)tag.hidden=true;this.onInfo?.(null);return;}
  const meta=String(info.type||'').split('·')[0].trim();
  if(box){this.$('ifc-selection-name').textContent=info.name;this.$('ifc-selection-meta').textContent=meta;box.hidden=false;}
  this.onInfo?.(info);
  if(!tag)return;
  this.$('ifc-name-tag-name').textContent=info.name;this.$('ifc-name-tag-meta').textContent=meta;
  if(!Number.isFinite(info.x)||!Number.isFinite(info.y)){tag.hidden=true;return;}
  tag.hidden=false;const view=tag.offsetParent?.getBoundingClientRect();if(!view)return;
  const w=tag.offsetWidth,h=tag.offsetHeight;
  let left=info.x-view.left+16,top=info.y-view.top-h-12;
  if(left+w>view.width-8)left=info.x-view.left-w-16;
  if(top<8)top=info.y-view.top+16;
  tag.style.left=Math.max(8,Math.min(Math.max(8,view.width-w-8),left))+'px';
  tag.style.top=Math.max(8,Math.min(Math.max(8,view.height-h-36),top))+'px';
 }
}

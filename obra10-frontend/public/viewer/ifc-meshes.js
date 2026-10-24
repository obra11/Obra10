// Share exact geometry/materials and draw every element of one material through a single BatchedMesh.
let Batch=null;
function batchClass(T){
 // Tools address pieces through hit.instanceId, the same field InstancedMesh reports.
 return Batch||(Batch=class IfcBatch extends T.BatchedMesh{raycast(raycaster,hits){const start=hits.length;super.raycast(raycaster,hits);for(let i=start;i<hits.length;i++)hits[i].instanceId=hits[i].batchId;}});
}
export class IfcMeshBuilder{
 constructor(T){this.T=T;this.geometries=new Map();this.materials=new Map();this.sets=new Map();this.volumes=new Map();this.instances=0;this.elementIds=new Set();this.origin=null;}
 add(api,id,placed,expressID){
  const T=this.T,key=placed.geometryExpressID;let geometry=this.geometries.get(key);
  if(!geometry){const geom=api.GetGeometry(id,key);try{
   const vertices=api.GetVertexArray(geom.GetVertexData(),geom.GetVertexDataSize()),raw=api.GetIndexArray(geom.GetIndexData(),geom.GetIndexDataSize());
   const count=vertices.length/6,position=new Float32Array(count*3),normal=new Float32Array(count*3);
   for(let i=0,j=0;i<count;i++,j+=6){const k=i*3;position[k]=vertices[j];position[k+1]=vertices[j+1];position[k+2]=vertices[j+2];normal[k]=vertices[j+3];normal[k+1]=vertices[j+4];normal[k+2]=vertices[j+5];}
   const indices=count<=65535?new Uint16Array(raw):raw.slice();
   geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.computeBoundingBox();this.geometries.set(key,geometry);
  }finally{geom.delete();}}
  const c=placed.color,colorKey=[c.x,c.y,c.z,c.w].join('/');let material=this.materials.get(colorKey);
  if(!material){material=new T.MeshLambertMaterial({color:new T.Color(c.x,c.y,c.z),opacity:c.w,transparent:c.w<1,side:T.DoubleSide});this.materials.set(colorKey,material);}
  let set=this.sets.get(colorKey);
  if(!set){set={material,geometries:new Map(),keys:[],matrices:[],ids:[]};this.sets.set(colorKey,set);}
  set.geometries.set(key,geometry);
  // Project coordinates (UTM) exceed float32 precision on the GPU, so pieces are stored
  // relative to the first placement and the model group carries the offset in doubles.
  const matrix=new T.Matrix4().fromArray(placed.flatTransformation),e=matrix.elements;
  if(!this.origin)this.origin=new T.Vector3(Math.round(e[12]),Math.round(e[13]),Math.round(e[14]));
  if(expressID!=null){this.elementIds.add(expressID);this.volumes.set(expressID,(this.volumes.get(expressID)||0)+this.solidVolume(geometry,matrix));}
  e[12]-=this.origin.x;e[13]-=this.origin.y;e[14]-=this.origin.z;
  set.keys.push(key);set.matrices.push(matrix);set.ids.push(expressID??null);
  this.instances++;
 }
 build(labels=new Map()){
  const T=this.T,group=new T.Group(),Mesh=batchClass(T);let drawObjects=0;
  for(const set of this.sets.values()){
   let vertices=0,indices=0;for(const g of set.geometries.values()){vertices+=g.attributes.position.count;indices+=g.index.count;}
   const mesh=new Mesh(set.matrices.length,vertices,indices,set.material),slots=new Map();
   for(const [key,g] of set.geometries)slots.set(key,mesh.addGeometry(g));
   set.matrices.forEach((m,i)=>mesh.setMatrixAt(mesh.addInstance(slots.get(set.keys[i])),m));
   const ids=set.ids;
   mesh.userData.ifcIds=ids;mesh.userData.ifcNames=ids.map(id=>labels.get(id)?.name||'');mesh.userData.ifcTypes=ids.map(id=>labels.get(id)?.type||'');mesh.userData.ifcVolumes=ids.map(id=>labels.get(id)?.volume??null);
   mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;group.add(mesh);drawObjects++;
  }
  if(this.origin)group.position.copy(this.origin);
  group.userData.renderStats={instances:this.instances,geometries:this.geometries.size,materials:this.materials.size,drawObjects};
  for(const g of this.geometries.values())g.dispose();this.geometries.clear();this.sets.clear();
  return group;
 }
 solidVolume(geometry,matrix){
  if(geometry.userData.localVolume==null)geometry.userData.localVolume=this.localVolume(geometry);
  return geometry.userData.localVolume*Math.abs(matrix.determinant());
 }
 localVolume(geometry){
  const pos=geometry?.attributes?.position,index=geometry?.index;if(!pos)return 0;
  const T=this.T,a=this._va||(this._va=new T.Vector3()),b=this._vb||(this._vb=new T.Vector3()),c=this._vc||(this._vc=new T.Vector3()),cross=this._vx||(this._vx=new T.Vector3());
  const count=index?index.count:pos.count,at=i=>index?index.getX(i):i;let sum=0;
  for(let i=0;i+2<count;i+=3){a.fromBufferAttribute(pos,at(i));b.fromBufferAttribute(pos,at(i+1));c.fromBufferAttribute(pos,at(i+2));sum+=a.dot(cross.crossVectors(b,c));}
  return Math.abs(sum)/6;
 }
 dispose(){for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();this.sets.clear();}
}
export function disposeIfcGroup(group){const geometries=new Set(),materials=new Set();group?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);o.dispose?.();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}

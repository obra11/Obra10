// Share exact geometry/materials and instance repeated components in bounded groups.
export class IfcMeshBuilder{
 constructor(T){this.T=T;this.geometries=new Map();this.materials=new Map();this.batches=new Map();this.instances=0;}
 add(api,id,placed){
  const T=this.T,key=placed.geometryExpressID;let geometry=this.geometries.get(key);
  if(!geometry){const geom=api.GetGeometry(id,key);try{
   const vertices=api.GetVertexArray(geom.GetVertexData(),geom.GetVertexDataSize()).slice(),raw=api.GetIndexArray(geom.GetIndexData(),geom.GetIndexDataSize());
   const indices=vertices.length/6<=65535?new Uint16Array(raw):raw.slice();
   const buffer=new T.InterleavedBuffer(vertices,6);geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.InterleavedBufferAttribute(buffer,3,0));geometry.setAttribute('normal',new T.InterleavedBufferAttribute(buffer,3,3));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometries.set(key,geometry);
  }finally{geom.delete();}}
  const c=placed.color,colorKey=[c.x,c.y,c.z,c.w].join('/');let material=this.materials.get(colorKey);
  if(!material){material=new T.MeshStandardMaterial({color:new T.Color(c.x,c.y,c.z),opacity:c.w,transparent:c.w<1,side:T.DoubleSide,roughness:.75});this.materials.set(colorKey,material);}
  // Transparent objects remain separate so Three can sort them by depth.
  const batchKey=key+':'+colorKey+(c.w<1?':'+this.instances:'');let batch=this.batches.get(batchKey);
  if(!batch){batch={geometry,material,matrices:[]};this.batches.set(batchKey,batch);}
  batch.matrices.push(new T.Matrix4().fromArray(placed.flatTransformation));this.instances++;
 }
 build(){
  const T=this.T,group=new T.Group();
  for(const batch of this.batches.values())for(let offset=0;offset<batch.matrices.length;offset+=512){
   const matrices=batch.matrices.slice(offset,offset+512);let mesh;
   if(matrices.length===1){mesh=new T.Mesh(batch.geometry,batch.material);mesh.applyMatrix4(matrices[0]);}
   else{mesh=new T.InstancedMesh(batch.geometry,batch.material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
   mesh.matrixAutoUpdate=false;group.add(mesh);
  }
  group.userData.renderStats={instances:this.instances,geometries:this.geometries.size,materials:this.materials.size,drawObjects:group.children.length};this.batches.clear();return group;
 }
 dispose(){for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();this.batches.clear();}
}
export function disposeIfcGroup(group){const geometries=new Set(),materials=new Set();group?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);o.dispose?.();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}

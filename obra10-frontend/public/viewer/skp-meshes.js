// Build SketchUp meshes into the same BatchedMesh / userData shape the IFC tools expect.
let Batch=null;
function batchClass(T){
 return Batch||(Batch=class SkpBatch extends T.BatchedMesh{raycast(raycaster,hits){const start=hits.length;super.raycast(raycaster,hits);for(let i=start;i<hits.length;i++)hits[i].instanceId=hits[i].batchId;}});
}
function materialColor(entry){
 const factor=entry?.pbrMetallicRoughness?.baseColorFactor;
 if(Array.isArray(factor)&&factor.length>=3){
  const r=+factor[0]||0,g=+factor[1]||0,b=+factor[2]||0,a=factor.length>3?+factor[3]:1;
  return [r,g,b,Number.isFinite(a)?a:1];
 }
 return [.75,.75,.75,1];
}
function localVolume(T,geometry){
 const pos=geometry?.attributes?.position,index=geometry?.index;if(!pos)return 0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3();
 const count=index?index.count:pos.count,at=i=>index?index.getX(i):i;let sum=0;
 for(let i=0;i+2<count;i+=3){a.fromBufferAttribute(pos,at(i));b.fromBufferAttribute(pos,at(i+1));c.fromBufferAttribute(pos,at(i+2));sum+=a.dot(cross.crossVectors(b,c));}
 return Math.abs(sum)/6;
}
export function buildSkpGroup(T,scene){
 const Mesh=batchClass(T),group=new T.Group();
 const materials=scene?.gltfMaterials||[],meshIndex=scene?.meshIndex||{},primitives=scene?.glbPrimitives||[];
 if(!primitives.length)throw new Error('O SKP não contém geometria 3D compatível.');
 const idOf=new Map(),labels=new Map(),storeyOf={},layerOrder=[],volumes=new Map();
 let nextId=1,origin=null,instances=0;
 const sets=new Map();
 for(const prim of primitives){
  const geomName=prim.geomName||('mesh_'+instances);
  let id=idOf.get(geomName);
  const meta=meshIndex[geomName]||{};
  if(id==null){
   id=nextId++;idOf.set(geomName,id);
   const name=(meta.name&&String(meta.name).trim())||(meta.definitionName&&String(meta.definitionName).trim())||'Componente';
   const type=(meta.definitionName&&meta.definitionName!==meta.name)?String(meta.definitionName):((meta.layer&&String(meta.layer))||'SketchUp');
   labels.set(id,{name,type,volume:0,meta});
   const layer=(meta.layer&&String(meta.layer).trim())||'Layer0';
   if(!layerOrder.includes(layer))layerOrder.push(layer);
   storeyOf[id]=layer;
  }
  const geometry=new T.BufferGeometry();
  const positions=prim.positions instanceof Float32Array?prim.positions:new Float32Array(prim.positions||[]);
  const normals=prim.normals instanceof Float32Array?prim.normals:new Float32Array(prim.normals||[]);
  if(positions.length<9)continue;
  if(!origin){
   origin=new T.Vector3(Math.round(positions[0]),Math.round(positions[1]),Math.round(positions[2]));
  }
  const shifted=new Float32Array(positions.length);
  for(let i=0;i<positions.length;i+=3){
   shifted[i]=positions[i]-origin.x;shifted[i+1]=positions[i+1]-origin.y;shifted[i+2]=positions[i+2]-origin.z;
  }
  geometry.setAttribute('position',new T.BufferAttribute(shifted,3));
  if(normals.length===positions.length)geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
  else geometry.computeVertexNormals();
  const raw=prim.indices instanceof Uint32Array?prim.indices:new Uint32Array(prim.indices||[]);
  const vertCount=shifted.length/3;
  const indices=vertCount<=65535&&raw.length?Uint16Array.from(raw):raw;
  if(indices.length)geometry.setIndex(new T.BufferAttribute(indices,1));
  geometry.computeBoundingBox();
  const vol=localVolume(T,geometry);
  volumes.set(id,(volumes.get(id)||0)+vol);
  const label=labels.get(id);if(label)label.volume=volumes.get(id);
  const color=materialColor(materials[prim.materialIndex]);
  const colorKey=color.map(v=>+v.toFixed(4)).join('/');
  let set=sets.get(colorKey);
  if(!set){
   const [r,g,b,a]=color;
   const material=new T.MeshLambertMaterial({color:new T.Color(r,g,b),opacity:a,transparent:a<1,side:T.DoubleSide});
   set={material,items:[]};sets.set(colorKey,set);
  }
  set.items.push({geometry,id});
  instances++;
 }
 let drawObjects=0;
 for(const set of sets.values()){
  let vertices=0,indices=0;
  for(const item of set.items){vertices+=item.geometry.attributes.position.count;indices+=item.geometry.index?item.geometry.index.count:item.geometry.attributes.position.count;}
  const mesh=new Mesh(set.items.length,Math.max(vertices,3),Math.max(indices,3),set.material);
  const ids=[];
  const identity=new T.Matrix4();
  for(const item of set.items){
   const slot=mesh.addGeometry(item.geometry);
   mesh.setMatrixAt(mesh.addInstance(slot),identity);
   ids.push(item.id);
   item.geometry.dispose();
  }
  mesh.userData.ifcIds=ids;
  mesh.userData.ifcNames=ids.map(id=>labels.get(id)?.name||'');
  mesh.userData.ifcTypes=ids.map(id=>labels.get(id)?.type||'');
  mesh.userData.ifcVolumes=ids.map(id=>labels.get(id)?.volume??null);
  mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;group.add(mesh);drawObjects++;
 }
 if(origin)group.position.copy(origin);
 group.userData.renderStats={instances,geometries:primitives.length,materials:sets.size,drawObjects};
 group.userData.skpElements=labels;
 group.userData.storeys=layerOrder.map(name=>({id:name,label:name,elevation:null}));
 group.userData.storeyOf=storeyOf;
 return group;
}
export function disposeSkpGroup(group){
 const geometries=new Set(),materials=new Set();
 group?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);o.dispose?.();});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}

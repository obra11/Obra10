// Read-only CFB streams used to locate embedded raster presentations in OLE.
function compound(bytes){
 const offset=bytes.findIndex((v,i)=>v===0xd0&&bytes[i+1]===0xcf&&bytes[i+2]===0x11&&bytes[i+3]===0xe0);if(offset<0)return[];
 const data=bytes.subarray(offset),v=new DataView(data.buffer,data.byteOffset,data.byteLength);const size=1<<v.getUint16(30,true),miniSize=1<<v.getUint16(32,true);if(![512,4096].includes(size)||miniSize!==64)throw Error('CFB inválido');
 const sector=n=>{const start=(n+1)*size;if(n>=0xfffffffa||start+size>data.length)throw Error('Setor CFB inválido');return data.subarray(start,start+size);};
 const words=b=>{const d=new DataView(b.buffer,b.byteOffset,b.byteLength);return Array.from({length:b.length/4},(_,i)=>d.getUint32(i*4,true));};
 const fatIds=[];for(let i=0;i<109;i++){const id=v.getUint32(76+i*4,true);if(id<0xfffffffa)fatIds.push(id);}let dif=v.getUint32(68,true);const visited=new Set();while(dif<0xfffffffa){if(visited.has(dif))throw Error('Ciclo CFB');visited.add(dif);const ids=words(sector(dif));fatIds.push(...ids.slice(0,-1).filter(n=>n<0xfffffffa));dif=ids.at(-1);}
 const fat=fatIds.flatMap(n=>words(sector(n)));
 const chain=(start,table,read,limit=data.length)=>{const chunks=[],seen=new Set();let count=0;for(let id=start;id<0xfffffffa;id=table[id]){if(!Number.isInteger(id)||seen.has(id)||count>data.length*2)throw Error('Cadeia CFB inválida');seen.add(id);const b=read(id);chunks.push(b);count+=b.length;if(count>=limit)break;}const out=new Uint8Array(Math.min(count,limit));let at=0;for(const b of chunks){out.set(b.subarray(0,out.length-at),at);at+=Math.min(b.length,out.length-at);}return out;};
 const dir=chain(v.getUint32(48,true),fat,sector),entries=[];for(let i=0;i+128<=dir.length;i+=128){const d=new DataView(dir.buffer,dir.byteOffset+i,128),length=d.getUint16(64,true);if(length<2||length>64)continue;entries.push({name:new TextDecoder('utf-16le').decode(dir.subarray(i,i+length-2)),type:d.getUint8(66),start:d.getUint32(116,true),size:d.getUint32(120,true)});}
 const root=entries.find(e=>e.type===5);if(!root)return[];const mini=chain(root.start,fat,sector,root.size),miniFat=words(chain(v.getUint32(60,true),fat,sector,v.getUint32(64,true)*size));
 return entries.filter(e=>e.type===2&&e.size>0&&e.size<=100*1024*1024).map(e=>({name:e.name,bytes:e.size<4096?chain(e.start,miniFat,n=>{if((n+1)*miniSize>mini.length)throw Error('Mini setor inválido');return mini.subarray(n*miniSize,(n+1)*miniSize);},e.size):chain(e.start,fat,sector,e.size)}));
}
function dibToBmp(data){
 if(data.length<40)return;const d=new DataView(data.buffer,data.byteOffset,data.byteLength),header=d.getUint32(0,true);if(![40,108,124].includes(header))return;
 const width=d.getInt32(4,true),height=d.getInt32(8,true),bpp=d.getUint16(14,true),compression=d.getUint32(16,true);if(width<=0||width>32768||!height||Math.abs(height)>32768||d.getUint16(12,true)!==1||![1,4,8,16,24,32].includes(bpp)||![0,3].includes(compression))return;
 const colors=d.getUint32(32,true)||(bpp<=8?1<<bpp:0),pixelOffset=14+header+colors*4+(header===40&&compression===3?12:0),required=Math.ceil(width*bpp/32)*4*Math.abs(height);if(pixelOffset+required>data.length+14)return;
 const bmp=new Uint8Array(data.length+14),bv=new DataView(bmp.buffer);bmp.set([66,77]);bv.setUint32(2,bmp.length,true);bv.setUint32(10,pixelOffset,true);bmp.set(data,14);return new Blob([bmp],{type:'image/bmp'});
}
function wmfBitmap(bytes){
 if(bytes.length<40)return;const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(d.getUint32(0,true)!==0x9ac6cdd7)return;
 let origin=[0,0],extent=null,bitmap=null;
 for(let pos=40;pos+6<=bytes.length;){const size=d.getUint32(pos,true)*2,fn=d.getUint16(pos+4,true),p=pos+6;if(size<6||pos+size>bytes.length)return;
  if(fn===0)return bitmap;
  if(fn===0x20b)origin=[d.getInt16(p,true),d.getInt16(p+2,true)];
  else if(fn===0x20c)extent=[d.getInt16(p,true),d.getInt16(p+2,true)];
  else if(fn===0xb41){
   if(bitmap||size<66||d.getUint32(p,true)!==0x00cc0020||!extent)return;
   const h=d.getInt16(p+4,true),w=d.getInt16(p+6,true),sy=d.getInt16(p+8,true),sx=d.getInt16(p+10,true),dh=d.getInt16(p+12,true),dw=d.getInt16(p+14,true),dy=d.getInt16(p+16,true),dx=d.getInt16(p+18,true),dib=bytes.subarray(p+20,pos+size),v=new DataView(dib.buffer,dib.byteOffset,dib.byteLength);
   if(sx||sy||w!==v.getInt32(4,true)||h!==Math.abs(v.getInt32(8,true))||dh!==extent[0]||dw!==extent[1]||dy!==origin[0]||dx!==origin[1])return;
   bitmap=dibToBmp(dib);
  }else if(![0,0x103,0x107].includes(fn))return;
  pos+=size;
 }
 return bitmap;
}
function raster(stream){const b=stream.bytes;
 if(b[0]===66&&b[1]===77)return new Blob([b],{type:'image/bmp'});
 if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return new Blob([b],{type:'image/png'});
 if(b[0]===255&&b[1]===216&&b[2]===255)return new Blob([b],{type:'image/jpeg'});
 if(/OlePres/.test(stream.name)&&b.length>40){const d=new DataView(b.buffer,b.byteOffset,b.byteLength);if(d.getUint32(0,true)===0xffffffff&&d.getUint32(4,true)===8){const target=d.getUint32(8,true),start=8+target+28;return dibToBmp(b.subarray(start));}}
 if(/CONTENTS|DIB/i.test(stream.name))return dibToBmp(b)||wmfBitmap(b);
}
async function decode(blob){const url=URL.createObjectURL(blob);const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Imagem não suportada'));img.src=url;});return {img,url};}catch(e){URL.revokeObjectURL(url);throw e;}}
export async function attachCadImages(database,prepared){
 const doc=prepared.document,raw=new Map();for(const b of database.tables.BLOCK_RECORD.entries)for(const e of b.entities)raw.set(e.handle,e);for(const e of database.entities)raw.set(e.handle,e);
 const defs=new Map((database.objects?.IMAGEDEF||[]).map(d=>[d.handle,d]));const urls=[],missing=[],unsupported=[];const visited=new Set();
 for(const entities of [doc.entities,...Object.values(doc.blocks||{}).map(b=>b.entities)])for(const e of entities){if(visited.has(e))continue;visited.add(e);const s=raw.get(e.handle);if(!s)continue;
  if(s.type==='IMAGE'){
   const def=defs.get(s.imageDefHandle);if(!(s.flags&1)){e.isVisible=false;continue;}
   const p=s.position,u=s.uPixel,v=s.vPixel,w=s.imageSize.x,h=s.imageSize.y;if(!p||!u||!v||!(w>0&&h>0))continue;
   e.kind='polyline';e.isCadRaster=true;e.imageBasis=[{x:p.x+v.x*h,y:p.y+v.y*h},{x:p.x+v.x*h+u.x*w,y:p.y+v.y*h+u.y*w},{x:p.x,y:p.y}];e.points=[...e.imageBasis,{x:p.x+u.x*w,y:p.y+u.y*w}];e.rasterSource=s;e.rasterName=def?.fileName||s.imageDefHandle;e.rasterMissing=true;missing.push(e);
  }else if(s.type==='OLE2FRAME'&&s.binaryData){
   try{const bytes=Uint8Array.from(s.binaryData.match(/../g)||[],h=>parseInt(h,16));let blob;for(const stream of compound(bytes)){blob=raster(stream);if(blob)break;}if(!blob){unsupported.push(s.handle);continue;}const {img,url}=await decode(blob);urls.push(url);const a=s.leftUpPoint,b=s.rightDownPoint;e.kind='polyline';e.isCadRaster=true;e.points=[{x:a.x,y:a.y},{x:b.x,y:a.y},{x:a.x,y:b.y},{x:b.x,y:b.y}];const header=new DataView(bytes.buffer);if(bytes.length>=98){const corner=i=>({x:header.getFloat64(2+i*24,true),y:header.getFloat64(10+i*24,true)}),corners=[corner(0),corner(1),corner(3),corner(2)];if(corners.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))e.points=corners;}e.rasterImage=img;e.rasterMissing=false;}catch{unsupported.push(s.handle);}
  }
 }
 const basename=name=>name.split(/[\\/]/).pop().toLocaleLowerCase();
 return {missing,unsupported,dispose(){for(const url of urls)URL.revokeObjectURL(url);},async link(files){let count=0;for(const file of files){const matches=missing.filter(e=>basename(e.rasterName)===basename(file.name));if(!matches.length)continue;const {img,url}=await decode(file);urls.push(url);for(const e of matches){e.rasterImage=img;e.rasterMissing=false;}count+=matches.length;}return count;}};
}
export {compound,dibToBmp};


export const centimetresPerUnit={1:2.54,2:30.48,4:.1,5:1,6:100,7:100000,10:91.44,14:10};
const transform=(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function collectSegments(doc){
 const segments=[];
 function visit(entities,m,parent='0',depth=0){
  if(depth>16)return;
  for(const e of entities){if(!e)continue;
   const layerName=!e.layer||e.layer==='0'?parent:e.layer,layer=doc.layers[layerName]||doc.layers[layerName?.toLowerCase()];
   if(e.isVisible===false||layer?.isVisible===false||layer?.isFrozen)continue;
   if(e.kind==='insert'){
    const name=e.blockName||e.name,b=doc.blocks[name]||doc.blocks[name?.toLowerCase()];if(!b)continue;
    const p=e.insertionPoint||{x:0,y:0},base=b.basePoint||{x:0,y:0},angle=e.rotation||0,c=Math.cos(angle),s=Math.sin(angle);
    const sx=typeof e.scale==='number'?e.scale:(e.scale?.x??e.scaleX??1),sy=typeof e.scale==='number'?e.scale:(e.scale?.y??e.scaleY??sx);
    const n=[c*sx,s*sx,-s*sy,c*sy,0,0];n[4]=p.x-n[0]*base.x-n[2]*base.y;n[5]=p.y-n[1]*base.x-n[3]*base.y;
    visit(b.entities,multiply(m,n),layerName,depth+1);continue;
   }
   const add=(a,b)=>{if(!a||!b)return;a=transform(a,m);b=transform(b,m);if([a.x,a.y,b.x,b.y].every(Number.isFinite))segments.push({a,b});};
   if(e.kind==='line')add(e.startPoint,e.endPoint);
   if(e.kind==='polyline'&&!e.isCadRaster){const p=e.vertices||e.points||[];for(let i=0;i<p.length-1;i++)if(!p[i].bulge)add(p[i],p[i+1]);if(e.isClosed&&p.length>1&&!p.at(-1).bulge)add(p.at(-1),p[0]);}
  }
 }
 visit(doc.entities,[1,0,0,1,0,0]);return segments;
}
export function snapToSegments(segments,p,tolerance){
 let special=null,nearest=null,ds=tolerance,dn=tolerance;
 for(const {a,b}of segments){
  if(p.x<Math.min(a.x,b.x)-tolerance||p.x>Math.max(a.x,b.x)+tolerance||p.y<Math.min(a.y,b.y)-tolerance||p.y>Math.max(a.y,b.y)+tolerance)continue;
  for(const [point,label]of [[a,'Extremidade'],[b,'Extremidade'],[{x:(a.x+b.x)/2,y:(a.y+b.y)/2},'Ponto médio']]){const d=Math.hypot(p.x-point.x,p.y-point.y);if(d<ds){ds=d;special={point,label};}}
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)continue;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)),point={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(p.x-point.x,p.y-point.y);
  if(d<dn){dn=d;nearest={point,label:'Na linha'};}
 }
 return special||nearest;
}

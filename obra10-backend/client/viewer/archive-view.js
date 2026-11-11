function asset(path){return globalThis.PrumoAssets?.[path]||new URL(path,document.baseURI).href;}
let engine;
function archiveEngine(){
 if(!engine)engine=import(asset('./vendor/archive/libarchive.js')).then(mod=>{
  mod.Archive.init({getWorker(){return new Worker(asset('./vendor/archive/worker-bundle.js'));}});
  return mod.Archive;
 });
 return engine;
}
function needsPassword(error){return /password|encrypt|senha/i.test(String(error&&error.message||error||''));}
export async function readArchive(file,password){
 const Archive=await archiveEngine();
 let archive;
 try{archive=await Archive.open(file);}
 catch(error){throw new Error(needsPassword(error)?'Compactado protegido por senha.':'Não foi possível ler este compactado.');}
 try{
  if(password)await archive.usePassword(password);
  const encrypted=await archive.hasEncryptedData();
  if(encrypted&&!password){
   await archive.close();
   archive=null;
   const asked=prompt('Este compactado pede senha.');
   if(!asked)throw new Error('Compactado protegido por senha.');
   return readArchive(file,asked);
  }
  const rows=await archive.getFilesArray();
  const entries=[];
  for(const row of rows){
   const item=row.file;
   if(!item||typeof item.extract!=='function'||!item.name)continue;
   const path=(row.path||'')+item.name;
   entries.push({path,size:Number(item.size)||0,async blob(){
    try{return await item.extract();}
    catch(error){throw new Error(needsPassword(error)?'Senha incorreta ou compactado protegido.':'Não foi possível extrair este item.');}
   }});
  }
  if(!entries.length){await archive.close();archive=null;throw new Error('O compactado não tem arquivos.');}
  entries.sort((a,b)=>a.path.localeCompare(b.path,'pt'));
  return {entries,close:()=>archive.close()};
 }catch(error){
  if(archive)await archive.close().catch(()=>{});
  if(String(error&&error.message||'').startsWith('Compactado')||String(error&&error.message||'').startsWith('Não foi')||String(error&&error.message||'').startsWith('Senha')||String(error&&error.message||'').startsWith('O compactado'))throw error;
  throw new Error('Não foi possível ler este compactado.');
 }
}

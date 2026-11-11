const library=await import(globalThis.PrumoAssets?.['./local-library.js']||new URL('./local-library.js',import.meta.url).href);
const family=name=>name.split(/[\\/]/).pop().replace(/\.(ttf|otf|woff2?)$/i,'');
async function load(name,file){const face=new FontFace(family(name),await file.arrayBuffer());await face.load();document.fonts.add(face);return face.family;}
export async function restoreFonts(){try{for(const f of await library.fontRecords())await load(f.id,f.file);}catch{}}
export async function importFonts(files){let count=0;for(const file of files){if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw Error('Importe fontes TTF, OTF ou WOFF. Fontes SHX ainda não são suportadas.');await load(file.name,file);await library.saveFont(file.name,file);count++;}return count;}

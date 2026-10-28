import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
const root=process.cwd(),out=join(root,'public');
const files=['index.html','dist/modul-core.mjs','dist/modul-studio.mjs'];
for(const file of files){
 const source=join(root,file),target=join(out,file);
 await mkdir(dirname(target),{recursive:true});
 await copyFile(source,target);
}
const html=await readFile(join(out,'index.html'),'utf8');
for(const required of ['./dist/modul-studio.mjs','modul_projects','planSvg','studioGenerate']){
 if(!html.includes(required))throw new Error('La interfaz no incluye '+required);
}
await writeFile(join(out,'404.html'),html);
console.log('Build estático listo: public/ con '+files.length+' archivos y ruta de respaldo.');

import {cpSync,mkdirSync} from 'node:fs';
for(const folder of ['cmaps','standard_fonts','wasm']){
  const target=new URL(`../public/pdfjs/${folder}/`,import.meta.url);
  mkdirSync(target,{recursive:true});
  cpSync(new URL(`../node_modules/pdfjs-dist/${folder}/`,import.meta.url),target,{recursive:true});
}
const licenses=new URL('../public/pdfjs/licenses/',import.meta.url);
mkdirSync(licenses,{recursive:true});
for(const name of ['pdfjs-dist','mammoth','turndown','turndown-plugin-gfm'])cpSync(new URL(`../node_modules/${name}/LICENSE`,import.meta.url),new URL(`${name}.txt`,licenses));
console.log('Prepared local PDF fonts, character maps and WebAssembly assets.');

export const MAX_DOCUMENT_BYTES=10*1024*1024;
export const MAX_ARTICLE_CHARACTERS=60000;
export const MAX_EXTRACTED_CHARACTERS=200000;
export const DOCUMENT_TYPES=['docx','pdf','md','markdown','txt'];

export function documentType(file){
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  if(!DOCUMENT_TYPES.includes(ext))throw new Error(ext==='doc'?'暂不支持旧版 .doc，请先另存为 .docx 后导入。':'请选择 Word（.docx）、PDF、Markdown 或 TXT 文档。');
  if(!file.size)throw new Error('这个文档是空的，请选择有内容的文件。');
  if(file.size>MAX_DOCUMENT_BYTES)throw new Error('文件超过 10 MB，请先缩小或拆分文档。');
  return ext;
}
export function titleFromFilename(name){return String(name||'未命名文章').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim().slice(0,150)||'未命名文章';}
export function decodeDocumentText(bytes){
  if(bytes[0]===0xff&&bytes[1]===0xfe)return {text:new TextDecoder('utf-16le').decode(bytes),encoding:'UTF-16'};
  if(bytes[0]===0xfe&&bytes[1]===0xff)return {text:new TextDecoder('utf-16be').decode(bytes),encoding:'UTF-16'};
  try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'UTF-8'};}catch{return {text:new TextDecoder('gb18030').decode(bytes),encoding:'GB18030'};}
}
export function normalizeImportedText(text){
  const result=String(text||'').replace(/^\uFEFF/,'').replaceAll('\r\n','\n').replaceAll('\r','\n').replaceAll('\0','').trim();
  if(result.length>MAX_EXTRACTED_CHARACTERS)throw new Error('提取的正文超过 20 万字符，请先把文档拆分成几篇文章。');
  if(!result)throw new Error('没有找到可导入的文字，请检查文档内容。');
  return result;
}
export function importedDraft(name,text){
  let markdown=normalizeImportedText(text),metadata={};
  const header=markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if(header){for(const line of header[1].split('\n')){const match=line.match(/^(title|category|tags|summary):\s*(.*?)\s*$/);if(match)metadata[match[1]]=match[2].replace(/^["']|["']$/g,'');}if(Object.keys(metadata).length)markdown=markdown.slice(header[0].length).trim();}
  if(!markdown)throw new Error('文档只有属性信息，没有正文。');
  const heading=markdown.match(/^#\s+([^\n]+)\n?/);
  const title=(metadata.title||heading?.[1]||titleFromFilename(name)).trim().slice(0,150);
  if(heading&&title===heading[1].trim())markdown=markdown.slice(heading[0].length).trim();
  if(!markdown)throw new Error('文档只有标题，没有正文。');
  return {title,category:(metadata.category||'随笔').slice(0,40),tags:(metadata.tags||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean).slice(0,12),intro:(metadata.summary||'').slice(0,260),markdown,art:'order',pinned:false};
}
export function validateImportedDraft(draft){
  if(!draft.title?.trim())return '请填写文章标题。';
  if(!draft.markdown?.trim())return '正文不能为空，请检查导入结果。';
  if(draft.markdown.length>MAX_ARTICLE_CHARACTERS)return `当前正文 ${draft.markdown.length.toLocaleString()} 字符，发表上限为 60,000 字符，请删减或拆分后发表。`;
  if(/!\[[^\]]*\]\(data:|<img[^>]+src\s*=\s*["']?data:/i.test(draft.markdown))return '正文含有内嵌图片，无法直接在 GitHub 文章中展示。请移除并在 GitHub 编辑框补充图片。';
  return '';
}
export function formatDocumentSize(bytes){return bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';}

// Check ZIP metadata before DOCX decompression, bounding resource use in the browser.
export function checkDocxArchive(buffer){
  const view=new DataView(buffer);if(view.byteLength<22||view.getUint32(0,true)!==0x04034b50)throw new Error('这不是有效的 Word .docx 文件，或文件已经损坏。');
  let end=-1;for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
  if(end<0)throw new Error('Word 文档结构不完整，无法导入。');
  const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),total=0;
  if(count>2000||offset>=view.byteLength)throw new Error('Word 文档结构过于复杂，请精简后重试。');
  for(let i=0;i<count;i++){
    if(offset+46>view.byteLength||view.getUint32(offset,true)!==0x02014b50)throw new Error('Word 文档结构损坏，无法导入。');
    if(view.getUint16(offset+8,true)&1)throw new Error('暂不支持加密的 Word 文档，请另存为未加密副本。');
    total+=view.getUint32(offset+24,true);if(total>40*1024*1024)throw new Error('Word 文档解压后的内容过大，请精简图片或拆分后重试。');
    offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
  }
}

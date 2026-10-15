import {documentType,decodeDocumentText,importedDraft,checkDocxArchive,normalizeImportedText} from './document-model.js';
import DOMPurify from 'dompurify';

export async function importDocument(file,onProgress=()=>{}){
  const type=documentType(file),warnings=[];
  onProgress('正在读取文档……');
  const buffer=await file.arrayBuffer();let text='',details='';
  if(['md','markdown','txt'].includes(type)){
    const decoded=decodeDocumentText(new Uint8Array(buffer));text=decoded.text;details=`${type==='txt'?'纯文本':'Markdown'} · ${decoded.encoding}`;
  }else if(type==='docx'){
    checkDocxArchive(buffer);onProgress('正在转换 Word 的标题、段落与表格……');
    const [{default:mammoth},{default:Turndown},gfmModule]=await Promise.all([import('mammoth/mammoth.browser.js'),import('turndown'),import('turndown-plugin-gfm')]);
    let images=0;
    const result=await mammoth.convertToHtml({arrayBuffer:buffer},{externalFileAccess:false,convertImage:mammoth.images.imgElement(async()=>{images++;return {src:'',alt:'文档图片'};})});
    const safeHtml=DOMPurify.sanitize(result.value.replace(/<img\b[^>]*>/gi,'<p>[图片未导入，请在发表前补充]</p>'),{USE_PROFILES:{html:true},FORBID_TAGS:['img','iframe','object','embed','style','form','input','button'],FORBID_ATTR:['style','id']});
    const converter=new Turndown({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
    converter.use(gfmModule.gfm||gfmModule.default.gfm);
    const document=new DOMParser().parseFromString(safeHtml,'text/html');
    document.querySelectorAll('table').forEach(table=>table.querySelector('tr')?.querySelectorAll('td').forEach(cell=>{const th=document.createElement('th');th.innerHTML=cell.innerHTML;cell.replaceWith(th);}));
    converter.addRule('word-table',{filter:'table',replacement:(_,table)=>{
      const rows=[...table.querySelectorAll('tr')].filter(row=>row.closest('table')===table).map(row=>[...row.children].filter(cell=>['TD','TH'].includes(cell.tagName)).map(cell=>converter.turndown(cell.innerHTML).trim().replaceAll('|','\\|').replace(/\n+/g,'<br>'))).filter(row=>row.length);
      if(!rows.length)return '';
      const width=Math.max(...rows.map(row=>row.length));const line=row=>'| '+Array.from({length:width},(_,i)=>row[i]||'').join(' | ')+' |';
      return '\n\n'+[line(rows[0]),line(Array(width).fill('---')),...rows.slice(1).map(line)].join('\n')+'\n\n';
    }});
    text=converter.turndown(document.body.innerHTML);details='Word · 保留标题、段落、列表与表格';
    if(images)warnings.push(`文档中的 ${images} 张图片没有上传。请在 GitHub 编辑框补充图片，并替换正文里的图片提示。`);
    if(result.messages?.some(m=>m.type==='warning'))warnings.push('部分 Word 样式可能已简化，请检查预览后再发表。');
  }else if(type==='pdf'){
    const signature=new TextDecoder().decode(new Uint8Array(buffer,0,Math.min(1024,buffer.byteLength)));if(!signature.includes('%PDF-'))throw new Error('这不是有效的 PDF 文件，或文件已经损坏。');
    onProgress('正在加载 PDF 文字解析器……');
    const pdfjs=await import('pdfjs-dist/build/pdf.mjs');
    const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    const base=new URL(import.meta.env.BASE_URL,location.href).href;
    const loading=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true,cMapUrl:base+'pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:base+'pdfjs/standard_fonts/',wasmUrl:base+'pdfjs/wasm/'});
    let pdf;
    try{
      pdf=await loading.promise;if(pdf.numPages>100)throw new Error('PDF 超过 100 页，请先拆分文档后导入。');
      const pages=[];
      for(let n=1;n<=pdf.numPages;n++){
        onProgress(`正在提取 PDF 文字：第 ${n} / ${pdf.numPages} 页……`);
        const page=await pdf.getPage(n),content=await page.getTextContent();const lines=[];let line='',y=null,lastRight=null;
        for(const item of content.items){if(!('str'in item))continue;const top=item.transform[5],left=item.transform[4];if(y!==null&&Math.abs(top-y)>4&&line){lines.push(line.trim());line='';lastRight=null;}if(line&&lastRight!==null&&left-lastRight>Math.max(2,(item.height||10)*.2))line+=' ';line+=item.str;y=top;lastRight=left+(item.width||0);if(item.hasEOL){lines.push(line.trim());line='';lastRight=null;y=null;}}
        if(line)lines.push(line.trim());const pageText=lines.filter(Boolean).join('\n');if(pageText)pages.push(pageText);page.cleanup();
      }
      text=pages.join('\n\n---\n\n');details=`PDF · ${pdf.numPages} 页 · 文字提取`;
      if(text.replace(/\s/g,'').length<10)throw new Error('没有提取到可读文字。这可能是扫描版 PDF，请先进行 OCR 文字识别，或使用 Word / TXT 文档。');
      warnings.push('PDF 按可选中的文字导入，原版式和图片不保留。双栏、表格或复杂排版请在预览中检查阅读顺序。');
      if(pages.length<pdf.numPages)warnings.push('部分页面没有提取到文字，请核对是否包含扫描页。');
    }catch(error){if(error.name==='PasswordException')throw new Error('暂不支持带密码的 PDF，请先另存为未加密副本。');if(error.name==='InvalidPDFException')throw new Error('PDF 文件损坏或格式不受支持，请重新导出文档后重试。');throw error;}finally{await loading.destroy();}
  }
  text=normalizeImportedText(text);
  const draft=importedDraft(file.name,text);
  if(draft.markdown.length>60000)warnings.push('正文超过发表上限 60,000 字符；可以先导入编辑，删减或拆分后再发表。');
  if(/!\[[^\]]*\]\(/.test(draft.markdown)||/<img\b/i.test(draft.markdown))warnings.push('预览暂不加载图片。网络图片链接会保留在正文中，请发表前确认图片可以公开访问。');
  return {...draft,filename:file.name,size:file.size,type,details,warnings};
}

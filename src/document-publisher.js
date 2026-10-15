import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {importDocument} from './document-import.js';
import {formatDocumentSize,MAX_ARTICLE_CHARACTERS,validateImportedDraft,documentType} from './document-model.js';
import {issueDraftUrl,repositoryUrl,PUBLICATION} from './publication.js';

const DRAFT_KEY='goucheng-document-draft-v1';
export function createDocumentPublisher({showDialog,toast,esc,download,getMode}){
  const $=s=>document.querySelector(s);let draft=null,job=0,tab='preview',busy=false,publishUrl='',publishBody='';
  function savedDraft(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');return d&&typeof d.markdown==='string'&&d.markdown.length<=200000&&typeof d.title==='string'?d:null;}catch{return null;}}
  function show(){
    job++;busy=false;draft=null;const saved=savedDraft();
    showDialog(`<span class="section-number">FROM DOCUMENT TO JOURNAL</span><h2 id="dialog-title">把文档，变成文章<span class="red-dot">.</span></h2><p class="reader-subtitle">导入、预览、调整，再公开发表。文档在当前浏览器解析，确认前不会上传。</p><div class="import-stepper"><span class="active">01 选择文档</span><i>→</i><span>02 预览与编辑</span><i>→</i><span>03 确认发表</span></div><div class="document-dropzone" id="document-dropzone"><span class="document-upload-symbol" aria-hidden="true">↥</span><strong>把你的文档，放在这里</strong><p>拖入一个文件，或点击选择文档</p><label class="document-file-button">选择文档<input id="document-input" type="file" accept=".docx,.pdf,.md,.markdown,.txt" aria-label="选择要发表的文档"></label><small>DOCX / PDF / Markdown / TXT · 最大 10 MB · PDF 最多 100 页</small></div><p id="document-progress" class="document-progress" role="status" aria-live="polite"></p><p id="document-error" class="form-error" role="alert"></p>${saved?`<div class="document-resume" id="document-resume"><div><strong>有一篇尚未发表的文档草稿</strong><p>${esc(saved.title||'未命名文章')}</p></div><button data-document-restore>恢复草稿 ↗</button></div>`:''}<div id="document-editor"></div><p class="local-note import-bottom-note">Word 导入常用文字格式；PDF 导入可选中的文字，扫描版需先做 OCR。图片不会自动上传，可在 GitHub 发表时补充。</p>`, 'document-publisher-dialog');
    const input=$('#document-input'),zone=$('#document-dropzone');
    input.addEventListener('change',()=>{if(input.files[0])load(input.files[0]);});
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
    zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');if(e.dataTransfer.files.length!==1){$('#document-error').textContent='请每次导入一个文档，确认发表后再导入下一篇。';return;}load(e.dataTransfer.files[0]);});
  }
  async function load(file){
    try{documentType(file);}catch(error){$('#document-error').textContent=error.message;$('#document-input').value='';return;}
    const id=++job;busy=true;$('#document-error').textContent='';$('#document-progress').textContent='正在读取文档……';$('#document-dropzone').setAttribute('aria-busy','true');
    try{const result=await importDocument(file,message=>{if(id===job&&getMode()==='document-publisher-dialog')$('#document-progress').textContent=message;});if(id!==job||getMode()!=='document-publisher-dialog')return;draft=result;tab='preview';$('#document-resume')?.remove();renderEditor();$('#document-progress').textContent='文档已导入。检查标题、正文与格式，确认后再发表。';}
    catch(error){if(id===job&&getMode()==='document-publisher-dialog'){$('#document-error').textContent=error.message||'文档解析失败，请确认文件完整，或另存为 DOCX / TXT 后重试。';$('#document-progress').textContent='';}}
    finally{if(id===job&&getMode()==='document-publisher-dialog'){busy=false;$('#document-dropzone').removeAttribute('aria-busy');$('#document-input').value='';}}
  }
  function renderEditor(){
    const box=$('#document-editor');box.innerHTML=`<div class="import-file-info"><span class="import-file-type">${esc(draft.type?.toUpperCase()||'DRAFT')}</span><div><strong>${esc(draft.filename||'已保存的草稿')}</strong><small>${draft.size?formatDocumentSize(draft.size)+' · ':''}${esc(draft.details||'本地草稿')}</small></div><span>✓ 已提取正文</span></div>${draft.warnings?.length?`<div class="import-warnings"><strong>发表前请检查</strong><ul>${draft.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<form id="document-form"><div class="document-fields"><label class="document-title-label">文章标题<input name="title" maxlength="150" required value="${esc(draft.title)}" placeholder="给文章起一个名字"></label><label>分类<input name="category" maxlength="40" value="${esc(draft.category||'随笔')}"></label><label>标签（逗号分隔）<input name="tags" maxlength="300" value="${esc((draft.tags||[]).join(', '))}" placeholder="生活, 思考"></label><label class="document-summary-label">文章简介（选填）<textarea name="intro" maxlength="260" rows="2" placeholder="留空时从正文自动提取">${esc(draft.intro||'')}</textarea></label></div><div class="document-edit-bar"><div role="tablist" aria-label="文档内容查看方式"><button type="button" role="tab" data-document-tab="preview" aria-selected="${tab==='preview'}">阅读预览</button><button type="button" role="tab" data-document-tab="source" aria-selected="${tab==='source'}">编辑正文</button></div><span id="document-count"></span></div><div id="document-preview" class="markdown-body document-preview" role="tabpanel" aria-label="文章预览"></div><label class="document-source-label" id="document-source-panel"><span class="sr-only">文章 Markdown 正文</span><textarea name="markdown" id="document-source" aria-label="文章 Markdown 正文" spellcheck="false">${esc(draft.markdown)}</textarea></label><p class="form-error" id="document-validation" role="alert"></p><div class="document-publish-footer"><div><strong>内容确认无误后，再公开发表</strong><p>使用 ${PUBLICATION.owner} 的 GitHub 账号完成最后确认。</p></div><div class="document-publish-buttons"><button type="button" class="document-secondary" data-document-save>保存本地草稿</button><button type="submit" class="primary-button">继续到 GitHub 发表 ↗</button></div></div></form><div id="document-handoff"></div>`;
    $('#document-dropzone').classList.add('has-document');
    document.querySelectorAll('.import-stepper span').forEach((s,i)=>s.classList.toggle('active',i===1));
    $('#document-form').addEventListener('input',()=>{collect();updatePreview();$('#document-handoff').innerHTML='';});
    $('#document-form').addEventListener('submit',e=>{e.preventDefault();preparePublish();});updatePreview();
  }
  function collect(){if(!$('#document-form')||!draft)return;const f=new FormData($('#document-form'));draft={...draft,title:f.get('title').trim(),category:f.get('category').trim()||'随笔',tags:[...new Set(f.get('tags').split(/[,，]/).map(t=>t.trim().slice(0,80)).filter(Boolean))].slice(0,12),intro:f.get('intro').trim(),markdown:f.get('markdown')};}
  function updatePreview(){
    if(!draft)return;$('#document-count').textContent=`${draft.markdown.length.toLocaleString()} / ${MAX_ARTICLE_CHARACTERS.toLocaleString()} 字符`;
    $('#document-preview').innerHTML=DOMPurify.sanitize(marked.parse(draft.markdown||'',{gfm:true,breaks:true}),{USE_PROFILES:{html:true},FORBID_TAGS:['img','iframe','video','audio','object','embed','style','script','link','form','input','button'],FORBID_ATTR:['style','id']})||'<p class="muted">还没有正文。</p>';
    $('#document-preview').querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
    $('#document-preview').hidden=tab!=='preview';$('#document-source-panel').hidden=tab!=='source';
    document.querySelectorAll('[data-document-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.documentTab===tab)));
    $('#document-validation').textContent=draft.markdown.length>MAX_ARTICLE_CHARACTERS?validateImportedDraft(draft):'';
  }
  function save(){collect();try{localStorage.setItem(DRAFT_KEY,JSON.stringify({...draft,savedAt:new Date().toISOString()}));toast('文档草稿已保存在当前浏览器，尚未公开发表');return true;}catch{toast('浏览器无法保存草稿，可下载 Markdown 保留正文');return false;}}
  function preparePublish(){
    if(busy){toast('文档仍在解析，请稍等');return;}collect();const error=validateImportedDraft(draft);$('#document-validation').textContent=error;if(error)return;
    const fullUrl=issueDraftUrl(draft);publishBody=new URL(fullUrl).searchParams.get('body');
    const fits=fullUrl.length<=7000;const fallback=new URL(`${repositoryUrl}/issues/new`);fallback.searchParams.set('labels','article');fallback.searchParams.set('title',draft.title);publishUrl=fits?fullUrl:fallback.href;
    save();document.querySelectorAll('.import-stepper span').forEach((s,i)=>s.classList.toggle('active',i===2));
    $('#document-handoff').innerHTML=`<section class="document-handoff"><span class="section-number">READY TO PUBLISH</span><h3>准备好，让文字被看见<span class="red-dot">.</span></h3><p>${fits?'文章标题、分类和正文已准备好。打开 GitHub 后检查内容，点击 Create / Submit new issue 才会公开发表。':'正文较长，无法完整放进跳转链接。先复制已整理的正文，再打开 GitHub 粘贴到正文框，点击 Create / Submit new issue 发表。'}</p><div class="document-publish-buttons"><button class="document-secondary" data-document-copy>复制发表正文</button><a class="primary-button" href="${esc(publishUrl)}" target="_blank" rel="noopener noreferrer">${fits?'打开 GitHub 确认发表 ↗':'打开 GitHub，粘贴并发表 ↗'}</a><button class="text-button" data-document-download>下载 Markdown ↗</button></div><p class="local-note">目前仍是草稿。GitHub 确认发表后，回到博客点击「刷新文章」；所有访客都能阅读公开版本。</p></section>`;
    $('#document-handoff').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||getMode()!=='document-publisher-dialog')return;
    if(b.dataset.documentTab){tab=b.dataset.documentTab;updatePreview();}
    if(b.hasAttribute('data-document-restore')){draft=savedDraft();if(draft){$('#document-resume')?.remove();renderEditor();$('#document-progress').textContent='已恢复当前浏览器保存的文档草稿，尚未公开发表。';}}
    if(b.hasAttribute('data-document-save'))save();
    if(b.hasAttribute('data-document-download')){collect();download(draft.title.replace(/[\\/:*?"<>|]/g,'-')+'.md',`# ${draft.title}\n\n${draft.markdown}`,'text/markdown;charset=utf-8');}
    if(b.hasAttribute('data-document-copy')){try{await navigator.clipboard.writeText(publishBody);toast('发表正文已复制，请粘贴到 GitHub 的正文框');}catch{$('.document-manual-copy')?.remove();$('#document-handoff').insertAdjacentHTML('beforeend','<label class="document-manual-copy">请全选并复制<textarea id="document-copy-text" aria-label="待复制的发表正文" readonly></textarea></label>');$('#document-copy-text').value=publishBody;$('#document-copy-text').select();}}
  });
  return {show};
}

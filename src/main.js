import './style.css';
import './features.css';
import './responsive.css';
import './public.css';
import './document-publisher.css';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {art} from './art.js';
import {shell,arrow,searchIcon} from './shell.js';
import {STORE_KEY,escapeHTML as esc,freshState,visiblePosts,filterPosts,validateBackup,readingMinutes,dateTime,uid,localDate} from './model.js';
import {createStudio} from './studio.js';
import {createDocumentPublisher} from './document-publisher.js';
import {PUBLIC_MODE,publicInitialState,fetchPublication} from './public-client.js';
import {repositoryUrl,newArticleUrl,applyPublication} from './publication.js';

const $ = s=>document.querySelector(s);
let state;
let storedSnapshot=null;
let storageWarning = '';
try {const data=localStorage.getItem(STORE_KEY);storedSnapshot=data;state=data?validateBackup(JSON.parse(data)):freshState();if(!data){try{state.saved=JSON.parse(localStorage.getItem('goucheng-saved')||'[]').filter(id=>state.posts.some(p=>p.id===id));}catch{/* ignore legacy cache */}}}
catch {state=freshState();storageWarning='浏览器中的旧数据无法读取，已打开示例内容。旧存储尚未覆盖，请先导出原始数据。';}
if(PUBLIC_MODE)state=publicInitialState(state);
let filters={category:'',query:'',tag:'',sort:'newest',saved:false,unread:false,from:'',to:''}, page=1, currentPost=null, replyTo=null;
let modalMode='', toastTimer, scheduledTimer;
const dialog=$('#reader');
export function markdown(text) {
  const clean=DOMPurify.sanitize(marked.parse(text||'',{breaks:true,gfm:true}),{USE_PROFILES:{html:true},FORBID_TAGS:['style','form','input','button','iframe','video','audio'],FORBID_ATTR:['style','id']});
  const wrapper=document.createElement('div');wrapper.innerHTML=clean;
  wrapper.querySelectorAll('a').forEach(a=>{if(a.href.startsWith('http')){a.target='_blank';a.rel='noopener noreferrer';}});
  wrapper.querySelectorAll('img').forEach(img=>{img.loading='lazy';img.referrerPolicy='no-referrer';});
  return wrapper.innerHTML;
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3300);}
function commit(mutate,{quiet=false}={}){
  const next=structuredClone(state);
  mutate(next);
  try {if(localStorage.getItem(STORE_KEY)!==storedSnapshot){if(!quiet)toast('另一个标签页更新了博客。请先保存编辑缓冲区并关闭弹窗，同步后再保存。');return false;}if(storageWarning&&storedSnapshot)localStorage.setItem(STORE_KEY+'-recovery',storedSnapshot);const serialized=JSON.stringify(next);localStorage.setItem(STORE_KEY,serialized);storedSnapshot=serialized;state=next;storageWarning='';scheduleRefresh();return true;}
  catch {if(!quiet)toast('保存失败：浏览器存储不可用或空间不足。请先备份数据或缩小封面图片。');return false;}
}
function replaceState(next){return commit(s=>Object.assign(s,next));}
function download(name,content,type='text/plain;charset=utf-8'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function theme(){let dark=state.prefs.theme==='dark'||state.prefs.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'paper';document.documentElement.style.setProperty('--reader-size',state.prefs.fontSize+'px');}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);
function mount(){
  $('#app').innerHTML=shell(state); document.title=`${state.site.title} ${state.site.english} — 个人手记`;
  if(PUBLIC_MODE){document.body.classList.add('public-mode');document.querySelectorAll('[data-action="studio"]').forEach(b=>{b.dataset.action='public-author';if(b.classList.contains('studio-entry'))b.textContent='作者发布 ↗';else b.textContent='写文章 ↗';});$('#blog-counts').parentElement.insertAdjacentHTML('afterend','<div class="public-status" role="status"><span id="public-update-status">正在连接公开文章源……</span><button data-action="refresh-public">刷新文章 ↻</button></div>');}
  document.querySelector('meta[name="description"]').content=state.site.description;
  $('#inline-query').value=filters.query;$('#sort-order').value=filters.sort;$('#unread-only').checked=filters.unread;
  render();theme();
  $('#inline-query').addEventListener('input',e=>{filters.query=e.target.value;page=1;render();});
  $('#sort-order').addEventListener('change',e=>{filters.sort=e.target.value;page=1;render();});
  $('#unread-only').addEventListener('change',e=>{filters.unread=e.target.checked;page=1;render();});
}
function scheduleRefresh(){clearTimeout(scheduledTimer);const now=Date.now();const next=state.posts.filter(p=>!p.deletedAt&&p.status==='published'&&Date.parse(p.publishAt)>now).sort((a,b)=>Date.parse(a.publishAt)-Date.parse(b.publishAt))[0];if(next)scheduledTimer=setTimeout(()=>{render();if(modalMode==='studio')studio.show();scheduleRefresh();},Math.min(2147483647,Math.max(50,Date.parse(next.publishAt)-now+50)));}
function cover(p,large=false){return p.cover?`<img src="${esc(p.cover)}" alt="${esc(p.title)}的封面" loading="lazy">`:art(p.art,large);}
function card(p, featured=false){const saved=state.saved.includes(p.id),read=state.read.includes(p.id);return `<article class="article ${featured?'featured':''}"><button class="article-art" data-post="${p.id}" aria-label="阅读：${esc(p.title)}">${cover(p,featured)}${featured?'<span class="featured-label">精选文章 / FEATURED</span>':''}${read?'<span class="read-badge">已读 ✓</span>':''}<span class="art-link">${arrow}</span></button><div class="article-copy"><div class="article-meta"><button class="category-label" data-category="${esc(p.category)}">${esc(p.category)}</button><time>${localDate(Date.parse(p.publishAt))}</time><span>${readingMinutes(p.markdown)} MIN READ</span></div><h3><button data-post="${p.id}">${esc(p.title)}</button></h3><p>${esc(p.intro)}</p><div class="card-tags">${p.tags.slice(0,3).map(t=>`<button data-tag="${esc(t)}"># ${esc(t)}</button>`).join('')}</div><div class="article-bottom"><button class="read-link" data-post="${p.id}">阅读文章 <span>↗</span></button><span class="card-actions"><small>${state.views[p.id]||0} 次本机阅读</small><button class="bookmark ${saved?'is-saved':''}" data-save="${p.id}" aria-label="${saved?'取消收藏':'收藏'}：${esc(p.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button></span></div></div></article>`;}
function render(){
  const posts=visiblePosts(state),categories=[...new Set(posts.map(p=>p.category))];
  $('#categories').innerHTML=['',...categories].map(c=>`<button data-category="${esc(c)}" class="filter ${filters.category===c?'active':''}" aria-pressed="${filters.category===c}">${esc(c||'全部文章')}<sup>${String(c?posts.filter(p=>p.category===c).length:posts.length).padStart(2,'0')}</sup></button>`).join('');
  const found=filterPosts(state,filters);const max=Math.max(1,Math.ceil(found.length/state.prefs.pageSize));page=Math.min(page,max);
  const active=Object.entries(filters).some(([k,v])=>k!=='sort'&&Boolean(v));
  $('#articles').innerHTML=found.length?`<div class="article-grid ${state.prefs.layout==='list'?'list-layout':''}">${found.slice((page-1)*state.prefs.pageSize,page*state.prefs.pageSize).map((p,i)=>card(p,i===0&&page===1&&!active&&state.prefs.layout==='grid'&&p.pinned)).join('')}</div>`:`<div class="empty-state"><span>∅</span><h3>${filters.saved?'还没有匹配的收藏':'没有找到相关的文章'}</h3><p>试试其他关键词、分类或标签，也可以清除筛选重新开始。</p><button class="text-button" data-action="reset">浏览全部文章 ↗</button></div>`;
  const desc=$('#filter-description');desc.hidden=!active;desc.innerHTML=`<span>${filters.saved?'我的收藏 · ':''}${filters.query?'搜索「'+esc(filters.query)+'」 · ':''}${filters.tag?'#'+esc(filters.tag)+' · ':''}共 ${found.length} 篇</span><button data-action="reset">清除全部筛选 ×</button>`;
  $('#active-filters').innerHTML=filters.from||filters.to?`<div class="date-filter-info">日期：${esc(filters.from||'不限')} — ${esc(filters.to||'不限')}<button data-action="clear-dates">移除日期筛选 ×</button></div>`:'';
  const sf=$('.saved-filter');sf.classList.toggle('active',filters.saved);sf.setAttribute('aria-pressed',String(filters.saved));
  $('#pagination').innerHTML=max>1?`<button data-page="${page-1}" ${page===1?'disabled':''}>← 上一页</button>${Array.from({length:max},(_,i)=>`<button data-page="${i+1}" class="${page===i+1?'active':''}" ${page===i+1?'aria-current="page"':''}>${i+1}</button>`).join('')}<button data-page="${page+1}" ${page===max?'disabled':''}>下一页 →</button>`:'';
  $('#blog-counts').textContent=`${posts.length} 篇文章 / ${categories.length} 个分类 / ${new Set(posts.flatMap(p=>p.tags)).size} 个标签`;
  $('.layout-toggle').setAttribute('aria-label',state.prefs.layout==='grid'?'切换列表布局':'切换网格布局');
  $('#sort-order').value=filters.sort;$('#unread-only').checked=filters.unread;
}
function resetFilters(){filters={category:'',query:'',tag:'',sort:'newest',saved:false,unread:false,from:'',to:''};page=1;$('#inline-query').value='';render();}
function showDialog(content,kind=''){
  currentPost=null;replyTo=null;modalMode=kind;dialog.className=kind;
  $('#dialog-content').innerHTML=`<button class="dialog-close" data-action="close" aria-label="关闭弹窗">×</button>${content}`;
  if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');dialog.scrollTop=0;
}
function closeDialog(){dialog.close();}
function preserveEditor(){if(modalMode==='editor')studio.captureEditor();}
function askLeaveEditor(next){if(modalMode==='editor'){preserveEditor();}next();}
function route(){const id=location.hash.startsWith('#article/')?location.hash.slice(9):null;if(id)openPost(id,{route:false});else if(modalMode==='post-dialog'&&dialog.open)closeDialog();}
function articleUrl(p){return location.origin+location.pathname+'#article/'+p.id;}
function openPost(id,{route:changeRoute=true,count=true}={}){
  const p=visiblePosts(state).find(p=>p.id===id);
  if(!p){showDialog('<h2 id="dialog-title">这篇文章暂时无法阅读</h2><p>文章可能尚未发布或已被移入回收站。</p><button class="primary-button" data-action="close">返回博客</button>');return;}
  if(changeRoute&&location.hash!==`#article/${p.id}`)history.pushState(null,'',`#article/${p.id}`);
  if(count)commit(s=>{s.views[p.id]=(s.views[p.id]||0)+1;s.history=[{id:p.id,at:new Date().toISOString()},...s.history.filter(h=>h.id!==p.id)].slice(0,100);},{quiet:true});
  const posts=visiblePosts(state).sort((a,b)=>Date.parse(b.publishAt)-Date.parse(a.publishAt)),index=posts.findIndex(x=>x.id===id);
  const related=posts.filter(x=>x.id!==id).sort((a,b)=>b.tags.filter(t=>p.tags.includes(t)).length-a.tags.filter(t=>p.tags.includes(t)).length).slice(0,2);
  const content=document.createElement('div');content.innerHTML=markdown(p.markdown);const headings=[...content.querySelectorAll('h1,h2,h3')];headings.forEach((h,i)=>h.id='section-'+i);
  showDialog(`<div class="reading-progress"><div></div></div><div class="reader-topline">${esc(state.site.english)} / THE JOURNAL <span>${localDate(Date.parse(p.publishAt))}</span></div><div class="reader-controls"><button data-action="reader-smaller" aria-label="缩小正文字号">A−</button><span id="font-size-label">${state.prefs.fontSize}px</span><button data-action="reader-larger" aria-label="放大正文字号">A+</button><button data-action="theme" aria-label="切换夜间模式">◐</button><button data-action="print">打印 / PDF</button></div><div class="article-meta"><button class="category-label" data-category="${esc(p.category)}">${esc(p.category)}</button><span>${readingMinutes(p.markdown)} 分钟阅读</span><span>${state.views[p.id]||0} 次本机阅读</span></div><h2 id="dialog-title">${esc(p.title)}</h2><p class="reader-subtitle">${esc(p.subtitle||p.intro)}</p><div class="reader-tags">${p.tags.map(t=>`<button data-tag="${esc(t)}"># ${esc(t)}</button>`).join('')}</div><div class="reader-art">${cover(p,true)}</div><div class="reading-layout"><aside class="table-of-contents"><small>文章目录</small>${headings.map((h,i)=>`<button data-heading="section-${i}">${esc(h.textContent)}</button>`).join('')||'<span>自由阅读</span>'}<span class="toc-progress">阅读进度 <b id="progress-number">0%</b></span></aside><div class="reader-body markdown-body" id="article-content">${content.innerHTML}</div></div><div class="reader-footer"><span>文 / ${esc(state.author.name)}</span><div class="reader-actions"><button data-save="${id}" class="text-button">${state.saved.includes(id)?'★ 已收藏':'☆ 收藏'}</button><button data-like="${id}" class="text-button" aria-pressed="${state.likes.includes(id)}">${state.likes.includes(id)?'♥ 已喜欢':'♡ 喜欢'}</button><button data-action="share-post">分享 ↗</button><button data-action="download-post">下载 Markdown</button><button data-read="${id}">${state.read.includes(id)?'✓ 已读（撤销）':'标为已读'}</button></div></div><section class="related-section"><span class="section-number">继续探索 / RELATED</span>${related.map(p=>`<button data-post="${p.id}">${esc(p.title)} ↗</button>`).join('')}</section><section id="comments" class="comments-section"></section><div class="post-neighbors">${index>0?`<button data-post="${posts[index-1].id}"><small>上一篇</small>${esc(posts[index-1].title)}</button>`:'<span></span>'}${index<posts.length-1?`<button data-post="${posts[index+1].id}"><small>下一篇</small>${esc(posts[index+1].title)}</button>`:''}</div>`, 'post-dialog');
  currentPost=id;renderComments();render();updateProgress();
}
function updateProgress(){if(modalMode!=='post-dialog'||!currentPost)return;const body=$('#article-content');if(!body)return;const r=body.getBoundingClientRect(),d=dialog.getBoundingClientRect();const progress=Math.max(0,Math.min(100,Math.round((d.bottom-r.top)/r.height*100)));$('.reading-progress>div').style.width=progress+'%';$('#progress-number').textContent=progress+'%';}
// The reading dialog is the scroll container, so progress follows its body.
dialog.addEventListener('scroll',updateProgress,{passive:true});
dialog.addEventListener('cancel',preserveEditor);
dialog.addEventListener('close',()=>{preserveEditor();document.body.classList.remove('dialog-open');currentPost=null;modalMode='';if(location.hash.startsWith('#article/'))history.replaceState(null,'','#journal');try{const latest=localStorage.getItem(STORE_KEY);if(latest&&latest!==storedSnapshot){state=validateBackup(JSON.parse(latest));storedSnapshot=latest;mount();toast('已同步其他标签页的更新，未提交的编辑仍保留');}}catch{/* keep last valid data */}});
dialog.addEventListener('click',e=>{if(e.target===dialog&&modalMode!=='editor'){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function renderComments(){
  if(PUBLIC_MODE){const number=currentPost?.match(/^issue-(\d+)$/)?.[1];$('#comments').innerHTML=`<div class="cloud-comments"><h3>一起聊聊这篇文章<span class="red-dot">.</span></h3><p>留言统一保存在 GitHub。登录 GitHub 后就能参与讨论，其他读者也能看到你的回复。</p>${number?`<a href="${repositoryUrl}/issues/${number}#issuecomment-new" target="_blank" rel="noopener noreferrer">查看评论 / 写下想法 ↗</a>`:''}</div>`;return;}
  const list=state.comments.filter(c=>c.postId===currentPost&&!c.deletedAt).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  $('#comments').innerHTML=`<div class="comments-heading"><h3>留下你的想法<span class="red-dot">.</span></h3><span>${list.length} 条本地留言</span></div><p class="local-note">留言保存在当前浏览器，仅你在这台设备上可见。</p>${list.map(c=>`<div class="comment ${c.parentId?'comment-reply':''}"><div class="comment-avatar">${esc(c.name.slice(0,1))}</div><div><strong>${esc(c.name)}</strong><time>${dateTime(c.createdAt)}</time>${c.parentId?`<small class="reply-context">回复 ${esc(list.find(x=>x.id===c.parentId)?.name||'已删除的留言')}</small>`:''}<p>${esc(c.body).replaceAll('\n','<br>')}</p><button data-reply="${c.id}">回复</button><button data-delete-comment="${c.id}">移入回收站</button></div></div>`).join('')||'<div class="comment-empty">还没有留言，写下第一个想法吧。</div>'}<div id="reply-context"></div><form id="comment-form"><label>你的称呼<input name="name" required maxlength="40" placeholder="怎么称呼你？" autocomplete="nickname"></label><label>你的想法<textarea name="body" required maxlength="2000" rows="4" placeholder="说说你的想法……"></textarea></label><div class="form-end"><span>支持换行 · 最多 2000 字</span><button type="submit" class="primary-button">保存本地留言 ↗</button></div></form>`;
  $('#comment-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim(),body=f.get('body').trim();if(!name||!body){toast('请填写称呼和留言内容');return;}if(state.comments.length>=5000){toast('已达到 5000 条本地留言上限，请先导出备份');return;}if(commit(s=>s.comments.push({id:uid(),postId:currentPost,name,body,parentId:replyTo,createdAt:new Date().toISOString(),deletedAt:null}))){replyTo=null;renderComments();toast('留言已保存在当前浏览器');}});
}
function showSearch(){showDialog(`<span class="section-number">FIND A THOUGHT</span><h2 id="dialog-title">寻找一个好想法<span class="red-dot">.</span></h2><form id="search-form"><div class="search-field">${searchIcon}<input aria-label="搜索标题或文章内容" id="search-input" type="search" maxlength="200" value="${esc(filters.query)}" placeholder="标题、正文、标签……" autofocus><button type="submit" aria-label="提交搜索">↗</button></div><div class="search-date-range"><label>开始日期<input name="from" type="date" value="${esc(filters.from)}"></label><label>结束日期<input name="to" type="date" value="${esc(filters.to)}"></label></div><p class="form-error" id="search-error" role="alert"></p><button class="primary-button" type="submit">搜索文章 ↗</button></form><div class="search-topics"><span>最近搜索</span>${state.searchHistory.map(q=>`<button data-query="${esc(q)}">${esc(q)} ↗</button>`).join('')||'<span>还没有搜索记录</span>'}</div><div class="search-topics"><span>探索标签</span>${[...new Set(visiblePosts(state).flatMap(p=>p.tags))].slice(0,6).map(t=>`<button data-tag="${esc(t)}"># ${esc(t)}</button>`).join('')}</div>`, 'search-dialog');
  $('#search-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),from=f.get('from'),to=f.get('to');if(from&&to&&from>to){$('#search-error').textContent='开始日期不能晚于结束日期';return;}runSearch($('#search-input').value,from,to);});}
function runSearch(query,from='',to=''){filters={...filters,query:query.trim(),category:'',tag:'',saved:false,from,to};page=1;if(filters.query)commit(s=>{s.searchHistory=[filters.query,...s.searchHistory.filter(q=>q!==filters.query)].slice(0,8);});closeDialog();$('#inline-query').value=filters.query;render();$('#journal').scrollIntoView({behavior:'smooth'});}
function showTags(){const tags=[...new Set(visiblePosts(state).flatMap(p=>p.tags))];showDialog(`<span class="section-number">FOLLOW YOUR CURIOSITY</span><h2 id="dialog-title">想法的索引<span class="red-dot">.</span></h2><p class="reader-subtitle">点击标签，沿着一个想法继续探索。</p><div class="tag-cloud">${tags.map(t=>`<button data-tag="${esc(t)}"><span># ${esc(t)}</span><sup>${visiblePosts(state).filter(p=>p.tags.includes(t)).length}</sup></button>`).join('')}</div>`,'tags-dialog');}
function showArchive(){const posts=visiblePosts(state).sort((a,b)=>Date.parse(b.publishAt)-Date.parse(a.publishAt)),months=[...new Set(posts.map(p=>localDate(Date.parse(p.publishAt)).slice(0,7)))];showDialog(`<span class="section-number">A COLLECTION OF THOUGHTS</span><h2 id="dialog-title">时间的切片<span class="red-dot">.</span></h2><p class="reader-subtitle">${posts.length} 篇记录 · ${months.length} 个月份</p>${months.map(m=>`<section class="archive-month"><h3>${m.replace('.',' / ')}<span>${posts.filter(p=>localDate(Date.parse(p.publishAt)).startsWith(m)).length} 篇</span></h3>${posts.filter(p=>localDate(Date.parse(p.publishAt)).startsWith(m)).map(p=>`<button data-post="${p.id}"><time>${localDate(Date.parse(p.publishAt)).slice(8)}</time><span>${esc(p.title)}<small>${esc(p.category)} · ${readingMinutes(p.markdown)} 分钟阅读</small></span><b>↗</b></button>`).join('')}</section>`).join('')||'<p>还没有已发布文章</p>'}`,'archive-dialog');}
function showAbout(){showDialog(`<span class="section-number">A PERSON, IN PROGRESS</span><h2 id="dialog-title">很高兴，在这里遇见你<span class="red-dot">。</span></h2><div class="about-modal-mark" aria-hidden="true">${esc(state.author.name)}</div><h3>我是${esc(state.author.name)}</h3><p class="reader-subtitle">${esc(state.author.role)}</p><div class="reader-body"><p>${esc(state.author.bio).replaceAll('\n','<br>')}</p><blockquote>保持观察，保持思考，<br>也给偶然留一点位置。</blockquote>${state.site.email?`<p>欢迎来信：<a href="mailto:${esc(state.site.email)}">${esc(state.site.email)}</a></p>`:''}</div><div class="about-stats"><span><b>${visiblePosts(state).length}</b> 篇文章</span><span><b>${new Set(visiblePosts(state).flatMap(p=>p.tags)).size}</b> 个话题</span><span><b>${visiblePosts(state).reduce((n,p)=>n+p.markdown.length,0).toLocaleString()}</b> 字符记录</span></div>`,'about-dialog');}
function showLibrary(tab='saved'){
  const published=visiblePosts(state),ids=tab==='saved'?state.saved:tab==='likes'?state.likes:tab==='read'?state.read:state.history.map(h=>h.id);
  const posts=ids.map(id=>published.find(p=>p.id===id)).filter(Boolean);
  showDialog(`<span class="section-number">YOUR PERSONAL READING SPACE</span><h2 id="dialog-title">我的阅读空间<span class="red-dot">.</span></h2><p class="local-note">收藏、喜欢、已读与历史保存在当前浏览器。</p><div class="library-tabs">${[['saved','收藏'],['likes','喜欢'],['history','最近阅读'],['read','已读文章']].map(([id,name])=>`<button data-library="${id}" class="${tab===id?'active':''}">${name}</button>`).join('')}</div><div class="library-list">${posts.map(p=>`<div><button class="library-post" data-post="${p.id}"><small>${esc(p.category)} · ${readingMinutes(p.markdown)} 分钟</small><strong>${esc(p.title)}</strong>${tab==='history'?`<small>${dateTime(state.history.find(h=>h.id===p.id).at)}</small>`:''}</button>${tab==='saved'?`<button data-library-remove="${p.id}" aria-label="从清单移除：${esc(p.title)}">×</button>`:''}</div>`).join('')||'<div class="empty-state"><h3>这里还很安静</h3><p>读一篇文章，慢慢建立自己的阅读清单。</p><button class="text-button" data-action="close">去发现文章 ↗</button></div>'}</div>`,'library-dialog');
}
function rss(){const base=location.origin+location.pathname;download('goucheng-feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(state.site.title)}</title><link>${esc(base)}</link><description>${esc(state.site.description)}</description><language>zh-CN</language>${visiblePosts(state).map(p=>`<item><title>${esc(p.title)}</title><link>${esc(articleUrl(p))}</link><guid>${esc(articleUrl(p))}</guid><description>${esc(p.intro)}</description><pubDate>${new Date(p.publishAt).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`,'application/rss+xml;charset=utf-8');toast('RSS 快照已下载，可导入支持文件的阅读器');}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('链接已复制');}catch{showDialog(`<h2 id="dialog-title">复制链接</h2><input class="share-input" aria-label="分享链接" readonly value="${esc(value)}">`);$('.share-input').select();}}
function printPost(){if(!currentPost)return;document.body.classList.add('printing-post');window.print();}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-post'));
const studio=createStudio({getState:()=>state,commit,replaceState,showDialog,closeDialog,toast,mount,render,markdown,cover,download,esc,getMode:()=>modalMode});
function showHelp(){showDialog(`<span class="section-number">MADE TO BE USED</span><h2 id="dialog-title">把博客用起来<span class="red-dot">.</span></h2><div class="help-grid"><section><h3>阅读与发现</h3><p>全文搜索支持日期区间，分类、标签、收藏与未读可组合筛选。支持四种排序、网格与列表、分页、随机阅读。</p><p>文章内有目录、字号调节、夜间模式、阅读进度、喜欢、收藏、已读、相关推荐、Markdown 下载及打印 PDF。</p></section><section><h3>写作与管理</h3><p>打开「创作中心」新建或编辑文章。Markdown 实时预览，支持封面图片、标签、置顶、草稿及定时发布。编辑缓冲区自动保存；点击保存后才会修改文章。</p><p>文章和评论可移入回收站并恢复。可自定义作者资料与站点信息，导出 JSON 全量备份，再合并导入。</p></section><section><h3>存储与发布</h3><p>这是本地优先版本，所有修改、留言与阅读统计存于当前浏览器。请定期导出备份。清除浏览器数据或更换设备不会保留这些内容。</p><p>创作中心没有账号权限体系；本地修改不会影响其他访客。定时发布在浏览器打开后按设定时间显示，日期使用北京时间。</p></section><section><h3>快捷键</h3><p><kbd>/</kbd> 搜索文章<br><kbd>Esc</kbd> 关闭弹窗<br><kbd>Ctrl / ⌘ + S</kbd> 在编辑器保存文章</p><p>RSS 提供当前内容的 XML 文件快照。跨设备同步、公开评论和邮件订阅需要接入服务端。</p></section></div><button class="primary-button" data-action="studio">打开创作中心 ↗</button>`,'help-dialog');}

const documentPublisher=createDocumentPublisher({showDialog,toast,esc,download,getMode:()=>modalMode});
function showPublicAuthor(){showDialog(`<span class="section-number">WRITE ONCE, READ EVERYWHERE</span><h2 id="dialog-title">写下来，让更多人看见<span class="red-dot">.</span></h2><p class="reader-subtitle">文章统一保存在你的 GitHub 仓库。发布后，所有访客读取同一份内容。</p><ol class="publish-guide"><li>点击「发表新文章」，登录 <strong>NagasakiSaki</strong> 的 GitHub 账号。</li><li>填写标题与 Markdown 正文，可修改顶部的分类、标签和简介。</li><li>点击 GitHub 的 <strong>Create / Submit new issue</strong> 公开发表，再回到博客点击「刷新文章」。</li><li>修改已发表的 Issue 会更新文章；关闭 Issue 会将文章从博客下架。</li></ol><p class="local-note">只有仓库所有者创建且带 article 标签的开放文章会出现在博客。GitHub 中提交的正文是公开内容，请把私人草稿保留在本地。</p><div class="publication-actions"><button class="primary-button" data-action="document-publish">上传文档发表 ↥</button><a class="secondary-button" href="${newArticleUrl}" target="_blank" rel="noopener noreferrer">发表新文章 ↗</a><a class="secondary-button" href="${repositoryUrl}/issues?q=is%3Aissue+author%3ANagasakiSaki+label%3Aarticle" target="_blank" rel="noopener noreferrer">管理已发表文章 ↗</a></div><p class="local-note">修改作者资料：<a class="publication-source" href="${repositoryUrl}/edit/main/public/site.json" target="_blank" rel="noopener noreferrer">编辑站点介绍 ↗</a>。保存到 main 后刷新博客即可读取。</p>`, 'public-author-dialog');}

let publicUpdateMessage='正在连接公开文章源……',publicUpdateError=false;
function publicStatus(){const label=$('#public-update-status');if(label){label.textContent=publicUpdateMessage;label.parentElement.classList.toggle('is-error',publicUpdateError);}}
async function refreshPublic(force=false){if(!PUBLIC_MODE)return;try{const published=await fetchPublication({force});if(!published)return;const before=JSON.stringify({posts:state.posts,site:state.site,author:state.author});state=applyPublication(state,published);publicUpdateMessage='公开文章已更新 · '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'}).format(new Date());publicUpdateError=false;if(before!==JSON.stringify({posts:state.posts,site:state.site,author:state.author})){mount();if(currentPost){const id=currentPost;openPost(id,{route:false,count:false});}}publicStatus();if(force)toast('已读取最新公开文章');}catch(error){publicUpdateMessage=error.message+' 当前显示上次成功获取的内容。';publicUpdateError=true;publicStatus();if(force)toast(publicUpdateMessage);}}

document.addEventListener('click',async e=>{
  const b=e.target.closest('button,a');if(!b)return;
  if(b.dataset.post){openPost(b.dataset.post);return;}
  if(b.dataset.category!==undefined){filters.category=b.dataset.category;page=1;if(dialog.open)closeDialog();render();$('#journal').scrollIntoView({behavior:'smooth'});return;}
  if(b.dataset.tag){filters.tag=b.dataset.tag;page=1;if(dialog.open)closeDialog();render();$('#journal').scrollIntoView({behavior:'smooth'});return;}
  if(b.dataset.page){page=Number(b.dataset.page);render();$('#journal').scrollIntoView({behavior:'smooth'});return;}
  if(b.dataset.query){runSearch(b.dataset.query);return;}
  if(b.dataset.library){showLibrary(b.dataset.library);return;}
  if(b.dataset.libraryRemove){if(commit(s=>s.saved=s.saved.filter(id=>id!==b.dataset.libraryRemove))){render();showLibrary();}return;}
  if(b.dataset.save){const id=b.dataset.save,exists=state.saved.includes(id);if(commit(s=>s.saved=exists?s.saved.filter(v=>v!==id):[...s.saved,id])){render();if(currentPost){b.textContent=exists?'☆ 收藏':'★ 已收藏';}toast(exists?'已移出收藏':'已加入收藏');}return;}
  if(b.dataset.like){const id=b.dataset.like,exists=state.likes.includes(id);if(commit(s=>s.likes=exists?s.likes.filter(v=>v!==id):[...s.likes,id])){b.textContent=exists?'♡ 喜欢':'♥ 已喜欢';b.setAttribute('aria-pressed',String(!exists));}return;}
  if(b.dataset.read){const id=b.dataset.read,exists=state.read.includes(id);if(commit(s=>s.read=exists?s.read.filter(v=>v!==id):[...s.read,id])){b.textContent=exists?'标为已读':'✓ 已读（撤销）';render();}return;}
  if(b.dataset.heading){$('#'+b.dataset.heading)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(b.dataset.reply){replyTo=b.dataset.reply;$('#reply-context').innerHTML=`<div class="reply-context">回复 ${esc(state.comments.find(c=>c.id===replyTo)?.name)} <button data-action="cancel-reply">取消 ×</button></div>`;$('#comment-form textarea').focus();return;}
  if(b.dataset.deleteComment){if(commit(s=>s.comments.find(c=>c.id===b.dataset.deleteComment).deletedAt=new Date().toISOString())){replyTo=null;renderComments();toast('留言已移入回收站，可在创作中心恢复');}return;}
  const a=b.dataset.action;
  if(a==='close'){preserveEditor();closeDialog();}
  if(a==='search')showSearch();if(a==='archive')showArchive();if(a==='about')showAbout();if(a==='library')showLibrary();if(a==='tags')showTags();if(a==='help'){PUBLIC_MODE?showPublicAuthor():showHelp();}
  if(a==='document-publish')documentPublisher.show();if(a==='public-author')showPublicAuthor();if(a==='refresh-public')refreshPublic(true);
  if(a==='studio')askLeaveEditor(()=>studio.show());
  if(a==='theme'){if(commit(s=>s.prefs.theme=document.documentElement.dataset.theme==='dark'?'paper':'dark'))theme();}
  if(a==='reader-smaller'||a==='reader-larger'){const sizes=[14,16,18,20],i=sizes.indexOf(state.prefs.fontSize);if(commit(s=>s.prefs.fontSize=sizes[Math.max(0,Math.min(3,i+(a==='reader-larger'?1:-1)))])){theme();$('#font-size-label').textContent=state.prefs.fontSize+'px';}}
  if(a==='layout'){if(commit(s=>s.prefs.layout=s.prefs.layout==='grid'?'list':'grid'))render();}
  if(a==='saved'){filters.saved=!filters.saved;page=1;render();}
  if(a==='reset')resetFilters();
  if(a==='clear-dates'){filters.from='';filters.to='';render();}
  if(a==='top')window.scrollTo({top:0,behavior:'smooth'});
  if(a==='copy-link')copy(location.origin+location.pathname);
  if(a==='share-post'&&currentPost)copy(articleUrl(state.posts.find(p=>p.id===currentPost)));
  if(a==='download-post'&&currentPost){const p=state.posts.find(p=>p.id===currentPost);download(p.title.replace(/[\\/:*?"<>|]/g,'-')+'.md',`# ${p.title}\n\n${p.subtitle||p.intro}\n\n${p.markdown}`,'text/markdown;charset=utf-8');}
  if(a==='print')printPost();
  if(a==='rss')rss();
  if(a==='random'){const posts=visiblePosts(state);if(posts.length)openPost(posts[Math.floor(Math.random()*posts.length)].id);else toast('发布第一篇文章后，就可以随机探索了');}
  if(a==='cancel-reply'){replyTo=null;$('#reply-context').innerHTML='';}
});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();showSearch();}if((e.ctrlKey||e.metaKey)&&e.key==='s'&&modalMode==='editor'){e.preventDefault();studio.saveEditor();}});
window.addEventListener('hashchange',route);
window.addEventListener('storage',e=>{if(e.key!==STORE_KEY)return;if(dialog.open){toast('另一个标签页更新了博客，关闭弹窗后会同步；编辑缓冲区会保留');return;}try{state=validateBackup(JSON.parse(e.newValue));storedSnapshot=e.newValue;mount();scheduleRefresh();toast('已同步当前浏览器其他标签页的更新');}catch{/* keep last valid state */}});
window.addEventListener('focus',()=>{render();scheduleRefresh();if(PUBLIC_MODE)refreshPublic();});
mount();scheduleRefresh();route();if(storageWarning)toast(storageWarning);
if(PUBLIC_MODE){refreshPublic();setInterval(()=>{if(!document.hidden)refreshPublic();},300000);}


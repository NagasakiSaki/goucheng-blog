import { posts as seeds, author } from './posts.js';

export const STORE_KEY = 'goucheng-studio-v2';
export const THEMES = ['paper', 'dark', 'system'];
export const ARTS = ['order', 'walk', 'less', 'type', 'paper', 'unfinished'];
export const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = () => crypto.randomUUID();
export const localDate = (time = Date.now()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(time).replaceAll('-', '.');
export const dateTime = time => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(time));
export const toMarkdown = p => p.markdown ?? p.sections?.map(([title,...body])=>`## ${title}\n\n${body.join('\n\n')}`).join('\n\n') ?? '';
export const readingMinutes = text => Math.max(1, Math.ceil((text.match(/[\u3400-\u9fff]/g)?.length || 0)/350+(text.match(/[a-zA-Z0-9]+/g)?.length || 0)/200));
const seedTags = [['构成主义','设计方法','秩序'],['城市漫游','散步','日常'],['注意力','取舍','成长'],['字体','排版','视觉设计'],['纸张','记忆','日常'],['成长','写作','自我探索']];
export function freshState() {
  return {version:2, site:{title:'构成',english:'GOUCHENG',tagline:'一个关于观察、思考与创造的地方',description:'在秩序与自由之间，寻找自己的表达。记录设计、生活，以及那些尚未成形的想法。',email:'',notice:'欢迎来到构成。这里的每一个想法，都在慢慢生长。'},author:{...author},
    posts:seeds.map((p,i)=>({...p, markdown:toMarkdown(p),tags:seedTags[i],status:'published',publishAt:p.date.replaceAll('.','-')+'T00:00:00+08:00',pinned:i===0,createdAt:p.date.replaceAll('.','-')+'T00:00:00+08:00',updatedAt:p.date.replaceAll('.','-')+'T00:00:00+08:00',deletedAt:null,cover:''})),
    saved:[],likes:[],read:[],history:[],views:{},comments:[],prefs:{theme:'paper',fontSize:16,layout:'grid',pageSize:6},searchHistory:[]};
}
export function isPublished(p, now = Date.now()) {return !p.deletedAt && p.status==='published' && new Date(p.publishAt).getTime()<=now;}
export function publicationStatus(p, now = Date.now()) {return p.deletedAt?'回收站':p.status==='draft'?'草稿':new Date(p.publishAt).getTime()>now?'待发布':'已发布';}
export function visiblePosts(state,now = Date.now()) {return state.posts.filter(p=>isPublished(p,now));}
export function filterPosts(state, f = {}, now = Date.now()) {
  const q=(f.query||'').trim().toLowerCase();
  return visiblePosts(state,now).filter(p=>(!f.category||p.category===f.category)&&(!f.tag||p.tags.includes(f.tag))&&(!f.saved||state.saved.includes(p.id))&&(!f.unread||!state.read.includes(p.id))&&(!f.from||localDate(Date.parse(p.publishAt)).replaceAll('.','-')>=f.from)&&(!f.to||localDate(Date.parse(p.publishAt)).replaceAll('.','-')<=f.to)&&(!q||`${p.title} ${p.intro} ${p.category} ${p.tags.join(' ')} ${p.markdown}`.toLowerCase().includes(q)))
    .sort((a,b)=>f.sort==='oldest'?new Date(a.publishAt)-new Date(b.publishAt):f.sort==='shortest'?readingMinutes(a.markdown)-readingMinutes(b.markdown):f.sort==='popular'?(state.views[b.id]||0)-(state.views[a.id]||0)||new Date(b.publishAt)-new Date(a.publishAt):Number(b.pinned)-Number(a.pinned)||new Date(b.publishAt)-new Date(a.publishAt));
}
export function safeUrl(value) {try {const u = new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function validCover(value) {return typeof value==='string'&&value.length<1500000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
export function validateBackup(raw) {
  if(!raw||raw.version!==2||!Array.isArray(raw.posts)||raw.posts.length>500) throw new Error('请选择构成博客导出的 v2 JSON 备份，最多支持 500 篇文章。');
  const text=(s,max=10000)=>typeof s==='string'?s.slice(0,max):'';
  const stringList=(v,max=30)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string').map(x=>x.slice(0,80)))].slice(0,max):[];
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
  const ids=new Set();
  const posts=raw.posts.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)||ids.has(p.id)||typeof p.title!=='string'||!p.title.trim()||!['draft','published'].includes(p.status)||typeof p.markdown!=='string'||p.markdown.length>200000||!date(p.publishAt)) throw new Error('备份包含无效文章、重复 ID、无效日期或过长正文，未导入任何数据。');
    ids.add(p.id);
    return {id:p.id,title:text(p.title,150),subtitle:text(p.subtitle,300),intro:text(p.intro,600),category:text(p.category,40)||'随笔',markdown:p.markdown,tags:stringList(p.tags,12),art:ARTS.includes(p.art)?p.art:'order',cover:validCover(p.cover),pinned:Boolean(p.pinned),status:p.status,publishAt:date(p.publishAt),createdAt:date(p.createdAt)||date(p.publishAt),updatedAt:date(p.updatedAt)||date(p.publishAt),deletedAt:date(p.deletedAt),date:localDate(Date.parse(p.publishAt))};
  });
  const commentIds = new Set();
  const comments=(Array.isArray(raw.comments)?raw.comments:[]).slice(0,5000).filter(c=>c&&typeof c.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)&&ids.has(c.postId)&&date(c.createdAt)&&typeof c.body==='string'&&c.body.trim()&&typeof c.name==='string'&&c.name.trim()).filter(c=>{if(commentIds.has(c.id))return false;commentIds.add(c.id);return true;}).map(c=>({id:c.id,postId:c.postId,name:text(c.name,40),body:text(c.body,2000),createdAt:date(c.createdAt),parentId:typeof c.parentId==='string'?c.parentId:null,deletedAt:date(c.deletedAt)}));
  comments.forEach(c=>{if(!comments.some(p=>p.id===c.parentId&&p.postId===c.postId&&p.id!==c.id)) c.parentId=null;});
  const defaults=freshState();
  return {...defaults,posts,comments,site:{title:text(raw.site?.title,30)||'构成',english:text(raw.site?.english,40)||'GOUCHENG',tagline:text(raw.site?.tagline,100),description:text(raw.site?.description,600),notice:text(raw.site?.notice,300),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.site?.email||'')?raw.site.email.slice(0,150):''},author:{name:text(raw.author?.name,40)||'博主',role:text(raw.author?.role,150),bio:text(raw.author?.bio,3000)},saved:stringList(raw.saved,500).filter(id=>ids.has(id)),likes:stringList(raw.likes,500).filter(id=>ids.has(id)),read:stringList(raw.read,500).filter(id=>ids.has(id)),history:(Array.isArray(raw.history)?raw.history:[]).filter(h=>ids.has(h?.id)&&date(h.at)).slice(0,100).map(h=>({id:h.id,at:date(h.at)})),views:Object.fromEntries(posts.map(p=>[p.id,Math.min(1000000,Math.max(0,Math.floor(Number(raw.views?.[p.id])||0)))])),prefs:{theme:THEMES.includes(raw.prefs?.theme)?raw.prefs.theme:'paper',fontSize:[14,16,18,20].includes(raw.prefs?.fontSize)?raw.prefs.fontSize:16,layout:raw.prefs?.layout==='list'?'list':'grid',pageSize:[3,6,9,12].includes(raw.prefs?.pageSize)?raw.prefs.pageSize:6},searchHistory:stringList(raw.searchHistory,8)};
}
export function mergeBackup(current, incoming, applyProfile=false) {
  const existing = new Set(current.posts.map(p=>p.id));
  const comments = new Set(current.comments.map(c=>c.id));
  const merged=structuredClone(current);
  merged.posts.push(...incoming.posts.filter(p=>!existing.has(p.id)));
  if(merged.posts.length>500) throw new Error('合并后超过 500 篇文章，请先整理备份。');
  merged.comments.push(...incoming.comments.filter(c=>!comments.has(c.id)));
  if(merged.comments.length>5000) throw new Error('合并后超过 5000 条留言，请先整理备份。');
  for(const key of ['saved','read','likes']) merged[key]=[...new Set([...merged[key],...incoming[key]])];
  if(applyProfile) {merged.site=incoming.site;merged.author=incoming.author;}
  return merged;
}

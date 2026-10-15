import { freshState, localDate, readingMinutes } from './model.js';

export const PUBLICATION = Object.freeze({owner:'NagasakiSaki',repo:'goucheng-blog',label:'article'});
export const repositoryUrl = `https://github.com/${PUBLICATION.owner}/${PUBLICATION.repo}`;
export const newArticleUrl = `${repositoryUrl}/issues/new?template=article.md`;

export function parseArticle(issue, owner=PUBLICATION.owner) {
  if (!issue || issue.pull_request || issue.state!=='open' || issue.user?.login?.toLowerCase()!==owner.toLowerCase() || !issue.labels?.some(l=>(typeof l==='string'?l:l.name)==='article') || !Number.isSafeInteger(issue.number)) return null;
  const source = typeof issue.body==='string'?issue.body:'';
  const meta={};let markdown=source.replace(/^<!--\s*goucheng:article\s*-->\s*/,'');
  const header=markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if(header){for(const line of header[1].split(/\r?\n/)){const match=line.match(/^([a-zA-Z]+):\s*(.*)$/);if(match)meta[match[1]]=match[2].trim().replace(/^["']|["']$/g,'');}markdown=markdown.slice(header[0].length).trim();}
  if(!issue.title?.trim()||!markdown.trim())return null;
  const created=Date.parse(issue.created_at),updated=Date.parse(issue.updated_at);
  if(!Number.isFinite(created)||!Number.isFinite(updated))return null;
  const plain=markdown.replace(/<[^>]*>/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`>_~|\-]/g,'').replace(/\s+/g,' ').trim();
  const arts=['order','walk','less','type','paper','unfinished'];
  return {id:`issue-${issue.number}`,issueNumber:issue.number,sourceUrl:`${repositoryUrl}/issues/${issue.number}`,title:issue.title.trim().slice(0,150),category:(meta.category||'随笔').slice(0,40),tags:[...new Set((meta.tags||'').split(/[,，]/).map(t=>t.trim().slice(0,80)).filter(Boolean))].slice(0,12),intro:(meta.summary||plain).slice(0,260),subtitle:(meta.subtitle||'').slice(0,300),markdown:markdown.slice(0,200000),status:'published',pinned:meta.pinned==='true',art:arts.includes(meta.art)?meta.art:'order',cover:'',publishAt:new Date(created).toISOString(),createdAt:new Date(created).toISOString(),updatedAt:new Date(updated).toISOString(),deletedAt:null,date:localDate(created),minutes:readingMinutes(markdown)};
}

export function buildPublication(issues,config) {
  const defaults=freshState();
  return {version:2,site:{...defaults.site,...config.site},author:{...defaults.author,...config.author},posts:issues.map(i=>parseArticle(i)).filter(Boolean).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.publishAt)-Date.parse(a.publishAt))};
}

export function applyPublication(personal,published) {
  return {...personal,site:structuredClone(published.site),author:structuredClone(published.author),posts:structuredClone(published.posts)};
}

export function issueDraftUrl(post) {
  const metadata=`<!-- goucheng:article -->\n---\ncategory: ${post.category.replaceAll('\n',' ')}\ntags: ${post.tags.join(', ')}\nsummary: ${post.intro.replaceAll('\n',' ')}\nart: ${post.art}\npinned: ${Boolean(post.pinned)}\n---\n\n${post.markdown}`;
  const url=new URL(`${repositoryUrl}/issues/new`);url.searchParams.set('labels','article');url.searchParams.set('title',post.title);url.searchParams.set('body',metadata);return url.href;
}

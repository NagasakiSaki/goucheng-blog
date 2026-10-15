import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,applyPublication,buildPublication,issueDraftUrl} from '../src/publication.js';
import {freshState} from '../src/model.js';

const issue={number:12,state:'open',title:'一篇公开文章',body:'<!-- goucheng:article -->\n---\ncategory: 生活\ntags: 随笔, 写作, 随笔\nsummary: 一句话摘要\nart: walk\npinned: true\n---\n\n## 正文\n\n更新后的内容。',labels:[{name:'article'}],user:{login:'NagasakiSaki'},created_at:'2026-10-15T00:00:00Z',updated_at:'2026-10-15T01:00:00Z'};
test('public articles require the owner, an open issue and the article label',()=>{
  assert.ok(parseArticle(issue));
  for(const mutation of [{user:{login:'someone-else'}},{state:'closed'},{labels:[]},{pull_request:{}},{number:'12'}])assert.equal(parseArticle({...issue,...mutation}),null);
});
test('public metadata is parsed and duplicate tags are removed',()=>{
  const p=parseArticle(issue);assert.equal(p.id,'issue-12');assert.equal(p.category,'生活');assert.deepEqual(p.tags,['随笔','写作']);assert.equal(p.intro,'一句话摘要');assert.equal(p.pinned,true);assert.equal(p.art,'walk');assert.equal(p.markdown,'## 正文\n\n更新后的内容。');
});
test('article edits and closure are reflected from the shared source',()=>{
  assert.match(parseArticle({...issue,body:'最新的一版正文'}).markdown,/最新的一版/);
  assert.equal(buildPublication([{...issue,state:'closed'}],{site:{},author:{}}).posts.length,0);
});
test('private local drafts cannot replace the public article list',()=>{
  const local=freshState();local.posts[0].title='这是一份私密草稿';local.posts[0].status='draft';local.saved=['issue-12'];local.prefs.theme='dark';
  const remote=buildPublication([issue],{site:{title:'公开博客'},author:{name:'作者'}});const result=applyPublication(local,remote);
  assert.equal(result.posts.length,1);assert.equal(result.posts[0].title,'一篇公开文章');assert.equal(result.site.title,'公开博客');assert.equal(result.prefs.theme,'dark');assert.deepEqual(result.saved,['issue-12']);
});
test('new readers receive the same public content regardless of local data',()=>{
  const remote=buildPublication([issue],{site:{},author:{}}),a=freshState(),b=freshState();b.posts=[];
  assert.deepEqual(applyPublication(a,remote).posts,applyPublication(b,remote).posts);
});
test('empty or invalid public issues are excluded and fallback metadata is bounded',()=>{
  assert.equal(parseArticle({...issue,body:' '}),null);assert.equal(parseArticle({...issue,updated_at:'invalid'}),null);
  const p=parseArticle({...issue,body:'---\nart: malicious\n---\n\n普通正文'});assert.equal(p.art,'order');assert.equal(p.intro,'普通正文');
});
test('draft publication URL encodes markdown and cannot inject URL parameters',()=>{
  const p=parseArticle(issue);p.title='文章 & labels=bad';const u=new URL(issueDraftUrl(p));assert.equal(u.searchParams.get('title'),p.title);assert.equal(u.searchParams.get('labels'),'article');assert.match(u.searchParams.get('body'),/更新后的内容/);
});

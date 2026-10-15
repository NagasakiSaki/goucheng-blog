import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,visiblePosts,filterPosts,validateBackup,mergeBackup,isPublished,publicationStatus,escapeHTML,readingMinutes,localDate,validCover} from '../src/model.js';

const now = Date.parse('2026-10-15T12:00:00+08:00');
test('draft, future and trashed articles are hidden, at the scheduled instant they become visible',()=>{
  const s=freshState(),base=s.posts[0];
  assert.equal(isPublished({...base,status:'draft'},now),false);
  assert.equal(isPublished({...base,deletedAt:new Date(now).toISOString()},now),false);
  assert.equal(isPublished({...base,publishAt:new Date(now+1).toISOString()},now),false);
  assert.equal(isPublished({...base,publishAt:new Date(now).toISOString()},now),true);
  assert.equal(publicationStatus({...base,publishAt:new Date(now+1).toISOString()},now),'待发布');
});
test('combined filters are intersected and unread excludes read articles',()=>{
  const s=freshState();s.saved=['order-in-chaos','walk-without-destination'];
  assert.deepEqual(filterPosts(s,{saved:true,category:'设计思考',tag:'秩序',query:'海报'},now).map(p=>p.id),['order-in-chaos']);
  s.read=['order-in-chaos'];assert.equal(filterPosts(s,{saved:true,category:'设计思考',unread:true},now).length,0);
  assert.equal(filterPosts(s,{query:'不会匹配的xyz'},now).length,0);
});
test('date range uses Beijing date, including after a backup normalizes dates to UTC',()=>{
  const s=validateBackup(freshState());
  assert.equal(s.posts[0].publishAt,'2026-10-11T16:00:00.000Z');
  assert.deepEqual(filterPosts(s,{from:'2026-10-12',to:'2026-10-12'},now).map(p=>p.id),['order-in-chaos']);
  assert.equal(localDate(Date.parse('2026-10-11T16:00:00Z')),'2026.10.12');
});
test('sort applies oldest, popularity and estimated reading time',()=>{
  const s=freshState();s.views['type-has-a-voice']=12;
  assert.equal(filterPosts(s,{sort:'oldest'},now)[0].id,'unfinished-is-okay');
  assert.equal(filterPosts(s,{sort:'popular'},now)[0].id,'type-has-a-voice');
  const list=filterPosts(s,{sort:'shortest'},now);assert.ok(list.every((p,i)=>i===0||readingMinutes(p.markdown)>=readingMinutes(list[i-1].markdown)));
});
test('a valid complete backup roundtrips published, drafts, trash and reading records',()=>{
  const s=freshState();s.posts[0].status='draft';s.posts[1].deletedAt=new Date(now).toISOString();s.saved=[s.posts[2].id];s.likes=[s.posts[2].id];s.read=[s.posts[2].id];s.history=[{id:s.posts[2].id,at:new Date(now).toISOString()}];s.views[s.posts[2].id]=3;
  const result=validateBackup(JSON.parse(JSON.stringify(s)));
  assert.equal(result.posts.length,6);assert.equal(visiblePosts(result,now).length,4);assert.deepEqual(result.saved,s.saved);assert.deepEqual(result.history,s.history);assert.equal(result.views[s.posts[2].id],3);
});
test('malformed backups are rejected atomically',()=>{
  assert.throws(()=>validateBackup({version:1,posts:[]}));
  for(const mutate of [s=>s.posts.push({...s.posts[0]}),s=>s.posts[0].id='bad\"id',s=>s.posts[0].publishAt='bad',s=>s.posts[0].markdown='a'.repeat(200001),s=>s.posts[0].status='unknown',s=>s.posts[0].title=' ']){
    const s=freshState();mutate(s);assert.throws(()=>validateBackup(s));
  }
});
test('backup import drops dangling references and clamps views and invalid preferences',()=>{
  const s=freshState();s.saved=['not-a-post'];s.views[s.posts[0].id]=-100;s.prefs={fontSize:500,theme:'bad'};s.comments=[{id:'c1',postId:s.posts[0].id,parentId:'missing',name:'朋友',body:'你好',createdAt:new Date(now).toISOString()},{id:'c2',postId:'missing',name:'朋友',body:'丢弃',createdAt:new Date(now).toISOString()}];
  const result=validateBackup(s);assert.deepEqual(result.saved,[]);assert.equal(result.views[s.posts[0].id],0);assert.equal(result.prefs.fontSize,16);assert.equal(result.comments.length,1);assert.equal(result.comments[0].parentId,null);
});
test('merge preserves current same-ID articles and adds new articles only once',()=>{
  const a=freshState(),b=freshState();b.posts[0].title='备份中的旧标题';b.posts.push({...b.posts[0],id:'new-id',title:'新的想法'});b.author.name='另一个作者';
  const first=mergeBackup(a,b);assert.equal(first.posts.length,7);assert.equal(first.posts[0].title,a.posts[0].title);assert.equal(first.author.name,a.author.name);assert.equal(mergeBackup(first,b).posts.length,7);assert.equal(mergeBackup(a,b,true).author.name,b.author.name);
});
test('merging respects the same post limit as backup validation',()=>{
  const a=freshState(),b=freshState();a.posts=Array.from({length:500},(_,i)=>({...a.posts[0],id:'post-'+i}));assert.throws(()=>mergeBackup(a,b));assert.equal(a.posts.length,500);
});
test('plain text HTML is escaped and SVG/remote data cannot be used as inline covers',()=>{
  assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(validCover('data:image/svg+xml;base64,AAAA'),'');assert.equal(validCover('javascript:alert(1)'),'');assert.equal(validCover('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
});

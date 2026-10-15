import test from 'node:test';
import assert from 'node:assert/strict';
import {documentType,titleFromFilename,decodeDocumentText,importedDraft,validateImportedDraft,checkDocxArchive,normalizeImportedText,MAX_DOCUMENT_BYTES} from '../src/document-model.js';
import {issueDraftUrl} from '../src/publication.js';

test('import accepts supported formats case-insensitively, rejects old Word, empty and oversized files',()=>{
  for(const ext of ['DOCX','pdf','MD','markdown','txt'])assert.equal(documentType({name:'文档.'+ext,size:100}),ext.toLowerCase());
  assert.throws(()=>documentType({name:'test.doc',size:100}),/另存为/);assert.throws(()=>documentType({name:'x.exe',size:1}));assert.throws(()=>documentType({name:'x.txt',size:0}));assert.throws(()=>documentType({name:'x.pdf',size:MAX_DOCUMENT_BYTES+1}));
});
test('UTF-8, UTF-16 and legacy Chinese text are decoded without silent mojibake',()=>{
  assert.equal(decodeDocumentText(new TextEncoder().encode('你好，文字')).text,'你好，文字');
  assert.equal(decodeDocumentText(Uint8Array.from([0xff,0xfe,0x60,0x4f,0x7d,0x59])).text,'你好');
  assert.equal(decodeDocumentText(Uint8Array.from([0xc4,0xe3,0xba,0xc3])).text,'你好');
});
test('imported content preserves non-title markdown, recognizes metadata and avoids duplicate page title',()=>{
  const d=importedDraft('文件.md','---\ntitle: 我的文章\ncategory: 设计\ntags: 字体, 排版\nsummary: 一句话介绍\n---\n\n# 我的文章\n\n## 正文\n\n保留 **粗体** 和 [链接](https://example.com)。');
  assert.equal(d.title,'我的文章');assert.equal(d.category,'设计');assert.deepEqual(d.tags,['字体','排版']);assert.equal(d.intro,'一句话介绍');assert.equal(d.markdown,'## 正文\n\n保留 **粗体** 和 [链接](https://example.com)。');
});
test('filename is a fallback title and imported text is normalized, never silently truncated',()=>{
  assert.equal(titleFromFilename('我的_第一篇-文章.docx'),'我的 第一篇 文章');assert.equal(importedDraft('记录.txt','\uFEFF这是正文\r\n第二行').markdown,'这是正文\n第二行');
  assert.throws(()=>normalizeImportedText('x'.repeat(200001)),/拆分/);assert.throws(()=>importedDraft('empty.md','# 只有标题'),/没有正文/);
});
test('publication rejects empty fields, oversized bodies and embedded data images',()=>{
  const d=importedDraft('a.md','正文内容');assert.equal(validateImportedDraft(d),'');assert.match(validateImportedDraft({...d,title:' '}),/标题/);assert.match(validateImportedDraft({...d,markdown:'x'.repeat(60001)}),/60,000/);assert.match(validateImportedDraft({...d,markdown:'![图](data:image/png;base64,AAAA)'}),/内嵌图片/);
});
test('publication handoff preserves the entire long document with its article metadata',()=>{
  const d=importedDraft('长文章.md','长文'.repeat(2000));d.category='写作';const u=new URL(issueDraftUrl(d)),body=u.searchParams.get('body');assert.ok(u.href.length>7000);assert.ok(body.endsWith(d.markdown));assert.match(body,/category: 写作/);assert.equal(u.searchParams.get('labels'),'article');
});
function zipMetadata({uncompressed=100,encrypted=false,count=1}={}){
  const b=new ArrayBuffer(98),v=new DataView(b);v.setUint32(0,0x04034b50,true);v.setUint32(30,0x02014b50,true);v.setUint16(38,encrypted?1:0,true);v.setUint32(54,uncompressed,true);v.setUint32(76,0x06054b50,true);v.setUint16(86,count,true);v.setUint32(92,30,true);return b;
}
test('DOCX archive validation prevents corrupt, encrypted and oversized ZIP expansion',()=>{
  assert.doesNotThrow(()=>checkDocxArchive(zipMetadata()));assert.throws(()=>checkDocxArchive(new ArrayBuffer(4)));assert.throws(()=>checkDocxArchive(zipMetadata({encrypted:true})),/加密/);assert.throws(()=>checkDocxArchive(zipMetadata({uncompressed:50*1024*1024})),/解压/);assert.throws(()=>checkDocxArchive(zipMetadata({count:2001})),/复杂/);
});

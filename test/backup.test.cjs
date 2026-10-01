const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {webcrypto,createHash} = require('node:crypto');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'src/backup.js'),'utf8');
// Every identifier/title/content below is synthetic; no account or novel data is used.
const BOOK = '9000000000000000001';
const TITLE = '合成测试作品';
const TEXT = '这是合成正文。数字 9000000000000000123 不应被改写。';
const HTML = '<p>'+TEXT+'</p>';
const PATHS = ['/api/author/volume/volume_list/v1','/api/author/chapter/chapter_list/v1','/api/author/edit_article/v0/'];

async function simulate(options={}) {
  const mixed=options.mixed;
  const rows=Array.from({length:mixed?127:167},(_,i)=>({
    item_id:String(9000000000000000100n+BigInt(i)),volume_id:mixed&&i>=65?'22':'11',index:i+1,
    title:`第${i+1}章 合成标题`,display_status:mixed?(i===122?5:i>122?10:1):1,
    article_status:1,word_number:TEXT.length,publish_time:mixed&&i>122?'0':'1700000000'
  }));
  if(options.unknownStatus) rows[0].display_status=99;
  if(options.ambiguous) rows[0].display_status=7;
  const blobs=new Map(),downloads=[],calls=[],attempts=new Map();let volumeReads=0;
  function element(tag='') {
    const node={tagName:tag.toUpperCase(),nodeType:1,style:{},childNodes:[],append(...items){this.childNodes.push(...items)},getAttribute(){return null},click(){if(this.download)downloads.push({name:this.download,blob:blobs.get(this.href)})}};
    if(tag==='template') Object.defineProperty(node,'innerHTML',{set(value){
      // Minimal DOM fixture for known <p> text fixtures; not an HTML parser test.
      assert.match(value,/^<p>[\s\S]*<\/p>$/);
      node.content={nodeType:11,childNodes:[{nodeType:1,tagName:'P',childNodes:[{nodeType:3,nodeValue:value.slice(3,-4)}]}]};
    }});
    return node;
  }
  class BlobURL extends URL {static createObjectURL(blob){const id='blob:local/'+blobs.size;blobs.set(id,blob);return id;}}
  const context={URL:BlobURL,Blob,TextEncoder,AbortSignal,crypto:webcrypto,setTimeout:fn=>{fn();return 1},console:{info(){},error(){}},window:{},
    location:{origin:options.wrongOrigin?'https://example.com':'https://fanqienovel.com',pathname:`/main/writer/chapter-manage/${BOOK}${options.noTitle?'':'&'+encodeURIComponent(TITLE)}`},
    document:{body:element('body'),createElement:element},performance:{getEntriesByType:()=>[]},
    fetch:async(url,config)=>{
      const u=new URL(url),p=u.searchParams;calls.push({path:u.pathname,params:p,config});
      assert.equal(u.origin,'https://fanqienovel.com');assert(PATHS.includes(u.pathname));
      assert.equal(config.method,'GET');assert.equal(config.credentials,'same-origin');assert.equal(config.mode,'same-origin');assert.equal(config.redirect,'error');
      assert.equal(p.get('book_id'),BOOK);
      let data;
      if(u.pathname===PATHS[0]) {
        volumeReads++;
        data={volume_list:[{volume_id:'11',volume_name:'合成第一卷',item_count:mixed?65:167},{volume_id:'22',volume_name:'合成第二卷',item_count:mixed?62:0}]};
        if(options.volumeChanged&&volumeReads>1)data.volume_list[0].item_count++;
      } else if(u.pathname===PATHS[1]) {
        // Real-world regression: no volume gives an empty list; status filters are ignored.
        assert(p.has('volume_id'),'every chapter-list request must specify a volume');
        assert.equal(p.get('status'),'0','filter locally from returned display_status');
        const filtered=rows.filter(row=>row.volume_id===p.get('volume_id'));
        const page=Number(p.get('page_index')),size=Number(p.get('page_count'));
        const offset=options.duplicate&&page===1?0:page*size;
        data={item_list:filtered.slice(offset,offset+size),total_count:filtered.length};
        if(options.earlyEmpty&&page===1)data.item_list=[];
        if(options.schema)data={unrecognized_list:[],total_count:167};
        if(options.listChanged&&volumeReads>1&&data.item_list.length)data.item_list=data.item_list.map((x,i)=>i===0?{...x,title:x.title+' changed'}:x);
      } else {
        const row=rows.find(x=>x.item_id===p.get('item_id'));assert(row);
        const attempt=(attempts.get(row.item_id)||0)+1;attempts.set(row.item_id,attempt);
        if(options.networkRetry&&row===rows[0]&&attempt<3)throw new Error('Synthetic network failure');
        const empty=(options.empty&&row===rows[10])||(options.bodyRetry&&row===rows[100]&&attempt===1);
        data={item_id:row.item_id,book_id:BOOK,title:row.title,content:empty?'<p></p>':HTML,column_data:{book_id:BOOK,book_name:TITLE}};
        if(options.wrongItem&&row===rows[0])data.item_id=rows[1].item_id;
      }
      // Simulate IDs serialized as JSON numbers instead of strings, without losing precision.
      const text=JSON.stringify({code:0,data}).replace(/"(900000000000000\d+)"/g,'$1');
      return {ok:true,status:200,text:async()=>text};
    }};
  const execution=vm.runInNewContext(source,context);
  if(options.wrongOrigin){await assert.rejects(execution,/章节管理/);assert.equal(calls.length,0);return;}
  await execution;
  const json=downloads.find(x=>x.name.endsWith('.json'));assert(json,'must provide report');
  const report=JSON.parse(await json.blob.text());
  return {report,downloads,calls,attempts,rows};
}

test('167 chapters, 12 pages, empty volume, ignored server status filters',async()=>{
  const {report,downloads,rows}=await simulate();
  assert.equal(report.complete,true);assert.equal(report.chapters.length,167);assert.equal(report.totals.backend_all_statuses,167);
  assert.equal(report.totals.backend_published_status_1,167);assert.equal(report.totals.backend_modifying_status_5,0);
  assert.equal(report.volumes[1].verified_list_count,0);assert(report.pages.some(x=>x.page_index===11&&x.count===2));
  assert.deepEqual(report.chapters.map(x=>x.item_id),rows.map(x=>x.item_id));
  assert.equal(report.chapters[166].order,167);assert.equal(report.chapters[0].content,TEXT);
  assert.equal(report.chapters[0].content_html_sha256,createHash('sha256').update(HTML).digest('hex'));
  const txt=await downloads.find(x=>x.name==='小说全文备份.txt').blob.text();
  assert.equal(txt.split(TEXT).length-1,167);assert(txt.indexOf(rows[0].title)<txt.indexOf(rows[166].title));
});
test('multiple volumes and mixed statuses use local status counts',async()=>{
  const {report}=await simulate({mixed:true});
  assert.equal(report.complete,true);assert.equal(report.chapters.length,123);assert.equal(report.excluded_chapters.length,4);
  assert.equal(report.chapters[122].volume_id,'22');assert.equal(report.totals.backend_modifying_status_5,1);
});
test('auto-detect book ID and recover title when absent from route',async()=>{
  const {report}=await simulate({noTitle:true});assert.equal(report.book_id,BOOK);assert.equal(report.book_title,TITLE);assert.equal(report.complete,true);
});
test('retry transient network requests',async()=>{
  const {report,attempts,rows}=await simulate({networkRetry:true});assert.equal(report.complete,true);assert.equal(attempts.get(rows[0].item_id),3);assert.equal(report.retries.length,2);
});
test('retry empty body in next chapter round',async()=>{
  const {report,attempts,rows}=await simulate({bodyRetry:true});assert.equal(report.complete,true);assert.equal(attempts.get(rows[100].item_id),2);
});
test('persistent empty body keeps 166 chapters and a failure record',async()=>{
  const {report,downloads}=await simulate({empty:true});assert.equal(report.complete,false);assert.equal(report.chapters.length,166);assert.equal(report.failed_chapters.length,1);assert.equal(report.failed_chapters[0].attempts,3);assert(!downloads.some(x=>x.name==='小说全文备份.txt'));
});
for(const [name,options] of [
  ['duplicate page',{duplicate:true}],['premature empty page',{earlyEmpty:true}],['unknown schema',{schema:true}],
  ['unknown status',{unknownStatus:true}],['ambiguous previously published state',{ambiguous:true}]
])test(name+' fails closed',async()=>{const {report,downloads}=await simulate(options);assert.equal(report.complete,false);assert(report.errors.length);assert(!downloads.some(x=>x.name==='小说全文备份.txt'));});
for(const [name,options] of [['volume changed',{volumeChanged:true}],['directory changed',{listChanged:true}]])
  test(name+' retains acquired bodies',async()=>{const {report}=await simulate(options);assert.equal(report.complete,false);assert.equal(report.chapters.length,167);});
test('mismatched chapter ID cannot become successful backup',async()=>{const {report}=await simulate({wrongItem:true});assert.equal(report.complete,false);assert.equal(report.failed_chapters.length,1);assert.equal(report.chapters.length,166);});
test('refuse non-Fanqie origin before any request',async()=>{await simulate({wrongOrigin:true});});
test('generated launcher embeds exactly the current source',()=>{
  const html=fs.readFileSync(path.join(root,'start.html'),'utf8');
  const text=html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1].replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');assert.equal(text,source);
});

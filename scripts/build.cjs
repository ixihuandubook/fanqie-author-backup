const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/backup.js'), 'utf8');
const escaped = source.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>番茄作者章节备份</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f4ee;color:#282922;font:17px/1.8 system-ui,sans-serif;padding:48px 24px}main{max-width:820px;margin:auto}h1{font-size:36px;line-height:1.3;margin:16px 0}section{padding:28px;background:#fff;border:1px solid #e3ddd0;border-radius:16px;margin:24px 0}button{background:#b54819;color:#fff;border:0;border-radius:9px;padding:14px 22px;font:inherit;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #538673;outline-offset:4px}a{color:#a64016}small{color:#666}code{background:#f4f0e8;padding:2px 6px}textarea{width:100%;height:320px;margin-top:16px;font:13px/1.5 monospace}#status{min-height:30px}li{margin:8px 0}
</style></head>
<body><main><small>FANQIE AUTHOR BACKUP · 1.0.0</small><h1>你的作品，留一份本地备份。</h1>
<p>在已登录的番茄作者后台读取自己作品的已发布章节。逐卷分页、核对完整性，导出 TXT 和 JSON。</p>
<p>觉得有用，欢迎 <a href="https://github.com/ixihuandubook/fanqie-author-backup" target="_blank" rel="noopener noreferrer">⭐ 到 GitHub 点一个 Star 收藏</a>，以后更容易找回来，也支持项目维护。收藏完全自愿，不影响使用。</p>
<section><h2>运行一次，自动读取</h2><ol><li>点击下面的按钮复制脚本。</li><li>切换到番茄作者后台，打开作品的<strong>章节管理</strong>页。</li><li>按 <code>Ctrl + Shift + J</code> 打开 Console（macOS：<code>⌘ + ⌥ + J</code>），粘贴并回车。</li><li>保持页面打开，等右上角面板完成核对，保存两个文件。</li></ol>
<button id="copy" type="button">复制只读备份脚本</button><p id="status" role="status" aria-live="polite"></p>
<p>完成后下载 <strong>小说全文备份.txt</strong> 与 <strong>小说章节备份.json</strong>。浏览器未自动保存时，分别点击结果面板里的下载链接。</p></section>
<section><h2>只读取，保留核对结果</h2><p>脚本仅调用番茄同源的三个 GET 接口，不读取或上传 Cookie、Token、密码，不修改正文、保存草稿或发布章节。本页面没有外部脚本、统计或网络请求。</p>
<p>未知接口结构、重复 ID、空正文或数量不一致时会生成未完成报告，并保留已取得正文。报告可能包含整本小说，请勿直接上传到公开 Issue。</p>
<p>「修改审核中」章节保存的是当前作者正文，可能与读者端版本不同。图片只保留标记。更多细节见 <a href="README.md">README</a>。</p>
<details><summary>查看与手动复制完整脚本</summary><textarea id="source" aria-label="只读备份脚本" readonly spellcheck="false">${escaped}</textarea></details></section>
<small>仅用于备份你拥有或获授权访问的作品。社区工具，与番茄官方无关联。MIT License。</small></main>
<script>
document.getElementById('copy').addEventListener('click',async()=>{
  const box=document.getElementById('source'),status=document.getElementById('status');
  try{await navigator.clipboard.writeText(box.value);status.textContent='已复制。请切回番茄章节管理页，在 Console 粘贴并回车。';}
  catch{box.closest('details').open=true;box.focus();box.select();status.textContent=document.execCommand('copy')?'已复制，请切回番茄页面运行。':'脚本已选中，请按 Ctrl+C（macOS：⌘+C）复制。';}
});
</script></body></html>
`;
const output = path.join(root, 'start.html');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output,'utf8') !== html) {
    console.error('start.html is out of date. Run npm run build.');
    process.exitCode = 1;
  } else console.log('start.html matches src/backup.js.');
} else {
  fs.writeFileSync(output, html, 'utf8');
  console.log('Built start.html.');
}

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.ogg':'audio/ogg', '.mp3':'audio/mpeg'
};

const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  // LAN内の確認用でもプロジェクト外のファイルは絶対に公開しない。
  if(!file.startsWith(root + path.sep)){
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file,(err,data)=>{
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});
    res.end(data);
  });
});

const PORT = 4174;
server.listen(PORT, '0.0.0.0', ()=>console.log('LAN preview on port ' + PORT));

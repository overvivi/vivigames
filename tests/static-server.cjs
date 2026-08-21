const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg'
};

const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  // テスト用サーバーからプロジェクト外を読めないようにする。
  if(!file.startsWith(root + path.sep)){
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file,(err,data)=>{
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});
    res.end(data);
  });
});

const PORT = Number(process.env.PORT) || 4173;
// 実機確認だけは同一Wi-Fiから開ける必要があるため、明示した時だけLANへ公開する。
const HOST = process.env.HOST || '127.0.0.1';

// 既に起動していたらそれを使う。Playwrightが reuseExistingServer で立てたものが
// 残っている場合があり、二重起動で落ちると開発サーバーごと止まってしまう。
server.on('error', err=>{
  if(err.code === 'EADDRINUSE'){
    console.log('http://' + HOST + ':' + PORT + ' は起動済みのため、そのまま利用します');
    setInterval(()=>{}, 1 << 30); // 起動元から見て生きている状態を保つ
    return;
  }
  throw err;
});
server.listen(PORT, HOST, ()=>{
  console.log('serving on http://' + HOST + ':' + PORT);
});

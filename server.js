'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=Number(process.env.PORT||8787),ROOT=path.resolve(__dirname);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.bin':'application/octet-stream'};
http.createServer((req,res)=>{
 let u;try{u=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end('Bad request')}
 if(u.pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,version:'18.3.23',mode:'static-local-kit'}))}
 let rel=decodeURIComponent(u.pathname);if(rel==='/'||!rel)rel='/index.html';const file=path.resolve(ROOT,'.'+rel);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file).toLowerCase(),base=path.basename(file);let cache='public, max-age=300';if(base==='service-worker.js')cache='no-store';else if(ext==='.bin'||ext==='.json')cache='no-store';else if(['.html','.js','.css','.webmanifest'].includes(ext))cache='no-cache, must-revalidate';res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':cache});fs.createReadStream(file).pipe(res)});
}).listen(PORT,'0.0.0.0',()=>console.log(`ZEBJUS FlightCore V18.3.23 static webapp: http://0.0.0.0:${PORT}`));

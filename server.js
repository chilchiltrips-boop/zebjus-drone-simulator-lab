'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname),VERSION=fs.readFileSync(path.join(ROOT,'VERSION.txt'),'utf8').trim();
const PORT=Number(process.env.PORT||8787),HOST=process.env.ZEBJUS_BIND_HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wasm':'application/wasm','.whl':'application/octet-stream','.task':'application/octet-stream','.bin':'application/octet-stream','.zip':'application/zip'};
const rootExtensions=new Set(['.html','.js','.mjs','.css','.json','.webmanifest','.png','.jpg','.jpeg','.svg','.glb']);
const deniedRoot=new Set(['release-integrity.json','package.json']);
function publicAsset(rel){
 const parts=rel.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.')))return false;
 const ext=path.extname(rel).toLowerCase();
 if(parts.length===1)return rootExtensions.has(ext)&&!deniedRoot.has(parts[0]);
 if(parts[0]==='vendor')return ['.js','.mjs','.json','.wasm','.whl','.zip','.data','.task','.py','.css','.bin','.ttf','.woff','.woff2'].includes(ext);
 if(parts[0]==='flight')return parts.length===2&&rootExtensions.has(ext);
 if(parts[0]==='python_companion')return parts.length===2&&ext==='.py';
 if(parts[0]==='FlightCore_Firmware')return parts.length===2&&(parts[1]==='catalog.json'||parts[1]==='latest.json'||/^ZEBJUS_FLIGHTCORE_A[12]_(?:APP|FACTORY)\.bin$/.test(parts[1]));
 return false;
}
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'allow':'GET, HEAD'});return res.end();}
 let u;try{u=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end('Bad request')}
 if(u.pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(req.method==='HEAD'?'':JSON.stringify({ok:true,version:VERSION,mode:'static-local-kit'}))}
 let rel;try{rel=decodeURIComponent(u.pathname)}catch{return res.writeHead(400).end('Bad path')}
 if(rel.endsWith('/'))rel+='index.html';
 rel=rel.replace(/^\/+/, '');
 if(!publicAsset(rel)){res.writeHead(403);return res.end('Forbidden');}
 const file=path.resolve(ROOT,rel);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.realpath(file,(error,real)=>{
  if(error){res.writeHead(404);return res.end('Not found');}
  if(!real.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(real,(err,st)=>{
   if(err||!st.isFile()){res.writeHead(404);return res.end('Not found');}
   const ext=path.extname(real).toLowerCase(),name=path.basename(real);
   const cache=(name==='service-worker.js'||ext==='.bin'||ext==='.json')?'no-store':['.html','.js','.mjs','.css','.webmanifest'].includes(ext)?'no-cache, must-revalidate':'public, max-age=300';
   res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':cache,'x-content-type-options':'nosniff'});
   if(req.method==='HEAD')return res.end();
   fs.createReadStream(real).on('error',()=>res.destroy()).pipe(res);
  });
 });
});
if(require.main===module)server.listen(PORT,HOST,()=>console.log('ZEBJUS FlightCore V'+VERSION+' local server: http://'+HOST+':'+PORT));
module.exports={server,publicAsset};

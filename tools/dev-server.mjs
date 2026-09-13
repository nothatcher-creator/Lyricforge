import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root=process.cwd();
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';rel=normalize(rel);if(rel.startsWith('..'))throw new Error('bad path');let path=join(root,rel);const s=await stat(path).catch(()=>null);if(s?.isDirectory())path=join(path,'index.html');const body=await readFile(path);res.setHeader('content-type',types[extname(path)]||'application/octet-stream');res.setHeader('cache-control','no-store');res.end(body);}catch{res.statusCode=404;res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`LyricForge dev server http://127.0.0.1:${port}`));

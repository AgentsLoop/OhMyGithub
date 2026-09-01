import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, 'dist')
const fallbackRoot = resolve(__dirname)
let port = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port')+1] : process.env.PORT || 3000)
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'}
function serveFile(p,res){
  try{
    const data=readFileSync(p)
    const e=extname(p)
    res.writeHead(200,{'Content-Type': mime[e]||'application/octet-stream','Cache-Control':'no-cache'})
    res.end(data)
  }catch{ res.writeHead(404); res.end('not found')}
}
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost')
  let pathname=url.pathname
  if(pathname==='/health'){ res.writeHead(200,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:true}))}
  const tryRoots=[existsSync(join(root,'index.html'))? root : fallbackRoot]
  for(const base of tryRoots){
    let file=join(base, pathname==='/'? 'index.html': pathname)
    if(existsSync(file) && statSync(file).isDirectory()) file=join(file,'index.html')
    if(existsSync(file) && statSync(file).isFile()) return serveFile(file,res)
  }
  // SPA fallback
  const fallback=join(tryRoots[0],'index.html')
  if(existsSync(fallback)) return serveFile(fallback,res)
  res.writeHead(404); res.end('not found')
})
server.listen(port,'0.0.0.0',()=>console.log(`Moonlit Parcel Dash listening on :${port} serving ${existsSync(join(root,'index.html'))?root:fallbackRoot}`))

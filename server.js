'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');

const host=process.env.HOST || '0.0.0.0';
const port=Number(process.env.PORT || 3000);
const indexPath=path.join(__dirname,'public','index.html');
const allowedTools=new Set(['PVcalc','seriescalc']);
const allowedParams=new Set(['lat','lon','peakpower','loss','angle','aspect','optimalangles','optimalinclination','usehorizon','mountingplace','pvtechchoice','pvcalculation','startyear','endyear','raddatabase','trackingtype','components','localtime']);

function sendJson(res,status,obj){
  const body=Buffer.from(JSON.stringify(obj));
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':body.length,
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  });
  res.end(body);
}

async function handlePvgis(req,res,url){
  if(req.method!=='GET') return sendJson(res,405,{error:'Povolena je pouze metoda GET.'});
  const tool=String(url.searchParams.get('tool')||'');
  if(!allowedTools.has(tool)) return sendJson(res,400,{error:'Nepovolený nástroj PVGIS.'});
  const lat=Number(url.searchParams.get('lat'));
  const lon=Number(url.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180){
    return sendJson(res,400,{error:'Neplatná zeměpisná poloha.'});
  }
  const params=new URLSearchParams();
  for(const key of allowedParams){
    const values=url.searchParams.getAll(key);
    if(!values.length) continue;
    for(const v of values) params.append(key,String(v));
  }
  params.set('outputformat','json');
  const upstreamUrl='https://re.jrc.ec.europa.eu/api/v5_3/'+tool+'?'+params.toString();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),55000);
  try{
    const upstream=await fetch(upstreamUrl,{
      headers:{Accept:'application/json','User-Agent':'FVE-Konfigurator-O131-Railway/1.0'},
      signal:controller.signal
    });
    const body=Buffer.from(await upstream.arrayBuffer());
    if(body.byteLength>25*1024*1024) return sendJson(res,502,{error:'Odpověď PVGIS je příliš velká.'});
    res.writeHead(upstream.status,{
      'Content-Type':upstream.headers.get('content-type')||'application/json; charset=utf-8',
      'Content-Length':body.length,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer'
    });
    res.end(body);
  }catch(error){
    const message=error&&error.name==='AbortError'?'Časový limit PVGIS.':'PVGIS není dostupné: '+(error&&error.message?error.message:'neznámá chyba');
    sendJson(res,502,{error:message});
  }finally{
    clearTimeout(timeout);
  }
}

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://'+(req.headers.host||'localhost'));
  if(url.pathname==='/health') return sendJson(res,200,{ok:true,app:'fve-o131'});
  if(url.pathname==='/pvgis-proxy') return handlePvgis(req,res,url);
  if(url.pathname==='/'||url.pathname==='/index.html'){
    fs.readFile(indexPath,(err,data)=>{
      if(err) return sendJson(res,500,{error:'O131 nebyl sestaven.'});
      res.writeHead(200,{
        'Content-Type':'text/html; charset=utf-8',
        'Content-Length':data.length,
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer'
      });
      res.end(data);
    });
    return;
  }
  sendJson(res,404,{error:'Nenalezeno.'});
});

server.listen(port,host,()=>{
  console.log('FVE O131 listening on '+host+':'+port);
});
'use strict';
const allowedTools=new Set(['PVcalc','seriescalc']);
const allowedParams=new Set(['lat','lon','peakpower','loss','angle','aspect','optimalangles','optimalinclination','usehorizon','mountingplace','pvtechchoice','pvcalculation','startyear','endyear','raddatabase','trackingtype','components','localtime']);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET') return res.status(405).json({error:'Povolena je pouze metoda GET.'});
 const tool=String(req.query.tool||''); if(!allowedTools.has(tool)) return res.status(400).json({error:'Nepovolený nástroj PVGIS.'});
 const lat=Number(req.query.lat),lon=Number(req.query.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180) return res.status(400).json({error:'Neplatná zeměpisná poloha.'});
 const params=new URLSearchParams();
 for(const key of allowedParams){const value=req.query[key];if(value===undefined||value===null)continue;if(Array.isArray(value))value.forEach(v=>params.append(key,String(v)));else params.set(key,String(value));}
 params.set('outputformat','json');
 const upstreamUrl='https://re.jrc.ec.europa.eu/api/v5_3/'+tool+'?'+params.toString();
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),55000);
 try{const upstream=await fetch(upstreamUrl,{headers:{Accept:'application/json','User-Agent':'FVE-Konfigurator-O131-Vercel/1.0'},signal:controller.signal});const body=await upstream.arrayBuffer();if(body.byteLength>25*1024*1024)return res.status(502).json({error:'Odpověď PVGIS je příliš velká.'});res.status(upstream.status);res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/json; charset=utf-8');return res.send(Buffer.from(body));}
 catch(error){const message=error&&error.name==='AbortError'?'Časový limit PVGIS.':'PVGIS není dostupné: '+(error&&error.message?error.message:'neznámá chyba');return res.status(502).json({error:message});}
 finally{clearTimeout(timeout);}
};
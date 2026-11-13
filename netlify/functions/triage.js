const MAX_INPUT=1800;
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
 if(!process.env.COHERE_API_KEY)return{statusCode:503,body:JSON.stringify({error:'COHERE_API_KEY is missing from Netlify Functions environment'})};
 let body;try{body=JSON.parse(event.body||'{}')}catch{return{statusCode:400,body:JSON.stringify({error:'Invalid JSON'})}};
 const incident=typeof body.incident==='string'?body.incident.trim():'';
 const mode=body.mode;
 if(incident.length<25||incident.length>MAX_INPUT||!['triage','plan'].includes(mode))return{statusCode:400,body:JSON.stringify({error:'Invalid incident or mode'})};
 const previous=mode==='plan'&&body.prior&&typeof body.prior==='object'?JSON.stringify(body.prior).slice(0,4500):'';
 const triage='Return JSON with keys: priority (severity and rationale), hypotheses (array of 2-3 possible causes), evidence (array of 3 evidence requests), owners (array of suggested teams), actions (array of 3 immediate actions), risks (array of customer and delivery risks).';
 const plan='Return JSON with keys: priority (program priority and rationale), owners (array of proposed workstreams and owners), actions (array of 4 sequenced execution steps), dependencies (array of 2-3 dependencies), risks (array of 2-3 risks and mitigations), communication (stakeholder update plan), success (array of measurable validation and exit criteria).';
 const instruction='You are an enterprise technical program delivery assistant. This is a fictional case-study demonstration, not an operational system. Do not invent incident facts or assert a confirmed root cause. Distinguish hypotheses from evidence. Recommend human validation and clear ownership. Keep concise, practical, technically literate. Output ONLY valid JSON with no markdown. '+(mode==='triage'?triage:plan);
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
  let response;try{response=await fetch('https://api.cohere.com/v2/chat',{method:'POST',headers:{Authorization:'Bearer '+process.env.COHERE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.COHERE_MODEL||'command-a-03-2025',temperature:0.2,max_tokens:850,messages:[{role:'system',content:instruction},{role:'user',content:'Incident:\n'+incident+(previous?'\nEarlier AI triage (unverified):\n'+previous:'')}] }),signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok){console.error('Cohere status',response.status,(await response.text()).slice(0,400));return{statusCode:502,body:JSON.stringify({error:'Cohere rejected request (HTTP '+response.status+'). Check Functions logs for details.'})}}
  const payload=await response.json();const output=(payload.message?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();const cleaned=output.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');const parsed=JSON.parse(cleaned);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid model response');
  return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({result:parsed,model:process.env.COHERE_MODEL||'command-a-03-2025'})};
 }catch(error){console.error('Cohere triage error:',error.message);return{statusCode:502,body:JSON.stringify({error:'Cohere analysis failed. Check function logs for details.'})}}
};
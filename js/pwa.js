"use strict";
/* ================= PWA: install, offline cache, first-run download of AI engines + models + fonts ================= */
const PACK_CACHE='lumen-models-v1';
const _JSD='https://cdn.jsdelivr.net/npm/',_MPM='https://storage.googleapis.com/mediapipe-models/',_HF=(r,f)=>`https://huggingface.co/${r}/resolve/main/${f}`;
const PACK=[
  ['AI 엔진 (MediaPipe)',9,['vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm'].map(f=>_JSD+'@mediapipe/tasks-vision@0.10.14/'+f)],
  ['얼굴 인식',4,[_MPM+'face_landmarker/face_landmarker/float16/1/face_landmarker.task']],
  ['인물 분할',16,[_MPM+'image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',_MPM+'image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite']],
  ['피사체 · 장면 · 물체 인식',18,[_MPM+'interactive_segmenter/magic_touch/float32/1/magic_touch.tflite',_MPM+'image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',_MPM+'object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite']],
  ['AI 엔진 (Transformers.js)',22,['transformers.min.js','ort-wasm-simd-threaded.jsep.wasm'].map(f=>_JSD+'@huggingface/transformers@3.1.2/dist/'+f)],
  ['장면 분할 (하늘·건물 등)',15,['config.json','preprocessor_config.json','onnx/model.onnx'].map(f=>_HF('Xenova/segformer-b0-finetuned-ade-512-512',f))],
  ['AI 업스케일',5,['config.json','preprocessor_config.json','onnx/model.onnx'].map(f=>_HF('Xenova/swin2SR-classical-sr-x2-64',f))],
  ['깊이 추정',27,['config.json','preprocessor_config.json','onnx/model_quantized.onnx'].map(f=>_HF('onnx-community/depth-anything-v2-small',f))],
  ['자동 태그',90,['config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','vocab.json','merges.txt','onnx/model_quantized.onnx'].map(f=>_HF('Xenova/clip-vit-base-patch32',f))],
  ['AI 엔진 (ONNX Runtime)',12,['ort.min.js','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'].map(f=>_JSD+'onnxruntime-web@1.19.2/dist/'+f)],
  ['AI 물체 지우기 (LaMa)',208,['https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx']]];
const PACK_MB=PACK.reduce((s,p)=>s+p[1],0);
const PW={sw:false,running:false,stop:false};
const pwaOK=()=>'serviceWorker' in navigator&&!window.claude&&(location.protocol==='https:'||(location.hostname==='localhost'&&/pwa/.test(location.search+sessionStorage.getItem('pwa'))));
function packState(){try{return JSON.parse(localStorage.getItem('lumen.pack')||'{}');}catch(e){return{};}}
function setPackState(s){try{localStorage.setItem('lumen.pack',JSON.stringify(s));}catch(e){}}
async function initPWA(){
  $('eShare').style.display=navigator.canShare&&MB.touch?'':'none';
  if(!pwaOK())return;
  if(/[?&]shared=/.test(location.search))takeShared();
  try{const reg=await navigator.serviceWorker.register('sw.js');PW.sw=true;
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate(w);});});
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);}catch(e){console.warn('SW',e);return;}
  let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading||!PW.reload)return;reloading=true;location.reload();});
  try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(e){}
  const st=packState();if(st.done)return;
  const cell=navigator.connection&&(navigator.connection.type==='cellular'||navigator.connection.saveData);
  packUI();if(st.later&&Date.now()-st.later<864e5)return;
  if(cell){packMsg(`모바일 데이터로 연결되어 있어요. 약 ${PACK_MB}MB를 내려받을까요? (Wi-Fi 권장)`,true);return;}
  runPack();}
function showUpdate(w){const t=$('pwaUpd');if(t)return;const b=el('div','pwaupd');b.id='pwaUpd';b.innerHTML='새 버전이 있어요 <button class="tb primary">새로고침</button>';
  b.querySelector('button').onclick=()=>{PW.reload=true;w.postMessage('skip');};document.body.appendChild(b);}
function packUI(){if($('pack'))return;const d=el('div','pack');d.id='pack';d.innerHTML=`<div class="pk-h"><b>첫 실행 준비</b><button class="pk-x" title="숨기기">×</button></div>
  <div class="pk-t" id="pkT">AI 엔진과 모델을 내려받아 휴대폰에 저장해요 (약 ${PACK_MB}MB). 한 번만 받으면 인터넷 없이도 모든 기능을 쓸 수 있어요.</div>
  <div class="pk-bar"><i id="pkBar"></i></div><div class="pk-s" id="pkS"></div>
  <div class="pk-a"><button class="tb" id="pkLater">나중에</button><button class="tb primary" id="pkGo">지금 받기</button></div>`;
  document.body.appendChild(d);d.querySelector('.pk-x').onclick=()=>d.classList.add('min');
  $('pkLater').onclick=()=>{PW.stop=true;const s=packState();s.later=Date.now();setPackState(s);d.remove();toast('AI 기능은 처음 쓸 때 필요한 것만 받아요. 왼쪽 위 메뉴 › 사진 › ‘AI 모델 모두 받기’로 언제든 받을 수 있어요');};
  $('pkGo').onclick=()=>{if(PW.running){PW.stop=true;return;}runPack();};
  d.addEventListener('click',e=>{if(d.classList.contains('min')&&!e.target.closest('button'))d.classList.remove('min');});}
function packMsg(t,ask){packUI();$('pkT').textContent=t;$('pkGo').textContent=ask?'받기':'지금 받기';}
async function runPack(){if(PW.running)return;if(!pwaOK()){toast('설치한 웹앱(https)에서만 미리 받을 수 있어요');return;}packUI();PW.running=true;PW.stop=false;
  $('pkGo').textContent='일시 정지';$('pkLater').style.display='none';$('pkT').textContent='내려받는 중이에요. 화면을 켜 둔 채로 기다려 주세요. 앱은 그대로 쓸 수 있어요.';
  setTimeout(()=>{const d=$('pack');if(d&&PW.running)d.classList.add('min');},5000);
  let wake=null;try{wake=await navigator.wakeLock.request('screen');}catch(e){}
  const cache=await caches.open(PACK_CACHE);let doneMB=0,fails=[];
  for(const [name,mb,urls] of PACK){if(PW.stop)break;let ok=true;
    for(let i=0;i<urls.length&&!PW.stop;i++){const u=urls[i];if(await cache.match(u))continue;
      $('pkS').textContent=`${name} 받는 중…`;
      try{await fetchToCache(cache,u,f=>{const tot=doneMB+mb*((i+f)/urls.length);$('pkBar').style.width=(tot/PACK_MB*100).toFixed(1)+'%';$('pkS').textContent=`${name} · 전체 ${Math.round(tot)} / ${PACK_MB}MB`;});}
      catch(e){console.warn(u,e);ok=false;break;}}
    if(!ok)fails.push(name);doneMB+=mb;$('pkBar').style.width=(doneMB/PACK_MB*100).toFixed(1)+'%';}
  try{await cacheFonts(cache);}catch(e){console.warn('fonts',e);}
  try{if(wake)await wake.release();}catch(e){}
  PW.running=false;$('pkLater').style.display='';
  if(PW.stop){packMsg('일시 정지했어요. ‘지금 받기’를 누르면 이어서 받아요.');return;}
  if(fails.length){packMsg('받지 못한 항목: '+fails.join(', ')+'. 인터넷 연결을 확인하고 다시 받아 주세요. (그 기능은 쓸 때 인터넷에서 불러와요)');$('pkGo').textContent='다시 받기';return;}
  const s=packState();s.done=Date.now();setPackState(s);$('pkT').textContent='준비 완료! 이제 인터넷 없이도 모든 기능을 쓸 수 있어요.';$('pkS').textContent='';$('pkGo').style.display='none';$('pkLater').textContent='닫기';
  $('pkLater').onclick=()=>$('pack').remove();setTimeout(()=>{const p=$('pack');if(p)p.remove();},6000);}
async function fetchToCache(cache,url,onProg){for(let a=0;a<3;a++){try{
      const r=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
      const total=+r.headers.get('content-length')||0;
      if(!r.body||!total){await cache.put(url,r);onProg(1);return;}
      const [a1,a2]=r.body.tee();const hdr=new Headers(r.headers);const put=cache.put(url,new Response(a2,{status:200,headers:hdr}));
      const rd=a1.getReader();let got=0,last=0;for(;;){const {done,value}=await rd.read();if(done)break;got+=value.length;const now=performance.now();if(now-last>200){last=now;onProg(Math.min(1,got/total));}}
      await put;onProg(1);return;}catch(e){if(a===2)throw e;await new Promise(r=>setTimeout(r,1500*(a+1)));}}}
async function cacheFonts(cache){const link=document.querySelector('link[data-remote]');if(!link)return;const u=link.dataset.remote.replace(/&amp;/g,'&');
  let r=await cache.match(u);if(!r){const n=await fetch(u,{mode:'cors',credentials:'omit'});if(!n.ok)return;await cache.put(u,n.clone());r=n;}
  const css=await r.text();const urls=[...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]))];
  let i=0;await Promise.all(Array.from({length:6},async()=>{while(i<urls.length){const f=urls[i++];if(await cache.match(f))continue;try{const x=await fetch(f,{mode:'cors',credentials:'omit'});if(x.ok)await cache.put(f,x);}catch(e){}}}));}
/* manual trigger (left panel) */
function packAll(){const s=packState();delete s.done;delete s.later;setPackState(s);const p=$('pack');if(p)p.classList.remove('min');runPack();}

/* photos shared from the gallery app (Web Share Target) */
async function takeShared(){try{history.replaceState(null,'',location.pathname);}catch(e){}
  let c;try{c=await caches.open('lumen-share');}catch(e){return;}const keys=await c.keys();if(!keys.length){toast('공유받은 사진을 찾지 못했어요');return;}
  const files=[];for(const k of keys.sort((a,b)=>a.url.localeCompare(b.url,undefined,{numeric:true}))){const r=await c.match(k);if(!r)continue;const b=await r.blob();
    files.push(new File([b],decodeURIComponent(r.headers.get('X-Name')||'shared.jpg'),{type:b.type}));}
  for(const k of keys)await c.delete(k);if(files.length)addFiles(files);}

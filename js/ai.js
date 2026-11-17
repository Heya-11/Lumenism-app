"use strict";
/* ================= On-device AI loader (free public models, downloaded on first use) ================= */
const MP_VER='0.10.14',MP_URL=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const TF_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';
const ORT_URL='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
const MPM='https://storage.googleapis.com/mediapipe-models/';
const AI_MODELS={
  face:{name:'얼굴 인식',size:'약 4MB',url:MPM+'face_landmarker/face_landmarker/float16/1/face_landmarker.task'},
  multiclass:{name:'인물 부위 분할',size:'약 16MB',url:MPM+'image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'},
  selfie:{name:'인물 분리',size:'약 0.3MB',url:MPM+'image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'},
  subject:{name:'피사체 선택',size:'약 6MB',url:MPM+'interactive_segmenter/magic_touch/float32/1/magic_touch.tflite'},
  classifier:{name:'장면 인식',size:'약 5MB',url:MPM+'image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite'},
  detector:{name:'물체 인식',size:'약 7MB',url:MPM+'object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'},
  scene:{name:'장면 분할(하늘·건물 등)',size:'약 15MB',tf:'Xenova/segformer-b0-finetuned-ade-512-512',task:'image-segmentation'},
  depth:{name:'깊이 추정',size:'약 27~100MB',tf:'onnx-community/depth-anything-v2-small',task:'depth-estimation',big:true},
  clip:{name:'자동 태그',size:'약 90~150MB',tf:'Xenova/clip-vit-base-patch32',task:'zero-shot-image-classification',big:true},
  upscale:{name:'AI 업스케일',size:'약 5~20MB',tf:'Xenova/swin2SR-classical-sr-x2-64',task:'image-to-image'},
  lama:{name:'AI 물체 지우기 (LaMa)',size:'약 200MB',url:'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx',big:true}};
const AI={mp:null,fileset:null,tf:null,ort:null,inst:{},loading:{}};
/* offline pack (downloaded by the start scripts into ./offline). Used only when served over http(s) by the start script. */
const OFF={ok:{},ready:null};
const offURL=p=>new URL('offline/'+p,location.href).href;
OFF.ready=(async()=>{if(!/^https?:$/.test(location.protocol))return;try{const r=await fetch('offline/manifest.json',{cache:'no-store'});if(r.ok)OFF.ok=(await r.json()).ok||{};}catch(e){}
  const n=Object.keys(OFF.ok).length;if(n)console.info('[Lumenism] offline pack:',Object.keys(OFF.ok).join(', '));})();
const MP_LOCAL={face:'face_landmarker.task',multiclass:'selfie_multiclass_256x256.tflite',selfie:'selfie_segmenter.tflite',subject:'magic_touch.tflite',classifier:'efficientnet_lite0.tflite',detector:'efficientdet_lite0.tflite'};
function isLocal(key){return !!(OFF.ok['mp_'+key]||OFF.ok['hf_'+key]||(key==='lama'&&OFF.ok.lama));}
function modelURL(key){const M=AI_MODELS[key];if(MP_LOCAL[key]&&OFF.ok['mp_'+key])return offURL('models/mediapipe/'+MP_LOCAL[key]);if(key==='lama'&&OFF.ok.lama)return offURL('models/lama/lama_fp32.onnx');return M.url;}
function aiAvailable(){if(window.claude){toast('AI 기능은 ZIP으로 받은 버전에서만 쓸 수 있어요 (웹 버전은 보안 정책상 모델을 내려받을 수 없어요)');return false;}
  if(!navigator.onLine&&!Object.keys(AI.inst).length&&!Object.keys(OFF.ok).length){toast('AI 모델을 처음 내려받으려면 인터넷 연결이 필요해요');}return true;}
async function confirmBig(key){await OFF.ready;const m=AI_MODELS[key];if(!m.big||AI.inst[key]||isLocal(key))return true;let ok=false;
  try{ok=localStorage.getItem('lumenism.ai.ok.'+key)==='1';}catch(e){}if(ok)return true;
  ok=await confirmDialog(`${m.name} 모델 내려받기`,`처음 한 번 ${m.size}를 내려받아요. 계속할까요?`);if(ok){try{localStorage.setItem('lumenism.ai.ok.'+key,'1');}catch(e){}}return ok;}
async function mpLib(){await OFF.ready;if(!AI.mp){const base=OFF.ok.mp_lib?offURL('lib/mediapipe'):MP_URL;AI.mp=await import(`${base}/vision_bundle.mjs`);AI.fileset=await AI.mp.FilesetResolver.forVisionTasks(`${base}/wasm`);}return AI.mp;}
async function tfLib(){await OFF.ready;if(!AI.tf){const loc=!!OFF.ok.tf_lib;AI.tf=await import(loc?offURL('lib/transformers/transformers.min.js'):TF_URL);const env=AI.tf.env;
    const anyHF=['scene','depth','clip','upscale'].some(k=>OFF.ok['hf_'+k]);env.allowLocalModels=anyHF;if(anyHF)env.localModelPath=offURL('models/hf/');env.allowRemoteModels=true;if(navigator.serviceWorker&&navigator.serviceWorker.controller)env.useBrowserCache=false;
    if(loc)try{env.backends.onnx.wasm.wasmPaths=offURL('lib/transformers/');}catch(e){}}return AI.tf;}
async function ortLib(){await OFF.ready;if(!AI.ort){const base=OFF.ok.ort_lib?offURL('lib/ort/'):ORT_URL;await new Promise((res,rej)=>{const s=document.createElement('script');s.src=base+'ort.min.js';s.onload=res;s.onerror=()=>rej(new Error('ONNX Runtime 로드 실패'));document.head.appendChild(s);});
    AI.ort=window.ort;AI.ort.env.wasm.wasmPaths=base;}return AI.ort;}
async function mpCreate(Cls,opts){const mp=await mpLib();
  for(const delegate of ['GPU','CPU']){try{return await mp[Cls].createFromOptions(AI.fileset,Object.assign({},opts,{baseOptions:Object.assign({},opts.baseOptions,{delegate})}));}
    catch(e){if(delegate==='CPU')throw e;}}}
async function getModel(key){if(AI.inst[key])return AI.inst[key];if(AI.loading[key])return AI.loading[key];const M=AI_MODELS[key];
  const job=(async()=>{busy(true,isLocal(key)?`${M.name} 모델 불러오는 중…`:`${M.name} 모델 준비 중… (처음 한 번 ${M.size} 내려받아요)`);await nextFrame();
    try{let inst;
      if(key==='face')inst=await mpCreate('FaceLandmarker',{baseOptions:{modelAssetPath:modelURL(key)},runningMode:'IMAGE',numFaces:8,outputFaceBlendshapes:true,minFaceDetectionConfidence:.4,minFacePresenceConfidence:.4});
      else if(key==='multiclass'||key==='selfie')inst=await mpCreate('ImageSegmenter',{baseOptions:{modelAssetPath:modelURL(key)},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});
      else if(key==='subject')inst=await mpCreate('InteractiveSegmenter',{baseOptions:{modelAssetPath:modelURL(key)},outputCategoryMask:false,outputConfidenceMasks:true});
      else if(key==='classifier')inst=await mpCreate('ImageClassifier',{baseOptions:{modelAssetPath:modelURL(key)},runningMode:'IMAGE',maxResults:8});
      else if(key==='detector')inst=await mpCreate('ObjectDetector',{baseOptions:{modelAssetPath:modelURL(key)},runningMode:'IMAGE',scoreThreshold:.3,maxResults:10});
      else if(M.tf){const tf=await tfLib();const opt={progress_callback:e=>{if(e.status==='progress'&&e.total)busy(true,`${M.name} 모델 내려받는 중… ${Math.round(e.loaded/e.total*100)}% (${(e.file||'').split('/').pop()})`);}};
        if(navigator.gpu)opt.device='webgpu';
        opt.dtype=key==='depth'||key==='clip'?'q8':'fp32';
        try{inst=await tf.pipeline(M.task,M.tf,opt);}
        catch(e){console.warn(e);delete opt.device;inst=await tf.pipeline(M.task,M.tf,opt);}}
      else if(key==='lama'){const ort=await ortLib();const buf=await fetchWithProgress(modelURL(key),p=>busy(true,`${M.name} 내려받는 중… ${Math.round(p*100)}%`));
        busy(true,'AI 물체 지우기 모델 불러오는 중…');await nextFrame();inst=await ort.InferenceSession.create(buf,{executionProviders:['wasm']});}
      AI.inst[key]=inst;return inst;}
    catch(e){console.error(e);throw new Error(`${M.name} 모델을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.`);}
    finally{busy(false);delete AI.loading[key];}})();
  AI.loading[key]=job;return job;}
async function fetchWithProgress(url,cb){const r=await fetch(url);if(!r.ok)throw new Error('다운로드 실패 '+r.status);const total=+r.headers.get('content-length')||0;
  if(!r.body||!total)return new Uint8Array(await r.arrayBuffer());const rd=r.body.getReader();const chunks=[];let got=0;
  for(;;){const {done,value}=await rd.read();if(done)break;chunks.push(value);got+=value.length;cb(got/total);}
  const out=new Uint8Array(got);let o=0;for(const c of chunks){out.set(c,o);o+=c.length;}return out;}
/* ---- input image for models (source orientation) ---- */
function aiCanvas(ph,max){ph._ai=ph._ai||{};const k='c'+max;if(ph._ai[k])return ph._ai[k];const src=ph.prev;
  const c=drawScaled(src,src.width,src.height,max);ph._ai[k]=c;return c;}
function maskFromFloat(arr,w,h,tw,th){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const im=x.createImageData(w,h);
  for(let i=0;i<w*h;i++){const v=Math.round(Math.min(1,Math.max(0,arr[i]))*255);im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=v;}x.putImageData(im,0,0);
  const o=document.createElement('canvas');o.width=tw;o.height=th;const ox=o.getContext('2d',{willReadFrequently:true});ox.imageSmoothingQuality='high';ox.drawImage(c,0,0,tw,th);
  const d=ox.getImageData(0,0,tw,th).data,out=new Uint8Array(tw*th);for(let i=0;i<tw*th;i++)out[i]=d[i*4+3];return out;}
function storeMap(data,w,h,kind){const aid=uid('a');STORE.aimaps.set(aid,{w,h,data,kind});return aid;}
function mapSize(ph){const s=Math.min(1,1024/Math.max(ph.prev.width,ph.prev.height));return[Math.max(8,Math.round(ph.prev.width*s)),Math.max(8,Math.round(ph.prev.height*s))];}
function closeRes(r){try{r&&r.close&&r.close();}catch(e){}}
/* ---- inference wrappers (all return plain data in source-normalized coordinates) ---- */
async function aiFaces(ph){if(ph._faces)return ph._faces;const m=await getModel('face');const c=aiCanvas(ph,1024);const r=m.detect(c);
  const faces=(r.faceLandmarks||[]).map((lm,i)=>{const pts=lm.map(q=>[q.x,q.y]);const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);
    const bs={};((r.faceBlendshapes||[])[i]?.categories||[]).forEach(cg=>bs[cg.categoryName]=cg.score);
    const box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];return{lm:pts,box,bs,w:Math.hypot(pts[454][0]-pts[234][0],(pts[454][1]-pts[234][1])*c.height/c.width)};});
  ph._faces=faces;return faces;}
async function aiSegment(ph,key){ph._seg=ph._seg||{};if(ph._seg[key])return ph._seg[key];const m=await getModel(key);const c=aiCanvas(ph,1024);const r=m.segment(c);
  const masks=(r.confidenceMasks||[]).map(mk=>({w:mk.width,h:mk.height,data:mk.getAsFloat32Array().slice()}));closeRes(r);ph._seg[key]=masks;return masks;}
async function aiSubjectMask(ph,u,v){const m=await getModel('subject');const c=aiCanvas(ph,1024);const r=m.segment(c,{keypoint:{x:u,y:v}});
  const ms=r.confidenceMasks||[];const mk=ms[ms.length>1?1:0];if(!mk){closeRes(r);throw new Error('피사체를 찾지 못했어요');}
  const out={w:mk.width,h:mk.height,data:mk.getAsFloat32Array().slice()};closeRes(r);
  if(ms.length===1){let s=0;for(const q of out.data)s+=q;if(s/out.data.length>.6)for(let i=0;i<out.data.length;i++)out.data[i]=1-out.data[i];}return out;}
async function aiClassify(ph){const m=await getModel('classifier');const r=m.classify(aiCanvas(ph,512));return((r.classifications||[])[0]?.categories||[]).map(c=>({name:c.categoryName,score:c.score}));}
async function aiDetect(ph){const m=await getModel('detector');const c=aiCanvas(ph,640);const r=m.detect(c);
  return(r.detections||[]).map(d=>({box:[d.boundingBox.originX/c.width,d.boundingBox.originY/c.height,(d.boundingBox.originX+d.boundingBox.width)/c.width,(d.boundingBox.originY+d.boundingBox.height)/c.height],name:d.categories[0]?.categoryName,score:d.categories[0]?.score}));}
async function aiScene(ph){ph._scene=ph._scene||null;if(ph._scene)return ph._scene;const pipe=await getModel('scene');const c=aiCanvas(ph,640);
  const out=await pipe(c.toDataURL('image/jpeg',.9));const res=out.map(o=>({label:o.label,w:o.mask.width,h:o.mask.height,data:o.mask.data,ch:o.mask.channels||1}));ph._scene=res;return res;}
async function aiDepth(ph){if(ph._depth)return ph._depth;const pipe=await getModel('depth');const c=aiCanvas(ph,768);const out=await pipe(c.toDataURL('image/jpeg',.9));
  const d=out.depth;const ch=d.channels||1,n=d.width*d.height,f=new Float32Array(n);let mn=1e9,mx=-1e9;for(let i=0;i<n;i++){const v=d.data[i*ch];f[i]=v;if(v<mn)mn=v;if(v>mx)mx=v;}
  for(let i=0;i<n;i++)f[i]=(f[i]-mn)/Math.max(1e-6,mx-mn);ph._depth={w:d.width,h:d.height,data:f};return ph._depth;}

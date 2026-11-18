"use strict";
/* ================= params ================= */
const ID=()=>[[0,0],[1,1]];
const defGeo=()=>({rot:0,fh:false,fv:false,angle:0,crop:{x:0,y:0,w:1,h:1},aspect:'free',pv:0,ph:0,pscale:100});
function defaults(){return{temp:0,tint:0,exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,texture:0,clarity:0,dehaze:0,vibrance:0,saturation:0,
  bw:false,bwMix:Array(8).fill(0),hslH:Array(8).fill(0),hslS:Array(8).fill(0),hslL:Array(8).fill(0),
  pcs:[],pcRest:0,
  gsH:220,gsS:0,gsL:0,gmH:30,gmS:0,gmL:0,ghH:45,ghS:0,ghL:0,gBal:0,
  duo:{on:false,a:'#1d3557',b:'#f4a261',amt:100},
  mix:{r:[100,0,0],g:[0,100,0],b:[0,0,100]},
  lut:{id:null,name:'',amt:100},
  sharpen:0,sharpRadius:1,sharpDetail:25,sharpMask:0,highPass:0,lnr:0,cnr:0,
  lens:{dist:0,ca:0,defringe:0,vig:0,vigMid:50},
  vig:0,vigMid:50,grain:0,grainSize:25,
  fx:{orton:0,glow:0,glowT:60,hal:0,tilt:0,blur:0,tx:.5,ty:.5,tang:0,tw:12,tf:18,shape:'circle',boost:30,fsharp:0,fdepth:.5,dof:8,aid:null,maskId:null},
  portrait:{aid:null,smooth:0,keep:50,red:0,bright:0,eyes:0,iris:0,teeth:0,slim:0,width:0,eye:0,nose:0,smile:0,lip:0,lipH:352,blush:0,blushH:6,brow:0,dark:0,fw:[],edits:[],pf:[]},liquify:[],
  privacy:{style:'mosaic',amt:50,expand:35,items:[]},
  sky:{on:false,aid:null,src:'clear',amt:100,fg:50,bright:0,shift:0,scale:100,flip:false,edge:50},light:{on:false,aid:null,amt:50,ang:-45,elev:35,warm:20,amb:20},
  curves:{rgb:ID(),r:ID(),g:ID(),b:ID()},pcurve:{sh:0,dk:0,lt:0,hl:0,s1:25,s2:50,s3:75},
  geo:defGeo(),masks:[],retouch:[],layers:[]};}
const clone=o=>JSON.parse(JSON.stringify(o));
const DEF_JSON=JSON.stringify(defaults());
const BANDS=[{n:'빨강',h:0},{n:'주황',h:30},{n:'노랑',h:60},{n:'녹색',h:120},{n:'아쿠아',h:180},{n:'파랑',h:240},{n:'자주',h:270},{n:'마젠타',h:300}];
const ADJ_KEYS=['exposure','contrast','highlights','shadows','temp','tint','clarity','saturation'];
const PHOTO_ONLY=['geo','retouch','layers','liquify','privacy'];
const PRESETS=[
  {n:'기본값 (색·톤 초기화)',p:{}},
  {n:'선명하게',p:{contrast:18,clarity:18,texture:10,dehaze:8,vibrance:35,saturation:5,sharpen:30}},
  {n:'따뜻한 오후',p:{temp:22,tint:4,highlights:-15,shadows:10,vibrance:12,ghH:42,ghS:18,gsH:25,gsS:8}},
  {n:'차가운 아침',p:{temp:-18,contrast:8,shadows:15,whites:8,vibrance:8,gsH:215,gsS:16,ghH:200,ghS:6}},
  {n:'흑백 클래식',p:{bw:true,contrast:28,clarity:20,highlights:-10,blacks:-10,bwMix:[12,15,8,-10,-5,-20,-5,0],grain:15}},
  {n:'흑백 하이키',p:{bw:true,exposure:0.4,contrast:-10,highlights:-30,shadows:40,whites:15,blacks:20}},
  {n:'필름 페이드',p:{curves:{rgb:[[0,.08],[.25,.25],[.75,.78],[1,.95]],r:ID(),g:ID(),b:ID()},saturation:-15,vibrance:5,grain:28,grainSize:35,gsH:190,gsS:15,ghH:40,ghS:14,fx:{orton:0,glow:0,glowT:60,hal:15,tilt:0,blur:0,tx:.5,ty:.5,tang:0,tw:12,tf:18}}},
  {n:'무디 다크',p:{exposure:-0.3,contrast:15,highlights:-40,shadows:-10,blacks:-15,vibrance:-12,clarity:10,vig:-30,gsH:220,gsS:20,gmH:200,gmS:6}},
  {n:'시네마틱 틸 & 오렌지',p:{contrast:15,highlights:-20,shadows:10,gsH:195,gsS:32,ghH:35,ghS:26,gBal:-10,hslS:[0,10,-10,-25,0,10,0,0],hslH:[0,-5,0,40,0,0,0,0]}},
  {n:'인물 부드럽게',p:{clarity:-18,texture:-15,highlights:-12,shadows:12,hslL:[5,12,0,0,0,0,0,0],hslS:[-5,-10,0,0,0,0,0,0],vibrance:8,vig:-10}},
  {n:'풍경 드라마틱',p:{contrast:20,highlights:-50,shadows:35,whites:10,blacks:-15,clarity:25,dehaze:15,vibrance:30,hslL:[0,0,0,-10,-10,-25,0,0],hslS:[0,0,0,15,15,10,0,0]}},
  {n:'몽환 (오톤)',p:{exposure:.15,contrast:10,highlights:-20,vibrance:10,fx:{orton:45,glow:15,glowT:55,hal:0,tilt:0,blur:0,tx:.5,ty:.5,tang:0,tw:12,tf:18}}},
];

/* ================= state ================= */
let R=null;const glc=document.getElementById('gl');
const photos=[];let cur=null,uidN=0,clipboard=null,tool='edit';
const UI={compare:'off',splitX:.5,clip:false,pick:null,tat:null,hslTab:'H',curveTab:'point',curveCh:'rgb',mixOut:'r',
  straighten:false,guide:false,guideLines:[],pendingCreate:null,pendingMode:'add',showOverlay:true,space:false,
  brush:{size:60,feather:50,flow:60,erase:false,auto:false},
  ret:{mode:'heal',size:40,feather:50,op:100,src:null,off:null,awaitSrc:false,ai:false},
  liq:{mode:'off',size:80,str:35},pe:{on:false,c:'lip',m:'add',size:30},face:-1,pv:false,sens:+(localStorage.getItem('lumen.sens')||1),aiMode:'new',recAI:false,cropSug:null,tagQuery:'',blemSens:50,aiOv:false,stacks:false,openStacks:new Set(),
  batch:{portrait:true,makeup:true,bokeh:true,sky:true,light:true},
  filter:'all',fullPreview:(()=>{try{return localStorage.getItem('darkroom.full')==='1';}catch(e){return false;}})()};
const EXP_DEF={target:'cur',fmt:'image/jpeg',q:92,size:0,os:0,tpl:'{name}_edit',
  wm:{on:false,text:'© My Photo',font:'Noto Sans KR',size:3,op:75,pos:'br',color:'#ffffff',logoSize:15},border:{on:false,w:3,color:'#ffffff'}};
UI.exp=(()=>{try{return Object.assign(clone(EXP_DEF),JSON.parse(localStorage.getItem('darkroom.exp')||'{}'));}catch(e){return clone(EXP_DEF);}})();
let view={s:1,x:0,y:0,fit:true};
const $=id=>document.getElementById(id);
const vw=$('view'),ov=$('ov');
const P=()=>cur?cur.params:defaults();
const selMask=()=>cur?cur.params.masks.find(m=>m.id===cur.sel)||null:null;
const selComp=()=>{const m=selMask();return m?m.comps.find(c=>c.id===cur.selComp)||m.comps[0]||null:null;};
const selRet=()=>cur?cur.params.retouch.find(r=>r.id===cur.selRet)||null:null;
const selLayer=()=>cur?cur.params.layers.find(l=>l.id===cur.selLayer)||null:null;
const selPC=()=>cur?cur.params.pcs[cur.selPC|0]||null:null;
const uid=p=>(p||'i')+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function ref(path){let o;const m=path.match(/^(\w+):(.*)$/);
  if(m){o={m:selMask,mc:selComp,r:selRet,l:selLayer,pc:selPC,ui:()=>UI}[m[1]]();path=m[2];}else o=P();
  if(!o)return null;const ks=path.split('.');const last=ks.pop();for(const k of ks){o=o[k];if(o==null)return null;}return[o,last];}
const PORT_KEYS=['smooth','keep','red','bright','eyes','iris','teeth','slim','width','eye','nose','smile','lip','lipH','blush','blushH','brow','dark'];
function portVal(po,i,k){const o=po.pf&&po.pf[i];return o&&o[k]!=null?o[k]:po[k];}
/* while one face is selected in the portrait panel, portrait sliders read/write that face's own value */
function faceKey(path){if(UI.face<0||!path.startsWith('portrait.'))return null;const k=path.slice(9);return PORT_KEYS.includes(k)?k:null;}
function getP(path){const fk=faceKey(path);if(fk&&cur)return portVal(cur.params.portrait,UI.face,fk);const r=ref(path);return r?r[0][r[1]]:0;}
function setP(path,v){const fk=faceKey(path);if(fk&&cur){const po=cur.params.portrait;if(!Array.isArray(po.pf))po.pf=[];const o=po.pf[UI.face]||(po.pf[UI.face]={});o[fk]=v;return;}const r=ref(path);if(r)r[0][r[1]]=v;}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2800);}
function vhint(msg){const h=$('vhint');h.textContent=msg||'';h.style.display=msg?'block':'none';}
function busy(on,txt){$('busy').classList.toggle('on',!!on);if(txt)$('busyTxt').textContent=txt;}
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rnd4=v=>Math.round(v*1e4)/1e4;

/* ================= render ================= */
let rafPending=false,histTimer=null;
function renderOpts(){const peOn=tool==='portrait'&&UI.pe.on;return{ovSel:peOn?PE_CH[UI.pe.c][2]:0,aiOv:(UI.aiOv&&tool!=='crop')||peOn,bypass:UI.compare==='before',split:(UI.compare==='split'&&tool!=='crop')?UI.splitX:-1,cropMode:tool==='crop',
  sel:tool==='mask'?cur.sel:null,overlay:tool==='mask'&&UI.showOverlay,clip:UI.clip};}
function requestRender(){if(!cur||rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;doRender();});}
function doRender(){if(!cur)return;const pw=glc.width,ph=glc.height;
  try{R.render(cur.params,renderOpts());}catch(e){console.error(e);toast('렌더링 오류: '+e.message);}
  if(glc.width!==pw||glc.height!==ph)fitView();else{drawOverlay();renderHi();}
  clearTimeout(histTimer);histTimer=setTimeout(updateHist,90);}
const small=document.createElement('canvas'),sctx=small.getContext('2d',{willReadFrequently:true});
const hcv=$('hist'),hctx=hcv.getContext('2d');
function updateHist(){if(!cur)return;
  const sw=240,sh=Math.max(1,Math.round(240*glc.height/glc.width));small.width=sw;small.height=sh;sctx.drawImage(glc,0,0,sw,sh);
  const d=sctx.getImageData(0,0,sw,sh).data;const H=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)];
  for(let i=0;i<d.length;i+=4){H[0][d[i]]++;H[1][d[i+1]]++;H[2][d[i+2]]++;}
  let mx=1;for(let c=0;c<3;c++)for(let i=2;i<254;i++)mx=Math.max(mx,H[c][i]);
  const dpr=window.devicePixelRatio||1,W=hcv.clientWidth*dpr,Ht=hcv.clientHeight*dpr;if(hcv.width!==W){hcv.width=W;hcv.height=Ht;}
  hctx.globalCompositeOperation='source-over';hctx.fillStyle='#171717';hctx.fillRect(0,0,W,Ht);
  hctx.strokeStyle='#262626';hctx.lineWidth=1;for(let i=1;i<4;i++){const x=Math.round(W*i/4)+.5;hctx.beginPath();hctx.moveTo(x,0);hctx.lineTo(x,Ht);hctx.stroke();}
  hctx.globalCompositeOperation='lighter';const cols=['rgba(220,60,60,.75)','rgba(60,200,80,.7)','rgba(70,110,240,.8)'];
  for(let c=0;c<3;c++){hctx.fillStyle=cols[c];hctx.beginPath();hctx.moveTo(0,Ht);
    for(let i=0;i<256;i++){const v=Math.min(1,H[c][i]/mx*0.92);hctx.lineTo(i/255*W,Ht-v*(Ht-4));}hctx.lineTo(W,Ht);hctx.closePath();hctx.fill();}
  hctx.globalCompositeOperation='source-over';
  const plain=UI.compare==='off'&&tool!=='crop'&&!UI.clip&&!(tool==='mask'&&UI.showOverlay&&cur.params.masks.length);
  if(plain){const url=small.toDataURL('image/jpeg',.7);cur.thumb=url;const im=cur.el&&cur.el.querySelector('img');if(im)im.src=url;}
  markEdited(cur);if(UI.filter==='edited'||UI.filter==='unedited')clearTimeout(window._fT),window._fT=setTimeout(applyFilter,400);}

/* ================= viewer ================= */
function applyView(){glc.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.s})`;
  $('zoomLbl').textContent=cur&&R&&R.last?Math.round(view.s*R.w/cur.w*100)+'%':'—';drawOverlay();positionHi();scheduleHi();}
/* ---- full-resolution detail view ---- */
let RH=null,hiState=null,hiTimer=null;const glHi=document.getElementById('glHi');
const MOBILE_DEV=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),TEX_CAP=MOBILE_DEV?8192:16384;
function fullSource(ph){if(ph.full)return ph.full;const lim=Math.min(R.maxTex,TEX_CAP);const s=Math.min(1,lim/Math.max(ph.w,ph.h));
  ph.full=(s===1&&ph.bm instanceof HTMLCanvasElement)?ph.bm:drawScaled(ph.bm,ph.w,ph.h,Math.max(ph.w,ph.h)*s);return ph.full;}
function hiNeeded(){if(!cur||UI.fullPreview||tool==='crop'||!R||!R.last)return false;const dpr=window.devicePixelRatio||1;return R.w<cur.w-1&&view.s*dpr>1.02;}
function hideHi(){glHi.style.display='none';hiState=null;}
function renderHi(){clearTimeout(hiTimer);if(!hiNeeded()){hideHi();return;}
  if(!RH){try{RH=new Renderer(glHi);}catch(e){hideHi();return;}}
  if(RH.photoUid!==cur.uid){RH.setSource(fullSource(cur),2048);RH.photoUid=cur.uid;}
  const Gf=geoMats(RH.w,RH.h,cur.params.geo,false);const k=Gf.outW/glc.width;const r=vw.getBoundingClientRect();
  let x0=-view.x/view.s*k,y0=-view.y/view.s*k,x1=(r.width-view.x)/view.s*k,y1=(r.height-view.y)/view.s*k;const pw=(x1-x0)*.06,ph=(y1-y0)*.06;
  x0=Math.max(0,Math.floor(x0-pw));y0=Math.max(0,Math.floor(y0-ph));x1=Math.min(Gf.outW,Math.ceil(x1+pw));y1=Math.min(Gf.outH,Math.ceil(y1+ph));
  const lim=Math.min(RH.maxTex,MOBILE_DEV?4096:8192);x1=Math.min(x1,x0+lim);y1=Math.min(y1,y0+lim);
  if(x1-x0<2||y1-y0<2){hideHi();return;}
  try{RH.render(cur.params,{...renderOpts(),region:[x0,y0,x1-x0,y1-y0]});}catch(e){console.error(e);hideHi();return;}
  hiState={x0,y0,k};glHi.style.display='block';positionHi();}
function positionHi(){if(!hiState)return;if(!hiNeeded()){hideHi();return;}const s=view.s/hiState.k;glHi.style.transform=`translate(${view.x+hiState.x0*s}px,${view.y+hiState.y0*s}px) scale(${s})`;}
function scheduleHi(){clearTimeout(hiTimer);hiTimer=setTimeout(renderHi,90);}
async function setFullPreview(v){UI.fullPreview=v;try{localStorage.setItem('darkroom.full',v?'1':'0');}catch(e){}$('bHQ').classList.toggle('on',v);if(!cur)return;
  busy(true,v?'원본 해상도로 전환 중…':'미리보기 해상도로 전환 중…');await nextFrame();
  try{const ow=glc.width;R.setSource(v?fullSource(cur):cur.prev,v?2048:1024);R.render(cur.params,renderOpts());const nw=glc.width;
    const r=vw.getBoundingClientRect(),cx=r.width/2,cy=r.height/2,f=ow/nw;view.x=cx-(cx-view.x);view.y=cy-(cy-view.y);view.s*=f;applyView();updateHist();
    toast(v?`원본 해상도(${R.w}×${R.h})로 미리보기 중이에요`:'빠른 미리보기로 돌아왔어요');}
  catch(e){toast('전환 실패: '+e.message);}busy(false);}
function fitView(){if(!cur)return;const r=vw.getBoundingClientRect(),pad=r.width<600?12:(tool==='crop'?48:32);
  const s=Math.min((r.width-pad*2)/glc.width,(r.height-pad*2)/glc.height);view={s,x:(r.width-glc.width*s)/2,y:(r.height-glc.height*s)/2,fit:true};applyView();}
function zoomAt(mx,my,ns){const o=cur&&R?cur.w/R.w:1;ns=clamp(ns,.02,8*o);view.x=mx-(mx-view.x)*(ns/view.s);view.y=my-(my-view.y)*(ns/view.s);view.s=ns;view.fit=false;applyView();}
function toggleZoom(mx,my){const r=vw.getBoundingClientRect();if(mx===undefined){mx=r.width/2;my=r.height/2;}if(view.fit)zoomAt(mx,my,cur&&R?cur.w/R.w:1);else fitView();}
const scr=p=>[view.x+p[0]*view.s,view.y+p[1]*view.s];
function srcToScreen(uv){const L=R.last;return scr(M3.ap(L.F,[uv[0]*L.w,uv[1]*L.h]));}
function screenToSrc(mx,my){const L=R.last;const s=M3.ap(L.T,[(mx-view.x)/view.s,(my-view.y)/view.s]);return[s[0]/L.w,s[1]/L.h];}
function frameToScreen(nx,ny){const L=R.last;return scr([nx*L.W,ny*L.H]);}
function screenToFrame(mx,my){const L=R.last;return[(mx-view.x)/view.s/L.W,(my-view.y)/view.s/L.H];}
function screenToOut(mx,my){return[(mx-view.x)/view.s,(my-view.y)/view.s];}
function outToScreen(x,y){return scr([x,y]);}

/* ================= history ================= */
function commit(label){if(!cur)return;cur.history=cur.history.slice(0,cur.hi+1);cur.history.push({label,state:clone(cur.params)});cur.hi=cur.history.length-1;
  if(cur.history.length>150){cur.history.shift();cur.hi--;}renderHistory();$('bUndo').disabled=cur.hi<=0;$('bRedo').disabled=true;}
function replaceParams(p){cur.params=p;R.invalidate();if(RH)RH.invalidate();syncUI();requestRender();}
function gotoHistory(i){if(!cur||i<0||i>=cur.history.length)return;cur.hi=i;replaceParams(clone(cur.history[i].state));}
function renderHistory(){const l=$('histList');if(!l)return;l.innerHTML='';if(!cur)return;
  cur.history.slice().reverse().forEach((h,ri)=>{const i=cur.history.length-1-ri;const d=document.createElement('div');
    d.className='li'+(i===cur.hi?' on':'')+(i>cur.hi?' future':'');d.textContent=h.label;d.onclick=()=>gotoHistory(i);l.appendChild(d);});}

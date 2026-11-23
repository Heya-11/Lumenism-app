"use strict";
/* ================= view: fit to the selected thing (moves the view, never the image) ================= */
function layerOutCorners(L){const lr=R.last,rc=R.layerRect(L,lr.outW,lr.outH);if(!rc)return null;const cx=L.x*lr.outW,cy=L.y*lr.outH,t=L.rot*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const x=a*rc.w/2,y=b*rc.h/2;return[cx+c*x-s*y,cy+s*x+c*y];});}
function fitToSelected(){if(!cur||!R||!R.last)return;const L=tool==='layers'?selLayer():null;
  if(!L||!(L.type==='image'||L.type==='text')){fitView();return;}
  const cs=layerOutCorners(L);if(!cs){fitView();return;}
  const xs=cs.map(p=>p[0]),ys=cs.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const r=vw.getBoundingClientRect(),pad=r.width<600?12:32,o=cur.w/R.w;
  const s=clamp(Math.min((r.width-pad*2)/Math.max(1,x1-x0),(r.height-pad*2)/Math.max(1,y1-y0)),.02,8*o);
  view={s,x:r.width/2-(x0+x1)/2*s,y:r.height/2-(y0+y1)/2*s,fit:false};applyView();
  if(x0<-1||y0<-1||x1>R.last.outW+1||y1>R.last.outH+1)toast('사진 밖으로 나간 부분은 비어 보여요');}
/* double-tap / double-click helper for list rows */
function onDouble(elm,fn){let last=0;elm.addEventListener('click',e=>{const t=performance.now();if(t-last<320){last=0;fn(e);}else last=t;});}

/* ================= layer alignment ================= */
function layer100(L){const lr=R.last,rc=R.layerRect(L,lr.outW,lr.outH);if(!rc)return null;return{w:rc.w*100/L.scale,h:rc.h*100/L.scale};}
function alignLayer(kind,arg){const L=selLayer();if(!L||!R||!R.last)return;const lr=R.last,b=layer100(L);if(!b)return;
  if(kind==='center'){L.x=.5;L.y=.5;}
  else if(kind==='fill'||kind==='fit'){const f=kind==='fill'?Math.max:Math.min;L.rot=0;L.x=.5;L.y=.5;L.scale=+(f(lr.outW/b.w,lr.outH/b.h)*100).toFixed(3);}
  else if(kind==='base'){const ap=(x,y)=>M3.ap(lr.F,[x,y]);const A=ap(0,0),B=ap(lr.w,0),D=ap(0,lr.h),C=ap(lr.w/2,lr.h/2);
    const ux=[B[0]-A[0],B[1]-A[1]],uy=[D[0]-A[0],D[1]-A[1]];const bw=Math.hypot(ux[0],ux[1]);
    L.rot=+(Math.atan2(ux[1],ux[0])*180/Math.PI).toFixed(3);L.x=+(C[0]/lr.outW).toFixed(5);L.y=+(C[1]/lr.outH).toFixed(5);L.scale=+(bw/b.w*100).toFixed(3);
    if(ux[0]*uy[1]-ux[1]*uy[0]<0)toast('배경 사진이 반전돼 있어서 레이어와 좌우(상하)가 반대로 보일 수 있어요');
    const ar=L.type==='image'?(R.imageTex(L)||{}).h/(R.imageTex(L)||{}).w:0,br=Math.hypot(uy[0],uy[1])/bw;if(ar&&Math.abs(ar-br)/br>.02)toast('가로세로 비율이 달라서 가로 폭에 맞췄어요');}
  else if(kind==='same'){const T=cur.params.layers.find(x=>x.id===arg);if(!T)return;const tb=R.layerRect(T,lr.outW,lr.outH);if(!tb)return;
    L.x=T.x;L.y=T.y;L.rot=T.rot;L.scale=+(tb.w/b.w*100).toFixed(3);}
  syncUI();requestRender();drawOverlay();commit({center:'레이어 가운데 정렬',fill:'레이어 화면 채우기',fit:'레이어 전체 보이기',base:'레이어 배경과 똑같이 겹치기',same:'레이어 크기·위치 맞추기'}[kind]);}
let nudgeT=null;
function nudgeLayer(dx,dy){const L=selLayer();if(!L||!R||!R.last)return false;const lr=R.last,px=1/view.s;
  L.x=+(L.x+dx*px/lr.outW).toFixed(5);L.y=+(L.y+dy*px/lr.outH).toFixed(5);requestRender();drawOverlay();
  clearTimeout(nudgeT);nudgeT=setTimeout(()=>{syncUI();commit(L.name+' 이동');},500);return true;}

/* ================= full-screen viewing ================= */
const FS={prevTool:null,barT:null,tap:null,wantFs:false};
function fsSetCmp(m){UI.compare=m;$('bBefore').classList.toggle('on',m==='before');$('bSplit').classList.toggle('on',m==='split');$('badge').style.display=m==='before'?'block':'none';fsSync();requestRender();}
function fsSync(){const b=$('fsBar');if(!b)return;b.querySelectorAll('[data-c]').forEach(x=>x.classList.toggle('on',x.dataset.c===(UI.compare==='off'?'after':UI.compare)));
  const vis=photos.filter(visibleByFilter),i=vis.indexOf(cur);$('fsCount').textContent=vis.length>1&&i>=0?`${i+1} / ${vis.length}`:'';
  $('fsPrev').disabled=i<=0;$('fsNext').disabled=i<0||i>=vis.length-1;}
function fsShowBar(on){const b=$('fsBar');if(!b)return;clearTimeout(FS.barT);b.classList.toggle('on',on);if(on)FS.barT=setTimeout(()=>b.classList.remove('on'),3200);}
function fsStep(d){const vis=photos.filter(visibleByFilter),i=vis.indexOf(cur)+d;if(vis[i]){select(vis[i]);view.fit=true;fitView();fsSync();return true;}fitView();return false;}
async function fsLock(o){try{await screen.orientation.lock(o);return true;}catch(e){return false;}}
async function enterFs(){if(!cur||UI.fsv)return;UI.fsv=true;FS.prevTool=tool;if(tool!=='edit')setTool('edit');UI.tat=null;
  document.body.classList.add('fsv');FS.wantFs=false;const de=document.documentElement;
  if(de.requestFullscreen){try{await de.requestFullscreen({navigationUI:'hide'});FS.wantFs=true;}catch(e){}}
  if(document.body.classList.contains('m-touch')&&FS.wantFs){const ar=R&&R.last?R.last.outW/R.last.outH:1;FS.orient=ar>1.05?'landscape':ar<.95?'portrait':null;if(FS.orient)fsLock(FS.orient);}
  view.fit=true;fitView();setTimeout(()=>{if(UI.fsv){view.fit=true;fitView();}},250);fsSync();fsShowBar(true);}
function exitFs(){if(!UI.fsv)return;UI.fsv=false;document.body.classList.remove('fsv');fsShowBar(false);
  try{screen.orientation&&screen.orientation.unlock&&screen.orientation.unlock();}catch(e){}
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
  if(FS.prevTool&&FS.prevTool!==tool)setTool(FS.prevTool);view.fit=true;setTimeout(fitView,60);}
async function fsRotate(){if(!FS.wantFs){toast('이 기기에서는 화면을 돌려 고정할 수 없어요. 폰을 직접 돌려 주세요');return;}
  const curO=(screen.orientation&&screen.orientation.type||'').startsWith('landscape')?'landscape':'portrait';const n=curO==='landscape'?'portrait':'landscape';
  if(await fsLock(n)){FS.orient=n;setTimeout(()=>{view.fit=true;fitView();},300);}else toast('이 기기에서는 화면을 돌려 고정할 수 없어요. 폰을 직접 돌려 주세요');}
function initFs(){const top=$('bFit');const fb=el('button','tb');fb.id='bFull';fb.title='전체화면으로 보기 (V)';fb.disabled=true;
  fb.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="lbl">전체화면</span>';fb.onclick=()=>cur&&enterFs();top.before(fb);
  const bar=el('div','fsbar');bar.id='fsBar';
  bar.innerHTML=`<button class="fsb" id="fsPrev" title="이전 사진 (←)"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="fsc" id="fsCount"></span>
    <div class="fseg"><button data-c="before">보정 전</button><button data-c="split">반반</button><button data-c="after">보정 후</button></div>
    <button class="fsb" id="fsNext" title="다음 사진 (→)"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
    <button class="fsb fsrot" id="fsRot" title="화면 돌리기"><svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 14a7 7 0 004 6M21 10a7 7 0 00-4-6"/></svg></button>
    <button class="fsb" id="fsX" title="전체화면 닫기 (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  vw.appendChild(bar);
  bar.addEventListener('pointerdown',e=>e.stopPropagation());
  bar.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{fsSetCmp(b.dataset.c==='after'?'off':b.dataset.c);fsShowBar(true);});
  $('fsPrev').onclick=()=>{fsStep(-1);fsShowBar(true);};$('fsNext').onclick=()=>{fsStep(1);fsShowBar(true);};
  $('fsRot').onclick=()=>{fsRotate();fsShowBar(true);};$('fsX').onclick=exitFs;
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&UI.fsv&&FS.wantFs)exitFs();});
  /* tap = show/hide the bar; horizontal swipe on a fitted photo = next/previous */
  vw.addEventListener('pointerdown',e=>{if(!UI.fsv||e.target.closest('#fsBar'))return;if(pointers.size>0){if(FS.tap)FS.tap.multi=true;return;}FS.tap={x:e.clientX,y:e.clientY,t:performance.now(),fit:view.fit,s0:view.s,id:e.pointerId,multi:false};},true);
  vw.addEventListener('pointerup',e=>{if(!UI.fsv||!FS.tap||e.pointerId!==FS.tap.id)return;const t=FS.tap;FS.tap=null;if(t.multi)return;
    const dx=e.clientX-t.x,dy=e.clientY-t.y,dt=performance.now()-t.t;
    if(Math.hypot(dx,dy)<8&&dt<350){if(UI.compare==='split'){const [mx]=rel(e);const sx=view.x+UI.splitX*glc.width*view.s;if(Math.abs(mx-sx)<24)return;}fsShowBar(!$('fsBar').classList.contains('on'));return;}
    if(t.fit&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<900){if(!fsStep(dx<0?1:-1)){view.fit=true;fitView();}return;}
    if(t.fit&&Math.abs(view.s-t.s0)<1e-9){view.fit=true;fitView();}});}

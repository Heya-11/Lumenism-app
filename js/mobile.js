"use strict";
/* ================= Mobile / foldable layouts (Galaxy Z Fold: cover, inner, flex) ================= */
const MB={filmTab:null,mode:'desk',sheet:'half',film:false,lib:false,flex:false,touch:matchMedia('(pointer:coarse)').matches};
const SHEET_H={closed:0,peek:.24,half:.44,full:.8};
function segments(){try{const s=window.viewport&&window.viewport.segments;if(s&&s.length===2)return[...s];}catch(e){}return null;}
function layoutMode(){const w=innerWidth,h=innerHeight;const sg=segments();
  if(sg&&sg[0].bottom<=sg[1].top+1&&Math.abs(sg[0].width-sg[1].width)<2)return{m:'flex',sg};
  if(navigator.devicePosture&&navigator.devicePosture.type==='folded'&&w>=600&&w>h)return{m:'flex',sg:null};
  if(w<700&&h>=520)return{m:'phone'};
  if(w<1200||(MB.touch&&w<1400))return{m:'tab',short:h<520||w<760};
  return{m:'desk'};}
function applyLayout(){const L=layoutMode(),b=document.body;MB.mode=L.m;
  b.classList.toggle('m',L.m!=='desk');['phone','tab','flex'].forEach(k=>b.classList.toggle('m-'+k,L.m===k));
  b.classList.toggle('m-short',!!L.short);b.classList.toggle('m-touch',MB.touch);
  if(L.m==='flex'){const top=L.sg?L.sg[0].bottom:Math.round(innerHeight*.5),gap=L.sg?Math.max(0,L.sg[1].top-L.sg[0].bottom):0;
    b.style.setProperty('--seg1',top+'px');b.style.setProperty('--hinge',gap+'px');}
  const tools=$('tools'),nav=$('mnav');if(L.m==='phone'){if(tools.parentElement!==nav)nav.appendChild(tools);}else if(tools.parentElement!==$('right'))$('right').insertBefore(tools,$('right').querySelector('.tpanel'));
  setSheet(MB.sheet,true);const fo=L.m==='tab'?(MB.filmTab??!L.short):(L.m==='phone'||L.m==='flex')&&MB.film;b.classList.toggle('m-film',!!fo);const bf=$('bFilm');if(bf)bf.classList.toggle('on',!!fo);
  if(L.m==='desk')setLib(false);}
function setSheet(s,quiet){MB.sheet=s;const b=document.body;
  if(MB.mode!=='phone'){b.style.removeProperty('--sh');return;}
  const avail=innerHeight-48-58-(MB.film?118:0);b.style.setProperty('--sh',Math.round(avail*SHEET_H[s])+'px');b.dataset.sheet=s;
  if(!quiet)setTimeout(()=>{if(cur&&view.fit)fitView();},220);}
function setLib(on){MB.lib=on;document.body.classList.toggle('m-lib',on);}
function toggleFilm(){const on=!document.body.classList.contains('m-film');if(MB.mode==='tab')MB.filmTab=on;else MB.film=on;document.body.classList.toggle('m-film',on);$('bFilm').classList.toggle('on',on);setSheet(MB.sheet);}

function initMobile(){
  /* bottom nav (phone) + grip + drawer scrim + extra top buttons */
  const nav=el('nav','mnav');nav.id='mnav';document.querySelector('.app').appendChild(nav);
  const grip=el('div','mgrip');grip.id='mgrip';grip.innerHTML='<i></i>';$('right').prepend(grip);
  const scrim=el('div','mscrim');scrim.id='mscrim';scrim.onclick=()=>setLib(false);document.body.appendChild(scrim);
  const lib=el('button','tb mshow');lib.id='bLib';lib.title='보관함 · 프리셋 · 기록';lib.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  lib.onclick=()=>setLib(!MB.lib);document.querySelector('.top .brand').after(lib);
  const fb=el('button','tb mshow');fb.id='bFilm';fb.title='필름 스트립';fb.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M8 6v12M16 6v12"/></svg>';
  fb.onclick=toggleFilm;$('bOpen').after(fb);
  const lclose=el('button','tb mclose');lclose.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';lclose.onclick=()=>setLib(false);$('left').prepend(lclose);

  /* phone: tapping a tool opens the sheet; tapping the active one toggles it */
  $('tools').addEventListener('click',e=>{const b=e.target.closest('button[data-tool]');if(!b||MB.mode!=='phone')return;
    const wasOn=b.dataset.tool===tool&&b._wasOn;if(wasOn)setSheet(MB.sheet==='closed'?'half':'closed');else if(MB.sheet==='closed')setSheet('half');},true);
  $('tools').addEventListener('pointerdown',e=>{const b=e.target.closest('button[data-tool]');if(b)b._wasOn=b.classList.contains('on');},true);

  /* grip drag (phone sheet height) */
  let gd=null;grip.addEventListener('pointerdown',e=>{if(MB.mode!=='phone')return;grip.setPointerCapture(e.pointerId);gd={y:e.clientY,h:$('right').getBoundingClientRect().height,t:Date.now()};document.body.classList.add('m-drag');});
  grip.addEventListener('pointermove',e=>{if(!gd)return;const h=clamp(gd.h-(e.clientY-gd.y),0,innerHeight*.85);document.body.style.setProperty('--sh',h+'px');});
  grip.addEventListener('pointerup',e=>{if(!gd)return;document.body.classList.remove('m-drag');const dy=e.clientY-gd.y;
    if(Math.abs(dy)<6&&Date.now()-gd.t<300){setSheet(MB.sheet==='full'?'half':MB.sheet==='half'?'full':'half');gd=null;return;}
    const avail=innerHeight-48-58-(MB.film?118:0),f=(gd.h-dy)/avail;gd=null;
    const best=Object.entries(SHEET_H).sort((a,b)=>Math.abs(a[1]-f)-Math.abs(b[1]-f))[0][0];setSheet(best);});

  /* touch sliders: horizontal swipe on the row changes the value relatively, vertical swipe scrolls (no accidental jumps) */
  let sd=null;
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const row=e.target.closest('.sl');if(!row||e.target.classList.contains('val'))return;
    const rng=row.querySelector('input[type=range]');if(!rng)return;sd={row,rng,x:e.clientX,y:e.clientY,v:+rng.value,id:e.pointerId,dir:null,w:rng.getBoundingClientRect().width||200};},true);
  document.addEventListener('pointermove',e=>{if(!sd||e.pointerId!==sd.id)return;const dx=e.clientX-sd.x,dy=e.clientY-sd.y;
    if(!sd.dir){if(Math.abs(dx)>7&&Math.abs(dx)>Math.abs(dy)*1.2){sd.dir='h';sd.x=e.clientX;sd.row.classList.add('drag');try{sd.row.setPointerCapture(e.pointerId);}catch(_){}}else if(Math.abs(dy)>8){sd=null;}return;}
    const mn=+sd.rng.min,mx=+sd.rng.max,st=+sd.rng.step||1;const fine=Math.abs(e.clientY-sd.y)>60?.25:1;
    let v=sd.v+(e.clientX-sd.x)/sd.w*(mx-mn)*fine*UI.sens;v=clamp(Math.round(v/st)*st,mn,mx);if(+sd.rng.value!==v){sd.rng.value=v;sd.rng.dispatchEvent(new Event('input',{bubbles:true}));}},true);
  const sEnd=e=>{if(!sd||e.pointerId!==sd.id)return;const d=sd;sd=null;d.row.classList.remove('drag');if(d.dir==='h'&&+d.rng.value!==d.v)d.rng.dispatchEvent(new Event('change',{bubbles:true}));};
  document.addEventListener('pointerup',sEnd,true);document.addEventListener('pointercancel',sEnd,true);
  /* double-tap a slider row = reset (dblclick is unreliable on touch) */
  let lastTap=null;document.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')return;const row=e.target.closest('.sl');if(!row||e.target.classList.contains('val'))return;
    const now=Date.now();if(lastTap&&lastTap.row===row&&now-lastTap.t<320){row.querySelector('label').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));lastTap=null;}else lastTap={row,t:now};});

  /* film strip: long-press = multi-select mode, then taps toggle */
  let lp=null;const thumbs=$('thumbs');
  thumbs.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const th=e.target.closest('.th');if(!th||e.target.classList.contains('x'))return;
    lp={th,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{const ph=photos.find(p=>p.el===th);if(!ph)return;MB.selMode=true;document.body.classList.add('m-selmode');
      if(navigator.vibrate)navigator.vibrate(15);th.onclick({target:th,ctrlKey:true});lp.fired=true;toast('여러 장 선택 모드 — 사진을 눌러 추가/해제하세요');},480)};});
  thumbs.addEventListener('pointermove',e=>{if(lp&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10){clearTimeout(lp.timer);if(!lp.fired)lp=null;}});
  thumbs.addEventListener('pointerup',()=>{if(lp)clearTimeout(lp.timer);});
  thumbs.addEventListener('click',e=>{const th=e.target.closest('.th');if(!th||e.target.classList.contains('x'))return;
    if(lp&&lp.fired){lp=null;e.stopPropagation();e.preventDefault();return;}lp=null;
    if(MB.selMode){e.stopPropagation();th.onclick({target:th,ctrlKey:true});if(!photos.some(p=>p.selected)){MB.selMode=false;document.body.classList.remove('m-selmode');}}},true);
  thumbs.addEventListener('contextmenu',e=>{if(MB.touch)e.preventDefault();});

  /* viewer: press and hold (one finger, still) = show original while held */
  let hold=null;const vwp=$('view');
  vwp.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!cur||tool!=='edit'||UI.tat||UI.pick)return;
    if(hold){clearTimeout(hold.t);hold=null;return;}
    hold={x:e.clientX,y:e.clientY,id:e.pointerId,t:setTimeout(()=>{if(!hold)return;hold.on=true;hold.prev=UI.compare;UI.compare='before';$('badge').style.display='block';requestRender();if(navigator.vibrate)navigator.vibrate(10);},450)};});
  vwp.addEventListener('pointermove',e=>{if(hold&&!hold.on&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>8){clearTimeout(hold.t);hold=null;}});
  const hEnd=()=>{if(!hold)return;clearTimeout(hold.t);if(hold.on){UI.compare=hold.prev;$('badge').style.display=UI.compare==='before'?'block':'none';requestRender();}hold=null;};
  vwp.addEventListener('pointerup',hEnd);vwp.addEventListener('pointercancel',hEnd);
  vwp.addEventListener('contextmenu',e=>{if(MB.touch)e.preventDefault();});

  /* close the drawer after choosing something that changes the photo */
  $('left').addEventListener('click',e=>{if(MB.mode==='desk')return;/* 추천(자동) keeps the drawer open: scene analysis, picking a variant and the strength slider all happen there */
    if(e.target.closest('.li.rec,.recbox'))return;if(e.target.closest('.li,.th'))setTimeout(()=>setLib(false),150);});

  window.addEventListener('resize',()=>{clearTimeout(MB.rt);MB.rt=setTimeout(applyLayout,60);});
  try{if(window.viewport&&window.viewport.addEventListener)window.viewport.addEventListener('segmentschange',applyLayout);}catch(e){}
  try{if(navigator.devicePosture)navigator.devicePosture.addEventListener('change',applyLayout);}catch(e){}
  if(MB.touch){$('filmHint').textContent='길게 눌러 여러 장 선택';if(UI.brush.size===60)UI.brush.size=32;
    /* Android: image/* only -> system photo picker (gallery). RAW needs the file browser, so it gets its own input/button */
    const f=$('file'),raw=f.cloneNode();raw.id='fileRaw';raw.accept=f.accept;f.accept='image/*';f.after(raw);raw.onchange=e=>{addFiles(e.target.files);e.target.value='';};
    const rb=el('button','tb','RAW · 파일에서 열기');rb.id='bOpenRaw';rb.onclick=()=>raw.click();$('bOpen2').after(rb);$('bOpen2').textContent='갤러리에서 사진 선택';
    const sb=el('div','msens');sb.innerHTML='<span>터치 조절 감도</span>';lclose.after(sb);sensChips(sb);
    const lr=el('button','btn full','RAW · 파일에서 사진 열기');lr.style.margin='4px 12px 8px';lr.style.width='calc(100% - 24px)';lr.onclick=()=>{setLib(false);raw.click();};lclose.after(lr);
    const ep=document.querySelector('#empty p');if(ep)ep.textContent='갤러리에서 사진을 고르세요. RAW(CR2·NEF·ARW·DNG 등)는 ‘RAW · 파일에서 열기’로 여세요. 사진은 휴대폰 안에서만 처리돼요.';}
  MB.sheet='half';applyLayout();}

/* share (Android: 공유 → 갤러리/드라이브 등) */
async function shareFiles(files){const fl=files.map(f=>new File([f.blob],f.name,{type:f.blob.type}));
  if(!(navigator.canShare&&navigator.canShare({files:fl})))return false;
  try{await navigator.share({files:fl,title:'Lumenism'});return true;}catch(e){if(e&&e.name==='AbortError')return true;console.warn(e);return false;}}

const SENS=[[.45,'세밀하게'],[1,'보통'],[1.7,'빠르게']];
function setSens(v){UI.sens=v;try{localStorage.setItem('lumen.sens',v);}catch(e){}document.querySelectorAll('.senschips button').forEach(b=>b.classList.toggle('on',+b.dataset.v===v));}
function sensChips(parent){const d=el('div','chips senschips');SENS.forEach(([v,n])=>{const b=el('button','',n);b.dataset.v=v;b.classList.toggle('on',v===UI.sens);b.onclick=()=>setSens(v);d.appendChild(b);});parent.appendChild(d);return d;}

"use strict";
/* ================= import ================= */
const PREV_MAX=2560;
function drawScaled(src,sw,sh,max){const s=Math.min(1,max/Math.max(sw,sh));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*s));c.height=Math.max(1,Math.round(sh*s));
  const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);return c;}
async function loadSource(file){
  if(RAW_RE.test(file.name)){const b=new Uint8Array(await file.arrayBuffer());const c=await rawPreview(b);return{src:c,raw:true,exif:exifFrom(b)};}
  let exif={};try{exif=exifFrom(new Uint8Array(await file.slice(0,262144).arrayBuffer()));}catch(e){}
  try{return{src:await createImageBitmap(file,{imageOrientation:'from-image'}),exif};}
  catch(e){return{exif,src:await new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('decode'));im.src=url;})};}}
function ensureRenderer(){if(R)return true;try{R=new Renderer(glc);}catch(e){toast(e.message);return false;}
  if(!R.localOK){const n=$('maskNoGL');if(n)n.style.display='';}return true;}
function makePhoto(o){const ph=Object.assign({uid:++uidN,params:defaults(),history:[{label:o.label||'가져오기',state:defaults()}],hi:0,sel:null,selComp:null,selRet:null,selLayer:null,selPC:0,
  snaps:[],rating:0,flag:0,selected:false},o);if(o.params)ph.history=[{label:o.label||'가져오기',state:clone(o.params)}];return ph;}
async function addFiles(files){
  files=[...files].filter(f=>f.type.startsWith('image/')||RAW_RE.test(f.name)||/\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name));if(!files.length)return;
  if(!ensureRenderer())return;busy(true,'불러오는 중…');let first=null;const fails=[];let rawMsg='';
  for(const f of files){try{const {src,raw,exif}=await loadSource(f);const w=src.width,h=src.height;
      const prev=drawScaled(src,w,h,Math.min(PREV_MAX,R.maxTex));const th=drawScaled(src,w,h,200).toDataURL('image/jpeg',.75);
      const ph=makePhoto({name:f.name,bm:src,w,h,prev,raw,exif,thumb:th});photos.push(ph);addThumb(ph);first=first||ph;if(raw)rawMsg=`RAW 파일은 내장 JPEG(${w}×${h})로 열었어요`;}
    catch(e){fails.push(f.name+(e&&e.message&&!/decode/.test(e.message)?' — '+e.message:''));}}
  if(UI.stacks)buildStacks();busy(false);if(fails.length)toast('열지 못한 파일: '+fails.join(', '));else if(rawMsg)toast(rawMsg);if(first)select(first);}
function thumbBadges(ph){const d=ph.el;if(!d)return;const cb=d.querySelector('.cb');if(cb)cb.textContent=ph.cull?[ph.cull.blur?'흐림':'',ph.cull.blink?'눈 감음':''].filter(Boolean).join(' · '):'';d.title=ph.name+(ph.tags&&ph.tags.length?'\n태그: '+ph.tags.join(', '):'');d.querySelector('.st').textContent='★'.repeat(ph.rating);d.querySelector('.fl').textContent=ph.flag===1?'⚑':ph.flag===-1?'✕':'';
  d.classList.toggle('reject',ph.flag===-1);d.classList.toggle('sel',ph.selected);}
function addThumb(ph,after){const d=el('div','th');d.innerHTML=`<img alt=""><button class="x" title="제거">×</button><i class="dot"></i><span class="st"></span><span class="fl"></span><span class="cb"></span>${ph.raw?'<span class="raw">RAW</span>':''}${ph.vc?'<span class="vc">사본</span>':''}`;
  d.querySelector('img').src=ph.thumb;
  d.onclick=e=>{if(e.target.classList.contains('x'))return;
    if(e.metaKey||e.ctrlKey){ph.selected=!ph.selected;if(cur&&!cur.selected&&ph.selected)cur.selected=true;photos.forEach(thumbBadges);syncUI();return;}
    if(e.shiftKey&&cur){const a=photos.indexOf(cur),b=photos.indexOf(ph);photos.forEach((p,i)=>p.selected=i>=Math.min(a,b)&&i<=Math.max(a,b)&&visibleByFilter(p));photos.forEach(thumbBadges);syncUI();return;}
    photos.forEach(p=>p.selected=false);photos.forEach(thumbBadges);select(ph);};
  d.querySelector('.x').onclick=()=>removePhoto(ph);ph.el=d;
  const th=$('thumbs');if(after&&after.el)after.el.after(d);else th.insertBefore(d,$('bAdd'));thumbBadges(ph);applyFilter();}
function removePhoto(ph){const i=photos.indexOf(ph);if(i<0)return;photos.splice(i,1);ph.el.remove();if(!photos.some(p=>p.bm===ph.bm))ph.bm.close&&ph.bm.close();
  if(cur===ph){cur=null;const n=photos.filter(visibleByFilter);if(n.length)select(n[Math.min(i,n.length-1)]);else if(photos.length)select(photos[0]);else setEmpty();}syncUI();}
function setEmpty(){glc.style.display='none';$('empty').style.display='';['left','right'].forEach(i=>$(i).classList.add('disabled'));
  ['bBefore','bSplit','bHQ','bFit','bReset','bExport','bUndo','bRedo'].forEach(i=>$(i).disabled=true);hideHi();$('mName').textContent='—';$('mDim').textContent='';$('exif').textContent='';
  $('zoomLbl').textContent='—';hctx.clearRect(0,0,hcv.width,hcv.height);ov.innerHTML='';vhint('');syncUI();}
function select(ph){recOnSelect();UI.cropSug=null;if(UI.recAI&&!ph._aiInfo)recAIInfo(ph).then(()=>{if(cur===ph){recCache=null;syncUI();}});photos.forEach(p=>{if(p!==ph&&p.full&&p.full!==p.bm)p.full=null;});cur=ph;R.setSource(UI.fullPreview?fullSource(ph):ph.prev,UI.fullPreview?2048:1024);glc.style.display='block';$('empty').style.display='none';
  UI.pendingCreate=null;UI.straighten=false;UI.guide=false;UI.guideLines=[];UI.pick=null;UI.ret.off=null;
  ['left','right'].forEach(i=>$(i).classList.remove('disabled'));['bBefore','bSplit','bHQ','bFit','bReset','bExport'].forEach(i=>$(i).disabled=false);
  photos.forEach(p=>p.el.classList.toggle('on',p===ph));ph.el.scrollIntoView({block:'nearest',inline:'nearest'});
  $('mName').textContent=ph.name;$('mDim').textContent=`${ph.w} × ${ph.h}`+(ph.raw?' · RAW 미리보기':'');$('exif').textContent=exifText(ph.exif);
  doRender();fitView();syncUI();updateModeUI();}
const pickHandlers={};
function pickFile(accept,fn){const i=$('fileAny');i.accept=accept;i.value='';i.onchange=()=>{const f=i.files[0];if(f)fn(f);};i.click();}

/* ================= filmstrip: rating / flag / filter ================= */
function targets(){const s=photos.filter(p=>p.selected);return s.length?s:(cur?[cur]:[]);}
function setRating(n){targets().forEach(p=>{p.rating=p.rating===n&&targets().length===1?0:n;thumbBadges(p);});syncUI();applyFilter();}
function setFlag(f){targets().forEach(p=>{p.flag=f;thumbBadges(p);});syncUI();applyFilter();}
function visibleByFilter(p){if(stackHidden(p))return false;const q=UI.tagQuery;if(q&&!(p.tags||[]).some(t=>t.includes(q)||q.includes(t)))return false;const f=UI.filter;if(f==='all')return true;if(f==='pick')return p.flag===1;if(f==='noreject')return p.flag!==-1;if(f==='edited')return isEdited(p);if(f==='unedited')return !isEdited(p);return p.rating>=+f;}
function applyFilter(){photos.forEach(p=>{if(p.el)p.el.style.display=visibleByFilter(p)?'':'none';});}
$('filmFilter').onchange=e=>{UI.filter=e.target.value;applyFilter();if(cur&&!visibleByFilter(cur)){const n=photos.find(visibleByFilter);if(n)select(n);}};

/* ================= virtual copy / snapshots / presets / sync ================= */
function virtualCopy(){if(!cur)return;const n=photos.filter(p=>p.bm===cur.bm).length;
  const ph=makePhoto({name:cur.name.replace(/\.[^.]+$/,'')+` (사본 ${n})`,bm:cur.bm,w:cur.w,h:cur.h,prev:cur.prev,raw:cur.raw,exif:cur.exif,thumb:cur.thumb,vc:true,params:clone(cur.params),label:'가상 사본'});
  photos.splice(photos.indexOf(cur)+1,0,ph);addThumb(ph,cur);select(ph);toast('가상 사본을 만들었어요');}
function ask(title,def){return new Promise(res=>{const m=$('askModal'),i=$('askInput');$('askTitle').textContent=title;i.value=def||'';m.classList.add('on');setTimeout(()=>{i.focus();i.select();},30);
  const done=v=>{m.classList.remove('on');$('askOk').onclick=$('askCancel').onclick=i.onkeydown=null;res(v);};
  $('askOk').onclick=()=>done(i.value.trim()||def);$('askCancel').onclick=()=>done(null);i.onkeydown=e=>{if(e.key==='Enter')done(i.value.trim()||def);if(e.key==='Escape')done(null);};});}
function confirmDialog(title,msg){return new Promise(res=>{const m=$('askModal'),i=$('askInput');$('askTitle').textContent=title;i.style.display='none';
  let p=m.querySelector('.askmsg');if(!p){p=el('div','note askmsg');i.after(p);}p.textContent=msg;p.style.display='';m.classList.add('on');
  const done=v=>{m.classList.remove('on');i.style.display='';p.style.display='none';$('askOk').onclick=$('askCancel').onclick=null;res(v);};$('askOk').onclick=()=>done(true);$('askCancel').onclick=()=>done(false);});}
async function makeSnapshot(){if(!cur)return;const d=new Date();const n=await ask('스냅샷 이름',`스냅샷 ${cur.snaps.length+1} (${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')})`);
  if(!n)return;cur.snaps.push({name:n,state:clone(cur.params)});syncUI();toast('스냅샷을 저장했어요');}
function loadUserPresets(){try{return JSON.parse(localStorage.getItem('darkroom.presets.v1')||'[]');}catch(e){return[];}}
function saveUserPresets(a){try{localStorage.setItem('darkroom.presets.v1',JSON.stringify(a));}catch(e){toast('이 브라우저에서는 프리셋을 저장할 수 없어요');}}
function presetFromParams(p){const o=clone(p);delete o.masks;PHOTO_ONLY.forEach(k=>delete o[k]);const d=defaults();for(const k in o)if(JSON.stringify(o[k])===JSON.stringify(d[k]))delete o[k];return o;}
async function saveCurrentPreset(){if(!cur)return;const n=await ask('프리셋 이름','내 프리셋 '+(loadUserPresets().length+1));if(!n)return;
  const a=loadUserPresets();a.push({n,p:presetFromParams(cur.params)});saveUserPresets(a);syncUI();toast(`‘${n}’ 프리셋을 저장했어요`);}
function applyPreset(pr){if(!cur)return;const keep={masks:cur.params.masks};PHOTO_ONLY.forEach(k=>keep[k]=cur.params[k]);
  const np=Object.assign(defaults(),clone(pr.p),clone(keep));if(pr.p.fx)np.fx=Object.assign(defaults().fx,clone(pr.p.fx));np.portrait=Object.assign(np.portrait,{aid:cur.params.portrait.aid});np.fx.aid=cur.params.fx.aid;np.portrait.fw=clone(cur.params.portrait.fw||[]);np.portrait.edits=clone(cur.params.portrait.edits||[]);np.sky=Object.assign(defaults().sky,np.sky||{},{aid:cur.params.sky.aid});if(!np.sky.aid)np.sky.on=false;np.light=Object.assign(defaults().light,np.light||{},{aid:cur.params.light.aid});if(!np.light.aid)np.light.on=false;if(np.lut.id&&!STORE.luts.has(np.lut.id))np.lut={id:null,name:'',amt:100};replaceParams(np);commit('프리셋: '+pr.n);}
async function exportPresets(){const a=loadUserPresets();if(!a.length){toast('저장한 프리셋이 없어요');return;}await saveFile('lumenism-presets.json',JSON.stringify(a,null,1),'application/json');}
async function importPresets(f){try{const a=JSON.parse(await f.text());if(!Array.isArray(a))throw 0;const b=loadUserPresets();a.forEach(x=>{if(x&&x.n&&x.p)b.push({n:x.n,p:x.p});});saveUserPresets(b);syncUI();toast(`${a.length}개 프리셋을 가져왔어요`);}
  catch(e){toast('프리셋 파일을 읽지 못했어요');}}
function adaptParams(src,ph){const np=clone(src);PHOTO_ONLY.forEach(k=>np[k]=clone(ph.params[k]));np.portrait.aid=ph.params.portrait.aid;np.fx.aid=ph.params.fx.aid;np.portrait.fw=clone(ph.params.portrait.fw||[]);np.portrait.edits=clone(ph.params.portrait.edits||[]);np.sky.aid=(ph.params.sky||{}).aid||null;if(!np.sky.aid)np.sky.on=false;np.light.aid=(ph.params.light||{}).aid||null;if(!np.light.aid)np.light.on=false;
  if(np.fx.tilt>=3&&np.fx.tilt<=5&&!np.fx.aid)np.fx.tilt=0;np.masks=np.masks.map(m=>Object.assign(m,{comps:m.comps.filter(c=>c.type!=='ai'||c.ph===ph.uid)})).filter(m=>m.comps.length);
  if(np.fx.tilt===6&&!np.masks.some(m=>m.id===np.fx.maskId))np.fx.tilt=0;return np;}
function syncToOthers(){if(!cur)return;const s=clone(cur.params);const sel=photos.filter(p=>p.selected&&p!==cur);const list=sel.length?sel:photos.filter(p=>p!==cur);let n=0;
  list.forEach(ph=>{ph.params=adaptParams(s,ph);ph.history=ph.history.slice(0,ph.hi+1);ph.history.push({label:'설정 동기화',state:clone(ph.params)});ph.hi=ph.history.length-1;markEdited(ph);n++;});
  toast(n?`${n}장의 사진에 적용했어요 (자르기·리터칭·레이어 제외)`:'다른 사진이 없어요');}
async function loadLutFile(f){try{const L=parseCube(await f.text());const id='lut:'+f.name+':'+L.size;STORE.luts.set(id,L);const p=P();p.lut.id=id;p.lut.name=f.name.replace(/\.cube$/i,'');
    R.lut3Key='?';syncUI();requestRender();commit('LUT 적용: '+p.lut.name);}catch(e){toast(e.message||'LUT을 읽지 못했어요');}}

/* ================= HDR ================= */
async function hdrMerge(){const sel=photos.filter(p=>p.selected);if(sel.length<2){toast('필름 스트립에서 '+(MB.touch?'사진을 길게 눌러':'Ctrl/⌘+클릭으로')+' 2장 이상 선택하세요');return;}
  const ar=sel[0].w/sel[0].h;if(sel.some(p=>Math.abs(p.w/p.h-ar)>.02)){toast('같은 크기·방향의 브래킷 사진만 병합할 수 있어요');return;}
  const s=Math.min(1,2048/Math.max(sel[0].w,sel[0].h));const W=Math.round(sel[0].w*s),H=Math.round(sel[0].h*s);
  busy(true,'HDR 병합 준비 중…');await nextFrame();
  const imgs=sel.map(p=>{const c=drawScaled(p.bm,p.w,p.h,Math.max(W,H));const x=c.getContext('2d');return x.getImageData(0,0,W,H).data;});
  const finish=data=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),W,H),0,0);
    const ph=makePhoto({name:'HDR_'+sel[0].name.replace(/\.[^.]+$/,'')+'.png',bm:c,w:W,h:H,prev:c,exif:sel[0].exif,thumb:drawScaled(c,W,H,200).toDataURL('image/jpeg',.75),label:'HDR 병합'});
    photos.push(ph);addThumb(ph);photos.forEach(p=>p.selected=false);photos.forEach(thumbBadges);busy(false);select(ph);toast(`${sel.length}장을 HDR로 병합했어요 (${W}×${H})`);};
  const fallback=async()=>{busy(true,'HDR 병합 중… (잠시 화면이 멈출 수 있어요)');await nextFrame();try{finish(hdrFuse(imgs,W,H).data);}catch(e){busy(false);toast('HDR 병합 실패: '+e.message);}};
  let wk;try{wk=new Worker('js/hdr.js');}catch(e){return fallback();}
  let started=false;wk.onmessage=e=>{const m=e.data;started=true;if(m.progress!==undefined)busy(true,`HDR 병합 중… ${Math.round(m.progress*100)}%`);
    if(m.done){wk.terminate();finish(m.data);}if(m.error){wk.terminate();busy(false);toast('HDR 병합 실패: '+m.error);}};
  wk.onerror=ev=>{ev.preventDefault&&ev.preventDefault();wk.terminate();if(!started)fallback();else{busy(false);toast('HDR 병합 실패');}};
  wk.postMessage({imgs,W,H});}

/* ================= export ================= */
let downloadsP=null;
function getDownloads(){if(!downloadsP){downloadsP=(window.claude&&typeof window.claude.use==='function')?
    Promise.race([window.claude.use('downloads').catch(()=>null),new Promise(r=>setTimeout(()=>r(null),10000))]):Promise.resolve(null);}return downloadsP;}
setTimeout(getDownloads,0);
async function saveFile(name,data,mime){const dl=await getDownloads();
  if(dl){try{await dl.save({filename:name,data});toast('저장했어요: '+name);return true;}catch(e){if(e&&e.code==='declined'){toast('저장을 취소했어요');return false;}}}
  const blob=data instanceof Blob?data:new Blob([data],{type:mime||'application/octet-stream'});const url=URL.createObjectURL(blob);
  if(!window.claude){const a=el('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('저장했어요: '+name);return true;}
  if(/^image\//.test(blob.type)){$('expResult').innerHTML=`<img src="${url}"><div class="note">이 화면에서는 바로 저장할 수 없어요. 이미지를 길게 누르거나 우클릭해 저장하세요.</div>`;}
  else{const a=el('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();toast('이 화면에서는 파일 저장이 막혀 있을 수 있어요');}return false;}
const POS=[['tl','왼쪽 위'],['tc','위 가운데'],['tr','오른쪽 위'],['ml','왼쪽 가운데'],['mc','가운데'],['mr','오른쪽 가운데'],['bl','왼쪽 아래'],['bc','아래 가운데'],['br','오른쪽 아래']];
let wmLogo=null;
function buildExportForm(){const f=$('expForm');const E=UI.exp;f.innerHTML='';const o={always:true,noCommit:true,noRender:true};const upd=()=>{saveExp();updateExpPreview();};
  const mk=(fn,...a)=>{const c=fn(...a);return c;};
  selectCtl(f,'대상','ui:exp.target',[['cur','현재 사진'],['sel','선택한 사진'],['vis','필터에 보이는 모든 사진']],{...o,onSet:upd});
  selectCtl(f,'형식','ui:exp.fmt',[['image/jpeg','JPEG'],['image/png','PNG'],['image/webp','WebP']],{...o,onSet:upd});
  slider(f,{path:'ui:exp.q',label:'품질',min:50,max:100,def:92,fmt:v=>Math.round(v),...o,onDone:upd});
  selectCtl(f,'크기 (긴 변)','ui:exp.size',[['0','원본 크기'],['4096','4096 px'],['2048','2048 px'],['1600','1600 px'],['1080','1080 px']],{...o,onSet:upd});
  selectCtl(f,'출력 선명하게','ui:exp.os',[['0','없음'],['0.35','화면용 · 낮음'],['0.7','화면용 · 표준'],['1.1','인쇄용 · 강하게']],{...o,onSet:upd});
  textCtl(f,'파일명','ui:exp.tpl',{...o,onSet:saveExp});f.appendChild(el('div','hint','{name} 원본 이름 · {n} 번호 · {date} 날짜 · {stars} 별점'));
  chk(f,'AI 2배 업스케일 (느림 · 긴 변 2048px 이하에서 처리)','ui:exp.up',{...o,onSet:saveExp});
  sub(f,'워터마크');chk(f,'워터마크 넣기','ui:exp.wm.on',{...o,onSet:upd});
  textCtl(f,'텍스트','ui:exp.wm.text',{...o,onSet:upd});selectCtl(f,'글꼴','ui:exp.wm.font',FONTS.map(x=>[x,x]),{...o,onSet:upd});
  slider(f,{path:'ui:exp.wm.size',label:'크기',min:1,max:12,step:.5,def:3,fmt:v=>(+v).toFixed(1),...o,onDone:upd});
  slider(f,{path:'ui:exp.wm.op',label:'불투명도',min:5,max:100,def:75,fmt:v=>Math.round(v),...o,onDone:upd});
  selectCtl(f,'위치','ui:exp.wm.pos',POS,{...o,onSet:upd});colorCtl(f,'색상','ui:exp.wm.color',{...o,onSet:upd});
  const lr=el('div','inline');f.appendChild(lr);btn(lr,'로고 이미지…',()=>pickFile('image/*',async fl=>{try{const bm=await createImageBitmap(fl);wmLogo=drawScaled(bm,bm.width,bm.height,1024);updateExpPreview();}catch(e){toast('로고를 열지 못했어요');}}),'btn sm',{always:true});
  btn(lr,'로고 빼기',()=>{wmLogo=null;updateExpPreview();},'btn sm',{always:true});
  slider(f,{path:'ui:exp.wm.logoSize',label:'로고 크기',min:3,max:50,def:15,fmt:v=>Math.round(v)+'%',...o,onDone:upd});
  sub(f,'테두리');chk(f,'테두리 넣기','ui:exp.border.on',{...o,onSet:upd});
  slider(f,{path:'ui:exp.border.w',label:'두께',min:.5,max:20,step:.5,def:3,fmt:v=>(+v).toFixed(1)+'%',...o,onDone:upd});colorCtl(f,'색상','ui:exp.border.color',{...o,onSet:upd});
  controls.forEach(c=>c.sync());}
function saveExp(){try{localStorage.setItem('darkroom.exp',JSON.stringify(UI.exp));}catch(e){}}
function compose(src,E){const W=src.width,H=src.height;const b=E.border.on?Math.round(E.border.w/100*Math.max(W,H)):0;
  const c=document.createElement('canvas');c.width=W+b*2;c.height=H+b*2;const x=c.getContext('2d');if(b){x.fillStyle=E.border.color;x.fillRect(0,0,c.width,c.height);}x.drawImage(src,b,b);
  if(E.wm.on){const px=Math.max(8,E.wm.size/100*H);const m=px*.9;const pos=E.wm.pos;x.globalAlpha=E.wm.op/100;
    const ax=pos[1]==='l'?b+m:pos[1]==='r'?b+W-m:b+W/2,ay=pos[0]==='t'?b+m:pos[0]==='b'?b+H-m:b+H/2;
    let lh=0,lw=0;if(wmLogo){lw=E.wm.logoSize/100*W;lh=lw*wmLogo.height/wmLogo.width;}
    const txt=(E.wm.text||'').trim();x.font=`600 ${px}px "${E.wm.font}", "Noto Sans KR", sans-serif`;const tw=txt?x.measureText(txt).width:0,th=txt?px:0;
    const gap=lh&&th?px*.4:0,totH=lh+gap+th;let top=pos[0]==='t'?ay:pos[0]==='b'?ay-totH:ay-totH/2;
    const alignX=w=>pos[1]==='l'?ax:pos[1]==='r'?ax-w:ax-w/2;
    if(lh){x.drawImage(wmLogo,alignX(lw),top,lw,lh);top+=lh+gap;}
    if(txt){x.fillStyle=E.wm.color;x.textBaseline='top';x.shadowColor='rgba(0,0,0,.35)';x.shadowBlur=px*.15;x.fillText(txt,alignX(tw),top);}x.globalAlpha=1;}
  return c;}
async function renderPhoto(ph,E,maxLong){if(document.fonts)await document.fonts.ready;
  const G=geoMats(ph.w,ph.h,ph.params.geo,false);const lim=maxLong||(+E.size||Infinity);
  const sc=Math.min(1,lim/Math.max(G.outW,G.outH),Math.min(R.maxTex,TEX_CAP)/Math.max(ph.w,ph.h));
  const srcC=drawScaled(ph.bm,ph.w,ph.h,Math.max(ph.w,ph.h)*sc);
  if(ph.params.layers.some(l=>l.type==='image'))ph.params.layers.forEach(l=>l.img&&ensureImageSourceFor(l.img));
  const oc=document.createElement('canvas');const r2=new Renderer(oc);
  let flat;try{r2.setSource(srcC,maxLong?512:2048);r2.render(ph.params,{outSharp:maxLong?0:+E.os});flat=document.createElement('canvas');flat.width=oc.width;flat.height=oc.height;flat.getContext('2d').drawImage(oc,0,0);}finally{r2.dispose();}
  if(!maxLong&&E.up&&aiAvailable()){let inp=flat;if(Math.max(flat.width,flat.height)>2048)inp=drawScaled(flat,flat.width,flat.height,2048);
    try{flat=await aiUpscale2x(inp,p=>{$('expStatus').textContent=`AI 업스케일 중… ${Math.round(p*100)}%`;});}catch(e){console.error(e);toast('AI 업스케일 실패 — 원래 크기로 저장해요');}}
  return compose(flat,E);}
function ensureImageSourceFor(id){if(id.startsWith('photo:')&&!STORE.images.has(id)){const p=photos.find(x=>'photo:'+x.uid===id);if(p)STORE.images.set(id,p.prev);}}
let prevTimer=null;
function updateExpPreview(){clearTimeout(prevTimer);prevTimer=setTimeout(async()=>{if(!cur)return;try{const c=await renderPhoto(cur,UI.exp,420);
  $('expPrev').innerHTML='';const im=el('img');im.src=c.toDataURL('image/jpeg',.85);$('expPrev').appendChild(im);}catch(e){$('expPrev').textContent='미리보기 실패';}},120);}
function expName(ph,i){const E=UI.exp;const d=new Date();const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[E.fmt];
  const base=(E.tpl||'{name}').replace(/\{name\}/g,ph.name.replace(/\.[^.]+$/,'')).replace(/\{n\}/g,String(i+1).padStart(3,'0'))
    .replace(/\{date\}/g,`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`).replace(/\{stars\}/g,ph.rating?ph.rating+'star':'').replace(/[\\/:*?"<>|]/g,'_');
  return base+'.'+ext;}
$('bExport').onclick=()=>{if(!cur)return;if(!$('expForm').childElementCount)buildExportForm();else controls.forEach(c=>c.sync());$('expResult').innerHTML='';$('expStatus').textContent='';$('expModal').classList.add('on');updateExpPreview();};
$('eCancel').onclick=()=>$('expModal').classList.remove('on');
$('expModal').addEventListener('pointerdown',e=>{if(e.target.id==='expModal')$('expModal').classList.remove('on');});
async function buildExport(){const E=UI.exp;const list=E.target==='cur'?[cur]:E.target==='sel'?photos.filter(p=>p.selected):photos.filter(visibleByFilter);
  if(!list.length){toast('내보낼 사진이 없어요 (선택한 사진 없음)');return null;}const files=[];const used=new Set();
  for(let i=0;i<list.length;i++){$('expStatus').textContent=`처리 중… ${i+1}/${list.length}`;await nextFrame();
    const c=await renderPhoto(list[i],E);const blob=await new Promise(r=>c.toBlob(r,E.fmt,E.q/100));if(!blob)throw new Error('인코딩 실패');
    let nm=expName(list[i],i);while(used.has(nm))nm=nm.replace(/(\.\w+)$/,'_1$1');used.add(nm);files.push({name:nm,blob,w:c.width,h:c.height});c.width=c.height=1;}
  $('expStatus').textContent='';return files;}
$('eShare').onclick=async()=>{const b=$('eShare');b.disabled=true;try{const files=await buildExport();if(files){const ok=await shareFiles(files);if(ok)$('expModal').classList.remove('on');else toast('이 기기에서는 공유를 쓸 수 없어요. 내보내기를 눌러 저장하세요');}}
  catch(e){toast('내보내기 실패: '+(e.message||e));$('expStatus').textContent='';}b.disabled=false;};
$('eGo').onclick=async()=>{const E=UI.exp;const go=$('eGo');go.disabled=true;
  try{const files=await buildExport();if(!files){go.disabled=false;return;}
    if(files.length===1){const ok=await saveFile(files[0].name,files[0].blob,E.fmt);if(ok)$('expModal').classList.remove('on');}
    else{const zf=[];for(const f of files)zf.push({name:f.name,data:new Uint8Array(await f.blob.arrayBuffer())});const ok=await saveFile(`lumenism_${files.length}장.zip`,makeZip(zf),'application/zip');if(ok)$('expModal').classList.remove('on');}}
  catch(e){toast('내보내기 실패: '+(e.message||e));$('expStatus').textContent='';}go.disabled=false;};

/* ================= toolbar / keyboard / dnd ================= */
$('file').onchange=e=>{addFiles(e.target.files);e.target.value='';};
['bOpen','bOpen2','bAdd'].forEach(i=>$(i).onclick=()=>$('file').click());
$('bUndo').onclick=()=>cur&&gotoHistory(cur.hi-1);$('bRedo').onclick=()=>cur&&gotoHistory(cur.hi+1);
$('bReset').onclick=()=>{if(!cur)return;replaceParams(defaults());commit('모두 초기화');};
function setCompare(m){UI.compare=UI.compare===m?'off':m;$('bBefore').classList.toggle('on',UI.compare==='before');$('bSplit').classList.toggle('on',UI.compare==='split');
  $('badge').style.display=UI.compare==='before'?'block':'none';requestRender();}
$('bBefore').onclick=()=>cur&&setCompare('before');$('bSplit').onclick=()=>cur&&setCompare('split');
$('bFit').onclick=()=>cur&&toggleZoom();
$('bHQ').onclick=()=>cur&&setFullPreview(!UI.fullPreview);$('bHQ').classList.toggle('on',UI.fullPreview);
function setClip(v){UI.clip=v;$('clipL').classList.toggle('on',v);$('clipR').classList.toggle('on',v);requestRender();}
$('clipL').onclick=$('clipR').onclick=()=>cur&&setClip(!UI.clip);
$('tools').querySelectorAll('button').forEach(b=>b.onclick=()=>cur&&setTool(b.dataset.tool));
let dragDepth=0;
window.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){dragDepth++;$('drop').classList.add('on');}});
window.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop').classList.remove('on');});
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop').classList.remove('on');
  const fs=[...e.dataTransfer.files];const cubes=fs.filter(f=>/\.cube$/i.test(f.name));if(cubes.length&&cur)loadLutFile(cubes[0]);addFiles(fs.filter(f=>!/\.cube$/i.test(f.name)));});
window.addEventListener('keydown',e=>{
  if(e.target.matches('input.val,input.txt,textarea,select')||$('askModal').classList.contains('on'))return;
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();if(cur)gotoHistory(cur.hi+(e.shiftKey?1:-1));return;}
  if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();if(cur)gotoHistory(cur.hi+1);return;}
  if(mod&&e.key==="'"){e.preventDefault();virtualCopy();return;}
  if(e.key===' '){if(!UI.space){UI.space=true;vw.classList.add('space');drawOverlay();}if(!e.target.matches('button'))e.preventDefault();return;}
  if(e.target.matches('input[type=range]')&&/Arrow/.test(e.key))return;
  if(!cur||mod||e.altKey)return;const k=e.key;
  const tools={e:'edit',E:'edit',r:'crop',R:'crop',m:'mask',M:'mask',q:'retouch',Q:'retouch',l:'layers',L:'layers',f:'portrait',F:'portrait'};
  if(k==='i'||k==='I'){toggleAIOv();return;}
  if(k==='\\')setCompare('before');else if(k==='y'||k==='Y')setCompare('split');
  else if(k==='z'||k==='Z')toggleZoom();else if(k==='j'||k==='J')setClip(!UI.clip);
  else if(tools[k])setTool(tool===tools[k]&&k.toLowerCase()!=='e'?'edit':tools[k]);
  else if(k>='0'&&k<='5')setRating(+k);else if(k==='p'||k==='P')setFlag(1);else if(k==='x'||k==='X')setFlag(-1);else if(k==='u'||k==='U')setFlag(0);
  else if((k==='o'||k==='O')&&tool==='mask'){UI.showOverlay=!UI.showOverlay;syncUI();requestRender();}
  else if(k==='Enter'&&tool==='crop')setTool('edit');
  else if(k==='Escape'){if(UI.pick||UI.tat||UI.straighten||UI.guide||UI.pendingCreate||UI.ret.awaitSrc){UI.pick=UI.tat=UI.pendingCreate=null;UI.straighten=UI.guide=UI.ret.awaitSrc=false;updateModeUI();}else if(tool!=='edit')setTool('edit');}
  else if(k==='Delete'||k==='Backspace'){if(tool==='mask'&&selMask()){e.preventDefault();deleteMask();}else if(tool==='retouch'&&selRet()){e.preventDefault();deleteRet();}else if(tool==='layers'&&selLayer()){e.preventDefault();deleteLayer();}}
  else if(k==='['||k===']'){const f=k===']'?1.15:1/1.15;if(tool==='portrait')UI.liq.size=clamp(Math.round(UI.liq.size*f),5,500);if(tool==='mask')UI.brush.size=clamp(Math.round(UI.brush.size*f),3,400);if(tool==='retouch')UI.ret.size=clamp(Math.round(UI.ret.size*f),3,400);syncUI();drawOverlay();}
  else if((k==='ArrowRight'||k==='ArrowLeft')&&!e.target.matches('input')){const vis=photos.filter(visibleByFilter);const i=vis.indexOf(cur)+(k==='ArrowRight'?1:-1);if(vis[i])select(vis[i]);}});
window.addEventListener('keyup',e=>{if(e.key===' '){UI.space=false;vw.classList.remove('space');drawOverlay();}});
if(document.fonts)document.fonts.addEventListener&&document.fonts.addEventListener('loadingdone',()=>{if(R){R.layerTex.forEach((v,k)=>R.layerTex.delete(k));requestRender();}});

/* ================= init ================= */
buildEdit();buildCrop();buildMask();buildRetouch();buildLayers();buildPortrait();buildLeft();injectAI();initMobile();initPWA();
dynHooks.push(()=>{photos.forEach(thumbBadges);});
setEmpty();

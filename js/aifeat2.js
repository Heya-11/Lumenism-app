"use strict";
/* ================= AI features (2): sky, relight, backlit, batch, stacks, edited filter ================= */
/* per-photo map builders, usable for any photo (not only cur) */
async function mapFor(ph,key){ph._fmap=ph._fmap||{};const k=String(key);if(ph._fmap[k]&&STORE.aimaps.has(ph._fmap[k]))return ph._fmap[k];
  const d=k==='4'?await aiDepth(ph):k==='3'?await aiMaskData(ph,'person'):k==='5'?await aiSubjectMask(ph,.5,.5):await aiMaskData(ph,'sky');
  const [w,h]=mapSize(ph);const aid=storeMap(maskFromFloat(d.data,d.w,d.h,w,h),w,h,k==='4'?'depth':'mask');ph._fmap[k]=aid;return aid;}
async function portraitFor(ph){if(ph._pAid&&STORE.portrait.has(ph._pAid))return ph._pAid;const faces=await aiFaces(ph);if(!faces.length)return null;
  let multi=null;try{multi=await aiSegment(ph,'multiclass');}catch(e){console.warn(e);}
  const [w,h]=mapSize(ph);const c=aiCanvas(ph,1024);const d=buildPortraitData(faces,multi,w,h,c.width/c.height);const aid=uid('p');STORE.portrait.set(aid,d);ph._pAid=aid;return aid;}
function mapMean(aid){const m=STORE.aimaps.get(aid);if(!m)return 0;let s=0;for(let i=0;i<m.data.length;i+=7)s+=m.data[i];return s/(m.data.length/7)/255;}

/* ---- sky replacement ---- */
async function skyEnable(){if(!cur)return;const ph=cur;
  const aid=await aiRun(async()=>{busy(true,'AI가 하늘을 찾는 중…');await nextFrame();const a=await mapFor(ph,'sky');busy(false);return a;});if(!aid||cur!==ph)return;
  if(mapMean(aid)<.01){toast('사진에서 하늘을 찾지 못했어요');return;}
  const s=P().sky;s.aid=aid;s.on=true;syncUI();requestRender();commit('하늘 교체');}
function setSky(key){const s=P().sky;s.src=key;syncUI();requestRender();commit('하늘: '+((SKIES.find(k=>k[0]===key)||[0,'내 사진'])[1]));}
function loadSkyFile(){pickFile('image/*',async f=>{try{const bm=await createImageBitmap(f);const c=drawScaled(bm,bm.width,bm.height,2400);const id='file:'+uid('s');
  STORE.images.set(id,c);imageNames.set(id,f.name);setSky(id);}catch(e){toast('이미지를 열지 못했어요');}});}

/* ---- relighting (depth based) ---- */
async function lightEnable(){if(!cur)return;const ph=cur;
  const aid=await aiRun(async()=>{if(!(await confirmBig('depth')))return null;busy(true,'AI가 거리(깊이)를 계산하는 중…');await nextFrame();const a=await mapFor(ph,4);busy(false);return a;});
  if(!aid||cur!==ph)return;const l=P().light;l.aid=aid;l.on=true;syncUI();requestRender();commit('AI 조명');}

/* ---- backlit portrait one-click ---- */
async function backlitFix(){if(!cur)return;const ph=cur;
  const r=await aiRun(async()=>{busy(true,'AI가 인물을 찾는 중…');await nextFrame();let faces=[];try{faces=await aiFaces(ph);}catch(e){console.warn(e);}
    const pm=await aiMaskData(ph,'person');busy(false);return{faces,pm};});if(!r||cur!==ph)return;
  const [w,h]=mapSize(ph);const md=maskFromFloat(r.pm.data,r.pm.w,r.pm.h,w,h);let cov=0;for(let i=0;i<md.length;i+=5)cov+=md[i];cov/=md.length/5*255;
  if(cov<.02&&!r.faces.length){toast('인물을 찾지 못했어요');return;}
  const fw=R.fw,fh=R.fh,s=R.fieldSrc;let fL=0,fn=0,bL=0,bn=0;const lum=k=>(s[k]*.2126+s[k+1]*.7152+s[k+2]*.0722)/255;
  for(let y=0;y<fh;y+=2)for(let x=0;x<fw;x+=2){const k=(y*fw+x)*4,mv=md[Math.min(h-1,Math.floor(y/fh*h))*w+Math.min(w-1,Math.floor(x/fw*w))];
    const inFace=r.faces.some(f=>x/fw>f.box[0]&&x/fw<f.box[2]&&y/fh>f.box[1]&&y/fh<f.box[3]);
    if(inFace||(!r.faces.length&&mv>200)){fL+=lum(k);fn++;}else if(mv<40){bL+=lum(k);bn++;}}
  fL=fn?fL/fn:.3;bL=bn?bL/bn:.5;
  if(fL>.42&&fL>bL*.8){toast('역광이 심하지 않아 보여요. 그래도 약하게 적용했어요');}
  const ev=clamp(Math.log2(.46/Math.max(fL,.03))*.85,.15,2.3);
  if(R.localOK){const aid=storeMap(md,w,h,'mask');const c={id:uid('c'),type:'ai',kind:'person',aid,ph:ph.uid,mode:'add',inv:false,feather:50};
    addComp(c,'new');const m=selMask();m.name='역광 보정 (인물)';Object.assign(m.adj,{exposure:+ev.toFixed(2),shadows:30,highlights:-10,clarity:5});}
  else{P().exposure=+(P().exposure+ev*.5).toFixed(2);P().shadows=Math.max(P().shadows,45);}
  const p=P();p.highlights=Math.min(p.highlights,bL>.55?-45:-25);if(bL>.7)p.whites=Math.min(p.whites,-15);p.dehaze=Math.max(p.dehaze,bL>.6?8:0);
  syncUI();requestRender();commit('역광 인물 살리기');toast(`얼굴 밝기를 ${ev.toFixed(1)}EV 올렸어요. 마스크 탭에서 ‘역광 보정 (인물)’을 조절할 수 있어요`);}

/* ---- batch AI ---- */
const P_KEYS=['smooth','keep','red','bright','eyes','iris','teeth','slim','width','eye','nose','smile'],M_KEYS=['lip','lipH','blush','blushH','brow','dark'];
const FX_KEYS=['tilt','blur','tx','ty','tang','tw','tf','shape','boost','fsharp','dof'];
async function batchAI(){if(!cur)return;const sel=photos.filter(p=>p.selected&&p!==cur);const list=sel.length?sel:photos.filter(p=>p!==cur&&visibleByFilter(p));
  if(!list.length){toast('적용할 다른 사진이 없어요. 필름 스트립에서 '+(MB.touch?'사진을 길게 눌러':'Ctrl/⌘+클릭으로')+' 사진을 고르세요');return;}
  const s=clone(P()),B=UI.batch;
  const doP=B.portrait&&P_KEYS.some(k=>s.portrait[k]!==defaults().portrait[k]),doM=B.makeup&&M_KEYS.some(k=>['lipH','blushH'].includes(k)?false:s.portrait[k]),
    doF=B.bokeh&&s.fx.tilt>0,doS=B.sky&&s.sky.on,doL=B.light&&s.light.on;
  if(!(doP||doM||doF||doS||doL)){toast('현재 사진에 일괄 적용할 AI 보정이 없어요');return;}
  if(((doF&&s.fx.tilt===4)||doL)&&!(await confirmBig('depth')))return;
  let ok=0;const miss=[];
  await aiRun(async()=>{for(let i=0;i<list.length;i++){const ph=list[i];busy(true,`AI 일괄 처리 중… ${i+1}/${list.length}`);await nextFrame();const np=ph.params;let ch=false;
      if(doP||doM){let aid=null;try{aid=await portraitFor(ph);}catch(e){console.warn(e);}
        if(aid){np.portrait.aid=aid;if(doP)P_KEYS.forEach(k=>np.portrait[k]=s.portrait[k]);if(doM)M_KEYS.forEach(k=>np.portrait[k]=s.portrait[k]);np.portrait.fw=STORE.portrait.get(aid).faces.map(()=>100);ch=true;}
        else miss.push(ph.name);}
      if(doF){if(s.fx.tilt===6){/* mask-based focus can't be transferred */}else{FX_KEYS.forEach(k=>np.fx[k]=s.fx[k]);
        if(s.fx.tilt>=3&&s.fx.tilt<=5){try{np.fx.aid=await mapFor(ph,s.fx.tilt);}catch(e){np.fx.tilt=0;}}
        if(s.fx.tilt===4&&np.fx.aid){const pd=ph._pAid&&STORE.portrait.get(ph._pAid);const f=pd&&pd.faces[0];np.fx.fdepth=f?+sampleMap(np.fx.aid,(f.box[0]+f.box[2])/2,(f.box[1]+f.box[3])/2).toFixed(3):s.fx.fdepth;}ch=true;}}
      if(doS){let aid=null;try{aid=await mapFor(ph,'sky');}catch(e){}np.sky=Object.assign(clone(s.sky),{aid,on:!!aid&&mapMean(aid)>.01});ch=ch||np.sky.on;}
      if(doL){try{np.light=Object.assign(clone(s.light),{aid:await mapFor(ph,4)});ch=true;}catch(e){console.warn(e);}}
      if(ch){ph.history=ph.history.slice(0,ph.hi+1);ph.history.push({label:'AI 일괄 처리',state:clone(ph.params)});ph.hi=ph.history.length-1;markEdited(ph);ok++;}}
    busy(false);});
  applyFilter();toast(`${ok}장에 적용했어요`+(miss.length?` · 얼굴을 못 찾은 ${miss.length}장은 인물 보정을 건너뛰었어요`:''));}

/* ---- edited / unedited ---- */
function isEdited(ph){const q=clone(ph.params);q.portrait.aid=null;q.portrait.fw=[];if(!(q.portrait.edits||[]).length)q.portrait.edits=[];if(!(q.portrait.pf||[]).some(Boolean))q.portrait.pf=[];q.fx.aid=null;if(q.sky)q.sky.aid=null;if(q.light)q.light.aid=null;return JSON.stringify(q)!==DEF_JSON;}
function markEdited(ph){if(ph.el)ph.el.classList.toggle('edited',isEdited(ph));}

/* ---- similar-photo stacks ---- */
function hashOf(p){if(!p._hash)p._hash=(p.cull&&p.cull.hash)||dhash(p);return p._hash;}
function buildStacks(){let g=null,gid=0;photos.forEach((p,i)=>{const prev=photos[i-1];let same=false;
    if(prev&&prev.bm!==p.bm){const a=hashOf(prev),b=hashOf(p);let d=0;for(let k=0;k<64;k++)if(a[k]!==b[k])d++;same=d<=12;}else if(prev&&prev.bm===p.bm)same=true;
    if(!same){g={id:'s'+(gid++),items:[]};}g.items.push(p);p._stack=g;});
  const seen=new Set();photos.forEach(p=>{const g=p._stack;if(seen.has(g))return;seen.add(g);
    g.leader=g.items.find(q=>q.flag===1)||g.items.slice().sort((a,b)=>((b.cull&&b.cull.score)||0)-((a.cull&&a.cull.score)||0))[0];});
  photos.forEach(stackBadge);}
function stackBadge(p){const d=p.el;if(!d)return;let b=d.querySelector('.sk');const g=p._stack;const on=UI.stacks&&g&&g.items.length>1&&g.leader===p;
  if(!on){if(b)b.remove();return;}if(!b){b=el('button','sk');d.appendChild(b);b.onclick=e=>{e.stopPropagation();const gg=p._stack;if(UI.openStacks.has(gg.id))UI.openStacks.delete(gg.id);else UI.openStacks.add(gg.id);stackBadge(p);applyFilter();};}
  const open=UI.openStacks.has(g.id);b.textContent=(open?'▾ ':'▸ ')+g.items.length;b.title=open?'묶음 접기':`비슷한 사진 ${g.items.length}장 — 펼치기`;}
function stackHidden(p){if(!UI.stacks||!p._stack||p._stack.items.length<2)return false;return p._stack.leader!==p&&!UI.openStacks.has(p._stack.id);}
function toggleStacks(on){UI.stacks=on;if(on)buildStacks();else photos.forEach(stackBadge);applyFilter();
  if(on){const n=new Set(photos.map(p=>p._stack).filter(g=>g&&g.items.length>1)).size;toast(n?`비슷한 사진 ${n}묶음으로 정리했어요. 숫자 버튼으로 펼칠 수 있어요`:'비슷한 사진 묶음이 없어요');}}

"use strict";
/* ================= AI features ================= */
async function aiRun(fn){if(!aiAvailable())return null;try{return await fn();}catch(e){console.error(e);busy(false);toast(e.message||'AI 처리에 실패했어요');return null;}}
const ADE={sky:['sky'],building:['building','house','skyscraper','tower','edifice'],plant:['tree','plant','grass','flower','palm','field'],
  water:['water','sea','river','lake','swimming pool','waterfall'],mountain:['mountain','hill','rock']};
const AI_MASKS=[['subject','피사체 (클릭)'],['person','인물'],['background','배경'],['hair','머리카락'],['faceskin','얼굴 피부'],['bodyskin','몸 피부'],['clothes','옷'],
  ['sky','하늘'],['building','건물'],['plant','나무·식물'],['water','물'],['mountain','산']];
async function aiMaskData(ph,kind,uv){
  if(kind==='subject')return await aiSubjectMask(ph,uv[0],uv[1]);
  if(kind==='person'||kind==='background'){const ms=await aiSegment(ph,'selfie');const m=ms[ms.length-1];const d=Float32Array.from(m.data);if(kind==='background')for(let i=0;i<d.length;i++)d[i]=1-d[i];return{w:m.w,h:m.h,data:d};}
  if(['hair','faceskin','bodyskin','clothes'].includes(kind)){const ms=await aiSegment(ph,'multiclass');const idx={hair:1,bodyskin:2,faceskin:3,clothes:4}[kind];const m=ms[idx];if(!m)throw new Error('인물 부위를 찾지 못했어요');return m;}
  const segs=await aiScene(ph);const names=ADE[kind];let out=null;
  for(const s of segs){if(!names.some(n=>s.label.toLowerCase().includes(n)))continue;if(!out)out={w:s.w,h:s.h,data:new Float32Array(s.w*s.h)};
    for(let i=0;i<s.w*s.h;i++)out.data[i]=Math.max(out.data[i],s.data[i*s.ch]/255);}
  if(!out)throw new Error('사진에서 해당 영역을 찾지 못했어요');return out;}
async function makeAiMask(kind,uv){if(!cur||!R.localOK)return;const ph=cur;
  const r=await aiRun(async()=>{busy(true,'AI가 영역을 찾는 중…');await nextFrame();const m=await aiMaskData(ph,kind,uv);busy(false);return m;});if(!r||cur!==ph)return;
  let s=0;for(const v of r.data)s+=v;if(s/r.data.length<.002){toast('해당 영역을 찾지 못했어요');return;}
  const [w,h]=mapSize(ph);const aid=storeMap(maskFromFloat(r.data,r.w,r.h,w,h),w,h,'mask');
  const mode=UI.aiMode||'new';const c={id:uid('c'),type:'ai',kind,aid,ph:ph.uid,mode:mode==='new'?'add':mode,inv:false,feather:50};
  addComp(c,mode==='new'||!selMask()?'new':mode);const m=selMask();if(m&&mode==='new')m.name=`AI ${AI_MASKS.find(a=>a[0]===kind)[1].replace(' (클릭)','')}`;
  syncUI();requestRender();commit('AI 마스크: '+AI_MASKS.find(a=>a[0]===kind)[1]);}
/* ---- bokeh / focus maps ---- */
async function ensureFocus(mode){const ph=cur,fx=P().fx;ph._fmap=ph._fmap||{};
  if(ph._fmap[mode]&&STORE.aimaps.has(ph._fmap[mode])){fx.aid=ph._fmap[mode];return true;}
  if(mode===5){UI.pick='focusSubject';updateModeUI();return false;}
  const r=await aiRun(async()=>{if(mode===4&&!(await confirmBig('depth')))return null;busy(true,mode===4?'AI가 거리(깊이)를 계산하는 중…':'AI가 인물을 찾는 중…');await nextFrame();
    const d=mode===4?await aiDepth(ph):await aiMaskData(ph,'person');busy(false);return d;});if(!r||cur!==ph)return false;
  const [w,h]=mapSize(ph);const aid=storeMap(maskFromFloat(r.data,r.w,r.h,w,h),w,h,mode===4?'depth':'mask');ph._fmap[mode]=aid;fx.aid=aid;
  if(mode===4)fx.fdepth=sampleMap(aid,.5,.45);return true;}
function sampleMap(aid,u,v){const m=STORE.aimaps.get(aid);if(!m)return .5;const x=clamp(Math.round(u*(m.w-1)),0,m.w-1),y=clamp(Math.round(v*(m.h-1)),0,m.h-1);return m.data[y*m.w+x]/255;}
async function setFocusMode(mode){const fx=P().fx;if(UI.pick&&/^focus/.test(UI.pick)&&mode!==5){UI.pick=null;updateModeUI();}fx.tilt=mode;if(fx.blur===0)fx.blur=60;syncUI();
  if(mode>=3&&mode<=5){const ok=await ensureFocus(mode);if(ok){syncUI();requestRender();commit('보케: '+FOCUS_MODES.find(m=>m[0]===mode)[1]);}else requestRender();return;}
  if(mode===6&&!fx.maskId&&P().masks.length)fx.maskId=P().masks[P().masks.length-1].id;
  syncUI();requestRender();commit('보케: '+FOCUS_MODES.find(m=>m[0]===mode)[1]);}
const FOCUS_MODES=[[0,'끄기'],[1,'틸트 시프트'],[2,'원형'],[3,'인물 (AI)'],[4,'깊이 (AI)'],[5,'피사체 (AI)'],[6,'마스크']];
/* ---- pick hooks (called from doPick) ---- */
async function aiPick(k,mx,my){const uv=screenToSrc(mx,my);
  if(k==='aisubject'){await makeAiMask('subject',uv);return;}
  if(k==='addFace'){await addFaceAt(uv);return;}
  if(k==='focusDepth'){const fx=P().fx;if(fx.tilt===4&&fx.aid){fx.fdepth=+sampleMap(fx.aid,uv[0],uv[1]).toFixed(3);syncUI();requestRender();commit('초점 거리 지정');}return;}
  if(k==='focusSubject'){const ph=cur;const r=await aiRun(async()=>{busy(true,'AI가 피사체를 찾는 중…');await nextFrame();const m=await aiSubjectMask(ph,uv[0],uv[1]);busy(false);return m;});
    if(!r||cur!==ph)return;const [w,h]=mapSize(ph);const aid=storeMap(maskFromFloat(r.data,r.w,r.h,w,h),w,h,'mask');ph._fmap=ph._fmap||{};ph._fmap[5]=aid;
    const fx=P().fx;fx.tilt=5;fx.aid=aid;if(!fx.blur)fx.blur=60;syncUI();requestRender();commit('보케: 피사체 (AI)');}}
/* ---- portrait ---- */
function fillPoly(x,pts,W,H){x.beginPath();pts.forEach((q,i)=>i?x.lineTo(q[0]*W,q[1]*H):x.moveTo(q[0]*W,q[1]*H));x.closePath();x.fill();}
function buildPortraitData(faces,multi,W,H,aspectFix){const layer=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.strokeStyle='#fff';x.lineJoin='round';return[c,x];};
  const [sc,sx]=layer(),[ec,ex]=layer(),[ic,ix]=layer(),[tc,tx]=layer();
  if(multi&&multi[3]){const a=new Float32Array(multi[3].data.length);for(let i=0;i<a.length;i++)a[i]=Math.max(multi[3].data[i],multi[2]?multi[2].data[i]:0);
    const u8=maskFromFloat(a,multi[3].w,multi[3].h,W,H);const im=sx.createImageData(W,H);for(let i=0;i<W*H;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=u8[i];}sx.putImageData(im,0,0);}
  else faces.forEach(f=>fillPoly(sx,LM.oval.map(k=>f.lm[k]),W,H));
  sx.globalCompositeOperation='destination-out';
  faces.forEach(f=>{const fwp=f.w*W;sx.lineWidth=fwp*.02;ex.lineWidth=fwp*.008;
    [LM.leye,LM.reye,LM.lbrow,LM.rbrow,LM.lipsOuter].forEach(g=>{const pts=g.map(k=>f.lm[k]);fillPoly(sx,pts,W,H);sx.stroke();});if(f.profile)return;
    [LM.leye,LM.reye].forEach(g=>{fillPoly(ex,g.map(k=>f.lm[k]),W,H);});
    if(f.lm.length>=478)[LM.liris,LM.riris].forEach(g=>{const c=f.lm[g[0]],r=Math.hypot((f.lm[g[1]][0]-c[0])*W,(f.lm[g[1]][1]-c[1])*H)*1.05;ix.beginPath();ix.arc(c[0]*W,c[1]*H,r,0,6.2832);ix.fill();});
    fillPoly(tx,LM.lipsInner.map(k=>f.lm[k]),W,H);});
  const get=x=>x.getImageData(0,0,W,H).data;const S=get(sx),E=get(ex),I=get(ix),T=get(tx);const rgba=new Uint8Array(W*H*4);
  for(let i=0;i<W*H;i++){rgba[i*4]=S[i*4+3];rgba[i*4+1]=E[i*4+3];rgba[i*4+2]=T[i*4+3];rgba[i*4+3]=I[i*4+3];}
  const fr=faces.filter(f=>!f.profile);
  /* makeup layers: R lips, G blush, B brows, A under-eye */
  const soft=(draw,blur)=>{const [c,x]=layer();x.filter=`blur(${Math.max(.5,blur).toFixed(1)}px)`;draw(x);return get(x);};
  const pt=(f,k)=>[f.lm[k][0]*W,f.lm[k][1]*H];const ctr=(f,g)=>{const v=g.map(k=>pt(f,k));return[v.reduce((s,q)=>s+q[0],0)/v.length,v.reduce((s,q)=>s+q[1],0)/v.length];};
  const Lp=soft(x=>fr.forEach(f=>{fillPoly(x,LM.lipsOuter.map(k=>f.lm[k]),W,H);x.globalCompositeOperation='destination-out';fillPoly(x,LM.lipsInner.map(k=>f.lm[k]),W,H);x.globalCompositeOperation='source-over';}),Math.max(...fr.map(f=>f.w*W*.006)));
  const Bl=soft(x=>fr.forEach(f=>{const fwp=f.w*W,mid=ctr(f,LM.lipsOuter);[[LM.leye,61,-1],[LM.reye,291,1]].forEach(([E,mc,sg])=>{const e=ctr(f,E),m=pt(f,mc);
      const ox=Math.sign(e[0]-mid[0])||sg;const c=[e[0]*.45+m[0]*.55+ox*fwp*.07,e[1]*.45+m[1]*.55];const r=fwp*.14;
      const g=x.createRadialGradient(c[0],c[1],0,c[0],c[1],r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.ellipse(c[0],c[1],r,r*.8,0,0,6.2832);x.fill();});}),1);
  const Bw=soft(x=>fr.forEach(f=>[LM.lbrow,LM.rbrow].forEach(g=>fillPoly(x,g.map(k=>f.lm[k]),W,H))),Math.max(...fr.map(f=>f.w*W*.008)));
  const Ue=soft(x=>fr.forEach(f=>{[LM.leye,LM.reye].forEach(E=>{const v=E.map(k=>pt(f,k));const xs=v.map(q=>q[0]),ys=v.map(q=>q[1]);const ew=Math.max(...xs)-Math.min(...xs),eh=Math.max(4,Math.max(...ys)-Math.min(...ys));
      const c=ctr(f,E);x.fillStyle='#fff';x.beginPath();x.ellipse(c[0],Math.max(...ys)+eh*.9,ew*.62,eh*1.15,0,0,6.2832);x.fill();});
    x.globalCompositeOperation='destination-out';[LM.leye,LM.reye].forEach(E=>{x.lineWidth=f.w*W*.02;fillPoly(x,E.map(k=>f.lm[k]),W,H);x.stroke();});x.globalCompositeOperation='source-over';}),Math.max(...fr.map(f=>f.w*W*.02)));
  const rgba2=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++){rgba2[i*4]=Lp[i*4+3];rgba2[i*4+1]=Bl[i*4+3];rgba2[i*4+2]=Bw[i*4+3];rgba2[i*4+3]=Ue[i*4+3];}
  const faceW=faces.length?Math.max(...faces.map(f=>f.w))*aspectFix:.2;return{w:W,h:H,rgba,rgba2,faces,faceW};}
async function analyzePortrait(opt={}){const ph=cur;const r=await aiRun(async()=>{busy(true,'AI가 얼굴을 찾는 중…');await nextFrame();const faces=await aiFaces(ph);
    let multi=null;try{busy(true,'AI가 피부 영역을 찾는 중…');multi=await aiSegment(ph,'multiclass');}catch(e){console.warn(e);}
    if(!faces.length){let cov=0;if(multi&&multi[3]){const d=multi[3].data;for(let i=0;i<d.length;i+=3)cov+=d[i]>.5;cov/=d.length/3;}if(cov<.002){busy(false);throw new Error('얼굴을 찾지 못했어요. ‘못 찾은 얼굴 추가’로 얼굴을 직접 눌러 보세요');}}
    busy(false);return{faces,multi};});if(!r||cur!==ph)return;
  const [w,h]=mapSize(ph);const c=aiCanvas(ph,1024);const d=buildPortraitData(r.faces,r.multi,w,h,c.width/c.height);const aid=uid('p');STORE.portrait.set(aid,d);
  P().portrait.aid=aid;P().portrait.fw=r.faces.map(()=>100);syncUI();requestRender();commit(`얼굴 분석 (${r.faces.length}명)`);if(opt.quiet)return;
  const np=r.faces.filter(f=>f.profile).length;toast(!r.faces.length?'얼굴 윤곽은 못 찾았지만 피부 보정은 쓸 수 있어요. 놓친 얼굴은 ‘못 찾은 얼굴 추가’로 눌러 주세요':`얼굴 ${r.faces.length}개를 찾았어요`+(np?` · 옆모습 ${np}개는 피부 보정만 적용돼요`:''));}
/* exclusion zones for blemish search: nostrils/nose base, eyes, brows, lips (dilated), drawn from face landmarks */
function blemishExclusion(pd,fw,fh){const c=document.createElement('canvas');c.width=fw;c.height=fh;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.strokeStyle='#fff';x.lineJoin='round';x.lineCap='round';
  const P=(f,k)=>f.lm[k]?[f.lm[k][0]*fw,f.lm[k][1]*fh]:null;const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  pd.faces.forEach(f=>{const fwp=f.w*fw;
    [[LM.leye,.07],[LM.reye,.07],[LM.lbrow,.05],[LM.rbrow,.05],[LM.lipsOuter,.045]].forEach(([g,lw])=>{x.lineWidth=fwp*lw;fillPoly(x,g.map(k=>f.lm[k]),fw,fh);x.stroke();});
    const tip=P(f,1),sub=P(f,2),wl=P(f,129),wr=P(f,358),al=P(f,98),ar=P(f,327);
    if(tip&&sub&&wl&&wr){const nw=d(wl,wr),cx=(wl[0]+wr[0]+tip[0]+sub[0])/4,cy=sub[1]*.6+tip[1]*.4;
      x.beginPath();x.ellipse(cx,cy,nw*.78,Math.max(d(tip,sub)*1.5,nw*.42),Math.atan2(wr[1]-wl[1],wr[0]-wl[0]),0,6.2832);x.fill();
      [wl,wr,al,ar].filter(Boolean).forEach(q=>{x.beginPath();x.arc(q[0],q[1],nw*.3,0,6.2832);x.fill();});
      x.lineWidth=nw*.35;x.beginPath();x.moveTo(P(f,168)?P(f,168)[0]:tip[0],P(f,168)?P(f,168)[1]:tip[1]-nw);x.lineTo(tip[0],tip[1]);x.stroke();}});
  const D=x.getImageData(0,0,fw,fh).data,out=new Uint8Array(fw*fh);for(let i=0;i<out.length;i++)out[i]=D[i*4+3];return out;}
function autoBlemish(){const pd=STORE.portrait.get(P().portrait.aid);if(!pd){toast('먼저 ‘얼굴·피부 분석’을 해 주세요');return;}
  const fw=R.fw,fh=R.fh,src=R.fieldSrc,N=fw*fh;const L=new Float32Array(N);for(let i=0;i<N;i++)L[i]=(src[i*4]*.2126+src[i*4+1]*.7152+src[i*4+2]*.0722)/255;
  const skin=new Float32Array(N);for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){const sx=Math.min(pd.w-1,Math.round(x/fw*pd.w)),sy=Math.min(pd.h-1,Math.round(y/fh*pd.h));skin[y*fw+x]=pd.rgba[(sy*pd.w+sx)*4]/255;}
  const excl=blemishExclusion(pd,fw,fh);const fwt=P().portrait.fw||[];
  const sens=clamp(UI.blemSens/100,0,1),thr=.085-.055*sens,maxN=Math.round(12+40*sens);
  const rb=Math.max(2,Math.round(pd.faceW*fh*.03));const I=new Float64Array((fw+1)*(fh+1));
  for(let y=0;y<fh;y++){let row=0;for(let x=0;x<fw;x++){row+=L[y*fw+x];I[(y+1)*(fw+1)+x+1]=I[y*(fw+1)+x+1]+row;}}
  const box=(x,y)=>{const x0=Math.max(0,x-rb),x1=Math.min(fw-1,x+rb),y0=Math.max(0,y-rb),y1=Math.min(fh-1,y+rb);return(I[(y1+1)*(fw+1)+x1+1]-I[y0*(fw+1)+x1+1]-I[(y1+1)*(fw+1)+x0]+I[y0*(fw+1)+x0])/((x1-x0+1)*(y1-y0+1));};
  const faceOf=(x,y)=>{let bi=0,bd=1e9;pd.faces.forEach((f,i)=>{const cx=(f.box[0]+f.box[2])/2*fw,cy=(f.box[1]+f.box[3])/2*fh,dd=(x-cx)**2+(y-cy)**2;if(dd<bd){bd=dd;bi=i;}});return bi;};
  /* shape test: dark blob must be small, round and isolated (nostrils, lashes, creases are big / elongated / connected) */
  const blobOK=(x,y,d)=>{const lv=box(x,y)-d*.5,R2=rb*2;let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,ring=0,ringN=0;
    for(let dy=-R2;dy<=R2;dy++)for(let dx=-R2;dx<=R2;dx++){const rr=Math.hypot(dx,dy);if(rr>R2)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=fw||yy>=fh)return false;
      const dark=L[yy*fw+xx]<lv;if(rr>R2-1.5){ringN++;if(dark)ring++;continue;}if(!dark)continue;n++;sx+=dx;sy+=dy;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
    if(!n||ring/Math.max(1,ringN)>.12)return false;if(n>Math.PI*rb*rb*1.6)return false;
    const mx=sx/n,my=sy/n,a=sxx/n-mx*mx,b=syy/n-my*my,c=sxy/n-mx*my,tr=a+b,det=a*b-c*c,disc=Math.sqrt(Math.max(0,tr*tr/4-det));const l1=tr/2+disc,l2=Math.max(1e-3,tr/2-disc);
    return l1/l2<4.5;};
  const cand=[];for(let y=rb;y<fh-rb;y++)for(let x=rb;x<fw-rb;x++){const i=y*fw+x;if(skin[i]<.6||excl[i]>20)continue;const d=box(x,y)-L[i];if(d<thr)continue;
    const e=rb*2;let inside=true;for(const [ox,oy] of [[e,0],[-e,0],[0,e],[0,-e],[e,e],[-e,-e],[e,-e],[-e,e]]){const q=Math.min(fh-1,Math.max(0,y+oy))*fw+Math.min(fw-1,Math.max(0,x+ox));if(skin[q]<.5||excl[q]>200){inside=false;break;}}if(!inside)continue;
    const c0=src[i*4],c2=src[i*4+2];if(c2>c0*1.05)continue;
    let mx=true;for(let dy=-2;dy<=2&&mx;dy++)for(let dx=-2;dx<=2;dx++){if(!dx&&!dy)continue;if(box(x+dx,y+dy)-L[i+dy*fw+dx]>d){mx=false;break;}}if(mx)cand.push([d,x,y]);}
  cand.sort((a,b)=>b[0]-a[0]);const pick=[];for(const c of cand){if(pick.length>=maxN)break;if(pick.some(p=>Math.hypot(p[1]-c[1],p[2]-c[2])<rb*2))continue;
    if((fwt[faceOf(c[1],c[2])]??100)<=0)continue;if(!blobOK(c[1],c[2],c[0]))continue;pick.push(c);}
  if(!pick.length){toast('지울 만한 잡티를 찾지 못했어요');return;}
  pick.forEach(([,x,y])=>{const r=+(rb*1.1/fh).toFixed(5),d=[rnd4(x/fw),rnd4(y/fh)];P().retouch.push({id:uid('r'),type:'heal',d,s:findSource(d,r),r,f:60,op:100});});
  syncUI();requestRender();commit(`잡티 자동 제거 (${pick.length}곳)`);toast(`잡티 ${pick.length}곳을 지웠어요. 리터칭 탭에서 하나씩 조정할 수 있어요`);}
/* ---- liquify (portrait tool pointer) ---- */
function portDown(mx,my){if(UI.pe.on)return peDown(mx,my);const m=UI.liq.mode;if(m==='off')return null;const uv=screenToSrc(mx,my);
  const st={m,r:+(UI.liq.size/(view.s*R.last.h)).toFixed(5),s:+(UI.liq.str/100*UI.sens).toFixed(3),p:[uv.map(rnd4)]};P().liquify.push(st);requestRender();
  let sm=uv.slice(),last=uv.slice();
  /* bloat/pucker/restore: grow at a steady rate while the finger rests (not per jittery move event) */
  const timer=m==='push'?null:setInterval(()=>{st.p.push(sm.map(rnd4));requestRender();},70);
  return{move(x,y){hoverPos=[x,y];const u=screenToSrc(x,y);
      sm=[sm[0]+(u[0]-sm[0])*.45,sm[1]+(u[1]-sm[1])*.45];/* smooth finger jitter */
      if(Math.hypot((sm[0]-last[0])*R.last.w,(sm[1]-last[1])*R.last.h)*view.s<3)return;last=sm.slice();if(m==='push'){st.p.push(sm.map(rnd4));requestRender();}},
    up(){if(timer)clearInterval(timer);commit('유동화: '+{push:'밀기',bloat:'부풀리기',pucker:'오므리기',restore:'복원'}[m]);}};}
/* ---- range editing for AI regions (skin / eyes / teeth / lips / blush / brows / under-eye) ---- */
const PE_CH={skin:['피부',0,1],eyes:['눈 흰자',1,2],teeth:['치아',2,3],lip:['입술',4,4],blush:['볼 터치',5,5],brow:['눈썹',6,6],dark:['눈 밑',7,7]};
function peDown(mx,my){const pd=STORE.portrait.get(P().portrait.aid);if(!pd){toast('먼저 ‘얼굴·피부 분석’을 해 주세요');return null;}
  const uv=screenToSrc(mx,my);const st={c:UI.pe.c,m:UI.pe.m,r:+(UI.pe.size/(view.s*R.last.h)).toFixed(5),p:[uv.map(rnd4)]};
  const E=P().portrait.edits||(P().portrait.edits=[]);E.push(st);requestRender();
  return{move(x,y){hoverPos=[x,y];const u=screenToSrc(x,y),lp=st.p[st.p.length-1];if(Math.hypot((u[0]-lp[0])*R.last.w,(u[1]-lp[1])*R.last.h)*view.s<3)return;st.p.push(u.map(rnd4));requestRender();},
    up(){commit(`범위 다듬기: ${PE_CH[st.c][0]} ${st.m==='add'?'더하기':'지우기'}`);}};}
function portArrays(pd,edits){edits=edits||[];const key=JSON.stringify(edits.map(s=>[s.c,s.m,s.r,s.p.length,s.p[s.p.length-1]]));
  if(pd._ed&&pd._ed.key===key)return pd._ed;if(!edits.length){pd._ed={key,rgba:pd.rgba,rgba2:pd.rgba2,v:(pd._ed?pd._ed.v:0)+1};return pd._ed;}
  const A=[new Uint8Array(pd.rgba),pd.rgba2?new Uint8Array(pd.rgba2):new Uint8Array(pd.w*pd.h*4)],W=pd.w,H=pd.h;
  for(const st of edits){const ch=PE_CH[st.c];if(!ch)continue;const arr=A[ch[1]>>2],o=ch[1]&3,r=Math.max(1.5,st.r*H),add=st.m==='add';
    const dab=(cx,cy)=>{const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(W-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(H-1,Math.ceil(cy+r));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-cx,y-cy)/r;if(d>=1)continue;const w=d<.5?1:1-(d-.5)/.5*(d-.5)/.5*(3-2*(d-.5)/.5)+0;const k=(y*W+x)*4+o;
        const ww=Math.max(0,Math.min(1,d<.5?1:1-((d-.5)/.5)**2));arr[k]=add?Math.max(arr[k],Math.round(255*ww)):Math.round(arr[k]*(1-ww));}};
    const pts=st.p.map(([u,v])=>[u*W,v*H]);dab(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/(r*.3)));for(let k=1;k<=n;k++)dab(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);}}
  pd._ed={key,rgba:A[0],rgba2:A[1],v:(pd._ed?pd._ed.v:0)+1};return pd._ed;}
function peToggle(on){UI.pe.on=on??!UI.pe.on;if(UI.pe.on)UI.liq.mode='off';syncUI();updateModeUI();requestRender();drawOverlay();
  if(UI.pe.on)toast('색으로 표시된 곳이 적용 범위예요. '+(MB.touch?'손가락으로':'드래그해서')+' 칠해서 더하거나 지우세요');}
function peReset(){const c=UI.pe.c,E=P().portrait.edits||[];const n=E.length;P().portrait.edits=E.filter(s=>s.c!==c);if(P().portrait.edits.length!==n){requestRender();commit(`범위 다듬기 초기화: ${PE_CH[c][0]}`);}}
function portraitOverlay(){let s='';const pd=STORE.portrait.get(P().portrait.aid);
  if(pd)pd.faces.forEach((f,i)=>{const a=srcToScreen([f.box[0],f.box[1]]),b=srcToScreen([f.box[2],f.box[3]]);const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]);const w=((P().portrait.fw||[])[i]??100);
    s+=`<rect x="${x0}" y="${y0}" width="${Math.abs(b[0]-a[0])}" height="${Math.abs(b[1]-a[1])}" fill="none" stroke="rgba(255,255,255,${w>0?.4:.15})" stroke-dasharray="4 4"/>`;
    if(pd.faces.length>1)s+=`<rect x="${x0}" y="${y0-20}" width="${w===100?22:56}" height="18" rx="4" fill="rgba(0,0,0,.6)"/><text x="${x0+6}" y="${y0-6}" fill="#fff" font-size="12" font-weight="600">${i+1}${w===100?'':' · '+w+'%'}</text>`;});
  if(UI.pe.on&&hoverPos&&!UI.space)s+=`<circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="${UI.pe.size}" fill="none" stroke="${UI.pe.m==='add'?'#fff':'#ff8a8a'}" stroke-width="1.2" stroke-dasharray="${UI.pe.m==='add'?'':'4 3'}"/>`;
  else if(UI.liq.mode!=='off'&&hoverPos&&!UI.space)s+=`<circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="${UI.liq.size}" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="2" fill="#fff"/>`;
  return s;}
/* ---- AI composition (crop suggestions) ---- */
async function aiCropSuggest(){const ph=cur;const r=await aiRun(async()=>{busy(true,'AI가 주요 피사체를 찾는 중…');await nextFrame();let boxes=[],face=false;
    try{const f=await aiFaces(ph);if(f.length){face=true;boxes=f.map(q=>{const h=q.box[3]-q.box[1];return[q.box[0],q.box[1]-h*.25,q.box[2],q.box[3]+h*.35];});}}catch(e){}
    if(!boxes.length){const d=await aiDetect(ph);boxes=d.filter(x=>x.score>.35).sort((a,b)=>(b.box[2]-b.box[0])*(b.box[3]-b.box[1])*b.score-(a.box[2]-a.box[0])*(a.box[3]-a.box[1])*a.score).slice(0,2).map(x=>x.box);}
    busy(false);return{boxes,face};});if(!r||cur!==ph)return;
  if(!r.boxes.length){toast('주요 피사체를 찾지 못했어요');return;}
  const g=P().geo,G=geoMats(R.w,R.h,g,true);const pts=[];r.boxes.forEach(b=>[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]].forEach(q=>{const o=M3.ap(G.F,[q[0]*R.w,q[1]*R.h]);pts.push([o[0]/G.W,o[1]/G.H]);}));
  const x0=clamp(Math.min(...pts.map(q=>q[0])),0,1),x1=clamp(Math.max(...pts.map(q=>q[0])),0,1),y0=clamp(Math.min(...pts.map(q=>q[1])),0,1),y1=clamp(Math.max(...pts.map(q=>q[1])),0,1);
  const sx=(x0+x1)/2,sy=(y0+y1)/2,bw=x1-x0,bh=y1-y0;const asps=[...new Set([g.aspect==='free'?'orig':g.aspect,'4:5','16:9','1:1'])].slice(0,3);
  const SQi=M3.inv(sqMatrix(G.W,G.H,g));
  UI.cropSug=asps.map(k=>{const rr=k==='orig'?G.W/G.H:k.split(':').map(Number).reduce((a,b)=>a/b);const rn=rr*G.H/G.W;
    let ch=Math.max(bh*(r.face?2.2:1.35),bw*(r.face?2.2:1.35)/rn);ch=Math.min(ch,1,1/rn);const cw=ch*rn;
    const tx=Math.abs(sx-.5)<.08?.5:(sx<.5?1/3:2/3),ty=r.face?.38:.5;
    const cr={x:clamp(sx-tx*cw,0,1-cw),y:clamp(sy-ty*ch,0,1-ch),w:cw,h:ch};return{k,label:(ASPECTS.find(a=>a[0]===k)||[0,k])[1],crop:fitCrop(cr,SQi,G.W,G.H)};});
  syncUI();toast('추천 구도를 골라 보세요');}
/* ---- layer background removal ---- */
async function removeLayerBg(){const L=selLayer();if(!L||L.type!=='image')return;const src=STORE.images.get(L.img);if(!src)return;
  const r=await aiRun(async()=>{busy(true,'AI가 배경을 지우는 중…');await nextFrame();const c=drawScaled(src,src.width,src.height,1024);
    let m=await getModel('selfie');let res=m.segment(c);let ms=res.confidenceMasks||[];let mk=ms[ms.length-1];let data=mk.getAsFloat32Array().slice(),w=mk.width,h=mk.height;closeRes(res);
    let s=0;for(const v of data)s+=v;if(s/data.length<.03){m=await getModel('subject');res=m.segment(c,{keypoint:{x:.5,y:.5}});ms=res.confidenceMasks||[];mk=ms[ms.length>1?1:0];data=mk.getAsFloat32Array().slice();w=mk.width;h=mk.height;closeRes(res);}
    busy(false);return{data,w,h};});if(!r)return;
  const a=maskFromFloat(r.data,r.w,r.h,src.width,src.height);const out=document.createElement('canvas');out.width=src.width;out.height=src.height;const x=out.getContext('2d');x.drawImage(src,0,0);
  const im=x.getImageData(0,0,out.width,out.height);for(let i=0;i<a.length;i++)im.data[i*4+3]=Math.min(im.data[i*4+3],a[i]);x.putImageData(im,0,0);
  const id='file:'+uid('f');STORE.images.set(id,out);imageNames.set(id,(imageNames.get(L.img)||L.name)+' (배경 제거)');L.img=id;R.layerTex.delete(L.id);if(RH)RH.layerTex.delete(L.id);
  syncUI();requestRender();commit('레이어 배경 제거');}
/* ---- LaMa object removal ---- */
async function lamaFill(src,strokes){if(!(await confirmBig('lama')))throw new Error('취소했어요');const sess=await getModel('lama');const ort=AI.ort;
  const w=src.width,h=src.height;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const s of strokes){const r=s.r*h;for(const [u,v] of s.p){x0=Math.min(x0,u*w-r);y0=Math.min(y0,v*h-r);x1=Math.max(x1,u*w+r);y1=Math.max(y1,v*h+r);}}
  const m=Math.max(32,Math.max(x1-x0,y1-y0)*.9);const rx=Math.max(0,Math.floor(x0-m)),ry=Math.max(0,Math.floor(y0-m)),rw=Math.min(w,Math.ceil(x1+m))-rx,rh=Math.min(h,Math.ceil(y1+m))-ry;
  const S=512;const ic=document.createElement('canvas');ic.width=ic.height=S;const ix=ic.getContext('2d',{willReadFrequently:true});ix.drawImage(src,rx,ry,rw,rh,0,0,S,S);
  const mc=document.createElement('canvas');mc.width=mc.height=S;const mx=mc.getContext('2d',{willReadFrequently:true});mx.strokeStyle=mx.fillStyle='#fff';mx.lineCap=mx.lineJoin='round';
  for(const s of strokes){const pts=s.p.map(([u,v])=>[(u*w-rx)/rw*S,(v*h-ry)/rh*S]);const lw=s.r*h*2/Math.max(rw,rh)*S*1.15;mx.lineWidth=lw;mx.beginPath();mx.arc(pts[0][0],pts[0][1],lw/2,0,6.283);mx.fill();
    mx.beginPath();pts.forEach((q,i)=>i?mx.lineTo(q[0],q[1]):mx.moveTo(q[0],q[1]));mx.stroke();}
  const id=ix.getImageData(0,0,S,S).data,md=mx.getImageData(0,0,S,S).data;const img=new Float32Array(3*S*S),msk=new Float32Array(S*S);
  for(let i=0;i<S*S;i++){img[i]=id[i*4]/255;img[S*S+i]=id[i*4+1]/255;img[2*S*S+i]=id[i*4+2]/255;msk[i]=md[i*4+3]>20?1:0;}
  const names=sess.inputNames;const mName=names.find(n=>/mask/i.test(n))||names[1],iName=names.find(n=>n!==mName)||names[0];
  busy(true,'AI가 지운 자리를 채우는 중…');await nextFrame();
  const out=await sess.run({[iName]:new ort.Tensor('float32',img,[1,3,S,S]),[mName]:new ort.Tensor('float32',msk,[1,1,S,S])});const t=out[sess.outputNames[0]];const od=t.data;
  let mxv=0;for(let i=0;i<od.length;i+=97)mxv=Math.max(mxv,od[i]);const k=mxv>2?1:255;
  const oc=document.createElement('canvas');oc.width=oc.height=S;const ox=oc.getContext('2d');const oim=ox.createImageData(S,S);
  for(let i=0;i<S*S;i++){oim.data[i*4]=od[i]*k;oim.data[i*4+1]=od[S*S+i]*k;oim.data[i*4+2]=od[2*S*S+i]*k;oim.data[i*4+3]=255;}ox.putImageData(oim,0,0);
  const pw=Math.round(rw),phh=Math.round(rh);const pc=document.createElement('canvas');pc.width=pw;pc.height=phh;const px=pc.getContext('2d',{willReadFrequently:true});px.drawImage(oc,0,0,pw,phh);
  const mk=document.createElement('canvas');mk.width=pw;mk.height=phh;const kx=mk.getContext('2d',{willReadFrequently:true});kx.drawImage(mc,0,0,pw,phh);
  const pim=px.getImageData(0,0,pw,phh),kd=kx.getImageData(0,0,pw,phh).data;const N=pw*phh;const a=new Float32Array(N);for(let i=0;i<N;i++)a[i]=kd[i*4+3]/255;
  const rad=Math.max(2,Math.round(Math.max(pw,phh)/180));const b=new Float32Array(N);
  for(let y=0;y<phh;y++)for(let x=0;x<pw;x++){let s=0,n=0;for(let dy=-rad;dy<=rad;dy+=Math.max(1,rad>>1))for(let dx=-rad;dx<=rad;dx+=Math.max(1,rad>>1)){const yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=phh||xx>=pw)continue;s=Math.max(s,a[yy*pw+xx]);n++;}b[y*pw+x]=s;}
  for(let i=0;i<N;i++)pim.data[i*4+3]=Math.round(Math.min(1,b[i])*255);px.putImageData(pim,0,0);busy(false);
  return{canvas:pc,bb:[rx/w,ry/h,rw/w,rh/h]};}
/* ---- culling ---- */
function sharpness(ph){const c=drawScaled(ph.prev,ph.prev.width,ph.prev.height,512);const x=c.getContext('2d',{willReadFrequently:true});const d=x.getImageData(0,0,c.width,c.height).data;const W=c.width,H=c.height;
  const g=new Float32Array(W*H);for(let i=0;i<W*H;i++)g[i]=d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114;let s=0,s2=0,n=0;
  for(let y=1;y<H-1;y++)for(let xx=1;xx<W-1;xx++){const i=y*W+xx;const l=4*g[i]-g[i-1]-g[i+1]-g[i-W]-g[i+W];s+=l;s2+=l*l;n++;}const m=s/n;return s2/n-m*m;}
function dhash(ph){const c=document.createElement('canvas');c.width=9;c.height=8;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(ph.prev,0,0,9,8);const d=x.getImageData(0,0,9,8).data;const bits=[];
  for(let y=0;y<8;y++)for(let xx=0;xx<8;xx++){const a=d[(y*9+xx)*4]+d[(y*9+xx)*4+1],b=d[(y*9+xx+1)*4]+d[(y*9+xx+1)*4+1];bits.push(a>b?1:0);}return bits;}
async function aiCull(){const list=photos.filter(p=>p.selected).length>1?photos.filter(p=>p.selected):photos.filter(visibleByFilter);if(!list.length)return;
  let faceOK=true;busy(true,'사진을 살펴보는 중…');await nextFrame();
  for(let i=0;i<list.length;i++){const p=list[i];busy(true,`사진을 살펴보는 중… ${i+1}/${list.length}`);await nextFrame();p.cull={sharp:sharpness(p),blink:false,hash:dhash(p)};
    if(faceOK&&aiAvailable()){try{const f=await aiFaces(p);p.cull.faces=f.length;p.cull.blink=f.some(q=>(q.bs.eyeBlinkLeft||0)>.5&&(q.bs.eyeBlinkRight||0)>.5);}catch(e){faceOK=false;toast('얼굴 인식 없이 흐림만 검사했어요');}}}
  const med=list.map(p=>p.cull.sharp).sort((a,b)=>a-b)[list.length>>1]||1;list.forEach(p=>{p.cull.blur=p.cull.sharp<med*.35;p.cull.score=Math.min(2,p.cull.sharp/med)-(p.cull.blink?1:0)-(p.cull.blur?1:0);});
  busy(false);photos.forEach(thumbBadges);const nb=list.filter(p=>p.cull.blur).length,nk=list.filter(p=>p.cull.blink).length;toast(`${list.length}장 검사: 흐림 ${nb}장 · 눈 감음 ${nk}장`);syncUI();}
function rejectProblems(){let n=0;photos.forEach(p=>{if(p.cull&&(p.cull.blur||p.cull.blink)){p.flag=-1;n++;thumbBadges(p);}});applyFilter();syncUI();toast(n?`${n}장을 거부로 표시했어요`:'먼저 ‘AI 선별’을 실행해 주세요');}
function bestShots(){const list=photos.filter(p=>p.cull);if(list.length<2){toast('먼저 ‘AI 선별’을 실행해 주세요');return;}const groups=[];let g=[list[0]];
  for(let i=1;i<list.length;i++){const a=list[i-1].cull.hash,b=list[i].cull.hash;let d=0;for(let k=0;k<64;k++)if(a[k]!==b[k])d++;if(d<=14)g.push(list[i]);else{groups.push(g);g=[list[i]];}}groups.push(g);
  let n=0;groups.filter(x=>x.length>1).forEach(x=>{const best=x.slice().sort((a,b)=>b.cull.score-a.cull.score)[0];best.flag=1;thumbBadges(best);n++;});applyFilter();syncUI();
  toast(n?`비슷한 사진 ${n}묶음에서 베스트 컷을 픽했어요`:'비슷한 사진 묶음이 없어요');}
/* ---- tags ---- */
const TAGS=[['바다','a photo of the sea or a beach'],['산','a photo of mountains'],['하늘','a photo of the sky and clouds'],['노을','a photo of a sunset'],['야경','a photo of a city at night'],
  ['도시','a photo of a city street'],['건물','a photo of a building'],['숲','a photo of a forest'],['꽃','a photo of flowers'],['음식','a photo of food'],['카페','a photo of a cafe interior'],
  ['인물','a portrait photo of a person'],['단체 사진','a group photo of people'],['아이','a photo of a child'],['강아지','a photo of a dog'],['고양이','a photo of a cat'],
  ['자동차','a photo of a car'],['실내','a photo of an indoor room'],['눈','a photo of snow'],['물','a photo of a lake or river']];
async function aiTagAll(){const list=photos.filter(p=>!p.tags);if(!list.length){toast('모든 사진에 태그가 있어요');return;}
  await aiRun(async()=>{if(!(await confirmBig('clip')))return;const pipe=await getModel('clip');
    for(let i=0;i<list.length;i++){busy(true,`AI 태그 만드는 중… ${i+1}/${list.length}`);await nextFrame();const p=list[i];
      const out=await pipe(aiCanvas(p,384).toDataURL('image/jpeg',.9),TAGS.map(t=>t[1]));const sorted=out.slice().sort((a,b)=>b.score-a.score);
      p.tags=sorted.filter((o,k)=>k===0||o.score>=.12).slice(0,4).map(o=>TAGS.find(t=>t[1]===o.label)[0]);thumbBadges(p);}busy(false);toast('태그를 만들었어요. 필름 스트립 검색창에서 찾아보세요');});applyFilter();}
/* ---- AI upscale (export) ---- */
async function aiUpscale2x(c,onProg){const pipe=await getModel('upscale');const T=128,O=8,W=c.width,H=c.height;const out=document.createElement('canvas');out.width=W*2;out.height=H*2;const ox=out.getContext('2d');
  const tiles=[];for(let y=0;y<H;y+=T-O*2)for(let x=0;x<W;x+=T-O*2)tiles.push([x,y]);let k=0;
  for(const [x,y] of tiles){const sx=Math.max(0,x-O),sy=Math.max(0,y-O),sw=Math.min(W-sx,T),sh=Math.min(H-sy,T);const t=document.createElement('canvas');t.width=sw;t.height=sh;t.getContext('2d').drawImage(c,sx,sy,sw,sh,0,0,sw,sh);
    const r=await pipe(t.toDataURL('image/png'));const img=(Array.isArray(r)?r[0]:r);const rc=img.toCanvas();
    const cx=(x-sx),cy=(y-sy),cw=Math.min(T-O*2,W-x),chh=Math.min(T-O*2,H-y);ox.drawImage(rc,cx*2,cy*2,cw*2,chh*2,x*2,y*2,cw*2,chh*2);k++;onProg&&onProg(k/tiles.length);if(k%4===0)await nextFrame();}
  return out;}
/* ---- recommendation: AI scene info ---- */
const IMN={landscape:['seashore','lakeside','valley','alp','volcano','cliff','promontory','sandbar','geyser','coral reef','mountain','dam','breakwater'],
  food:['pizza','plate','cheeseburger','hotdog','carbonara','burrito','ice cream','espresso','bakery','guacamole','consomme','trifle','pretzel','bagel','meat loaf','potpie','dough','soup','bowl','french loaf','strawberry','orange','banana','mashed potato'],
  indoor:['library','restaurant','dining table','home theater','studio couch','wardrobe','desk','bookcase','shoji','four-poster','window shade','sliding door']};
async function recAIInfo(ph){if(ph._aiInfo)return ph._aiInfo;const info={faces:[],labels:[]};
  try{info.faces=await aiFaces(ph);}catch(e){console.warn(e);}try{info.labels=await aiClassify(ph);}catch(e){console.warn(e);}ph._aiInfo=info;return info;}
function applyAIInfo(a,info){if(!info)return a;const lab=info.labels.map(l=>l.name.toLowerCase());const has=k=>lab.slice(0,5).some(n=>IMN[k].some(w=>n.includes(w)));
  const faceArea=info.faces.reduce((s,f)=>s+(f.box[2]-f.box[0])*(f.box[3]-f.box[1]),0);
  a.aiScene=faceArea>.012?'portrait':has('food')?'food':has('landscape')?'landscape':has('indoor')?'indoor':null;
  if(info.faces.length){const d=R.fieldSrc,fw=R.fw,fh=R.fh;let sL=0,n=0,sr=0,sg=0,sb=0;
    info.faces.forEach(f=>{const x0=Math.round((f.box[0]+(f.box[2]-f.box[0])*.25)*fw),x1=Math.round((f.box[2]-(f.box[2]-f.box[0])*.25)*fw),y0=Math.round((f.box[1]+(f.box[3]-f.box[1])*.35)*fh),y1=Math.round((f.box[3]-(f.box[3]-f.box[1])*.25)*fh);
      for(let y=Math.max(0,y0);y<Math.min(fh,y1);y++)for(let x=Math.max(0,x0);x<Math.min(fw,x1);x++){const k=(y*fw+x)*4;sr+=d[k];sg+=d[k+1];sb+=d[k+2];sL+=(d[k]*.2126+d[k+1]*.7152+d[k+2]*.0722)/255;n++;}});
    if(n){a.faceL=sL/n;a.faceRGB=[sr/n/255,sg/n/255,sb/n/255];}}
  return a;}

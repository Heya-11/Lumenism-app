"use strict";
/* ================= tool switching / mode hints ================= */
function setTool(t){if(!cur)return;const prev=tool;tool=t;UI.straighten=false;UI.guide=false;UI.pendingCreate=null;UI.pick=null;UI.tat=null;UI.ret.awaitSrc=false;
  $('tools').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  ['edit','crop','mask','retouch','layers','portrait'].forEach(k=>$('p'+k[0].toUpperCase()+k.slice(1)).classList.toggle('on',k===t));
  vw.dataset.tool=t;
  if(t==='mask'&&!selMask()&&cur.params.masks.length){const m=cur.params.masks[cur.params.masks.length-1];cur.sel=m.id;cur.selComp=m.comps[0]?.id;}
  syncUI();updateModeUI();
  if(prev==='crop'||t==='crop'){doRender();fitView();}else requestRender();
  if(t==='edit')setTimeout(drawCurve,0);}
function modeHint(){if(UI.pick)return{wb:'회색이나 흰색이어야 할 곳을 클릭하세요',pc:'바꾸고 싶은 색을 클릭하세요',range:'마스크를 적용할 색을 클릭하세요',aisubject:'선택할 피사체를 클릭하세요',focusDepth:'초점을 맞출 곳을 클릭하세요',focusSubject:'초점을 맞출 피사체를 클릭하세요'}[UI.pick];
  if(UI.tat)return UI.tat==='hsl'?'바꾸고 싶은 색 위에서 위아래로 드래그하세요':'바꾸고 싶은 밝기 위에서 위아래로 드래그하세요';
  if(tool==='crop'){if(UI.straighten)return'수평선(또는 수직선)을 따라 드래그하세요';if(UI.guide)return`세로·가로 기준선을 따라 선을 그으세요 (${UI.guideLines.length}/4)`;return'';}
  if(tool==='mask'){if(UI.pendingCreate&&UI.pendingCreate!=='brush')return UI.pendingCreate==='linear'?'드래그해서 그라디언트 방향과 길이를 정하세요':'중심에서 바깥쪽으로 드래그하세요';
    const c=selComp();if(c&&c.type==='brush')return(UI.brush.erase?'지우개':'브러시')+(UI.brush.auto?' (자동 마스크)':'')+' — 칠할 곳을 드래그 · [ ] 크기 · Space+드래그 이동';return'';}
  if(tool==='retouch'){const m=UI.ret.mode;if(m==='stamp')return UI.ret.awaitSrc||!UI.ret.src?'복제할 소스 지점을 클릭하세요 (Alt+클릭)':'칠해서 소스를 복제하세요 · Alt+클릭으로 소스 다시 지정';
    return{heal:'고칠 곳을 클릭하세요 — 주변과 어울리게 자동으로 메워요',clone:'고칠 곳을 클릭하세요 — 다른 곳을 그대로 복사해요',redeye:'눈 중심에서 바깥으로 드래그하세요',fill:'지울 대상을 브러시로 칠하면 주변 내용으로 채워요'}[m];}
  if(UI.pick==='aisubject')return'선택할 피사체를 클릭하세요';
  if(tool==='portrait')return UI.pe.on?`칠해서 ${PE_CH[UI.pe.c][0]} 범위 ${UI.pe.m==='add'?'더하기':'지우기'} · 두 손가락으로 이동`:UI.liq.mode!=='off'?'드래그해서 유동화 · [ ] 크기 · Space+드래그 이동':'';
  if(tool==='layers')return selLayer()&&(selLayer().type==='image'||selLayer().type==='text')?'레이어를 드래그해서 옮기세요':'';
  return'';}
function updateModeUI(){vhint(modeHint());const m=$('mHint');if(m)m.textContent=tool==='mask'?modeHint():'';const rh=$('retHint');if(rh)rh.textContent=tool==='retouch'?modeHint():'';
  vw.classList.toggle('picking',!!UI.pick);vw.classList.toggle('tat',!!UI.tat);syncUI();drawOverlay();}
function startPick(k){UI.pick=UI.pick===k?null:k;UI.tat=null;updateModeUI();}

/* ================= pickers / auto ================= */
function doPick(mx,my){const k=UI.pick;UI.pick=null;
  if(k==='aisubject'||k==='focusDepth'||k==='focusSubject'){updateModeUI();aiPick(k,mx,my);return;}
  if(k==='wb'){const uv=screenToSrc(mx,my);const c=R.srcPixel(uv[0],uv[1],2).map(v=>Math.max(.002,Math.pow(v,2.2)));const [cr,cg,cb]=c;
    const a11=.35*cr,a12=.08*cr+.25*cg,b1=cg-cr,a21=-.35*cb,a22=.08*cb+.25*cg,b2=cg-cb,det=a11*a22-a12*a21;
    if(Math.abs(det)>1e-9){const t=(b1*a22-a12*b2)/det,n=(a11*b2-b1*a21)/det;P().temp=clamp(Math.round(t*100),-100,100);P().tint=clamp(Math.round(n*100),-100,100);commit('흰색 균형 스포이드');}}
  else if(k==='pc'){const o=screenToOut(mx,my);const c=R.readPixel(o[0],o[1]);const h=rgb2hslJS(c);const pcs=P().pcs;
    if(pcs.length>=4){toast('포인트 컬러는 최대 4개예요');}else{pcs.push({h:h[0],s:h[1],l:h[2],range:35,dh:0,ds:0,dl:0});cur.selPC=pcs.length-1;commit('포인트 컬러 추가');}}
  else if(k==='range'){const m=selMask();if(m){const uv=screenToSrc(mx,my);m.range.color=R.srcPixel(uv[0],uv[1],2);m.range.type='color';commit('범위 마스크 색 선택');}}
  updateModeUI();requestRender();}
function rgb2hslJS([r,g,b]){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
  if(d>1e-5){s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return[h,s,l];}
function autoTone(){const d=R.fieldSrc,n=d.length/4,hist=new Uint32Array(256);let sum=0,sum2=0;
  for(let i=0;i<n;i++){const l=Math.round(d[i*4]*.2126+d[i*4+1]*.7152+d[i*4+2]*.0722);hist[l]++;}
  const pct=q=>{let c=0;for(let i=0;i<256;i++){c+=hist[i];if(c>=n*q)return i/255;}return 1;};
  for(let i=0;i<256;i++){sum+=hist[i]*i/255;sum2+=hist[i]*(i/255)**2;}const mean=sum/n,std=Math.sqrt(Math.max(0,sum2/n-mean*mean));
  const p1=pct(.01),p10=pct(.1),p50=pct(.5),p99=pct(.99);
  const ev=clamp(2.2*Math.log2(.46/Math.max(p50,.02))*.7,-2.5,2.5);const k=Math.pow(2,ev/2.2);
  const q99=Math.min(1,p99*k),q10=p10*k,q1=p1*k;const p=P();
  p.exposure=Math.round(ev*20)/20;
  p.highlights=q99>.95?-Math.round(clamp((q99-.85)*350,0,70)):0;
  p.shadows=q10<.12?Math.round(clamp((.16-q10)*300,0,60)):0;
  p.whites=q99<.92?Math.round(clamp((.96-q99)*160,0,40)):0;
  p.blacks=q1>.04?-Math.round(clamp((q1-.02)*220,0,40)):0;
  p.contrast=std<.2?Math.round(clamp((.24-std)*200,0,30)):0;
  p.vibrance=Math.max(p.vibrance,10);
  syncUI();requestRender();commit('자동 톤');}

/* ================= TAT ================= */
function tatDown(mx,my){const o=screenToOut(mx,my);const c=R.readPixel(o[0],o[1]);const p=P();
  if(UI.tat==='hsl'){const [h,s]=rgb2hslJS(c);if(s<.05&&!p.bw){toast('채도가 거의 없는 곳이에요. 색이 있는 곳을 골라 보세요');}
    const deg=h*360,cen=BANDS.map(b=>b.h);let w=Array(8).fill(0);
    for(let i=0;i<8;i++){const a=cen[i],b=i===7?360:cen[i+1];if(deg>=a&&deg<b){const t=(deg-a)/(b-a);w[i]=1-t;w[(i+1)%8]=t;}}
    const key=p.bw?'bwMix':'hsl'+UI.hslTab;const start=p[key].slice();
    return{move(x,y){const dv=-(y-my)*.5;for(let i=0;i<8;i++)if(w[i]>0)p[key][i]=Math.round(clamp(start[i]+dv*w[i],-100,100));syncUI();requestRender();},
      up(){commit('타깃 조정: '+(p.bw?'흑백 혼합':{H:'색조',S:'채도',L:'광도'}[UI.hslTab]));}};}
  const L=.2126*c[0]+.7152*c[1]+.0722*c[2]*1;const pc=p.pcurve;const key=L<pc.s1/100?'sh':L<pc.s2/100?'dk':L<pc.s3/100?'lt':'hl';const s0=pc[key];
  if(UI.curveTab!=='param'){UI.curveTab='param';}
  return{move(x,y){pc[key]=Math.round(clamp(s0-(y-my)*.5,-100,100));syncUI();requestRender();},up(){commit('타깃 조정: 톤 곡선');}};}

/* ================= CROP ================= */
function aspectRatio(key){const L=R.last;if(key==='free'||!L)return null;if(key==='orig')return L.W/L.H;const [a,b]=key.split(':').map(Number);return a/b;}
function effCrop(){const L=R.last;return fitCrop(P().geo.crop,M3.inv(sqMatrix(L.W,L.H,P().geo)),L.W,L.H);}
function cropHit(mx,my){const c=effCrop(),[x0,y0]=frameToScreen(c.x,c.y),[x1,y1]=frameToScreen(c.x+c.w,c.y+c.h);
  const locked=!!aspectRatio(P().geo.aspect),near=(a,b)=>Math.abs(a-b)<14;
  const corners={nw:[x0,y0],ne:[x1,y0],sw:[x0,y1],se:[x1,y1]};for(const k in corners)if(near(mx,corners[k][0])&&near(my,corners[k][1]))return k;
  if(!locked){const inY=my>y0&&my<y1,inX=mx>x0&&mx<x1;if(near(mx,x0)&&inY)return'w';if(near(mx,x1)&&inY)return'e';if(near(my,y0)&&inX)return'n';if(near(my,y1)&&inX)return's';}
  if(mx>x0&&mx<x1&&my>y0&&my<y1)return'move';return null;}
function cropDrag(s,hd,dx,dy){const MIN=.03;let x0=s.x,y0=s.y,x1=s.x+s.w,y1=s.y+s.h;
  if(hd==='move')return{x:clamp(s.x+dx,0,1-s.w),y:clamp(s.y+dy,0,1-s.h),w:s.w,h:s.h};
  if(hd.includes('w'))x0=clamp(x0+dx,0,x1-MIN);if(hd.includes('e'))x1=clamp(x1+dx,x0+MIN,1);
  if(hd.includes('n'))y0=clamp(y0+dy,0,y1-MIN);if(hd.includes('s'))y1=clamp(y1+dy,y0+MIN,1);
  const r=aspectRatio(P().geo.aspect);
  if(r&&hd.length===2){const L=R.last,rn=r*L.H/L.W;let w=x1-x0,hh=w/rn;const top=hd.includes('n'),ay=top?s.y+s.h:s.y,maxH=top?ay:1-ay;
    if(hh>maxH){hh=maxH;w=hh*rn;if(hd.includes('w'))x0=x1-w;else x1=x0+w;}if(top){y1=ay;y0=ay-hh;}else{y0=ay;y1=ay+hh;}}
  return{x:x0,y:y0,w:x1-x0,h:y1-y0};}
function constrainCrop(s,c){const L=R.last,SQi=M3.inv(sqMatrix(L.W,L.H,P().geo));if(cropValid(c,SQi,L.W,L.H))return c;
  const lerp=t=>({x:s.x+(c.x-s.x)*t,y:s.y+(c.y-s.y)*t,w:s.w+(c.w-s.w)*t,h:s.h+(c.h-s.h)*t});
  let lo=0,hi=1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(cropValid(lerp(m),SQi,L.W,L.H))lo=m;else hi=m;}return lerp(lo);}
let sLine=null;
function cropDown(mx,my){
  if(UI.straighten){const p0=[mx,my];sLine=[p0,p0];return{move(x,y){sLine=[p0,[x,y]];drawOverlay();},
    up(){const [a,b]=sLine;sLine=null;const dx=b[0]-a[0],dy=b[1]-a[1];if(Math.hypot(dx,dy)<12){drawOverlay();return;}
      let d=Math.atan2(dy,dx)*180/Math.PI;while(d>45)d-=90;while(d<-45)d+=90;const g=P().geo;g.angle=Math.round(clamp(g.angle-d,-45,45)*10)/10;
      UI.straighten=false;updateModeUI();requestRender();commit(`수평 맞춤 ${g.angle.toFixed(1)}°`);}};}
  if(UI.guide){const p0=[mx,my];sLine=[p0,p0];return{move(x,y){sLine=[p0,[x,y]];drawOverlay();},
    up(){const [a,b]=sLine;sLine=null;if(Math.hypot(b[0]-a[0],b[1]-a[1])<20){drawOverlay();return;}const L=R.last,SQi=M3.inv(L.SQ);
      const f=p=>{const q=screenToFrame(p[0],p[1]);return M3.ap(SQi,[q[0]*L.W,q[1]*L.H]);};
      UI.guideLines.push([f(a),f(b)]);if(UI.guideLines.length>4)UI.guideLines.shift();solveUpright();updateModeUI();}};}
  const hd=cropHit(mx,my);if(!hd)return null;const s=effCrop(),p0=screenToFrame(mx,my);
  return{move(x,y){const p=screenToFrame(x,y);P().geo.crop=constrainCrop(s,cropDrag(s,hd,p[0]-p0[0],p[1]-p0[1]));drawOverlay();},up(){commit('자르기');updateHist();}};}
function solveUpright(){const g=P().geo,L=R.last,W=L.W,H=L.H,lines=UI.guideLines;if(!lines.length)return;
  const SQ0=sqMatrix(W,H,g);const cls=lines.map(l=>{const a=M3.ap(SQ0,l[0]),b=M3.ap(SQ0,l[1]);return Math.abs(b[0]-a[0])<Math.abs(b[1]-a[1])?'v':'h';});
  const nv=cls.filter(c=>c==='v').length,nh=cls.length-nv;
  const cost=x=>{const SQ=sqMatrix(W,H,{...g,pv:x[0],ph:x[1],angle:x[2]});let c=0;lines.forEach((l,i)=>{const a=M3.ap(SQ,l[0]),b=M3.ap(SQ,l[1]);
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;const s=cls[i]==='v'?dx/len:dy/len;c+=s*s;});return c+1e-6*(x[0]*x[0]+x[1]*x[1]);};
  const free=[nv>=2,nh>=2,true];let x=[g.pv,g.ph,g.angle];if(!free[0])x[0]=g.pv;if(!free[1])x[1]=g.ph;
  const lim=[[-100,100],[-100,100],[-45,45]];let best=cost(x);
  for(const step of [20,8,3,1,.3,.1,.03])for(let it=0;it<30;it++){let imp=false;
    for(let k=0;k<3;k++){if(!free[k])continue;for(const s of [step,-step]){const y=x.slice();y[k]=clamp(y[k]+s,lim[k][0],lim[k][1]);const c=cost(y);if(c<best-1e-12){best=c;x=y;imp=true;}}}if(!imp)break;}
  g.pv=Math.round(x[0]*10)/10;g.ph=Math.round(x[1]*10)/10;g.angle=Math.round(x[2]*10)/10;syncUI();requestRender();commit('가이드 업라이트');}
function setAspect(key){const g=P().geo;g.aspect=key;const r=aspectRatio(key);
  if(r){const L=R.last,rn=r*L.H/L.W;let w=1,h=1;if(rn>1)h=1/rn;else w=rn;g.crop={x:(1-w)/2,y:(1-h)/2,w,h};}
  syncUI();requestRender();commit('자르기 비율 '+ASPECTS.find(a=>a[0]===key)[1]);}
function rotate90(dir){const g=P().geo;const n=dir>0?1:3;
  for(let i=0;i<n;i++){g.rot=(g.rot+1)%4;const c=g.crop;g.crop={x:1-c.y-c.h,y:c.x,w:c.h,h:c.w};[g.fh,g.fv]=[g.fv,g.fh];[g.pv,g.ph]=[g.ph,-g.pv];}
  g.aspect=ASP_INV[g.aspect]||g.aspect;UI.guideLines=[];syncUI();requestRender();commit(dir>0?'오른쪽으로 회전':'왼쪽으로 회전');}
function flip(axis){const g=P().geo,c=g.crop;if(axis==='h'){g.fh=!g.fh;c.x=1-c.x-c.w;g.ph=-g.ph;}else{g.fv=!g.fv;c.y=1-c.y-c.h;g.pv=-g.pv;}g.angle=-g.angle;
  UI.guideLines=[];syncUI();requestRender();commit(axis==='h'?'좌우 반전':'상하 반전');}

/* ================= MASK ================= */
function newComp(type,mode){return{id:uid('c'),type,mode:mode||'add',inv:false,feather:50,a:[.5,.3],b:[.5,.6],c:[.5,.5],rx:.25,ry:.25,strokes:[]};}
function startNewMask(type,mode){if(!cur||!R.localOK)return;
  if(mode!=='new'&&!selMask())mode='new';
  if(type==='brush'){const c=newComp('brush',mode==='new'?'add':mode);addComp(c,mode);commit(mode==='new'?'마스크 추가: 브러시':'구성 요소 추가: 브러시');UI.pendingCreate=null;updateModeUI();return;}
  UI.pendingCreate=type;UI.pendingMode=mode;updateModeUI();}
function addComp(c,mode){if(mode==='new'){const n=cur.params.masks.length+1;const m={id:uid('m'),name:'마스크 '+n,comps:[c],adj:Object.fromEntries(ADJ_KEYS.map(k=>[k,0])),
    range:{type:'none',lo:0,hi:100,sm:20,tol:30,color:null}};cur.params.masks.push(m);cur.sel=m.id;}else selMask().comps.push(c);
  cur.selComp=c.id;syncUI();requestRender();}
function compHandles(c){const asp=R.last.w/R.last.h;
  if(c.type==='linear')return[{k:'a',uv:c.a},{k:'b',uv:c.b},{k:'mid',uv:[(c.a[0]+c.b[0])/2,(c.a[1]+c.b[1])/2]}];
  if(c.type==='radial')return[{k:'c',uv:c.c},{k:'rx',uv:[c.c[0]+c.rx/asp,c.c[1]]},{k:'ry',uv:[c.c[0],c.c[1]-c.ry]}];return[];}
function compPin(c){if(c.type==='linear')return[(c.a[0]+c.b[0])/2,(c.a[1]+c.b[1])/2];if(c.type==='radial')return c.c;const s=c.strokes.find(s=>!s.e);return s?s.p[0]:null;}
function maskDown(mx,my){const uv=screenToSrc(mx,my),asp=R.last.w/R.last.h;
  if(UI.pendingCreate){const type=UI.pendingCreate,mode=UI.pendingMode;UI.pendingCreate=null;const c=newComp(type,mode==='new'?'add':mode);
    if(type==='linear'){c.a=uv.map(rnd4);c.b=[c.a[0],c.a[1]+.0001];}else{c.c=uv.map(rnd4);c.rx=c.ry=.001;}addComp(c,mode);
    return{move(x,y){const u=screenToSrc(x,y);if(type==='linear')c.b=u.map(rnd4);else{const d=Math.hypot((u[0]-c.c[0])*asp,u[1]-c.c[1]);c.rx=c.ry=rnd4(Math.max(.005,d));}requestRender();},
      up(){if(type==='linear'&&Math.hypot((c.b[0]-c.a[0])*asp,c.b[1]-c.a[1])<.02)c.b=[c.a[0],Math.min(1,c.a[1]+.3)];if(type==='radial'&&c.rx<.02){c.rx=.25;c.ry=.2;}
        updateModeUI();requestRender();commit((mode==='new'?'마스크 추가: ':'구성 요소 추가: ')+MASK_N[type]);}};}
  const m=selMask(),c=selComp();
  if(c){for(const h of compHandles(c)){const [hx,hy]=srcToScreen(h.uv);if(Math.hypot(mx-hx,my-hy)<12){const s0=clone(c),u0=uv;
    return{move(x,y){const u=screenToSrc(x,y),du=[u[0]-u0[0],u[1]-u0[1]];
      if(h.k==='a')c.a=u.map(rnd4);else if(h.k==='b')c.b=u.map(rnd4);
      else if(h.k==='mid'){c.a=[rnd4(s0.a[0]+du[0]),rnd4(s0.a[1]+du[1])];c.b=[rnd4(s0.b[0]+du[0]),rnd4(s0.b[1]+du[1])];}
      else if(h.k==='c')c.c=[rnd4(s0.c[0]+du[0]),rnd4(s0.c[1]+du[1])];
      else if(h.k==='rx')c.rx=rnd4(Math.max(.01,Math.abs(u[0]-c.c[0])*asp));else if(h.k==='ry')c.ry=rnd4(Math.max(.01,Math.abs(u[1]-c.c[1])));requestRender();},
      up(){commit(m.name+' 조절');}};}}}
  for(const o of cur.params.masks){if(o===m)continue;const pin=o.comps[0]&&compPin(o.comps[0]);if(!pin)continue;const [px,py]=srcToScreen(pin);
    if(Math.hypot(mx-px,my-py)<11){cur.sel=o.id;cur.selComp=o.comps[0].id;syncUI();requestRender();updateModeUI();return{move(){},up(){}};}}
  if(c&&c.type==='brush'){const B=UI.brush;const s={e:B.erase?1:0,a:B.auto?1:0,f:B.feather/100,fl:B.flow/100,r:+(B.size/(view.s*R.last.h)).toFixed(5),p:[uv.map(rnd4)]};
    c.strokes.push(s);requestRender();
    return{move(x,y){hoverPos=[x,y];const u=screenToSrc(x,y),lp=s.p[s.p.length-1];if(Math.hypot((u[0]-lp[0])*R.last.w,(u[1]-lp[1])*R.last.h)*view.s<2)return;s.p.push(u.map(rnd4));requestRender();},
      up(){commit(s.e?'브러시 지우기':'브러시 칠하기');}};}
  return null;}
function deleteMask(){const m=selMask();if(!m)return;const ms=cur.params.masks;ms.splice(ms.indexOf(m),1);const n=ms[ms.length-1];cur.sel=n?n.id:null;cur.selComp=n?n.comps[0]?.id:null;
  syncUI();requestRender();commit('마스크 삭제');}

/* ================= RETOUCH ================= */
function findSource(d,r){const fw=R.fw,fh=R.fh,px=R.fieldSrc,asp=R.w/R.h;
  const at=(u,v)=>{const x=clamp(Math.round(u*fw),0,fw-1),y=clamp(Math.round(v*fh),0,fh-1),k=(y*fw+x)*4;return[px[k],px[k+1],px[k+2]];};
  const ring=(c,rr)=>{const o=[];for(let k=0;k<16;k++){const a=k/16*Math.PI*2;o.push(at(c[0]+Math.cos(a)*rr/asp,c[1]+Math.sin(a)*rr));}return o;};
  const rd=ring(d,r*1.35);let best=null,be=Infinity;
  for(const dist of [2.4,3.2,4.2])for(let k=0;k<16;k++){const a=k/16*Math.PI*2;const c=[d[0]+Math.cos(a)*r*dist/asp,d[1]+Math.sin(a)*r*dist];
    if(c[0]-r*1.4/asp<0||c[0]+r*1.4/asp>1||c[1]-r*1.4<0||c[1]+r*1.4>1)continue;
    const rc=ring(c,r*1.35);let e=0;for(let i=0;i<16;i++)for(let j=0;j<3;j++)e+=(rd[i][j]-rc[i][j])**2;
    const inn=ring(c,r*.5).concat(ring(c,r*.9),[at(c[0],c[1])]);const mu=[0,1,2].map(j=>inn.reduce((s,p)=>s+p[j],0)/inn.length);
    let v=0;inn.forEach(p=>{for(let j=0;j<3;j++)v+=(p[j]-mu[j])**2;});e+=v*.6*16/inn.length+dist*40;if(e<be){be=e;best=c;}}
  return(best||[clamp(d[0]+r*3/asp,0,1),d[1]]).map(rnd4);}
let fillStroke=null;
function retDown(mx,my,e){const uv=screenToSrc(mx,my);const items=cur.params.retouch;const L=R.last;
  for(const it of items.slice().reverse()){if(!(it.type==='heal'||it.type==='clone'||it.type==='redeye'))continue;
    const hs=it.type==='redeye'?[['c',it.c]]:[['d',it.d],['s',it.s]];
    for(const [k,p] of hs){const [hx,hy]=srcToScreen(p);const rs=it.r*L.h*view.s;if(Math.hypot(mx-hx,my-hy)<Math.max(10,rs)){cur.selRet=it.id;syncUI();const p0=p.slice(),u0=uv;
      return{move(x,y){const u=screenToSrc(x,y);it[k]=[rnd4(p0[0]+u[0]-u0[0]),rnd4(p0[1]+u[1]-u0[1])];requestRender();},up(){commit(RET_N[it.type]+' 이동');}};}}}
  const m=UI.ret.mode,r=+(UI.ret.size/(view.s*L.h)).toFixed(5);
  if(m==='heal'||m==='clone'){const d=uv.map(rnd4);const it={id:uid('r'),type:m,d,s:findSource(d,r),r,f:UI.ret.feather,op:UI.ret.op};items.push(it);cur.selRet=it.id;
    syncUI();requestRender();return{move(){},up(){commit(m==='heal'?'스팟 복구':'스팟 복제');}};}
  if(m==='redeye'){const it={id:uid('r'),type:'redeye',c:uv.map(rnd4),r:.005,f:40,op:100};items.push(it);cur.selRet=it.id;requestRender();
    return{move(x,y){const u=screenToSrc(x,y);it.r=rnd4(Math.max(.004,Math.hypot((u[0]-it.c[0])*L.w/L.h,u[1]-it.c[1])));requestRender();},
      up(){if(it.r<=.0045)it.r=r*.5;syncUI();requestRender();commit('적목 제거');}};}
  if(m==='stamp'){if(e.altKey||UI.ret.awaitSrc||!UI.ret.src){UI.ret.src=uv;UI.ret.off=null;UI.ret.awaitSrc=false;updateModeUI();toast('복제 소스를 지정했어요');return{move(){},up(){}};}
    const off=UI.ret.off||[rnd4(UI.ret.src[0]-uv[0]),rnd4(UI.ret.src[1]-uv[1])];UI.ret.off=off;
    const it={id:uid('r'),type:'stamp',off,strokes:[{e:0,f:UI.ret.feather/100,fl:UI.ret.op/100,r,p:[uv.map(rnd4)]}]};items.push(it);cur.selRet=it.id;requestRender();const s=it.strokes[0];
    return{move(x,y){hoverPos=[x,y];const u=screenToSrc(x,y),lp=s.p[s.p.length-1];if(Math.hypot((u[0]-lp[0])*L.w,(u[1]-lp[1])*L.h)*view.s<2)return;s.p.push(u.map(rnd4));R.retKey='';requestRender();},
      up(){syncUI();commit('복제 도장');}};}
  if(m==='fill'){fillStroke={r,p:[uv]};drawOverlay();
    return{move(x,y){hoverPos=[x,y];fillStroke.p.push(screenToSrc(x,y));drawOverlay();},up(){const s=fillStroke;fillStroke=null;runFill(s);}};}
  return null;}
async function runFill(s){busy(true,'내용 인식 채우기 계산 중…');await nextFrame();
  try{let res=null;if(UI.ret.ai&&aiAvailable()){try{res=await lamaFill(cur.prev,[s]);}catch(e){if(e.message!=='취소했어요')toast('AI 채우기 실패 — 기본 방식으로 채울게요');else{busy(false);drawOverlay();return;}}}
    busy(true,'내용 인식 채우기 계산 중…');if(!res)res=contentFill(cur.prev,[s]);const pid=uid('p');STORE.patches.set(pid,res.canvas);
    const it={id:uid('r'),type:'fill',pid,bb:res.bb.map(rnd4)};cur.params.retouch.push(it);cur.selRet=it.id;syncUI();requestRender();commit('내용 인식 채우기');}
  catch(e){toast('채우기 실패: '+e.message);}busy(false);drawOverlay();}
function deleteRet(){const r=selRet();if(!r)return;const a=cur.params.retouch;a.splice(a.indexOf(r),1);cur.selRet=null;syncUI();requestRender();commit('리터칭 삭제');}

/* ================= LAYERS ================= */
function newLayer(type){const n=cur.params.layers.filter(l=>l.type===type).length+1;
  const L={id:uid('l'),type,name:`${LAYER_N[type]} ${n}`,visible:true,blend:'normal',opacity:100,x:.5,y:.5,scale:100,rot:0,mask:{type:'none',x:.5,y:.5,ang:90,size:40,f:50,inv:false}};
  if(type==='text')Object.assign(L,{text:'텍스트를 입력하세요',font:'Noto Sans KR',size:6,color:'#ffffff',bold:true,shadow:true});
  if(type==='color')Object.assign(L,{color:'#ff8a3d',blend:'softlight',opacity:50});
  if(type==='adjust')Object.assign(L,{exp:0,con:0,sat:0,hue:0,invert:false});return L;}
function addLayer(type,extra){const L=Object.assign(newLayer(type),extra||{});cur.params.layers.push(L);cur.selLayer=L.id;syncUI();requestRender();commit('레이어 추가: '+LAYER_N[type]);updateModeUI();}
const imageNames=new Map();
async function addImageLayer(file){try{const bm=await createImageBitmap(file,{imageOrientation:'from-image'});const c=drawScaled(bm,bm.width,bm.height,2048);bm.close&&bm.close();
    const id='file:'+uid('f');STORE.images.set(id,c);imageNames.set(id,file.name);addLayer('image',{img:id,name:file.name.replace(/\.[^.]+$/,'')});}
  catch(e){toast('이미지를 열지 못했어요');}}
function imageSources(){const o=[];imageNames.forEach((n,id)=>o.push([id,'파일: '+n]));photos.forEach(p=>o.push(['photo:'+p.uid,'필름: '+p.name]));return o;}
function ensureImageSource(id){if(id&&id.startsWith('photo:')&&!STORE.images.has(id)){const p=photos.find(x=>'photo:'+x.uid===id);if(p)STORE.images.set(id,p.prev);}if(R)R.layerTex.delete(selLayer()?.id);}
function deleteLayer(){const L=selLayer();if(!L)return;const a=cur.params.layers;a.splice(a.indexOf(L),1);cur.selLayer=a.length?a[a.length-1].id:null;syncUI();requestRender();commit('레이어 삭제');}
function dupLayer(){const L=selLayer();if(!L)return;const c=clone(L);c.id=uid('l');c.name=L.name+' 복사';c.x=Math.min(1,c.x+.03);c.y=Math.min(1,c.y+.03);
  const a=cur.params.layers;a.splice(a.indexOf(L)+1,0,c);cur.selLayer=c.id;syncUI();requestRender();commit('레이어 복제');}
function layerCorners(L){const lr=R.last;const rc=R.layerRect(L,lr.outW,lr.outH);if(!rc)return null;const cx=L.x*lr.outW,cy=L.y*lr.outH,t=L.rot*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const x=a*rc.w/2,y=b*rc.h/2;return outToScreen(cx+c*x-s*y,cy+s*x+c*y);});}
function inPoly(p,poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
function layerDown(mx,my){const ls=cur.params.layers;let target=null;const sl=selLayer();
  if(sl&&sl.visible&&(sl.type==='image'||sl.type==='text')){const cs=layerCorners(sl);if(cs&&inPoly([mx,my],cs))target=sl;}
  if(!target)for(const L of ls.slice().reverse()){if(!L.visible||!(L.type==='image'||L.type==='text'))continue;const cs=layerCorners(L);if(cs&&inPoly([mx,my],cs)){target=L;break;}}
  if(!target)return null;if(cur.selLayer!==target.id){cur.selLayer=target.id;syncUI();}const L=target,x0=L.x,y0=L.y,lr=R.last;
  return{move(x,y){L.x=+(x0+(x-mx)/view.s/lr.outW).toFixed(4);L.y=+(y0+(y-my)/view.s/lr.outH).toFixed(4);requestRender();},up(){syncUI();commit(L.name+' 이동');}};}

/* ================= overlay ================= */
let hoverPos=null;
function drawOverlay(){if(!cur||!R||!R.last){ov.innerHTML='';return;}let s='';const L=R.last;const W=vw.clientWidth,H=vw.clientHeight;
  if(tool==='crop'){const c=effCrop(),[x0,y0]=frameToScreen(c.x,c.y),[x1,y1]=frameToScreen(c.x+c.w,c.y+c.h);
    s+=`<path d="M-10 -10H${W+10}V${H+10}H-10Z M${x0} ${y0}V${y1}H${x1}V${y0}Z" fill="rgba(0,0,0,.6)" fill-rule="evenodd"/>`;
    for(let i=1;i<3;i++){const gx=x0+(x1-x0)*i/3,gy=y0+(y1-y0)*i/3;s+=`<line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y1}" stroke="rgba(255,255,255,.35)"/><line x1="${x0}" y1="${gy}" x2="${x1}" y2="${gy}" stroke="rgba(255,255,255,.35)"/>`;}
    s+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="#fff"/>`;
    [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(([x,y,a,b])=>s+=`<path d="M${x} ${y+b*16}V${y}H${x+a*16}" fill="none" stroke="#fff" stroke-width="3"/>`);
    if(!aspectRatio(P().geo.aspect)){const mxp=(x0+x1)/2,myp=(y0+y1)/2;[[mxp-8,y0,mxp+8,y0],[mxp-8,y1,mxp+8,y1],[x0,myp-8,x0,myp+8],[x1,myp-8,x1,myp+8]].forEach(([a,b,c2,d])=>s+=`<line x1="${a}" y1="${b}" x2="${c2}" y2="${d}" stroke="#fff" stroke-width="3"/>`);}
    UI.guideLines.forEach(l=>{const a=M3.ap(L.SQ,l[0]),b=M3.ap(L.SQ,l[1]);const A=frameToScreen(a[0]/L.W,a[1]/L.H),B=frameToScreen(b[0]/L.W,b[1]/L.H);
      s+=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#4dd2ff" stroke-width="2"/><circle cx="${A[0]}" cy="${A[1]}" r="4" fill="#4dd2ff"/><circle cx="${B[0]}" cy="${B[1]}" r="4" fill="#4dd2ff"/>`;});
    if(sLine)s+=`<line x1="${sLine[0][0]}" y1="${sLine[0][1]}" x2="${sLine[1][0]}" y2="${sLine[1][1]}" stroke="${UI.guide?'#4dd2ff':'#ffd34d'}" stroke-width="2" stroke-dasharray="6 4"/>`;}
  else if(tool==='mask'){const m=selMask(),asp=L.w/L.h;
    if(m)m.comps.forEach(c=>{const sel=c===selComp(),st=sel?'#fff':'rgba(255,255,255,.4)';
      if(c.type==='linear'){const A=srcToScreen(c.a),B=srcToScreen(c.b);let dx=B[0]-A[0],dy=B[1]-A[1];const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const px=-dy*3000,py=dx*3000;
        s+=`<line x1="${A[0]-px}" y1="${A[1]-py}" x2="${A[0]+px}" y2="${A[1]+py}" stroke="${st}" stroke-width="1.2"/><line x1="${B[0]-px}" y1="${B[1]-py}" x2="${B[0]+px}" y2="${B[1]+py}" stroke="${st}" stroke-width="1.2" stroke-dasharray="5 4"/>`;}
      if(c.type==='radial'){const f=1-c.feather/100,pts=[],pin=[];for(let i=0;i<=72;i++){const t=i/72*Math.PI*2;pts.push(srcToScreen([c.c[0]+Math.cos(t)*c.rx/asp,c.c[1]+Math.sin(t)*c.ry]).join(','));
          pin.push(srcToScreen([c.c[0]+Math.cos(t)*c.rx*f/asp,c.c[1]+Math.sin(t)*c.ry*f]).join(','));}
        s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${st}" stroke-width="1.3"/>`;if(sel)s+=`<polyline points="${pin.join(' ')}" fill="none" stroke="rgba(255,255,255,.5)" stroke-dasharray="4 4"/>`;}});
    const c=selComp();if(c)compHandles(c).forEach(h=>{const [x,y]=srcToScreen(h.uv);const big=h.k==='mid'||h.k==='c';s+=`<circle cx="${x}" cy="${y}" r="${big?6:5}" fill="${big?'#5aa2ff':'#fff'}" stroke="#000" stroke-width="1.2"/>`;});
    cur.params.masks.forEach(o=>{if(o===m||!o.comps[0])return;const pin=compPin(o.comps[0]);if(!pin)return;const [x,y]=srcToScreen(pin);s+=`<circle cx="${x}" cy="${y}" r="6" fill="#222" stroke="#fff" stroke-width="1.5"/>`;});
    if(c&&c.type==='brush'&&hoverPos&&!UI.space&&!UI.pendingCreate){const r=UI.brush.size,ri=r*(1-UI.brush.feather/100);
      s+=`<circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="${r}" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="${Math.max(1,ri)}" fill="none" stroke="rgba(255,255,255,.5)" stroke-dasharray="3 3"/>`;
      if(UI.brush.erase)s+=`<line x1="${hoverPos[0]-5}" y1="${hoverPos[1]}" x2="${hoverPos[0]+5}" y2="${hoverPos[1]}" stroke="#fff" stroke-width="1.5"/>`;}}
  else if(tool==='retouch'){const sel=selRet();
    cur.params.retouch.forEach(it=>{const on=it===sel,col=on?'#fff':'rgba(255,255,255,.55)';
      if(it.type==='heal'||it.type==='clone'){const D=srcToScreen(it.d),S=srcToScreen(it.s),rs=it.r*L.h*view.s;
        s+=`<line x1="${D[0]}" y1="${D[1]}" x2="${S[0]}" y2="${S[1]}" stroke="${col}" stroke-width="1"/><circle cx="${D[0]}" cy="${D[1]}" r="${rs}" fill="none" stroke="${col}" stroke-width="${on?2:1.2}"/><circle cx="${S[0]}" cy="${S[1]}" r="${rs}" fill="none" stroke="${col}" stroke-dasharray="4 3"/>`;}
      if(it.type==='redeye'){const C=srcToScreen(it.c);s+=`<circle cx="${C[0]}" cy="${C[1]}" r="${it.r*L.h*view.s}" fill="none" stroke="${on?'#ff6b6b':'rgba(255,107,107,.6)'}" stroke-width="1.5"/>`;}
      if(it.type==='fill'&&on){const A=srcToScreen([it.bb[0],it.bb[1]]),B=srcToScreen([it.bb[0]+it.bb[2],it.bb[1]+it.bb[3]]);s+=`<rect x="${Math.min(A[0],B[0])}" y="${Math.min(A[1],B[1])}" width="${Math.abs(B[0]-A[0])}" height="${Math.abs(B[1]-A[1])}" fill="none" stroke="#fff" stroke-dasharray="4 4"/>`;}});
    if(fillStroke){const r=fillStroke.r*L.h*view.s;s+=`<polyline points="${fillStroke.p.map(p=>srcToScreen(p).join(',')).join(' ')}" fill="none" stroke="rgba(255,60,60,.55)" stroke-width="${r*2}" stroke-linecap="round" stroke-linejoin="round"/>`;}
    if(UI.ret.mode==='stamp'&&UI.ret.src&&!UI.ret.off){const S=srcToScreen(UI.ret.src);s+=`<path d="M${S[0]-9} ${S[1]}H${S[0]+9}M${S[0]} ${S[1]-9}V${S[1]+9}" stroke="#fff" stroke-width="2"/><circle cx="${S[0]}" cy="${S[1]}" r="${UI.ret.size}" fill="none" stroke="rgba(255,255,255,.6)" stroke-dasharray="4 3"/>`;}
    if(hoverPos&&!UI.space&&UI.ret.mode!=='redeye'){s+=`<circle cx="${hoverPos[0]}" cy="${hoverPos[1]}" r="${UI.ret.size}" fill="none" stroke="#fff" stroke-width="1.2"/>`;
      if(UI.ret.mode==='stamp'&&UI.ret.off){const u=screenToSrc(hoverPos[0],hoverPos[1]);const S=srcToScreen([u[0]+UI.ret.off[0],u[1]+UI.ret.off[1]]);s+=`<path d="M${S[0]-8} ${S[1]}H${S[0]+8}M${S[0]} ${S[1]-8}V${S[1]+8}" stroke="#fff" stroke-width="1.5"/>`;}}}
  else if(tool==='portrait')s+=portraitOverlay();
  else if(tool==='layers'){const Lr=selLayer();if(Lr&&Lr.visible&&(Lr.type==='image'||Lr.type==='text')){const cs=layerCorners(Lr);if(cs)s+=`<polygon points="${cs.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#5aa2ff" stroke-width="1.5" stroke-dasharray="6 4"/>`;}}
  if(UI.compare==='split'&&tool!=='crop'){const x=view.x+UI.splitX*glc.width*view.s,y0=Math.max(0,view.y),y1=Math.min(H,view.y+glc.height*view.s);
    s+=`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#fff" stroke-width="1.5"/><circle cx="${x}" cy="${(y0+y1)/2}" r="9" fill="#fff"/><path d="M${x-4} ${(y0+y1)/2}l-3 0M${x+4} ${(y0+y1)/2}l3 0" stroke="#000"/>`;
    s+=`<text x="${x-10}" y="${y0+20}" text-anchor="end">보정 전</text><text x="${x+10}" y="${y0+20}">보정 후</text>`;}
  ov.innerHTML=s;}

/* ================= pointer routing ================= */
let pan=null,act=null;const pointers=new Map();
function rel(e){const r=vw.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
function startAct(mx,my,e){if(UI.tat&&tool==='edit')act=tatDown(mx,my);
  else if(tool==='crop')act=cropDown(mx,my);else if(tool==='mask')act=maskDown(mx,my);else if(tool==='retouch')act=retDown(mx,my,e);else if(tool==='layers')act=layerDown(mx,my);else if(tool==='portrait')act=portDown(mx,my);
  return !!act;}
let pend=null;/* touch: wait briefly before starting a tool stroke so a second finger can turn it into pinch/pan */
function pinchStart(){const [a,b]=[...pointers.values()];const r=vw.getBoundingClientRect();const m=[(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top];
  pan={pinch:Math.hypot(a.x-b.x,a.y-b.y),s:view.s,m,vx:view.x,vy:view.y};vw.classList.add('panning');}
function flushPend(){if(!pend)return;const p=pend;pend=null;clearTimeout(p.t);if(!startAct(p.mx,p.my,p.e)){pan={x:p.cx,y:p.cy,vx:view.x,vy:view.y};vw.classList.add('panning');}}
let ftap=null;/* touch: 2-finger tap = undo, 3-finger tap = redo */
vw.addEventListener('pointerdown',e=>{if(!cur||e.target.closest('.empty'))return;try{vw.setPointerCapture(e.pointerId);}catch(_){}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.pointerType==='touch'){if(pointers.size===1)ftap={t:performance.now(),n:1,o:new Map([[e.pointerId,[e.clientX,e.clientY]]]),moved:false};else if(ftap){ftap.n=Math.max(ftap.n,pointers.size);ftap.o.set(e.pointerId,[e.clientX,e.clientY]);}}
  const [mx,my]=rel(e);
  if(pointers.size===2){if(pend){clearTimeout(pend.t);pend=null;}if(act){act.up();act=null;}pinchStart();return;}
  if(pointers.size>2)return;
  if(UI.space||e.button===1){pan={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};vw.classList.add('panning');return;}
  if(UI.compare==='split'&&tool!=='crop'){const x=view.x+UI.splitX*glc.width*view.s;if(Math.abs(mx-x)<(e.pointerType==='touch'?22:10)){act={move(x2){UI.splitX=clamp((x2-view.x)/view.s/glc.width,0,1);requestRender();},up(){}};return;}}
  if(UI.pick){doPick(mx,my);return;}
  if(e.button===0){
    if(e.pointerType==='touch'&&(tool!=='edit'||UI.tat)){pend={mx,my,cx:e.clientX,cy:e.clientY,e,t:setTimeout(flushPend,110)};return;}
    if(startAct(mx,my,e))return;}
  pan={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};vw.classList.add('panning');});
vw.addEventListener('pointermove',e=>{const [mx,my]=rel(e);
  if(tool==='mask'||tool==='retouch'||tool==='portrait'){hoverPos=[mx,my];if(!act&&!pan)drawOverlay();}
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ftap&&!ftap.moved){const o=ftap.o.get(e.pointerId);if(o&&Math.hypot(e.clientX-o[0],e.clientY-o[1])>14)ftap.moved=true;}
  if(pend){if(Math.hypot(e.clientX-pend.cx,e.clientY-pend.cy)>6)flushPend();else return;}
  if(act){act.move(mx,my);if(tool==='mask'||tool==='retouch'||tool==='portrait')drawOverlay();return;}
  if(!pan)return;
  if(pan.pinch&&pointers.size===2){const [a,b]=[...pointers.values()];const r=vw.getBoundingClientRect();const m=[(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top];
    const o=cur&&R?cur.w/R.w:1;const ns=clamp(pan.s*Math.hypot(a.x-b.x,a.y-b.y)/pan.pinch,.02,8*o);
    view.x=m[0]-(pan.m[0]-pan.vx)*(ns/pan.s);view.y=m[1]-(pan.m[1]-pan.vy)*(ns/pan.s);view.s=ns;view.fit=false;applyView();}
  else if(!pan.pinch){view.x=pan.vx+e.clientX-pan.x;view.y=pan.vy+e.clientY-pan.y;view.fit=false;applyView();}});
const endPtr=e=>{pointers.delete(e.pointerId);
  if(ftap&&pointers.size===0){const f=ftap;ftap=null;if(f.n>=2&&!f.moved&&performance.now()-f.t<380&&e.type==='pointerup'){if(pend){clearTimeout(pend.t);pend=null;}if(act){act.up();act=null;}pan=null;vw.classList.remove('panning');
    if(f.n===2){if(cur.hi>0){gotoHistory(cur.hi-1);toast('실행 취소');}}else if(cur.hi<cur.history.length-1){gotoHistory(cur.hi+1);toast('다시 실행');}return;}}if(pend&&pointers.size===0){const p=pend;flushPend();if(act){const [mx,my]=rel(e);act.move(mx,my);}}if(pan&&pan.pinch&&pointers.size===1){pan=null;}if(act&&pointers.size===0){const a=act;act=null;a.up();}if(pointers.size===0){pan=null;vw.classList.remove('panning');}};
vw.addEventListener('pointerup',endPtr);vw.addEventListener('pointercancel',endPtr);
vw.addEventListener('pointerleave',()=>{hoverPos=null;if(tool==='mask'||tool==='retouch'||tool==='portrait')drawOverlay();});
vw.addEventListener('dblclick',e=>{if(!cur||tool!=='edit'||UI.tat||e.target.closest('.empty'))return;const [mx,my]=rel(e);toggleZoom(mx,my);});
vw.addEventListener('wheel',e=>{if(!cur)return;e.preventDefault();const [mx,my]=rel(e);zoomAt(mx,my,view.s*Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0018)));},{passive:false});
new ResizeObserver(()=>{if(cur&&view.fit)fitView();if(cur)updateHist();drawCurve();}).observe(vw);

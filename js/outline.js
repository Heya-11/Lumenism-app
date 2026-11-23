"use strict";
/* ---- 테두리: draw a loop around something; the selection snaps to the nearest edges inside it ----
   outlineCut(rgba,w,h,poly,snap,ai) -> Uint8Array alpha (w*h, 0..255)
   poly: [[u,v],...] in 0..1 of the image; snap 0..100 = how far inside the line to look for an edge;
   ai: optional Uint8Array (w*h) object mask, used instead of edge snapping and clipped to the loop. */
function olRaster(poly,w,h){const m=new Uint8Array(w*h),n=poly.length,xs=[];
  for(let y=0;y<h;y++){const py=(y+.5)/h;xs.length=0;
    for(let i=0,j=n-1;i<n;j=i++){const yi=poly[i][1],yj=poly[j][1];if((yi>py)!==(yj>py)){const xi=poly[i][0],xj=poly[j][0];xs.push(((xj-xi)*(py-yi)/(yj-yi)+xi)*w);}}
    xs.sort((a,b)=>a-b);
    for(let k=0;k+1<xs.length;k+=2){const a=Math.max(0,Math.ceil(xs[k]-.5)),b=Math.min(w-1,Math.floor(xs[k+1]-.5));for(let x=a;x<=b;x++)m[y*w+x]=1;}}
  return m;}
/* chamfer distance (px) from each inside pixel to the drawn line; the picture border does not count as a line */
function olDist(m,w,h){const d=new Float32Array(w*h),B=1e9,S=Math.SQRT2;for(let i=0;i<w*h;i++)d[i]=m[i]?B:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=d[i];if(!v)continue;
    if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+S);if(x<w-1)v=Math.min(v,d[i-w+1]+S);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;let v=d[i];if(!v)continue;
    if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+S);if(x>0)v=Math.min(v,d[i+w-1]+S);}d[i]=v;}
  return d;}
/* edge strength 0..1 from a lightly smoothed copy */
function olGrad(rgba,w,h){const n=w*h,gr=new Float32Array(n),ch=[new Float32Array(n),new Float32Array(n),new Float32Array(n)],tmp=new Float32Array(n);
  for(let c=0;c<3;c++){const A=ch[c];for(let i=0;i<n;i++)tmp[i]=rgba[i*4+c];
    for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++){const l=x>0?x-1:x,r=x<w-1?x+1:x;A[o+x]=(tmp[o+l]+tmp[o+x]+tmp[o+r])/3;}}
    for(let y=0;y<h;y++){const u=(y>0?y-1:y)*w,o=y*w,d=(y<h-1?y+1:y)*w;for(let x=0;x<w;x++)tmp[o+x]=(A[u+x]+A[o+x]+A[d+x])/3;}
    A.set(tmp);}
  const [R0,G0,B0]=ch,k=1/(255*1.5);
  for(let y=0;y<h;y++){const u=(y>0?y-1:y)*w,o=y*w,d=(y<h-1?y+1:y)*w;
    for(let x=0;x<w;x++){const l=o+(x>0?x-1:x),r=o+(x<w-1?x+1:x);
      const gx=Math.abs(R0[r]-R0[l])+Math.abs(G0[r]-G0[l])+Math.abs(B0[r]-B0[l]),gy=Math.abs(R0[d+x]-R0[u+x])+Math.abs(G0[d+x]-G0[u+x])+Math.abs(B0[d+x]-B0[u+x]);
      const g=(gx>gy?gx:gy)*k;gr[o+x]=g>1?1:g;}}
  return gr;}
/* small binary heap keyed by float */
function olHeap(cap){let k=new Float64Array(cap),v=new Int32Array(cap),n=0;
  return{get size(){return n;},
    push(key,val){if(n===k.length){const k2=new Float64Array(n*2),v2=new Int32Array(n*2);k2.set(k);v2.set(v);k=k2;v=v2;}
      let i=n++;while(i>0){const p=(i-1)>>1;if(k[p]<=key)break;k[i]=k[p];v[i]=v[p];i=p;}k[i]=key;v[i]=val;},
    pop(){const top=v[0],tk=k[0];const lk=k[--n],lv=v[n];let i=0;
      for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&k[c+1]<k[c])c++;if(k[c]>=lk)break;k[i]=k[c];v[i]=v[c];i=c;}k[i]=lk;v[i]=lv;this.k=tk;return top;}};}
function olBlur(a,w,h,passes){let s=a,t=new Float32Array(w*h);
  for(let p=0;p<passes;p++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let acc=0,c=0;for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;acc+=s[yy*w+xx];c++;}}t[y*w+x]=acc/c;}
    const q=s===a?new Float32Array(w*h):s;s=t;t=q;}
  return s;}
function outlineCut(rgba,w,h,poly,snap,ai){const n=w*h;const P=olRaster(poly,w,h);let area=0;for(let i=0;i<n;i++)area+=P[i];
  const out=new Uint8Array(n);if(area<9)return out;
  if(ai){for(let i=0;i<n;i++)out[i]=P[i]?ai[i]:0;const soft=olBlur(Float32Array.from(out),w,h,1);for(let i=0;i<n;i++)out[i]=Math.round(soft[i]);return out;}
  if(!(snap>0)){const f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=P[i];const b=olBlur(f,w,h,1);for(let i=0;i<n;i++)out[i]=Math.round(b[i]*255);return out;}
  const D=olDist(P,w,h);let maxD=0;for(let i=0;i<n;i++)if(D[i]>maxD)maxD=D[i];
  const eqR=Math.sqrt(area/Math.PI);let core=Math.max(3,Math.min(snap/100*.95,.95)*maxD);void eqR;
  const G=olGrad(rgba,w,h);const LAM=110,BG=1.45,S=Math.SQRT2;
  const lab=new Uint8Array(n),dist=new Float64Array(n).fill(Infinity),band=new Uint8Array(n);const H=olHeap(4096);
  for(let i=0;i<n;i++)band[i]=P[i]&&D[i]<=core?1:0;
  const NX=[-1,1,0,0,-1,1,-1,1],NY=[0,0,-1,1,-1,-1,1,1],NL=[1,1,1,1,S,S,S,S];
  // seeds: pixels just beyond the band on either side
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(band[i])continue;let near=false;
    for(let k=0;k<8;k++){const xx=x+NX[k],yy=y+NY[k];if(xx<0||yy<0||xx>=w||yy>=h)continue;if(band[yy*w+xx]){near=true;break;}}
    if(!near)continue;lab[i]=P[i]?1:2;dist[i]=0;H.push(0,i);}
  // colour model: how much each pixel looks like the background just outside the line vs the inside core
  const NOT=new Uint8Array(n);for(let i=0;i<n;i++)NOT[i]=P[i]?0:1;const DO=olDist(NOT,w,h);const ring=Math.max(4,Math.min(w,h)*.012);
  const hb=new Float32Array(512),hf=new Float32Array(512),bin=new Uint16Array(n);let nb=0,nf=0;
  for(let i=0;i<n;i++){const k=i*4;bin[i]=(rgba[k]>>5)<<6|(rgba[k+1]>>5)<<3|(rgba[k+2]>>5);if(!P[i]&&DO[i]<=ring){hb[bin[i]]++;nb++;}else if(P[i]&&D[i]>core){hf[bin[i]]++;nf++;}}
  const pb=new Float32Array(512);for(let b=0;b<512;b++){const a=(hb[b]+.5)/(nb+256),c=(hf[b]+.5)/(nf+256);pb[b]=a/(a+c);}
  const KC=nb>20&&nf>20?5:0;
  while(H.size){const i=H.pop(),di=H.k;if(di>dist[i])continue;const x=i%w,y=(i/w)|0,L=lab[i],mul=L===2?BG:1,gi=G[i];
    for(let k=0;k<8;k++){const xx=x+NX[k],yy=y+NY[k];if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(!band[j])continue;
      const gj=G[j],r=pb[bin[j]],cm=1+KC*(L===2?1-r:r);const nd=di+NL[k]*mul*cm*(1+LAM*(gi>gj?gi:gj));if(nd<dist[j]){dist[j]=nd;lab[j]=L;H.push(nd,j);}}}
  const NB=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  const f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=P[i]&&(D[i]>core||lab[i]===1)?1:0;
  // drop specks: keep fg only if it touches the core via fg pixels (flood from core)
  const keep=new Uint8Array(n),st=[];for(let i=0;i<n;i++)if(P[i]&&D[i]>core){keep[i]=1;st.push(i);}
  if(!st.length){for(let i=0;i<n;i++)if(f[i]){keep[i]=1;}}else while(st.length){const i=st.pop(),x=i%w,y=(i/w)|0;
    for(const [dx,dy] of NB){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(!keep[j]&&f[j]){keep[j]=1;st.push(j);}}}
  for(let i=0;i<n;i++)f[i]=keep[i];
  // fill small holes inside the selection (flood background from outside)
  const outside=new Uint8Array(n);const q=[];for(let i=0;i<n;i++)if(!P[i]&&!f[i]){outside[i]=1;q.push(i);}
  while(q.length){const i=q.pop(),x=i%w,y=(i/w)|0;for(let k=0;k<4;k++){const [dx,dy]=NB[k];const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(!outside[j]&&!f[j]){outside[j]=1;q.push(j);}}}
  for(let i=0;i<n;i++)if(!f[i]&&!outside[i]&&P[i])f[i]=1;// pockets the outside never reached
  const b=olBlur(f,w,h,1);for(let i=0;i<n;i++)out[i]=Math.round(b[i]*255);return out;}
/* deepest point inside the loop (a good place to point the AI at) */
function olCenter(poly,w,h){const P=olRaster(poly,w,h),D=olDist(P,w,h);let bi=-1,bv=0;for(let i=0;i<w*h;i++)if(D[i]>bv){bv=D[i];bi=i;}
  if(bi<0){let x=0,y=0;poly.forEach(p=>{x+=p[0];y+=p[1];});return[x/poly.length,y/poly.length];}return[(bi%w+.5)/w,((bi/w|0)+.5)/h];}
function olArea(poly){let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j][0]+poly[i][0])*(poly[j][1]-poly[i][1]);return Math.abs(a/2);}
/* simplify a hand-drawn line (drop points closer than eps) */
function olThin(pts,eps){const o=[pts[0]];for(const p of pts){const l=o[o.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>=eps)o.push(p);}return o;}
/* AI object mask for a canvas, pointed at (u,v); returns Uint8Array at tw*th or null */
async function olAiMask(canvas,u,v,tw,th){const m=await getModel('subject');const r=m.segment(canvas,{keypoint:{x:u,y:v}});
  const ms=r.confidenceMasks||[];const mk=ms[ms.length>1?1:0];if(!mk){closeRes(r);return null;}const data=mk.getAsFloat32Array().slice(),w=mk.width,h=mk.height;closeRes(r);
  if(ms.length===1){let s=0;for(const q of data)s+=q;if(s/data.length>.6)for(let i=0;i<data.length;i++)data[i]=1-data[i];}
  return maskFromFloat(data,w,h,tw,th);}
function olRgba(canvas,max){const c=drawScaled(canvas,canvas.width,canvas.height,max);return{c,w:c.width,h:c.height,d:c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data};}

/* ---- mask component: type 'outline' {pts, snap, ai, aiAid} ---- */
async function outlineAI(c){if(!c||c.type!=='outline'||!c.pts||!c.ai||(c.aiAid&&STORE.aimaps.has(c.aiAid)))return;const ph=cur;if(!ph||!aiAvailable()){c.ai=false;syncUI();return;}
  const r=await aiRun(async()=>{busy(true,'AI가 테두리 안의 물체를 찾는 중…');await nextFrame();const [w,h]=mapSize(ph);const ctr=olCenter(c.pts,96,96);
    const m=await olAiMask(aiCanvas(ph,1024),ctr[0],ctr[1],w,h);busy(false);return m&&{m,w,h};});
  if(!r){c.ai=false;syncUI();requestRender();return;}c.aiAid=storeMap(r.m,r.w,r.h,'mask');syncUI();requestRender();}

/* ---- layer cut-out with a drawn outline ---- */
function screenToLayer(L,mx,my){const lr=R.last,rc=R.layerRect(L,lr.outW,lr.outH);if(!rc)return null;const o=screenToOut(mx,my);
  const dx=o[0]-L.x*lr.outW,dy=o[1]-L.y*lr.outH,t=L.rot*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return[(c*dx+s*dy)/rc.w+.5,(-s*dx+c*dy)/rc.h+.5];}
async function layerOutlineCut(L,screenPts){const src=STORE.images.get(L.img);if(!src)return;
  const poly=screenPts.map(p=>screenToLayer(L,p[0],p[1])).filter(Boolean);if(poly.length<6||olArea(poly)<.0004){toast('따낼 부분을 조금 더 크게 둘러 그려 주세요');return;}
  const O=UI.outline;busy(true,'테두리 안을 따내는 중…');await nextFrame();
  try{const s=olRgba(src,1024);let ai=null;
    if(O.ai&&aiAvailable()){const ctr=olCenter(poly,96,96);ai=await aiRun(async()=>olAiMask(s.c,ctr[0],ctr[1],s.w,s.h));if(!ai)toast('AI가 물체를 찾지 못해 경계 맞춤으로 따냈어요');}
    const a=outlineCut(s.d,s.w,s.h,poly,O.snap,ai);let sum=0;for(const v of a)sum+=v;if(sum<255*20){busy(false);toast('테두리 안에서 따낼 부분을 찾지 못했어요');return;}
    const f=new Float32Array(a.length);for(let i=0;i<a.length;i++)f[i]=a[i]/255;const full=maskFromFloat(f,s.w,s.h,src.width,src.height);
    const out=document.createElement('canvas');out.width=src.width;out.height=src.height;const x=out.getContext('2d');x.drawImage(src,0,0);
    const im=x.getImageData(0,0,out.width,out.height);for(let i=0;i<full.length;i++)im.data[i*4+3]=Math.min(im.data[i*4+3],full[i]);x.putImageData(im,0,0);
    if(!L.imgOrig)L.imgOrig=L.img;const id='file:'+uid('f');STORE.images.set(id,out);imageNames.set(id,(imageNames.get(L.imgOrig)||L.name)+' (테두리로 따냄)');L.img=id;
    R.layerTex.delete(L.id);if(RH)RH.layerTex.delete(L.id);busy(false);UI.layerCut=false;syncUI();updateModeUI();requestRender();commit('레이어 테두리로 따내기');}
  catch(e){console.error(e);busy(false);toast('따내기 실패: '+e.message);}}
function layerRestore(){const L=selLayer();if(!L||!L.imgOrig)return;L.img=L.imgOrig;R.layerTex.delete(L.id);if(RH)RH.layerTex.delete(L.id);syncUI();requestRender();commit('레이어 원래 이미지로');}

/* ---- cut the background photo itself: p.baseCut = {kind:'outline',pts,snap,ai,aiAid,ph} | {kind:'ai',aid,ph} ---- */
async function baseOutlineCut(screenPts){if(!cur)return;const ph=cur,asp=R.last.w/R.last.h;const pts=olThin(screenPts.map(p=>screenToSrc(p[0],p[1]).map(rnd4)),.002);
  if(pts.length<6||olArea(pts.map(p=>[p[0]*asp,p[1]]))<.0006){toast('남길 부분을 조금 더 크게 둘러 그려 주세요');return;}
  const c={kind:'outline',pts,snap:UI.outline.snap,ai:UI.outline.ai,ph:ph.uid};
  if(c.ai&&aiAvailable()){const r=await aiRun(async()=>{busy(true,'AI가 테두리 안의 물체를 찾는 중…');await nextFrame();const [w,h]=mapSize(ph);const ctr=olCenter(pts,96,96);
      const m=await olAiMask(aiCanvas(ph,1024),ctr[0],ctr[1],w,h);busy(false);return m&&{m,w,h};});
    if(r&&cur===ph)c.aiAid=storeMap(r.m,r.w,r.h,'mask');else{c.ai=false;toast('AI가 물체를 찾지 못해 경계 맞춤으로 따냈어요');}}
  if(cur!==ph)return;P().baseCut=c;UI.layerCut=false;syncUI();updateModeUI();requestRender();commit('배경 사진 테두리로 따내기');}
async function removeBaseBg(){const ph=cur;if(!ph)return;
  const r=await aiRun(async()=>{busy(true,'AI가 배경을 지우는 중…');await nextFrame();const c=aiCanvas(ph,1024);
    let m=await getModel('selfie');let res=m.segment(c);let ms=res.confidenceMasks||[];let mk=ms[ms.length-1];let data=mk.getAsFloat32Array().slice(),w=mk.width,h=mk.height;closeRes(res);
    let s=0;for(const v of data)s+=v;if(s/data.length<.03){m=await getModel('subject');res=m.segment(c,{keypoint:{x:.5,y:.5}});ms=res.confidenceMasks||[];mk=ms[ms.length>1?1:0];data=mk.getAsFloat32Array().slice();w=mk.width;h=mk.height;closeRes(res);}
    busy(false);return{data,w,h};});if(!r||cur!==ph)return;
  const [w,h]=mapSize(ph);const aid=storeMap(maskFromFloat(r.data,r.w,r.h,w,h),w,h,'mask');P().baseCut={kind:'ai',aid,ph:ph.uid};syncUI();requestRender();commit('배경 사진 배경 제거');}
function baseRestore(){if(!cur||!P().baseCut)return;P().baseCut=null;syncUI();requestRender();commit('배경 사진 원래대로');}

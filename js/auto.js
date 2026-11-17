"use strict";
/* ================= 추천 (자동): rule-based photo analysis ================= */
function wbSolve(cr,cg,cb){const a11=.35*cr,a12=.08*cr+.25*cg,b1=cg-cr,a21=-.35*cb,a22=.08*cb+.25*cg,b2=cg-cb,det=a11*a22-a12*a21;
  if(Math.abs(det)<1e-9)return{t:0,n:0};return{t:(b1*a22-a12*b2)/det,n:(a11*b2-b1*a21)/det};}
function analyzePhoto(){const d=R.fieldSrc,fw=R.fw,fh=R.fh,N=fw*fh;const L=new Float32Array(N),S=new Float32Array(N),hist=new Uint32Array(256);
  let satSum=0,skin=0,sky=0,top=0,hiC=0,loC=0,mR=0,mG=0,mB=0,cSum=0,cN=0,eSum=0,eN=0;
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){const i=y*fw+x,k=i*4,r=d[k]/255,g=d[k+1]/255,b=d[k+2]/255;
    const l=.2126*r+.7152*g+.0722*b;L[i]=l;hist[Math.min(255,(l*255)|0)]++;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),s=mx>0?(mx-mn)/mx:0;S[i]=s;satSum+=s;
    let h=0;if(mx-mn>1e-4){h=mx===r?((g-b)/(mx-mn))%6:mx===g?(b-r)/(mx-mn)+2:(r-g)/(mx-mn)+4;h*=60;if(h<0)h+=360;}
    if(mx>=.98)hiC++;if(mx<=.025)loC++;mR+=r;mG+=g;mB+=b;
    const dx=x/fw-.5,dy=y/fh-.5,cd=Math.hypot(dx,dy);
    if(h<=50&&s>.18&&s<.68&&mx>.25&&mx<.97&&r>g&&g>b)skin+=1+Math.max(0,1-cd/.5);
    if(y<fh*.35){top++;if(h>185&&h<250&&s>.12&&mx>.35)sky++;}
    if(Math.abs(dx)<.2&&Math.abs(dy)<.2){cSum+=l;cN++;}else if(cd>.4){eSum+=l;eN++;}}
  const pct=q=>{let c=0;for(let i=0;i<256;i++){c+=hist[i];if(c>=N*q)return(i+.5)/255;}return 1;};
  let mean=0,m2=0;for(let i=0;i<N;i++){mean+=L[i];m2+=L[i]*L[i];}mean/=N;const std=Math.sqrt(Math.max(0,m2/N-mean*mean));
  const p55=pct(.55),p98=pct(.98);let wr=0,wg=0,wb=0,wn=0;
  for(let i=0;i<N;i++){if(L[i]>=p55&&L[i]<=p98&&S[i]<.3){const k=i*4;wr+=Math.pow(d[k]/255,2.2);wg+=Math.pow(d[k+1]/255,2.2);wb+=Math.pow(d[k+2]/255,2.2);wn++;}}
  let wbv;if(wn>N*.02)wbv=wbSolve(wr/wn,wg/wn,wb/wn);else{const g=wbSolve(Math.pow(mR/N,2.2),Math.pow(mG/N,2.2),Math.pow(mB/N,2.2));wbv={t:g.t*.5,n:g.n*.5};}
  let nz=0,nn=0;for(let y=2;y<fh-2;y+=3)for(let x=2;x<fw-2;x+=3){const i=y*fw+x;const gx=Math.abs(L[i+1]-L[i-1]),gy=Math.abs(L[i+fw]-L[i-fw]);
    const m=(L[i-1]+L[i+1]+L[i-fw]+L[i+fw]+L[i-fw-1]+L[i-fw+1]+L[i+fw-1]+L[i+fw+1])/8;if(gx+gy<.04){nz+=Math.abs(L[i]-m);nn++;}}
  const noise=nn?nz/nn*255:0;const iso=cur.exif&&cur.exif.iso||0;
  const satMean=satSum/N,p1=pct(.01),p99=pct(.99);
  return{p005:pct(.005),p1,p10:pct(.1),p50:pct(.5),p99,p995:pct(.995),mean,std,sat:satMean,skin:skin/N,sky:top?sky/top:0,
    hiClip:hiC/N,loClip:loC/N,wb:wbv,noise,iso,warm:mR/Math.max(mB,1e-6),
    haze:Math.max(0,Math.min(1,(.62-(p99-p1))*2.5))*(satMean<.28?1:.4),backlit:eN&&cN?(eSum/eN-cSum/cN)>.12:false,night:pct(.5)<.16};}
function recBase(a){const r={};const scene=a.aiScene||(a.aiScene===undefined&&a.skin>.07?'portrait':a.sky>.22?'landscape':a.night?'night':'general');
  let target=scene==='night'?.28:.46;if(a.p50>.55&&a.std<.2)target=a.p50;
  let ev=clamp(2.2*Math.log2(target/Math.max(a.p50,.01))*.75,-2,2.5);if(scene==='night')ev=clamp(ev,-1,1);
  if(a.faceL!==undefined){const fe=clamp(2.2*Math.log2(.55/Math.max(a.faceL,.02))*.7,-2,2.5);ev=ev*.4+fe*.6;}
  const k=Math.pow(2,ev/2.2),q99=a.p99*k,q995=a.p995*k,q10=a.p10*k,q005=a.p005*k;
  r.exposure=Math.round(ev*20)/20;
  r.highlights=q99>.9?-Math.round(clamp((q99-.82)*260+a.hiClip*400,0,85)):0;
  r.shadows=q10<.15?Math.round(clamp((.18-q10)*320+(a.backlit?20:0),0,65)):(a.backlit?15:0);
  r.whites=q995<.93?Math.round(clamp((.97-q995)*150,0,45)):(q995>1.05?-Math.round(clamp((q995-1)*60,0,30)):0);
  r.blacks=q005>.03?-Math.round(clamp((q005-.015)*250,0,45)):0;
  r.contrast=a.std<.2?Math.round(clamp((.24-a.std)*180,0,30)):(a.std>.32?-Math.round(clamp((a.std-.3)*100,0,20)):0);
  let wbK=.6;if(a.warm>1.45&&a.sat>.3)wbK=.25;if(scene==='night')wbK=.3;
  if(scene==='indoor')wbK=.8;
  r.temp=Math.round(clamp(a.wb.t*100*wbK,-40,40));r.tint=Math.round(clamp(a.wb.n*100*wbK,-30,30));
  if(a.faceRGB){const [fr,,fb]=a.faceRGB;r.temp=Math.round(clamp(r.temp+clamp((fb/Math.max(fr,.01)-.7)*120,-15,15),-40,40));}
  r.vibrance=Math.round(clamp((.38-a.sat)*90,0,35));r.saturation=a.sat<.2?5:0;
  r.dehaze=Math.round(clamp(a.haze*35,0,30));
  r.texture=scene==='portrait'?-10:scene==='landscape'?10:5;r.clarity=scene==='portrait'?-8:scene==='landscape'?12:6;
  r.sharpen=scene==='portrait'?20:35;r.sharpMask=scene==='portrait'?45:15;
  const ns=Math.max(clamp(a.noise/5,0,1),a.iso?clamp(Math.log2(a.iso/200)/4,0,1):0);r.lnr=Math.round(ns*45);r.cnr=Math.round(15+ns*35);
  const H=Array(8).fill(0),Sx=Array(8).fill(0),Lx=Array(8).fill(0);
  if(scene==='portrait'){Lx[1]=8;Sx[1]=-6;Sx[0]=-4;}
  if(scene==='landscape'){Lx[5]=-12;Sx[5]=10;Sx[4]=8;Sx[3]=6;}
  if(scene==='food'){r.vibrance=Math.min(60,r.vibrance+15);r.saturation+=5;r.temp=clamp(r.temp+5,-40,40);r.clarity=8;r.texture=10;}
  r.hslH=H;r.hslS=Sx;r.hslL=Lx;return{r,scene};}
function recVariants(a){const {r,scene}=recBase(a);
  const viv=Object.assign(clone(r),{contrast:r.contrast+12,clarity:r.clarity+12,texture:r.texture+10,vibrance:Math.min(60,r.vibrance+18),saturation:r.saturation+4,dehaze:r.dehaze+6,sharpen:r.sharpen+15});
  const mood=Object.assign(clone(r),{exposure:Math.round((r.exposure-.15)*20)/20,contrast:r.contrast+10,highlights:Math.max(-100,r.highlights-15),blacks:Math.max(-100,r.blacks-12),
    vibrance:r.vibrance-12,saturation:-10,clarity:r.clarity+6,gsH:205,gsS:18,ghH:40,ghS:14,gBal:-10,vig:-18,curves:{rgb:[[0,.05],[.5,.49],[1,.97]],r:ID(),g:ID(),b:ID()}});
  return{scene,list:[{n:'자연스럽게',p:r},{n:'선명하게',p:viv},{n:'분위기 있게',p:mood}]};}
const REC_RANGE={exposure:[-5,5],sharpen:[0,150],lnr:[0,100],cnr:[0,100],sharpMask:[0,100],gsS:[0,100],ghS:[0,100],gmS:[0,100],gsH:null,ghH:null,gmH:null};
function blendVal(a,b,t,key){
  if(key==='curves'){const o={};for(const ch in b){const A=a[ch],B=b[ch];o[ch]=(A.length===B.length)?A.map((p,i)=>[clamp(p[0]+(B[i][0]-p[0])*clamp(t,0,1),0,1),clamp(p[1]+(B[i][1]-p[1])*t,0,1)]):(t>0?clone(B):clone(A));}return o;}
  if(typeof a==='number'&&typeof b==='number'){if(REC_RANGE[key]===null)return t>0?b:a;const [lo,hi]=REC_RANGE[key]||[-100,100];const v=clamp(a+(b-a)*t,lo,hi);return key==='exposure'?Math.round(v*100)/100:Math.round(v);}
  if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return a.map((x,i)=>blendVal(x,b[i],t,key));
  return t>0?clone(b):clone(a);}
/* ---- state & UI ---- */
let recCache=null,thumbR=null;
function recThumb(params){if(!thumbR){thumbR=new Renderer(document.createElement('canvas'));}
  if(thumbR.uid!==cur.uid){thumbR.setSource(drawScaled(cur.prev,cur.prev.width,cur.prev.height,320),256);thumbR.uid=cur.uid;}
  thumbR.invalidate();thumbR.render(params,{});return thumbR.canvas.toDataURL('image/jpeg',.82);}
function recActive(){return !!(cur&&cur.rec&&cur.rec.hi===cur.hi);}
function recCompute(){if(!cur)return null;if(recCache&&recCache.uid===cur.uid)return recCache;
  let a=analyzePhoto();if(UI.recAI&&cur._aiInfo)a=applyAIInfo(a,cur._aiInfo);const v=recVariants(a);const keys=new Set();v.list.forEach(x=>Object.keys(x.p).forEach(k=>keys.add(k)));
  const SC={portrait:'인물',landscape:'풍경',night:'야경·저조도',general:'일반',food:'음식',indoor:'실내'};const r=v.list[0].p;const tips=[];
  if(Math.abs(r.exposure)>=.1)tips.push(`노출 ${r.exposure>0?'+':''}${r.exposure.toFixed(2)}EV`);if(r.highlights<=-20)tips.push('밝은 영역 복구');if(r.shadows>=15)tips.push('어두운 영역 살림');
  if(Math.abs(r.temp)>=6||Math.abs(r.tint)>=6)tips.push('화이트 밸런스 보정');if(r.dehaze>=8)tips.push('디헤이즈');if(r.lnr>=12)tips.push('노이즈 감소');
  recCache={uid:cur.uid,keys:[...keys],list:v.list,summary:`장면: ${SC[v.scene]}${a.aiScene!==undefined?' (AI)':''}`+(tips.length?' · '+tips.join(' · '):''),thumbs:null};return recCache;}
function recTarget(orig,i){const c=recCompute();const o={};c.keys.forEach(k=>o[k]=clone(orig[k]));Object.assign(o,clone(c.list[i].p));return o;}
function recApply(i){if(!cur)return;const c=recCompute();const orig=recActive()?cur.rec.orig:(()=>{const o={};c.keys.forEach(k=>o[k]=clone(cur.params[k]));return o;})();
  const tgt=recTarget(orig,i);Object.assign(cur.params,clone(tgt));R.invalidate();if(RH)RH.invalidate();
  commit(`추천: ${c.list[i].n}`);cur.rec={hi:cur.hi,orig,tgt,idx:i,t:100};syncUI();requestRender();}
function recStrength(t,done){if(!recActive())return;const rc=cur.rec;rc.t=t;const tt=t/100;
  for(const k of Object.keys(rc.tgt))cur.params[k]=blendVal(rc.orig[k],rc.tgt[k],tt,k);syncUI();requestRender();
  if(done){cur.history[cur.hi]={label:`추천: ${recCompute().list[rc.idx].n} (${t}%)`,state:clone(cur.params)};renderHistory();}}
let recOpen=false;
function buildRecUI(list){const item=el('div','li rec','<span class="nm">✨ 추천 (자동)</span><span class="tag">사진 분석</span>');list.appendChild(item);
  const box=el('div','recbox');box.style.display='none';list.appendChild(box);
  const sum=el('div','hint');sum.style.margin='0 0 6px';box.appendChild(sum);
  const grid=el('div','recgrid');box.appendChild(grid);
  const cards=[0,1,2].map(i=>{const c=el('div','reccard','<div class="ph"></div><span></span>');c.onclick=()=>recApply(i);grid.appendChild(c);return c;});
  const sw=el('div');sw.style.marginTop='8px';box.appendChild(sw);
  const row=el('div','sl');row.innerHTML='<label>강도</label><input type="range" min="0" max="150" step="1"><input class="val" readonly>';sw.appendChild(row);
  const [,rng,val]=row.children;rng.oninput=()=>{val.value=rng.value+'%';recStrength(+rng.value,false);};rng.onchange=()=>recStrength(+rng.value,true);
  row.children[0].ondblclick=()=>{rng.value=100;val.value='100%';recStrength(100,true);};
  const hint=el('div','hint','추천안을 누르면 적용돼요. 다른 보정을 하면 강도 조절은 닫혀요.');box.appendChild(hint);
  item.onclick=()=>{if(!cur)return;recOpen=!recOpen;refresh(true);};
  async function refresh(force){box.style.display=recOpen&&cur?'':'none';item.classList.toggle('on',recOpen&&!!cur);if(!recOpen||!cur)return;
    const c=recCompute();sum.textContent=c.summary;
    const act=recActive();cards.forEach((cd,i)=>{cd.classList.toggle('on',act&&cur.rec.idx===i);cd.lastChild.textContent=c.list[i].n;});
    sw.style.display=act?'':'none';if(act){rng.value=cur.rec.t;val.value=cur.rec.t+'%';}
    if(!c.thumbs){c.thumbs='pending';const base=clone(cur.params);const orig={};c.keys.forEach(k=>orig[k]=base[k]);
      cards.forEach(cd=>cd.firstChild.innerHTML='<div class="spin"></div>');await nextFrame();
      try{const th=c.list.map((_,i)=>recThumb(Object.assign(clone(base),recTarget(orig,i))));if(recCache===c){c.thumbs=th;}}catch(e){console.error(e);c.thumbs=null;}}
    if(Array.isArray(c.thumbs)&&recCache===c)cards.forEach((cd,i)=>{if(!cd.firstChild.querySelector('img'))cd.firstChild.innerHTML=`<img src="${c.thumbs[i]}" alt="">`;});}
  dynHooks.push(()=>refresh(false));}
function recOnSelect(){recCache=null;}

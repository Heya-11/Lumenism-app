"use strict";
/* ================= Sky library (procedural skies + user images) ================= */
const SKIES=[['clear','맑은 하늘'],['cumulus','뭉게구름'],['sunset','노을'],['golden','골든아워'],['bluehour','블루아워'],['dramatic','극적인 구름'],['night','별밤']];
const SKY_CACHE=new Map();
function skyImage(key){if(!key)return null;if(key.startsWith('file:'))return STORE.images.get(key)||null;if(!SKY_CACHE.has(key))SKY_CACHE.set(key,genSky(key));return SKY_CACHE.get(key);}
function skyAvg(d){let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=64){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}return[r/n/255,g/n/255,b/n/255];}
function valueNoise(W,H,seed){let s=seed>>>0||1;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%100000)/100000;};
  const G=(gw,gh)=>{const a=new Float32Array((gw+1)*(gh+1));for(let i=0;i<a.length;i++)a[i]=rnd();return a;};
  const out=new Float32Array(W*H);let amp=1,tot=0;
  for(let o=0;o<6;o++){const gw=Math.max(2,Math.round(3*2**o*W/H)),gh=Math.max(2,3*2**o);const g=G(gw,gh);
    for(let y=0;y<H;y++){const fy=y/H*gh,y0=Math.floor(fy),ty=fy-y0,sy=ty*ty*(3-2*ty);
      for(let x=0;x<W;x++){const fx=x/W*gw,x0=Math.floor(fx),tx=fx-x0,sx=tx*tx*(3-2*tx);const i=y0*(gw+1)+x0;
        const v=(g[i]*(1-sx)+g[i+1]*sx)*(1-sy)+(g[i+gw+1]*(1-sx)+g[i+gw+2]*sx)*sy;out[y*W+x]+=v*amp;}}tot+=amp;amp*=.5;}
  for(let i=0;i<out.length;i++)out[i]/=tot;return out;}
function genSky(kind){const W=1600,H=1000,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const grad=stops=>{const g=x.createLinearGradient(0,0,0,H);stops.forEach(([p,col])=>g.addColorStop(p,col));x.fillStyle=g;x.fillRect(0,0,W,H);};
  const P={clear:[[0,'#1f5fb8'],[.6,'#5d9be0'],[1,'#cfe4f7']],cumulus:[[0,'#2a67bd'],[.65,'#6aa6e4'],[1,'#d7e8f7']],
    sunset:[[0,'#24305e'],[.38,'#6a4c86'],[.66,'#d9667a'],[.86,'#ff9a5c'],[1,'#ffd08a']],golden:[[0,'#4f78b8'],[.5,'#c7a98f'],[.8,'#f3b06a'],[1,'#ffe1a6']],
    bluehour:[[0,'#0b1a45'],[.55,'#2f4f8f'],[.85,'#7d86b8'],[1,'#d7a9a8']],dramatic:[[0,'#2b3340'],[.55,'#5b6676'],[1,'#b9c0c8']],night:[[0,'#02040c'],[.7,'#0b1636'],[1,'#22325c']]}[kind]||[[0,'#2a67bd'],[1,'#cfe4f7']];
  grad(P);
  const nw=400,nh=250,N=valueNoise(nw,nh,{clear:7,cumulus:11,sunset:23,golden:31,bluehour:5,dramatic:41,night:3}[kind]||9);
  const cl=document.createElement('canvas');cl.width=nw;cl.height=nh;const cx=cl.getContext('2d');const im=cx.createImageData(nw,nh);
  const cfg={clear:{th:.62,a:.35,col:[255,255,255],sh:0},cumulus:{th:.5,a:.95,col:[255,255,255],sh:.35},sunset:{th:.55,a:.75,col:[255,150,120],sh:.45,dark:[90,60,110]},
    golden:{th:.56,a:.7,col:[255,225,180],sh:.3},bluehour:{th:.6,a:.45,col:[150,150,200],sh:.3},dramatic:{th:.38,a:.95,col:[225,228,232],sh:.75,dark:[45,50,60]},night:{th:.75,a:.15,col:[120,130,170],sh:0}}[kind]||{th:.55,a:.8,col:[255,255,255],sh:.3};
  for(let y=0;y<nh;y++){const hz=y/nh;const flat=1+hz*1.5;for(let xx=0;xx<nw;xx++){const v=N[y*nw+xx];const yy=Math.min(nh-1,Math.floor(y*1+3));
      const a=Math.max(0,Math.min(1,(v-cfg.th)/.12))*cfg.a*(1-Math.pow(hz,3)*.6);const sh=Math.max(0,Math.min(1,(N[Math.min(nh-1,y+4)*nw+xx]-v)*6+.5))*cfg.sh;
      const dk=cfg.dark||[cfg.col[0]*.55,cfg.col[1]*.58,cfg.col[2]*.65];const k=(y*nw+xx)*4;
      for(let ch=0;ch<3;ch++)im.data[k+ch]=cfg.col[ch]*(1-sh)+dk[ch]*sh;im.data[k+3]=a*255/flat**.2;}}
  cx.putImageData(im,0,0);x.imageSmoothingQuality='high';x.drawImage(cl,0,0,W,H);
  if(kind==='sunset'||kind==='golden'){const g=x.createRadialGradient(W*.62,H*.97,0,W*.62,H*.97,H*.7);g.addColorStop(0,'rgba(255,240,200,.95)');g.addColorStop(.15,'rgba(255,200,140,.5)');g.addColorStop(1,'rgba(255,160,100,0)');x.fillStyle=g;x.fillRect(0,0,W,H);}
  if(kind==='night'){let s=99;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};for(let i=0;i<900;i++){const r=rnd()**3*1.6+.3;x.fillStyle=`rgba(255,255,${220+rnd()*35|0},${.35+rnd()*.65})`;x.beginPath();x.arc(rnd()*W,rnd()*H*.85,r,0,6.2832);x.fill();}}
  return c;}
function skyThumb(key){const c=skyImage(key);if(!c)return '';if(!c._thumb){const t=drawScaled(c,c.width,c.height,120);c._thumb=t.toDataURL('image/jpeg',.8);}return c._thumb;}

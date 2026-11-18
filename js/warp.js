"use strict";
/* Face-mesh landmark groups (MediaPipe 468/478 topology) */
const LM={
  oval:[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
  jaw:[132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361],
  cheek:[234,93,132,454,323,361],
  leye:[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  reye:[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466],
  lbrow:[70,63,105,66,107,55,65,52,53,46],rbrow:[300,293,334,296,336,285,295,282,283,276],
  lipsOuter:[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],
  lipsInner:[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191],
  liris:[468,469,470,471,472],riris:[473,474,475,476,477]};
/* displacement field (inverse warp) for face reshape + liquify. Returns {w,h,data} in uv units or null */
function buildDisp(p,faces,aspect){const po=p.portrait||{},L=p.liquify||[];
  const faceOn=faces&&faces.length&&(po.slim||po.width||po.eye||po.nose||po.smile);
  if(!faceOn&&!L.length)return null;
  const long=512,Wd=aspect>=1?long:Math.max(8,Math.round(long*aspect)),Hd=aspect>=1?Math.max(8,Math.round(long/aspect)):long;
  const D=new Float32Array(Wd*Hd*4);
  const each=(cx,cy,r,fn)=>{if(r<1)return;const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(Wd-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(Hd-1,Math.ceil(cy+r)),r2=r*r;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=x-cx,dy=y-cy,d2=dx*dx+dy*dy;if(d2>=r2)continue;let w=1-d2/r2;w*=w;fn((y*Wd+x)*4,w,dx,dy);}};
  const push=(cx,cy,r,vx,vy)=>each(cx,cy,r,(i,w)=>{D[i]-=vx*w;D[i+1]-=vy*w;});
  const scale=(cx,cy,r,s)=>each(cx,cy,r,(i,w,dx,dy)=>{D[i]-=dx*s*w;D[i+1]-=dy*s*w;});
  const restore=(cx,cy,r,s)=>each(cx,cy,r,(i,w)=>{const k=Math.max(0,1-w*s);D[i]*=k;D[i+1]*=k;});
  if(faceOn)faces.forEach((f,fi)=>{if(f.profile)return;const wf=((po.fw||[])[fi]??100)/100;if(wf<=0)return;const pf={slim:po.slim*wf,width:po.width*wf,eye:po.eye*wf,nose:po.nose*wf,smile:po.smile*wf};const P=k=>f.lm[k]?[f.lm[k][0]*Wd,f.lm[k][1]*Hd]:null;const avg=a=>{const v=a.map(P).filter(Boolean);return[v.reduce((s,q)=>s+q[0],0)/v.length,v.reduce((s,q)=>s+q[1],0)/v.length];};
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);const l=P(234),r=P(454),nose=P(1);if(!l||!r||!nose)return;const fw=dist(l,r);
    if(pf.slim){const s=pf.slim/100;LM.jaw.forEach(k=>{const q=P(k);push(q[0],q[1],fw*.17,(nose[0]-q[0])*.13*s,-fw*.012*s);});}
    if(pf.width){const s=pf.width/100;LM.cheek.forEach(k=>{const q=P(k);push(q[0],q[1],fw*.22,(nose[0]-q[0])*.09*s,0);});}
    if(pf.eye){const s=pf.eye/100*.3;[[LM.leye,33,133],[LM.reye,263,362]].forEach(([E,a,b])=>{const c=avg(E);const ew=dist(P(a),P(b));scale(c[0],c[1],ew*1.25,s);});}
    if(pf.nose){const a=P(129),b=P(358);if(a&&b){const c=[(a[0]+b[0])/2,(a[1]+b[1])/2];scale(c[0],c[1],dist(a,b)*.95,-pf.nose/100*.28);}}
    if(pf.smile){const a=P(61),b=P(291);if(a&&b){const mw=dist(a,b),s=pf.smile/100;push(a[0],a[1],mw*.38,-mw*.03*s,-mw*.07*s);push(b[0],b[1],mw*.38,mw*.03*s,-mw*.07*s);}}});
  for(const st of L){const r=st.r*Hd,s=st.s;const pts=st.p.map(([u,v])=>[u*Wd,v*Hd]);if(!pts.length)continue;
    if(st.m==='push'){for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/Math.max(1,r*.15)));
      for(let k=1;k<=n;k++){const c=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n];push(c[0],c[1],r,(b[0]-a[0])/n*s*.8,(b[1]-a[1])/n*s*.8);}}continue;}
    const step=Math.max(1,r*.3);let prev=null;
    const apply=c=>{if(st.m==='bloat')scale(c[0],c[1],r,s*.035);else if(st.m==='pucker')scale(c[0],c[1],r,-s*.035);else restore(c[0],c[1],r,s*.25);};
    for(const q of pts){if(!prev){apply(q);prev=q;continue;}const d=Math.hypot(q[0]-prev[0],q[1]-prev[1]);if(d<step){apply(prev);continue;}
      const n=Math.floor(d/step);for(let k=1;k<=n;k++){const c=[prev[0]+(q[0]-prev[0])*k/n,prev[1]+(q[1]-prev[1])*k/n];apply(c);}prev=q;}}
  for(let i=0;i<D.length;i+=4){D[i]/=Wd;D[i+1]/=Hd;}
  return{w:Wd,h:Hd,data:D};}

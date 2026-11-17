"use strict";
/* exemplar-based inpainting (onion-peel order, coherence + random search) */
function inpaintRGBA(img,W,H,hole){const N=W*H,R=new Float32Array(N*3);
  for(let i=0;i<N;i++){R[i*3]=img[i*4];R[i*3+1]=img[i*4+1];R[i*3+2]=img[i*4+2];}
  const known=new Uint8Array(N);for(let i=0;i<N;i++)known[i]=hole[i]?0:1;
  const P=2;const I=new Int32Array((W+1)*(H+1));
  for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){row+=hole[y*W+x]?1:0;I[(y+1)*(W+1)+x+1]=I[y*(W+1)+x+1]+row;}}
  const valid=new Uint8Array(N);const srcList=[];
  for(let y=P;y<H-P;y++)for(let x=P;x<W-P;x++){const s=I[(y+P+1)*(W+1)+x+P+1]-I[(y-P)*(W+1)+x+P+1]-I[(y+P+1)*(W+1)+x-P]+I[(y-P)*(W+1)+x-P];
    if(s===0){valid[y*W+x]=1;srcList.push(y*W+x);}}
  if(srcList.length<16)throw new Error('채울 영역 주변에 참고할 부분이 부족해요');
  const dist=new Int32Array(N).fill(-1);let q=[];for(let i=0;i<N;i++)if(known[i]){dist[i]=0;}
  for(let i=0;i<N;i++)if(!known[i]){const x=i%W,y=(i/W)|0;if((x>0&&known[i-1])||(x<W-1&&known[i+1])||(y>0&&known[i-W])||(y<H-1&&known[i+W])){dist[i]=1;q.push(i);}}
  const order=[];while(q.length){const nq=[];for(const i of q){order.push(i);const x=i%W,y=(i/W)|0;
      for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1])if(j>=0&&dist[j]<0){dist[j]=dist[i]+1;nq.push(j);}}q=nq;}
  const srcOf=new Int32Array(N).fill(-1);
  const energy=(p,c,useAll)=>{const px=p%W,py=(p/W)|0,cx=c%W,cy=(c/W)|0;let e=0,n=0;
    for(let dy=-P;dy<=P;dy++){const yy=py+dy;if(yy<0||yy>=H)continue;for(let dx=-P;dx<=P;dx++){const xx=px+dx;if(xx<0||xx>=W)continue;
      if(dx===0&&dy===0)continue;const a=yy*W+xx;if(!useAll&&!known[a])continue;const b=(cy+dy)*W+cx+dx;
      const d0=R[a*3]-R[b*3],d1=R[a*3+1]-R[b*3+1],d2=R[a*3+2]-R[b*3+2];e+=d0*d0+d1*d1+d2*d2;n++;}}
    return n?e/n:1e12;};
  const search=(p,useAll)=>{let best=-1,bE=Infinity;const px=p%W,py=(p/W)|0;
    const tryC=c=>{if(c<0||c>=N||!valid[c])return;const e=energy(p,c,useAll);if(e<bE){bE=e;best=c;}};
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=px+dx,yy=py+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const n=yy*W+xx;
      if(srcOf[n]>=0){const sx=(srcOf[n]%W)-dx,sy=((srcOf[n]/W)|0)-dy;if(sx>=0&&sy>=0&&sx<W&&sy<H)tryC(sy*W+sx);}}
    for(let k=0;k<36;k++)tryC(srcList[(Math.random()*srcList.length)|0]);
    if(best>=0){let r=Math.max(W,H)/4;const bx=best%W,by=(best/W)|0;
      while(r>=1){for(let k=0;k<3;k++){const xx=Math.round(bx+(Math.random()*2-1)*r),yy=Math.round(by+(Math.random()*2-1)*r);if(xx>=0&&yy>=0&&xx<W&&yy<H)tryC(yy*W+xx);}r/=2;}}
    return best;};
  for(const p of order){const c=search(p,false);if(c<0)continue;R[p*3]=R[c*3];R[p*3+1]=R[c*3+1];R[p*3+2]=R[c*3+2];known[p]=1;srcOf[p]=c;}
  for(let it=0;it<2;it++)for(const p of order){const c=search(p,true);if(c<0)continue;srcOf[p]=c;R[p*3]=R[c*3];R[p*3+1]=R[c*3+1];R[p*3+2]=R[c*3+2];}
  // membrane (Laplace) correction so the fill matches surrounding gradients
  const D=new Float32Array(N*3),D2=new Float32Array(N*3);const holeIdx=order;
  const mism=(p,k,ch)=>{const s=srcOf[p];if(s<0)return 0;const t=s+(k-p);if(t<0||t>=N)return 0;return R0(k,ch)-R[t*3+ch];};
  const R0=(k,ch)=>img[k*4+ch];
  for(let it=0;it<300;it++){for(const p of holeIdx){const x=p%W,y=(p/W)|0;for(let ch=0;ch<3;ch++){let s=0,n=0;
      for(const k of [x>0?p-1:-1,x<W-1?p+1:-1,y>0?p-W:-1,y<H-1?p+W:-1]){if(k<0)continue;s+=hole[k]?D[k*3+ch]:mism(p,k,ch);n++;}
      D2[p*3+ch]=n?s/n:0;}}
    for(const p of holeIdx){D[p*3]=D2[p*3];D[p*3+1]=D2[p*3+1];D[p*3+2]=D2[p*3+2];}}
  for(let i=0;i<N;i++)if(hole[i]){img[i*4]=R[i*3]+D[i*3];img[i*4+1]=R[i*3+1]+D[i*3+1];img[i*4+2]=R[i*3+2]+D[i*3+2];}
  return img;}
/* strokes: [{r (frac of h), p:[[u,v]...]}] on source canvas src -> {canvas, bb} */
function contentFill(src,strokes){const w=src.width,h=src.height;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const s of strokes){const r=s.r*h;for(const [u,v] of s.p){x0=Math.min(x0,u*w-r);y0=Math.min(y0,v*h-r);x1=Math.max(x1,u*w+r);y1=Math.max(y1,v*h+r);}}
  const bw=x1-x0,bh=y1-y0;const m=Math.max(24,Math.max(bw,bh)*.8);
  const rx=Math.max(0,Math.floor(x0-m)),ry=Math.max(0,Math.floor(y0-m)),rw=Math.min(w,Math.ceil(x1+m))-rx,rh=Math.min(h,Math.ceil(y1+m))-ry;
  if(rw<8||rh<8)throw new Error('영역이 너무 작아요');
  const holeArea=Math.max(1,bw*bh*.6);const sc=Math.min(1,Math.sqrt(26000/holeArea),700/Math.max(rw,rh));
  const W=Math.max(8,Math.round(rw*sc)),H=Math.max(8,Math.round(rh*sc));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';x.drawImage(src,rx,ry,rw,rh,0,0,W,H);const im=x.getImageData(0,0,W,H);
  const mc=document.createElement('canvas');mc.width=W;mc.height=H;const mx=mc.getContext('2d',{willReadFrequently:true});
  mx.strokeStyle='#fff';mx.fillStyle='#fff';mx.lineCap='round';mx.lineJoin='round';
  for(const s of strokes){const r=s.r*h*sc;mx.lineWidth=r*2;const pts=s.p.map(([u,v])=>[(u*w-rx)*sc,(v*h-ry)*sc]);
    mx.beginPath();mx.arc(pts[0][0],pts[0][1],r,0,6.283);mx.fill();mx.beginPath();pts.forEach((p,i)=>i?mx.lineTo(p[0],p[1]):mx.moveTo(p[0],p[1]));mx.stroke();}
  const md=mx.getImageData(0,0,W,H).data;const N=W*H;let hole=new Uint8Array(N);for(let i=0;i<N;i++)hole[i]=md[i*4+3]>20?1:0;
  const dil=(a)=>{const o=new Uint8Array(N);for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const i=y*W+xx;if(a[i]||(xx>0&&a[i-1])||(xx<W-1&&a[i+1])||(y>0&&a[i-W])||(y<H-1&&a[i+W]))o[i]=1;}return o;};
  hole=dil(hole);
  inpaintRGBA(im.data,W,H,hole);
  let al=dil(dil(hole));const af=new Float32Array(N);
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){let s=0,n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const yy=y+dy,x2=xx+dx;if(yy<0||x2<0||yy>=H||x2>=W)continue;s+=al[yy*W+x2];n++;}af[y*W+xx]=s/n;}
  for(let i=0;i<N;i++)im.data[i*4+3]=Math.round(Math.min(1,af[i]*1.4)*255);
  x.putImageData(im,0,0);
  return{canvas:cv,bb:[rx/w,ry/h,rw/w,rh/h]};}

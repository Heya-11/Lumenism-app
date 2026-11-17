"use strict";
/* Exposure fusion (Mertens) with MTB translation alignment. Works in a Worker or on the main thread. */
function hdrFuse(imgs,W,H,progress){
  const N=W*H,K=imgs.length;progress=progress||(()=>{});
  const gray=imgs.map(d=>{const g=new Uint8Array(N);for(let i=0;i<N;i++)g[i]=(d[i*4]*54+d[i*4+1]*183+d[i*4+2]*19)>>8;return g;});
  // --- MTB alignment
  const down=(g,w,h)=>{const w2=w>>1,h2=h>>1,o=new Uint8Array(w2*h2);for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){const i=(y*2)*w+x*2;o[y*w2+x]=(g[i]+g[i+1]+g[i+w]+g[i+w+1])>>2;}return o;};
  const bitmaps=(g,n)=>{const hist=new Uint32Array(256);for(let i=0;i<n;i++)hist[g[i]]++;let c=0,med=0;for(;med<256;med++){c+=hist[med];if(c>=n/2)break;}
    const t=new Uint8Array(n),e=new Uint8Array(n);for(let i=0;i<n;i++){t[i]=g[i]>med?1:0;e[i]=Math.abs(g[i]-med)>6?1:0;}return[t,e];};
  const shiftErr=(a,b,w,h,dx,dy)=>{let err=0;for(let y=Math.max(0,dy);y<Math.min(h,h+dy);y+=1){const yy=y-dy;for(let x=Math.max(0,dx);x<Math.min(w,w+dx);x++){const i=y*w+x,j=yy*w+(x-dx);
      if(a[1][i]&&b[1][j]&&a[0][i]!==b[0][j])err++;}}return err;};
  const ref=K>>1;const offs=imgs.map(()=>[0,0]);
  const levels=Math.max(1,Math.min(6,Math.floor(Math.log2(Math.min(W,H)/32))));
  const pyr=g=>{const out=[{g,w:W,h:H}];for(let l=1;l<levels;l++){const p=out[l-1];out.push({g:down(p.g,p.w,p.h),w:p.w>>1,h:p.h>>1});}return out;};
  const refP=pyr(gray[ref]);
  for(let k=0;k<K;k++){if(k===ref)continue;const P=pyr(gray[k]);let ox=0,oy=0;
    for(let l=levels-1;l>=0;l--){ox*=2;oy*=2;const A=refP[l],B=P[l];const ba=bitmaps(A.g,A.w*A.h),bb=bitmaps(B.g,B.w*B.h);let best=[ox,oy],be=Infinity;
      const e0=shiftErr(ba,bb,A.w,A.h,ox,oy);be=e0*.97;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const e=shiftErr(ba,bb,A.w,A.h,ox+dx,oy+dy);if(e<be){be=e;best=[ox+dx,oy+dy];}}[ox,oy]=best;}
    const A0=refP[0],B0=P[0],ba0=bitmaps(A0.g,A0.w*A0.h),bb0=bitmaps(B0.g,B0.w*B0.h);
    if(shiftErr(ba0,bb0,W,H,ox,oy)>shiftErr(ba0,bb0,W,H,0,0)*.85){ox=0;oy=0;}
    offs[k]=[ox,oy];}
  progress(.15);
  // --- float images (shifted)
  const F=imgs.map((d,k)=>{const [dx,dy]=offs[k];const f=new Float32Array(N*3);
    for(let y=0;y<H;y++){const sy=Math.min(H-1,Math.max(0,y-dy));for(let x=0;x<W;x++){const sx=Math.min(W-1,Math.max(0,x-dx));const s=(sy*W+sx)*4,i=(y*W+x)*3;
      f[i]=d[s]/255;f[i+1]=d[s+1]/255;f[i+2]=d[s+2]/255;}}return f;});
  // --- weights
  const Wt=F.map(f=>{const w=new Float32Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,j=i*3;const r=f[j],g=f[j+1],b=f[j+2];const L=.2126*r+.7152*g+.0722*b;
      const ln=(xx,yy)=>{const k=(Math.min(H-1,Math.max(0,yy))*W+Math.min(W-1,Math.max(0,xx)))*3;return .2126*f[k]+.7152*f[k+1]+.0722*f[k+2];};
      const lap=Math.abs(4*L-ln(x-1,y)-ln(x+1,y)-ln(x,y-1)-ln(x,y+1));const mu=(r+g+b)/3;const sat=Math.sqrt(((r-mu)**2+(g-mu)**2+(b-mu)**2)/3);
      const we=Math.exp(-((r-.5)**2)/.08)*Math.exp(-((g-.5)**2)/.08)*Math.exp(-((b-.5)**2)/.08);
      w[i]=(lap+.001)*(sat+.001)*we+1e-12;}return w;});
  for(let i=0;i<N;i++){let s=0;for(let k=0;k<K;k++)s+=Wt[k][i];for(let k=0;k<K;k++)Wt[k][i]/=s;}
  progress(.35);
  // --- pyramids
  const blurDown=(a,w,h,ch)=>{const w2=(w+1)>>1,h2=(h+1)>>1,o=new Float32Array(w2*h2*ch);const k=[1,4,6,4,1];
    const tmp=new Float32Array(w*h2*ch);
    for(let y=0;y<h2;y++)for(let x=0;x<w;x++)for(let c=0;c<ch;c++){let s=0;for(let t=-2;t<=2;t++){const yy=Math.min(h-1,Math.max(0,y*2+t));s+=a[(yy*w+x)*ch+c]*k[t+2];}tmp[(y*w+x)*ch+c]=s/16;}
    for(let y=0;y<h2;y++)for(let x=0;x<w2;x++)for(let c=0;c<ch;c++){let s=0;for(let t=-2;t<=2;t++){const xx=Math.min(w-1,Math.max(0,x*2+t));s+=tmp[(y*w+xx)*ch+c]*k[t+2];}o[(y*w2+x)*ch+c]=s/16;}
    return{a:o,w:w2,h:h2};};
  const up=(s,w,h,ch)=>{const o=new Float32Array(w*h*ch);for(let y=0;y<h;y++){const fy=Math.min(s.h-1,(y+.5)/2-.5),y0=Math.max(0,Math.floor(fy)),y1=Math.min(s.h-1,y0+1),ty=Math.max(0,fy-y0);
      for(let x=0;x<w;x++){const fx=Math.min(s.w-1,(x+.5)/2-.5),x0=Math.max(0,Math.floor(fx)),x1=Math.min(s.w-1,x0+1),tx=Math.max(0,fx-x0);
        for(let c=0;c<ch;c++){const a=s.a[(y0*s.w+x0)*ch+c],b=s.a[(y0*s.w+x1)*ch+c],cc=s.a[(y1*s.w+x0)*ch+c],d=s.a[(y1*s.w+x1)*ch+c];
          o[(y*w+x)*ch+c]=(a*(1-tx)+b*tx)*(1-ty)+(cc*(1-tx)+d*tx)*ty;}}}return o;};
  const L=Math.max(2,Math.min(8,Math.floor(Math.log2(Math.min(W,H)))-3));
  let result=null;
  for(let k=0;k<K;k++){let gw={a:Wt[k],w:W,h:H},gi={a:F[k],w:W,h:H};const lev=[];
    for(let l=0;l<L;l++){const ni=l<L-1?blurDown(gi.a,gi.w,gi.h,3):null;const nw=l<L-1?blurDown(gw.a,gw.w,gw.h,1):null;
      let lap;if(ni){const u=up(ni,gi.w,gi.h,3);lap=new Float32Array(gi.a.length);for(let i=0;i<lap.length;i++)lap[i]=gi.a[i]-u[i];}else lap=gi.a;
      const out=new Float32Array(lap.length);const n=gi.w*gi.h;for(let i=0;i<n;i++){const ww=gw.a[i];out[i*3]=lap[i*3]*ww;out[i*3+1]=lap[i*3+1]*ww;out[i*3+2]=lap[i*3+2]*ww;}
      lev.push({a:out,w:gi.w,h:gi.h});if(ni){gi=ni;gw=nw;}}
    if(!result)result=lev;else for(let l=0;l<L;l++){const r=result[l].a,s=lev[l].a;for(let i=0;i<r.length;i++)r[i]+=s[i];}
    Wt[k]=null;F[k]=null;progress(.35+.55*(k+1)/K);}
  let cur=result[L-1];for(let l=L-2;l>=0;l--){const t=result[l];const u=up(cur,t.w,t.h,3);for(let i=0;i<u.length;i++)u[i]+=t.a[i];cur={a:u,w:t.w,h:t.h};}
  const out=new Uint8ClampedArray(N*4);for(let i=0;i<N;i++){out[i*4]=cur.a[i*3]*255;out[i*4+1]=cur.a[i*3+1]*255;out[i*4+2]=cur.a[i*3+2]*255;out[i*4+3]=255;}
  progress(1);return{data:out,offs};}
if(typeof importScripts==='function'&&typeof document==='undefined'){
  self.onmessage=e=>{try{const {imgs,W,H}=e.data;const r=hdrFuse(imgs,W,H,p=>self.postMessage({progress:p}));self.postMessage({done:true,data:r.data,offs:r.offs},[r.data.buffer]);}
    catch(err){self.postMessage({error:String(err&&err.message||err)});}};}

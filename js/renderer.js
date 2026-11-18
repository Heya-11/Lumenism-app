"use strict";
/* ---------- tone curve LUT ---------- */
function evalCurve(pts){const n=pts.length,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),out=new Float32Array(256);
  const d=[],m=new Array(n);for(let i=0;i<n-1;i++)d[i]=(ys[i+1]-ys[i])/Math.max(1e-6,xs[i+1]-xs[i]);
  m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=0;m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
  let seg=0;for(let k=0;k<256;k++){const x=k/255;let y;
    if(x<=xs[0])y=ys[0];else if(x>=xs[n-1])y=ys[n-1];else{while(seg<n-2&&x>xs[seg+1])seg++;
      const i=seg,h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;
      y=(2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];}
    out[k]=Math.min(1,Math.max(0,y));}return out;}
function paramCurve(pc){const out=new Float32Array(256);const s1=pc.s1/100,s2=pc.s2/100,s3=pc.s3/100;
  const regs=[[pc.sh,0,s1],[pc.dk,s1,s2],[pc.lt,s2,s3],[pc.hl,s3,1]];
  for(let k=0;k<256;k++){const x=k/255;let y=x;
    for(const [amt,a,b] of regs){if(!amt)continue;const c=(a+b)/2,w=Math.max(.08,(b-a)*.9);const t=(x-c)/w;const bump=Math.max(0,1-t*t);y+=amt/100*.22*bump*bump*Math.min(1,x*8,(1-x)*8+.0001);}
    out[k]=Math.min(1,Math.max(0,y));}return out;}
function sampleArr(a,v){const x=Math.min(1,Math.max(0,v))*255,i=Math.floor(x),f=x-i;return i>=255?a[255]:a[i]*(1-f)+a[i+1]*f;}
function buildLut(cv,pc){const M=evalCurve(cv.rgb),PC=paramCurve(pc),R=evalCurve(cv.r),G=evalCurve(cv.g),B=evalCurve(cv.b),d=new Uint8Array(1024);
  for(let i=0;i<256;i++){const m=sampleArr(PC,M[i]);d[i*4]=Math.round(sampleArr(R,m)*255);d[i*4+1]=Math.round(sampleArr(G,m)*255);d[i*4+2]=Math.round(sampleArr(B,m)*255);d[i*4+3]=255;}return d;}

/* ---------- brush raster into float buffer ---------- */
function rasterStrokeBuf(buf,s,fw,fh,from,srcPix){
  const r=Math.max(.6,s.r*fh),step=Math.max(.75,r*.2),inner=r*Math.min(.98,1-s.f);
  const dab=(cx,cy)=>{let ref=null;
    if(s.a&&srcPix){const ix=Math.min(fw-1,Math.max(0,Math.round(cx))),iy=Math.min(fh-1,Math.max(0,Math.round(cy))),k=(iy*fw+ix)*4;ref=[srcPix[k],srcPix[k+1],srcPix[k+2]];}
    const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(fw-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(fh-1,Math.ceil(cy+r));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-cx,y-cy);if(d>r)continue;
      let f=d<=inner?1:1-(d-inner)/(r-inner+1e-6);f=f*f*(3-2*f);let w=s.fl*f;
      if(ref){const k=(y*fw+x)*4,dr=srcPix[k]-ref[0],dg=srcPix[k+1]-ref[1],db=srcPix[k+2]-ref[2];const dist=Math.sqrt(dr*dr+dg*dg+db*db);
        const t=Math.min(1,Math.max(0,(dist-16)/40));w*=1-t*t*(3-2*t);}
      if(w<=0)continue;const i=y*fw+x;buf[i]=s.e?buf[i]*(1-w):buf[i]+(1-buf[i])*w;}};
  let prev=null;const st=Math.max(0,from-1);
  for(let i=st;i<s.p.length;i++){const x=s.p[i][0]*fw,y=s.p[i][1]*fh;
    if(!prev){prev=[x,y];if(i===0)dab(x,y);continue;}
    const d=Math.hypot(x-prev[0],y-prev[1]);if(d<step)continue;
    const n=Math.floor(d/step);for(let k=1;k<=n;k++)dab(prev[0]+(x-prev[0])*k/n,prev[1]+(y-prev[1])*k/n);prev=[x,y];}}

const BLENDS=[['normal','표준'],['multiply','곱하기'],['screen','스크린'],['overlay','오버레이'],['softlight','소프트 라이트'],['hardlight','하드 라이트'],
  ['darken','어둡게'],['lighten','밝게'],['dodge','색상 닷지'],['burn','색상 번'],['difference','차이'],['hue','색조'],['saturation','채도'],['color','색상'],['luminosity','광도']];
const BLEND_IDX=Object.fromEntries(BLENDS.map((b,i)=>[b[0],i]));
const STORE={images:new Map(),patches:new Map(),luts:new Map(),aimaps:new Map(),portrait:new Map()};

class Renderer{
  constructor(canvas){
    const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true,premultipliedAlpha:false,antialias:false,alpha:false});
    if(!gl)throw new Error('WebGL2를 사용할 수 없는 브라우저입니다.');
    this.gl=gl;this.canvas=canvas;this.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.localOK=!!gl.getExtension('EXT_color_buffer_float');
    const P=f=>this.prog(f);
    this.pCopy=P(FS_COPY);this.pBlur=P(FS_BLUR);this.pDev=P(FS_DEV);this.pComp=P(FS_COMP);this.pAcc=P(FS_ACC);
    this.pRet=P(FS_RET);this.pFx=P(FS_FX);this.pLayer=P(FS_LAYER);this.pPresent=P(FS_PRESENT);
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    this.lutTex=this.tex(256,1);this.empty=this.tex(1,1);
    this.lut3Dummy=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,this.lut3Dummy);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA,1,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    this.lut3Tex=null;this.lut3Key='';this.lut3Size=1;
    this.locs=new Map();this.lutKey='';this.brush=new Map();this.fieldKey='';this.retKey='';this.out=null;
    this.layerTex=new Map();this.patchTex=new Map();
  }
  prog(fs){const gl=this.gl;const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
    const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,VS));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));p._id=Math.random().toString(36);return p;}
  tex(w,h,o={}){const gl=this.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,!!o.src);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    if(o.src)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,o.src);
    else if(o.half)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
    else if(o.r8){gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,o.data||null);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    if(o.mip&&o.src)gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,(o.mip&&o.src)?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    t._w=w;t._h=h;return t;}
  mipify(t){const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  upload(t,src){const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);}
  fbo(ts){const gl=this.gl;const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    ts.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0));
    if(ts.length>1)gl.drawBuffers(ts.map((_,i)=>gl.COLOR_ATTACHMENT0+i));
    f._ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return f;}
  u(p,n){const key=p._id+n;let l=this.locs.get(key);if(l===undefined){l=this.gl.getUniformLocation(p,n);this.locs.set(key,l);}return l;}
  bindTex(p,name,unit,t,target){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(target||gl.TEXTURE_2D,t);gl.uniform1i(this.u(p,name),unit);}
  pass(prog,src,fbo,w,h,dir){const gl=this.gl;gl.useProgram(prog);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,w,h);
    this.bindTex(prog,'uSrc',0,src);if(dir)gl.uniform2fv(this.u(prog,'uDir'),dir);gl.drawArrays(gl.TRIANGLES,0,3);}
  /* blurred pyramid of a texture into tex pair; returns texture */
  blurInto(src,pair,w,h,iters){const [A,B,fA,fB]=pair;this.pass(this.pCopy,src,fA,w,h);
    for(let i=0;i<iters;i++){this.pass(this.pBlur,A,fB,w,h,[1/w,0]);this.pass(this.pBlur,B,fA,w,h,[0,1/h]);}return A;}
  pair(w,h,mip){const A=this.tex(w,h,{mip}),B=this.tex(w,h);return[A,B,this.fbo([A]),this.fbo([B]),w,h];}
  freePair(p){if(!p)return;const gl=this.gl;gl.deleteTexture(p[0]);gl.deleteTexture(p[1]);gl.deleteFramebuffer(p[2]);gl.deleteFramebuffer(p[3]);}
  setSource(canvasSrc,fieldMax){const gl=this.gl;
    if(this.srcTex)gl.deleteTexture(this.srcTex);if(this.retTex){gl.deleteTexture(this.retTex);gl.deleteFramebuffer(this.retF);this.retTex=null;}
    [this.lowP,this.midP].forEach(p=>this.freePair(p));
    (this.fT||[]).forEach(t=>gl.deleteTexture(t));if(this.fF)gl.deleteFramebuffer(this.fF);if(this.wT){gl.deleteTexture(this.wT);gl.deleteFramebuffer(this.wF);}
    this.brush.forEach(c=>gl.deleteTexture(c.tex));this.brush.clear();this.fieldKey='';this.retKey='';
    this.patchTex.forEach(t=>gl.deleteTexture(t));this.patchTex.clear();
    const w=canvasSrc.width,h=canvasSrc.height;this.w=w;this.h=h;
    this.srcTex=this.tex(w,h,{src:canvasSrc,mip:true});this.base=this.srcTex;
    this.lowP=this.pair(Math.max(8,Math.round(w/8)),Math.max(8,Math.round(h/8)));
    const fsS=Math.min(1,2560/Math.max(w,h));this.midP=this.pair(Math.max(8,Math.round(w*fsS/2)),Math.max(8,Math.round(h*fsS/2)));
    this.computeBlurs();
    const sc=Math.min(1,(fieldMax||1024)/Math.max(w,h));this.fw=Math.max(4,Math.round(w*sc));this.fh=Math.max(4,Math.round(h*sc));
    const fc=document.createElement('canvas');fc.width=this.fw;fc.height=this.fh;const fx=fc.getContext('2d',{willReadFrequently:true});
    fx.imageSmoothingQuality='high';fx.drawImage(canvasSrc,0,0,this.fw,this.fh);this.fieldSrc=fx.getImageData(0,0,this.fw,this.fh).data;
    if(this.focusT){gl.deleteTexture(this.focusT);gl.deleteFramebuffer(this.focusF);this.focusT=null;}
    if(this.localOK){this.fT=[0,1,2].map(()=>this.tex(this.fw,this.fh,{half:true}));this.fF=this.fbo(this.fT);this.focusT=this.tex(this.fw,this.fh,{half:true});this.focusF=this.fbo([this.focusT]);
      this.wT=this.tex(this.fw,this.fh,{half:true});this.wF=this.fbo([this.wT]);if(!this.fF._ok||!this.wF._ok)this.localOK=false;}
    if(!this.localOK){this.fT=[0,1,2].map(()=>this.tex(1,1));this.fF=null;}else this.clearField();
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
  computeBlurs(){const L=this.lowP,M=this.midP;this.lowT=this.blurInto(this.base,L,L[4],L[5],2);this.midT=this.blurInto(this.base,M,M[4],M[5],1);}
  clearField(){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.fF);gl.viewport(0,0,this.fw,this.fh);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
  invalidate(){this.brush.forEach(c=>c.dirty=true);this.fieldKey='';this.retKey='';}
  /* brush weight textures (R8 at field res, top-left origin) */
  brushTex(item,auto){let c=this.brush.get(item.id);const fw=this.fw,fh=this.fh,S=item.strokes;
    if(!c){c={buf:new Float32Array(fw*fh),u8:new Uint8Array(fw*fh),tex:this.tex(fw,fh,{r8:true}),n:0,lp:0,dirty:true};this.brush.set(item.id,c);}
    let ch=false;const src=auto?this.fieldSrc:null;
    if(c.dirty||S.length<c.n||(S.length===c.n&&c.n>0&&S[c.n-1].p.length<c.lp)){c.buf.fill(0);S.forEach(s=>rasterStrokeBuf(c.buf,s,fw,fh,0,src));ch=true;c.dirty=false;}
    else{if(c.n>0&&S[c.n-1].p.length>c.lp){rasterStrokeBuf(c.buf,S[c.n-1],fw,fh,c.lp,src);ch=true;}for(let i=c.n;i<S.length;i++){rasterStrokeBuf(c.buf,S[i],fw,fh,0,src);ch=true;}}
    c.n=S.length;c.lp=S.length?S[S.length-1].p.length:0;
    if(ch){const b=c.buf,u=c.u8;for(let i=0;i<b.length;i++)u[i]=b[i]*255+.5;const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,c.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,fw,fh,0,gl.RED,gl.UNSIGNED_BYTE,u);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);}
    return c.tex;}
  /* retouch pass: source -> retTex */
  updateRetouch(items){const key=JSON.stringify(items);if(key===this.retKey)return;this.retKey=key;const gl=this.gl,w=this.w,h=this.h;
    if(!items.length){this.base=this.srcTex;this.computeBlurs();return;}
    if(!this.retTex){this.retTex=this.tex(w,h,{mip:true});this.retF=this.fbo([this.retTex]);}
    this.pass(this.pCopy,this.srcTex,this.retF,w,h);
    const P=this.pRet;gl.useProgram(P);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.bindTex(P,'uOrig',0,this.srcTex);gl.uniform1f(this.u(P,'uAspect'),w/h);
    for(const it of items){let kind={heal:0,clone:1,redeye:2,stamp:3,fill:4,privacy:5}[it.type];let wt=this.empty;
      if(it.type==='stamp')wt=this.brushTex(it,false);
      if(it.type==='fill'){wt=this.patchTex.get(it.pid);if(!wt){const cv=STORE.patches.get(it.pid);if(!cv)continue;wt=this.tex(cv.width,cv.height,{src:cv});this.patchTex.set(it.pid,wt);}}
      gl.useProgram(P);gl.bindFramebuffer(gl.FRAMEBUFFER,this.retF);gl.viewport(0,0,w,h);
      this.bindTex(P,'uOrig',0,this.srcTex);this.bindTex(P,'uW',1,wt);
      gl.uniform1i(this.u(P,'uKind'),kind);
      gl.uniform2fv(this.u(P,'uD'),it.d||it.c||[0,0]);gl.uniform2fv(this.u(P,'uS'),it.s||[0,0]);gl.uniform2fv(this.u(P,'uOff'),it.off||[0,0]);
      gl.uniform1f(this.u(P,'uR'),it.r||.01);gl.uniform1f(this.u(P,'uRpx'),(it.r||.01)*h);gl.uniform1f(this.u(P,'uF'),Math.max(.01,(it.f??50)/100));gl.uniform1f(this.u(P,'uOp'),(it.op??100)/100);
      gl.uniform4fv(this.u(P,'uBB'),it.bb||[0,0,1,1]);
      if(kind===5){gl.uniform1f(this.u(P,'uR'),it.blk);gl.uniform1f(this.u(P,'uRpx'),it.blk*h);gl.uniform2f(this.u(P,'uOff'),it.st,0);}
      gl.drawArrays(gl.TRIANGLES,0,3);}
    gl.disable(gl.BLEND);this.mipify(this.retTex);
    this.base=this.retTex;this.computeBlurs();this.fieldKey='';}
  aiTex(aid){if(!aid)return null;const m=STORE.aimaps.get(aid);if(!m)return null;this.aiT=this.aiT||new Map();let t=this.aiT.get(aid);if(t)return t;
    t=this.tex(m.w,m.h,{r8:true,data:m.data});this.aiT.set(aid,t);return t;}
  portTex(aid,edits){const d=aid&&STORE.portrait.get(aid);if(!d)return null;const ed=portArrays(d,edits);this.pT=this.pT||new Map();let t=this.pT.get(aid);
    if(t&&t.v===ed.v)return t.t;const gl=this.gl;if(!t){t={t:this.rgbaTex(d.w,d.h,ed.rgba)};this.pT.set(aid,t);}else{gl.bindTexture(gl.TEXTURE_2D,t.t);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,d.w,d.h,gl.RGBA,gl.UNSIGNED_BYTE,ed.rgba);}
    t.v=ed.v;return t.t;}
  rgbaTex(w,h,data){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  port2Tex(aid,edits){const d=aid&&STORE.portrait.get(aid);if(!d||!d.rgba2)return null;const ed=portArrays(d,edits);this.pT2=this.pT2||new Map();let t=this.pT2.get(aid);
    if(t&&t.v===ed.v)return t.t;const gl=this.gl;if(!t){t={t:this.rgbaTex(d.w,d.h,ed.rgba2)};this.pT2.set(aid,t);}else{gl.bindTexture(gl.TEXTURE_2D,t.t);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,d.w,d.h,gl.RGBA,gl.UNSIGNED_BYTE,ed.rgba2);}
    t.v=ed.v;return t.t;}
  skyTex(key){const c=skyImage(key);if(!c)return null;this.skT=this.skT||new Map();let t=this.skT.get(key);if(t)return t;
    const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;t={tex:this.rgbaTex(c.width,c.height,d),w:c.width,h:c.height,avg:skyAvg(d)};this.skT.set(key,t);return t;}
  skyOld(aid){this.skO=this.skO||new Map();if(this.skO.has(aid))return this.skO.get(aid);const m=STORE.aimaps.get(aid);const fw=this.fw,fh=this.fh,s=this.fieldSrc;let r=0,g=0,b=0,n=0;
    for(let y=0;y<fh;y+=2)for(let x=0;x<fw;x+=2){const mv=m.data[Math.min(m.h-1,Math.floor(y/fh*m.h))*m.w+Math.min(m.w-1,Math.floor(x/fw*m.w))];if(mv<200)continue;const k=(y*fw+x)*4;r+=s[k];g+=s[k+1];b+=s[k+2];n++;}
    const v=n?[r/n/255,g/n/255,b/n/255]:[.6,.7,.85];this.skO.set(aid,v);return v;}
  updateDisp(p){const key=JSON.stringify([p.portrait,p.liquify,this.w,this.h]);if(key===this.dispKey)return this.dispOn;this.dispKey=key;
    const faces=(STORE.portrait.get(p.portrait.aid)||{}).faces||[];const res=buildDisp(p,faces,this.w/this.h);this.dispOn=!!res;
    if(res){const gl=this.gl;if(!this.dispTex||this.dispTex._w!==res.w||this.dispTex._h!==res.h){if(this.dispTex)gl.deleteTexture(this.dispTex);this.dispTex=this.tex(res.w,res.h,{half:true});}
      gl.bindTexture(gl.TEXTURE_2D,this.dispTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,res.w,res.h,0,gl.RGBA,gl.FLOAT,res.data);}
    return this.dispOn;}
  maskWeight(m){const gl=this.gl,fw=this.fw,fh=this.fh;
    const texs=m.comps.map(c=>c.type==='brush'?this.brushTex(c,!!c.auto):c.type==='ai'?this.aiTex(c.aid):null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.wF);gl.viewport(0,0,fw,fh);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const C=this.pComp;gl.useProgram(C);gl.uniform1f(this.u(C,'uAspect'),this.w/this.h);gl.enable(gl.BLEND);
    m.comps.forEach((c,i)=>{const mode=i===0?'add':c.mode;
      if(mode==='add'){gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);}
      else if(mode==='sub'){gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_COLOR);}
      else{gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ZERO,gl.SRC_COLOR);}
      gl.uniform1i(this.u(C,'uType'),c.type==='linear'?0:c.type==='radial'?1:2);gl.uniform1i(this.u(C,'uInv'),c.inv?1:0);
      gl.uniform2fv(this.u(C,'uA'),c.a||[0,0]);gl.uniform2fv(this.u(C,'uB'),c.b||[0,1]);gl.uniform2fv(this.u(C,'uC'),c.c||[.5,.5]);gl.uniform2f(this.u(C,'uR'),c.rx||.2,c.ry||.2);
      gl.uniform1f(this.u(C,'uFeather'),(c.feather??50)/100);this.bindTex(C,'uBrush',0,texs[i]||this.empty);
      gl.drawArrays(gl.TRIANGLES,0,3);});
    gl.blendEquation(gl.FUNC_ADD);gl.disable(gl.BLEND);}
  accPass(m,fbo,adj0,adj1,sel){const gl=this.gl;const A=this.pAcc;gl.useProgram(A);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,this.fw,this.fh);
    this.bindTex(A,'uW',0,this.wT);this.bindTex(A,'uSrc',1,this.base);const rg=m.range||{type:'none'};
    gl.uniform4fv(this.u(A,'uAdj0'),adj0);gl.uniform4fv(this.u(A,'uAdj1'),adj1);gl.uniform1f(this.u(A,'uSel'),sel);
    gl.uniform1i(this.u(A,'uRT'),rg.type==='lum'?1:rg.type==='color'?2:0);
    if(rg.type==='lum')gl.uniform3f(this.u(A,'uRV'),rg.lo/100,rg.hi/100,rg.sm/100);else gl.uniform3f(this.u(A,'uRV'),(rg.tol||30)/100*.6,0,(rg.sm||20)/100*.5);
    gl.uniform3fv(this.u(A,'uRC'),rg.color||[0,0,0]);gl.drawArrays(gl.TRIANGLES,0,3);}
  updateField(p,o){if(!this.localOK)return;const fmode=p.fx.tilt===6?p.fx.maskId||'':'';
    const key=JSON.stringify(p.masks)+'|'+(o.sel||'')+'|'+(o.overlay?1:0)+'|'+fmode;
    if(key===this.fieldKey)return;this.fieldKey=key;const gl=this.gl;
    const live=new Set();p.masks.forEach(m=>m.comps.forEach(c=>live.add(c.id)));p.retouch.forEach(r=>live.add(r.id));
    this.brush.forEach((c,id)=>{if(!live.has(id)){gl.deleteTexture(c.tex);this.brush.delete(id);}});
    this.clearField();
    for(const m of p.masks){if(!m.comps.length)continue;this.maskWeight(m);const J=m.adj;
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
      this.accPass(m,this.fF,[J.exposure,J.contrast/100,J.highlights/100,J.shadows/100],[J.temp/100,J.tint/100,J.clarity/100,J.saturation/100],(o.overlay&&m.id===o.sel)?1:0);
      gl.disable(gl.BLEND);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.focusF);gl.viewport(0,0,this.fw,this.fh);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const fm=fmode&&p.masks.find(m=>m.id===fmode);
    if(fm&&fm.comps.length){this.maskWeight(fm);this.accPass(fm,this.focusF,[1,0,0,0],[0,0,0,0],0);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
  setLut(p){const key=JSON.stringify([p.curves,p.pcurve]);if(key===this.lutKey)return;this.lutKey=key;
    const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.lutTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,buildLut(p.curves,p.pcurve));}
  setLut3(id){if((id||'')===this.lut3Key)return;this.lut3Key=id||'';const gl=this.gl;
    if(this.lut3Tex){gl.deleteTexture(this.lut3Tex);this.lut3Tex=null;}
    const L=id&&STORE.luts.get(id);if(!L)return;const n=L.size,d=new Uint8Array(n*n*n*4);
    for(let i=0;i<n*n*n;i++){d[i*4]=Math.round(Math.min(1,Math.max(0,L.data[i*3]))*255);d[i*4+1]=Math.round(Math.min(1,Math.max(0,L.data[i*3+1]))*255);d[i*4+2]=Math.round(Math.min(1,Math.max(0,L.data[i*3+2]))*255);d[i*4+3]=255;}
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,t);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA,n,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R].forEach(k=>gl.texParameteri(gl.TEXTURE_3D,k,gl.CLAMP_TO_EDGE));
    this.lut3Tex=t;this.lut3Size=n;}
  ensureOut(W,H,fs){const gl=this.gl;const key=W+'x'+H+'@'+fs.toFixed(4);if(this.out&&this.out.key===key)return this.out;
    if(this.out){const o=this.out;[o.dev,o.a,o.b].forEach(t=>gl.deleteTexture(t));[o.fdev,o.fa,o.fb].forEach(f=>gl.deleteFramebuffer(f));this.freePair(o.bA);this.freePair(o.bB);}
    const dev=this.tex(W,H),a=this.tex(W,H),b=this.tex(W,H);
    this.out={key,W,H,dev,a,b,fdev:this.fbo([dev]),fa:this.fbo([a]),fb:this.fbo([b]),
      bA:this.pair(Math.max(4,Math.round(W*fs/4)),Math.max(4,Math.round(H*fs/4))),bB:this.pair(Math.max(4,Math.round(W*fs/16)),Math.max(4,Math.round(H*fs/16)))};return this.out;}
  textCanvas(L,outH){const px=Math.max(4,Math.round(L.size/100*outH));const key=JSON.stringify([L.text,L.font,px,L.color,L.bold,L.shadow]);
    let c=this.layerTex.get(L.id);if(c&&c.key===key)return c;
    const cv=document.createElement('canvas'),x=cv.getContext('2d');const font=`${L.bold?700:400} ${px}px "${L.font}", "Noto Sans KR", sans-serif`;x.font=font;
    const lines=(L.text||' ').split('\n');const lw=Math.max(...lines.map(s=>x.measureText(s).width),1);const pad=Math.ceil(px*.3);
    cv.width=Math.ceil(lw+pad*2);cv.height=Math.ceil(lines.length*px*1.25+pad*2);
    x.font=font;x.textAlign='center';x.textBaseline='middle';
    if(L.shadow){x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=px*.12;x.shadowOffsetY=px*.04;}
    x.fillStyle=L.color;lines.forEach((s,i)=>x.fillText(s,cv.width/2,pad+px*1.25*(i+.5)));
    if(c)this.gl.deleteTexture(c.tex);c={key,tex:this.tex(cv.width,cv.height,{src:cv}),w:cv.width,h:cv.height};this.layerTex.set(L.id,c);return c;}
  imageTex(L){const src=STORE.images.get(L.img);if(!src)return null;let c=this.layerTex.get(L.id);
    if(c&&c.key===L.img)return c;if(c)this.gl.deleteTexture(c.tex);c={key:L.img,tex:this.tex(src.width,src.height,{src}),w:src.width,h:src.height};this.layerTex.set(L.id,c);return c;}
  layerRect(L,outW,outH){if(L.type==='text'){const c=this.textCanvas(L,outH);return{w:c.w*L.scale/100,h:c.h*L.scale/100,c};}
    if(L.type==='image'){const c=this.imageTex(L);if(!c)return null;const w=outW*.5*L.scale/100;return{w,h:w*c.h/c.w,c};}return null;}
  render(p,o={}){const gl=this.gl,cv=this.canvas,w=this.w,h=this.h;
    const G=geoMats(w,h,p.geo,o.cropMode);this.last={...G,w,h};const W=G.outW,H=G.outH;
    let [rx,ry,rw,rh]=o.region||[0,0,W,H];rx=Math.max(0,Math.min(W-1,rx));ry=Math.max(0,Math.min(H-1,ry));rw=Math.max(1,Math.min(rw,W-rx));rh=Math.max(1,Math.min(rh,H-ry));
    if(cv.width!==rw||cv.height!==rh){cv.width=rw;cv.height=rh;}
    const reg=[rx/W,1-(ry+rh)/H,rw/W,rh/H],fs=Math.min(1,2560/Math.max(W,H));
    this.updateRetouch(p.retouch.concat(privItems(p)));this.setLut(p);this.setLut3(p.lut.id);this.updateField(p,o);
    const dOn=this.updateDisp(p);const pd=STORE.portrait.get(p.portrait.aid),ptT=pd?this.portTex(p.portrait.aid,p.portrait.edits):null;
    /* create every texture before binding starts (creating binds to the active unit and would clobber earlier bindings) */
    if(pd)this.port2Tex(p.portrait.aid,p.portrait.edits);if(p.sky&&p.sky.on&&p.sky.aid&&this.aiTex(p.sky.aid))this.skyTex(p.sky.src);if(p.light&&p.light.on)this.aiTex(p.light.aid);if(o.aiOv&&p.fx.aid)this.aiTex(p.fx.aid);
    const out=this.ensureOut(rw,rh,fs);const split=o.bypass?2:(o.split??-1);
    // ---- develop
    const B=[rw,0,rx,0,-rh,ry+rh,0,0,1],A=[1/w,0,0,0,-1/h,1,0,0,1];const M=M3.chain(A,G.T,B);
    const D=this.pDev;gl.useProgram(D);gl.bindFramebuffer(gl.FRAMEBUFFER,out.fdev);gl.viewport(0,0,rw,rh);gl.uniform4fv(this.u(D,'uRegion'),reg);
    this.bindTex(D,'uTex',0,this.base);this.bindTex(D,'uOrig',1,this.srcTex);this.bindTex(D,'uBlur',2,this.lowT);this.bindTex(D,'uMid',3,this.midT);
    this.bindTex(D,'uLut',4,this.lutTex);this.bindTex(D,'uL0',5,this.fT[0]);this.bindTex(D,'uL1',6,this.fT[1]);this.bindTex(D,'uL2',7,this.fT[2]);
    this.bindTex(D,'uLut3',8,this.lut3Tex||this.lut3Dummy,gl.TEXTURE_3D);
    const f=(n,v)=>gl.uniform1f(this.u(D,n),v),i1=(n,v)=>gl.uniform1i(this.u(D,n),v);
    gl.uniformMatrix3fv(this.u(D,'uGeo'),false,M3.col(M));
    gl.uniform2f(this.u(D,'uTexel'),1/w,1/h);f('uOutAspect',W/H);f('uSrcAspect',w/h);f('uSplit',o.cropMode?-1:split);
    i1('uBypass',o.bypass?1:0);i1('uOverlay',(o.overlay&&this.localOK)?1:0);
    const Ln=p.lens;f('uDistort',Ln.dist/100);f('uCA',Ln.ca/100);f('uLensVig',Ln.vig/100);f('uLensVigMid',Ln.vigMid/100);f('uDefringe',Ln.defringe/100);
    f('uTemp',p.temp/100);f('uTint',p.tint/100);f('uExposure',p.exposure);f('uContrast',p.contrast/100);
    f('uHighlights',p.highlights/100);f('uShadows',p.shadows/100);f('uWhites',p.whites/100);f('uBlacks',p.blacks/100);
    f('uTexture',p.texture/100);f('uClarity',p.clarity/100);f('uDehaze',p.dehaze/100);f('uVibrance',p.vibrance/100);f('uSaturation',p.saturation/100);
    const hs=new Float32Array(24);for(let i=0;i<8;i++){hs[i*3]=p.hslH[i]/100;hs[i*3+1]=p.hslS[i]/100;hs[i*3+2]=p.hslL[i]/100;}
    gl.uniform3fv(this.u(D,'uHsl'),hs);i1('uBW',p.bw?1:0);gl.uniform1fv(this.u(D,'uBWMix'),p.bwMix.map(v=>v/100));
    gl.uniform3f(this.u(D,'uGS'),p.gsH/360,p.gsS/100,p.gsL/100);gl.uniform3f(this.u(D,'uGM'),p.gmH/360,p.gmS/100,p.gmL/100);
    gl.uniform3f(this.u(D,'uGH'),p.ghH/360,p.ghS/100,p.ghL/100);f('uBal',p.gBal/100);
    f('uSharpen',p.sharpen/100);f('uSharpRadius',p.sharpRadius);f('uSharpDetail',p.sharpDetail/100);f('uSharpMask',p.sharpMask/100);
    f('uHighPass',p.highPass/100);f('uLNR',p.lnr/100);f('uCNR',p.cnr/100);
    f('uVig',p.vig/100);f('uVigMid',p.vigMid/100);f('uGrain',p.grain/100);f('uGrainSize',p.grainSize/100);
    i1('uDuo',p.duo.on?1:0);gl.uniform3fv(this.u(D,'uDuoA'),hex3(p.duo.a));gl.uniform3fv(this.u(D,'uDuoB'),hex3(p.duo.b));f('uDuoAmt',p.duo.amt/100);
    const mx=p.mix;gl.uniformMatrix3fv(this.u(D,'uMix'),false,[mx.r[0],mx.g[0],mx.b[0],mx.r[1],mx.g[1],mx.b[1],mx.r[2],mx.g[2],mx.b[2]].map(v=>v/100));
    const pcs=p.pcs.slice(0,4),pt=new Float32Array(16),pa=new Float32Array(16);
    pcs.forEach((c,i)=>{pt.set([c.h,c.s,c.l,Math.max(.02,c.range/100*.35)],i*4);pa.set([c.dh/100,c.ds/100,c.dl/100,1],i*4);});
    gl.uniform4fv(this.u(D,'uPCt'),pt);gl.uniform4fv(this.u(D,'uPCa'),pa);i1('uPCn',pcs.length);f('uPCRest',pcs.length?p.pcRest/100:0);
    i1('uLut3On',this.lut3Tex?1:0);f('uLut3Amt',p.lut.amt/100);f('uLut3Size',this.lut3Size);
    i1('uDispOn',dOn?1:0);this.bindTex(D,'uDisp',9,dOn?this.dispTex:this.empty);const po=p.portrait;
    i1('uPortOn',ptT?1:0);this.bindTex(D,'uPort',10,ptT||this.empty);
    gl.uniform4f(this.u(D,'uPA'),po.smooth/100,po.keep/100,po.red/100,po.bright/100);
    gl.uniform4f(this.u(D,'uPB'),po.eyes/100,po.iris/100,po.teeth/100,pd?Math.max(1.5,pd.faceW*h*.018):2);
    const pt2=pd?this.port2Tex(p.portrait.aid,p.portrait.edits):null;this.bindTex(D,'uPort2',11,pt2||this.empty);
    gl.uniform4f(this.u(D,'uMK'),(po.lip||0)/100,(po.blush||0)/100,(po.brow||0)/100,(po.dark||0)/100);gl.uniform2f(this.u(D,'uMH'),(po.lipH??352)/360,(po.blushH??6)/360);
    const fd=new Float32Array(256);let fn=0;if(pd)pd.faces.slice(0,16).forEach((q,i)=>{const v=k=>portVal(po,i,k);
      fd.set([v('smooth')/100,v('keep')/100,v('red')/100,v('bright')/100, v('eyes')/100,v('iris')/100,v('teeth')/100,((po.fw||[])[i]??100)/100,
        (v('lip')||0)/100,(v('blush')||0)/100,(v('brow')||0)/100,(v('dark')||0)/100, (v('lipH')??352)/360,(v('blushH')??6)/360,(q.box[0]+q.box[2])/2,(q.box[1]+q.box[3])/2],i*16);fn++;});
    gl.uniform4fv(this.u(D,'uFD'),fd);i1('uFN',fn);
    const sk=p.sky||{},skM=sk.on&&sk.aid?this.aiTex(sk.aid):null,skT=skM?this.skyTex(sk.src):null;
    i1('uSkyOn',skM&&skT?1:0);this.bindTex(D,'uSkyM',13,skM||this.empty);this.bindTex(D,'uSky',12,skT?skT.tex:this.empty);
    if(skM&&skT){const pa=w/h,sa=skT.w/skT.h,sc=100/Math.max(50,sk.scale||100);let kx=Math.min(1,pa/sa)*sc,ky=Math.min(1,sa/pa)*sc;
      const ox=.5-.5*kx,oy=.5-.5*ky+(sk.shift||0)/100*(1-ky)*.5;if(sk.flip){kx=-kx;}
      gl.uniform4f(this.u(D,'uSkyT'),kx,ky,sk.flip?.5+.5*Math.abs(kx):ox,oy);
      const old=this.skyOld(sk.aid),nw=skT.avg,lo=luma3(old),ln=luma3(nw);const fgk=(sk.fg??50)/100;
      const tint=[0,1,2].map(i=>clamp((nw[i]/Math.max(.02,ln))/(old[i]/Math.max(.02,lo)),.7,1.35)*clamp(Math.pow(ln/Math.max(.02,lo),.25),.75,1.25));
      gl.uniform3fv(this.u(D,'uSkyTint'),tint);f('uSkyL',lo);gl.uniform4f(this.u(D,'uSkyP'),(sk.amt??100)/100,fgk,Math.pow(2,(sk.bright||0)/100),(sk.edge??50)/100);}
    const lt=p.light||{},rlT=lt.on&&lt.aid?this.aiTex(lt.aid):null;i1('uRelOn',rlT?1:0);this.bindTex(D,'uRel',14,rlT||this.empty);
    if(rlT){const m=STORE.aimaps.get(lt.aid),a=lt.ang*Math.PI/180,e=lt.elev*Math.PI/180;gl.uniform2f(this.u(D,'uRelTx'),1/m.w,1/m.h);
      gl.uniform3f(this.u(D,'uRelL'),Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e));
      const wm=(lt.warm||0)/100,wc=wm>=0?[1,.82,.6]:[.65,.8,1];gl.uniform3fv(this.u(D,'uRelC'),wc.map(v=>1+(v-1)*Math.abs(wm)));
      gl.uniform4f(this.u(D,'uRelP'),lt.amt/100,lt.amb/100,1,28);}
    const fxp=p.fx;let ovT=null,ovType=0;if(o.aiOv&&fxp.tilt>=3&&fxp.tilt<=5&&fxp.aid){ovT=this.aiTex(fxp.aid);ovType=ovT?(fxp.tilt===4?2:1):0;}
    i1('uAIOv',o.aiOv?1:0);i1('uOvSel',o.ovSel||0);i1('uOvFT',ovType);this.bindTex(D,'uOvF',15,ovT||this.empty);gl.uniform2f(this.u(D,'uOvFP'),fxp.fdepth??.5,(fxp.dof??8)/100);
    gl.drawArrays(gl.TRIANGLES,0,3);
    let curT=out.dev;
    // ---- effects
    const fx=p.fx;let focusTex=this.empty,fType=0,fFlip=1,blurOK=fx.tilt>0&&fx.blur>0;
    if(fx.tilt>=3&&fx.tilt<=5){focusTex=this.aiTex(fx.aid)||null;if(!focusTex)blurOK=false;fType=fx.tilt===4?1:0;}
    if(fx.tilt===6){if(fx.maskId&&this.localOK&&p.masks.some(m=>m.id===fx.maskId)){focusTex=this.focusT;fFlip=0;}else blurOK=false;}
    const fxOn=!o.cropMode&&(fx.orton>0||fx.glow>0||fx.hal>0||blurOK);
    if(fxOn){this.mipify(out.dev);
      const a=this.blurInto(out.dev,out.bA,out.bA[4],out.bA[5],2);this.mipify(a);
      const b=this.blurInto(a,out.bB,out.bB[4],out.bB[5],3);
      const X=this.pFx;gl.useProgram(X);gl.bindFramebuffer(gl.FRAMEBUFFER,out.fa);gl.viewport(0,0,rw,rh);gl.uniform4fv(this.u(X,'uRegion'),reg);
      this.bindTex(X,'uBase',0,out.dev);this.bindTex(X,'uBA',1,a);this.bindTex(X,'uBB',2,b);
      const g=(n,v)=>gl.uniform1f(this.u(X,n),v);g('uSplit',split);g('uOutAspect',W/H);g('uOrton',fx.orton/100);g('uGlow',fx.glow/100);g('uGlowT',fx.glowT/100);
      g('uHal',fx.hal/100);g('uBlurAmt',fx.blur/100);g('uTAng',fx.tang*Math.PI/180);g('uTW',fx.tw/100);g('uTF',fx.tf/100);
      g('uBlurAmt',blurOK?fx.blur/100:0);this.bindTex(X,'uFocus',3,focusTex||this.empty);gl.uniformMatrix3fv(this.u(X,'uGeo'),false,M3.col(M));
      const rpx=.032*Math.max(W,H);gl.uniform2f(this.u(X,'uRad'),rpx/rw,rpx/rh);g('uBoost',(fx.boost??30)/100);g('uFSharp',(fx.fsharp||0)/100);
      g('uFDepth',fx.fdepth??.5);g('uDof',(fx.dof??8)/100);gl.uniform1i(this.u(X,'uShape'),fx.shape==='hex'?1:0);
      gl.uniform1i(this.u(X,'uFocusType'),fType);gl.uniform1i(this.u(X,'uFocusFlip'),fFlip);
      gl.uniform1i(this.u(X,'uTilt'),blurOK?fx.tilt:0);gl.uniform2f(this.u(X,'uTC'),fx.tx,fx.ty);gl.drawArrays(gl.TRIANGLES,0,3);curT=out.a;}
    // ---- layers
    if(!o.cropMode)for(const L of p.layers){if(!L.visible)continue;let rect=null;
      if(L.type==='image'||L.type==='text'){rect=this.layerRect(L,W,H);if(!rect)continue;}
      const tgtT=curT===out.a?out.b:out.a,tgtF=curT===out.a?out.fb:out.fa;
      const Y=this.pLayer;gl.useProgram(Y);gl.bindFramebuffer(gl.FRAMEBUFFER,tgtF);gl.viewport(0,0,rw,rh);gl.uniform4fv(this.u(Y,'uRegion'),reg);
      this.bindTex(Y,'uBase',0,curT);this.bindTex(Y,'uTex',1,rect?rect.c.tex:this.empty);
      gl.uniform1i(this.u(Y,'uType'),{image:0,text:1,color:2,adjust:3}[L.type]);gl.uniform1i(this.u(Y,'uBlend'),BLEND_IDX[L.blend]||0);
      if(rect){const Xf=M3.chain([1,0,0,0,-1,1,0,0,1],M3.T(.5,.5),M3.S(1/rect.w,1/rect.h),M3.R(-L.rot*Math.PI/180),M3.T(-L.x*W,-L.y*H),B);
        gl.uniformMatrix3fv(this.u(Y,'uXf'),false,M3.col(Xf));}
      gl.uniform1f(this.u(Y,'uOp'),L.opacity/100);gl.uniform1f(this.u(Y,'uSplit'),split);gl.uniform1f(this.u(Y,'uOutAspect'),W/H);
      gl.uniform3fv(this.u(Y,'uColor'),hex3(L.color||'#ffffff'));
      gl.uniform4f(this.u(Y,'uAdj'),L.exp||0,(L.con||0)/100,(L.sat||0)/100,(L.hue||0)/360);gl.uniform1i(this.u(Y,'uAdjInv'),L.invert?1:0);
      const mk=L.mask;gl.uniform1i(this.u(Y,'uMType'),mk.type==='linear'?1:mk.type==='radial'?2:0);gl.uniform1i(this.u(Y,'uMInv'),mk.inv?1:0);
      if(mk.type==='linear')gl.uniform4f(this.u(Y,'uMP'),mk.x,mk.y,mk.ang*Math.PI/180,mk.f/100*.5);
      else gl.uniform4f(this.u(Y,'uMP'),mk.x,mk.y,mk.size/100,0);
      gl.uniform1f(this.u(Y,'uMF'),Math.max(.01,mk.f/100));
      gl.drawArrays(gl.TRIANGLES,0,3);curT=tgtT;}
    // ---- present
    const Q=this.pPresent;gl.useProgram(Q);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,rw,rh);
    this.bindTex(Q,'uTex',0,curT);gl.uniform2f(this.u(Q,'uTexel'),1/rw,1/rh);gl.uniform1i(this.u(Q,'uClip'),o.clip?1:0);gl.uniform1f(this.u(Q,'uOS'),o.outSharp||0);
    gl.drawArrays(gl.TRIANGLES,0,3);}
  readPixel(x,y){const gl=this.gl,b=new Uint8Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.readPixels(Math.max(0,Math.min(this.canvas.width-1,Math.round(x))),Math.max(0,Math.min(this.canvas.height-1,this.canvas.height-1-Math.round(y))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);return[b[0]/255,b[1]/255,b[2]/255];}
  srcPixel(u,v,rad=1){const fw=this.fw,fh=this.fh,d=this.fieldSrc;let r=0,g=0,b=0,n=0;const cx=Math.round(u*fw),cy=Math.round(v*fh);
    for(let y=cy-rad;y<=cy+rad;y++)for(let x=cx-rad;x<=cx+rad;x++){if(x<0||y<0||x>=fw||y>=fh)continue;const k=(y*fw+x)*4;r+=d[k];g+=d[k+1];b+=d[k+2];n++;}
    return n?[r/n/255,g/n/255,b/n/255]:[.5,.5,.5];}
  dispose(){const e=this.gl.getExtension('WEBGL_lose_context');e&&e.loseContext();}
}
function luma3(c){return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function hex3(h){const n=parseInt((h||'#000000').slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}

"use strict";
const VS=`#version 300 es
out vec2 vUv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const HDR=`#version 300 es
precision highp float;precision highp sampler3D;in vec2 vUv;`;
const COMMON=`
const vec3 LW=vec3(.2126,.7152,.0722);
float luma(vec3 c){return dot(c,LW);}
vec3 rgb2hsl(vec3 c){float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));float l=(mx+mn)*.5,d=mx-mn,h=0.,s=0.;
 if(d>1e-5){s=l>.5?d/(2.-mx-mn):d/(mx+mn);
  if(mx==c.r)h=(c.g-c.b)/d+(c.g<c.b?6.:0.);else if(mx==c.g)h=(c.b-c.r)/d+2.;else h=(c.r-c.g)/d+4.;h/=6.;}
 return vec3(h,s,l);}
float h2r(float p,float q,float t){t=fract(t);if(t<1./6.)return p+(q-p)*6.*t;if(t<.5)return q;if(t<2./3.)return p+(q-p)*(2./3.-t)*6.;return p;}
vec3 hsl2rgb(vec3 h){if(h.y<1e-5)return vec3(h.z);float q=h.z<.5?h.z*(1.+h.y):h.z+h.y-h.z*h.y;float p=2.*h.z-q;
 return vec3(h2r(p,q,h.x+1./3.),h2r(p,q,h.x),h2r(p,q,h.x-1./3.));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float hueDist(float a,float b){float d=abs(a-b);return min(d,1.-d);}
vec3 overlayB(vec3 a,vec3 b){return mix(2.*a*b,1.-2.*(1.-a)*(1.-b),step(.5,a));}
`;
const FS_COPY=HDR+`out vec4 o;uniform sampler2D uSrc;void main(){o=vec4(texture(uSrc,vUv).rgb,1.);}`;
const FS_BLUR=HDR+`out vec4 o;uniform sampler2D uSrc;uniform vec2 uDir;
void main(){vec3 s=texture(uSrc,vUv).rgb*.2270270270;
s+=(texture(uSrc,vUv+uDir*1.3846153846).rgb+texture(uSrc,vUv-uDir*1.3846153846).rgb)*.3162162162;
s+=(texture(uSrc,vUv+uDir*3.2307692308).rgb+texture(uSrc,vUv-uDir*3.2307692308).rgb)*.0702702703;
o=vec4(s,1.);}`;

/* retouch: 0 heal, 1 clone, 2 redeye, 3 stamp, 4 patch */
const FS_RET=HDR+`out vec4 o;
uniform int uKind;uniform sampler2D uOrig,uW;uniform vec2 uD,uS,uOff;uniform float uR,uF,uOp,uAspect,uRpx;uniform vec4 uBB;
void main(){vec2 p=vec2(vUv.x,1.-vUv.y);vec2 asp=vec2(uAspect,1.);float w=0.;vec3 col;
 if(uKind<=2){float d=length((p-uD)*asp)/uR;w=1.-smoothstep(1.-uF,1.,d);if(w<=0.)discard;
  if(uKind==2){col=texture(uOrig,vUv).rgb;float gb=(col.g+col.b)*.5;float red=smoothstep(.02,.15,col.r-gb)*step(.15,col.r);
    col.r=mix(col.r,gb*.85,red*uOp);col=mix(col,col*.8,red*uOp);}
  else{vec2 sp=p+(uS-uD);col=texture(uOrig,vec2(sp.x,1.-sp.y)).rgb;
    if(uKind==0){vec3 off=vec3(0.);float ws=0.;float lod=log2(max(1.,uRpx*.45));
      for(int k=0;k<12;k++){float a=float(k)/12.*6.2832;vec2 dir=vec2(cos(a)/uAspect,sin(a))*uR*1.2;vec2 pd=uD+dir,ps=uS+dir;
        vec3 md=textureLod(uOrig,vec2(pd.x,1.-pd.y),lod).rgb,ms=textureLod(uOrig,vec2(ps.x,1.-ps.y),lod).rgb;
        vec2 dd=(p-pd)*asp;float wk=1./(dot(dd,dd)+uR*uR*.04);off+=(md-ms)*wk;ws+=wk;}
      col+=off/ws;}
    w*=uOp;}}
 else if(uKind==3){w=texture(uW,p).r;if(w<=.002)discard;vec2 sp=p+uOff;col=texture(uOrig,vec2(sp.x,1.-sp.y)).rgb;}
 else{vec2 q=(p-uBB.xy)/uBB.zw;if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)discard;vec4 t=texture(uW,vec2(q.x,1.-q.y));col=t.rgb;w=t.a;}
 o=vec4(clamp(col,0.,1.),w);}`;

/* mask component weight (source space) */
const FS_COMP=HDR+`out vec4 o;
uniform int uType,uInv;uniform vec2 uA,uB,uC,uR;uniform float uFeather,uAspect;uniform sampler2D uBrush;
void main(){vec2 p=vec2(vUv.x,1.-vUv.y);vec2 asp=vec2(uAspect,1.);float w;
 if(uType==0){vec2 a=uA*asp,b=uB*asp,q=p*asp,d=b-a;float t=dot(q-a,d)/max(dot(d,d),1e-8);w=1.-smoothstep(0.,1.,t);}
 else if(uType==1){vec2 q=(p-uC)*asp;float d=length(q/max(uR,vec2(1e-4)));float f=max(uFeather,.01);w=1.-smoothstep(1.-f,1.,d);}
 else w=texture(uBrush,p).r;
 if(uInv==1)w=1.-w;o=vec4(w);}`;
/* mask accumulation with range mask */
const FS_ACC=HDR+COMMON+`
layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;layout(location=2) out vec4 o2;
uniform sampler2D uW,uSrc;uniform vec4 uAdj0,uAdj1;uniform float uSel;uniform int uRT;uniform vec3 uRV,uRC;
void main(){float w=clamp(texture(uW,vUv).r,0.,1.);
 if(uRT>0){vec3 s=texture(uSrc,vUv).rgb;float r;
  if(uRT==1){float L=luma(s);float sm=max(uRV.z,.005);r=smoothstep(uRV.x-sm,uRV.x,L)*(1.-smoothstep(uRV.y,uRV.y+sm,L));}
  else{float d=distance(s,uRC);r=1.-smoothstep(uRV.x,uRV.x+max(uRV.z,.01),d);}
  w*=r;}
 o0=uAdj0*w;o1=uAdj1*w;o2=vec4(w*uSel);}`;

const FS_DEV=HDR+`out vec4 o;
uniform sampler2D uTex,uOrig,uBlur,uMid,uLut,uL0,uL1,uL2;uniform sampler3D uLut3;
uniform mat3 uGeo;uniform vec2 uTexel;uniform vec4 uRegion;uniform float uOutAspect,uSrcAspect,uSplit;uniform int uOverlay,uBypass;
uniform float uDistort,uCA,uLensVig,uLensVigMid,uDefringe;
uniform float uTemp,uTint,uExposure,uContrast,uHighlights,uShadows,uWhites,uBlacks,uTexture,uClarity,uDehaze,uVibrance,uSaturation;
uniform vec3 uHsl[8];uniform int uBW;uniform float uBWMix[8];
uniform vec3 uGS,uGM,uGH;uniform float uBal;
uniform float uSharpen,uSharpRadius,uSharpDetail,uSharpMask,uHighPass,uLNR,uCNR;
uniform float uVig,uVigMid,uGrain,uGrainSize;
uniform int uDuo;uniform vec3 uDuoA,uDuoB;uniform float uDuoAmt;
uniform mat3 uMix;
uniform vec4 uPCt[4],uPCa[4];uniform float uPCRest;uniform int uPCn;
uniform int uLut3On;uniform float uLut3Amt,uLut3Size;
uniform sampler2D uDisp,uPort;uniform int uDispOn,uPortOn;uniform vec4 uPA,uPB;
uniform sampler2D uPort2,uSky,uSkyM,uRel,uOvF;uniform vec4 uMK;uniform vec2 uMH;uniform vec4 uFD[64];uniform int uFN;
uniform int uSkyOn,uRelOn,uAIOv,uOvFT,uOvSel;uniform vec4 uSkyT,uSkyP;uniform vec3 uSkyTint;uniform float uSkyL;uniform vec4 uRelP;uniform vec3 uRelL,uRelC;uniform vec2 uRelTx,uOvFP;
`+COMMON+`
const float CEN[8]=float[8](0.,30./360.,60./360.,120./360.,180./360.,240./360.,270./360.,300./360.);
vec3 bandAdj(float h){for(int i=0;i<8;i++){int j=(i+1)%8;float c0=CEN[i];float c1=j==0?1.:CEN[j];
  if(h>=c0&&h<c1){float t=(h-c0)/(c1-c0);t=t*t*(3.-2.*t);return mix(uHsl[i],uHsl[j],t);}}return uHsl[0];}
float bwAdj(float h){for(int i=0;i<8;i++){int j=(i+1)%8;float c0=CEN[i];float c1=j==0?1.:CEN[j];
  if(h>=c0&&h<c1){float t=(h-c0)/(c1-c0);t=t*t*(3.-2.*t);return mix(uBWMix[i],uBWMix[j],t);}}return uBWMix[0];}
vec3 gradeOff(vec3 g){vec3 col=hsl2rgb(vec3(g.x,1.,.5));vec3 off=col-luma(col);return off*g.y*.35+vec3(g.z*.2);}
float lut1(float v,int ch){vec3 s=texture(uLut,vec2(clamp(v,0.,1.)*(255./256.)+.5/256.,.5)).rgb;return ch==0?s.r:ch==1?s.g:s.b;}
vec2 lens(vec2 uv){if(uDistort==0.)return uv;vec2 q=(uv-.5)*vec2(uSrcAspect,1.);float rn=dot(q,q)/(.25*(uSrcAspect*uSrcAspect+1.));
  float k=uDistort*.45;return .5+(uv-.5)*(1.+k*rn)/max(1.,1.+k);}
vec3 samp(vec2 uv){if(uCA==0.)return texture(uTex,uv).rgb;vec2 d=uv-.5;float s=uCA*.004;
  return vec3(texture(uTex,.5+d*(1.+s)).r,texture(uTex,uv).g,texture(uTex,.5+d*(1.-s)).b);}
/* per-face table, 4 vec4 per face: A=(smooth,keep,red,bright) B=(eyes,iris,teeth,strength) M=(lip,blush,brow,dark) H=(lipH,blushH,cx,cy) */
int faceIdx(vec2 tl){int bi=-1;float bd=1e9;for(int i=0;i<16;i++){if(i>=uFN)break;vec2 d=(tl-uFD[i*4+3].zw)*vec2(uSrcAspect,1.);float dd=dot(d,d);if(dd<bd){bd=dd;bi=i;}}return bi;}
float faceWt(vec2 tl){int i=faceIdx(tl);return i<0?1.:uFD[i*4+1].w;}
vec3 aiOverlay(vec3 c,vec2 tl){vec4 acc=vec4(0.);
 if(uOvSel>0&&uPortOn==1){vec4 a=texture(uPort,tl),b=texture(uPort2,tl);float v=uOvSel==1?a.r:uOvSel==2?a.g:uOvSel==3?a.b:uOvSel==4?b.r:uOvSel==5?b.g:uOvSel==6?b.b:b.a;
  return mix(c*.7,mix(c,vec3(1.,.3,.7),.6),clamp(v,0.,1.));}
 if(uPortOn==1){float fwo=min(faceWt(tl),1.);vec4 pm=texture(uPort,tl)*fwo;vec4 p2=texture(uPort2,tl)*fwo;acc+=vec4(1.,.35,.6,1.)*pm.r*.45;acc+=vec4(.2,.95,1.,1.)*max(max(pm.g,pm.b),pm.a)*.6;
  acc+=vec4(1.,.2,1.,1.)*max(max(p2.r,p2.g),max(p2.b,p2.a))*.5*step(.001,dot(uMK,uMK));}
 if(uSkyOn==1)acc+=vec4(.25,.5,1.,1.)*texture(uSkyM,tl).r*.5;
 if(uOvFT==1)acc+=vec4(.3,1.,.3,1.)*texture(uOvF,tl).r*.45;
 if(uOvFT==2){float f=texture(uOvF,tl).r;acc+=vec4(.3,1.,.3,1.)*(1.-smoothstep(uOvFP.y,uOvFP.y+.08,abs(f-uOvFP.x)))*.45;}
 if(uDispOn==1){vec2 dd=texture(uDisp,tl).xy;acc+=vec4(1.,.85,.1,1.)*clamp(length(dd)*120.,0.,1.)*.6;}
 if(acc.a<=0.)return c;vec3 col=acc.rgb/acc.a;float a=clamp(acc.a,0.,.7);return mix(c*.75,col,a);}
void main(){
 vec2 ouv=uRegion.xy+vUv*uRegion.zw;vec3 hg=uGeo*vec3(vUv,1.);vec2 suv=hg.xy/hg.z;
 if(suv.x<-.002||suv.y<-.002||suv.x>1.002||suv.y>1.002){o=vec4(.11,.11,.11,1.);return;}
 suv=clamp(suv,0.,1.);
 if(uBypass==1||ouv.x<uSplit){vec3 oc=texture(uOrig,suv).rgb;if(uAIOv==1)oc=aiOverlay(oc,vec2(suv.x,1.-suv.y));o=vec4(oc,1.);return;}
 if(uDispOn==1){vec2 tl=vec2(suv.x,1.-suv.y);tl=clamp(tl+texture(uDisp,tl).xy,0.,1.);suv=vec2(tl.x,1.-tl.y);}
 vec2 duv=clamp(lens(suv),0.,1.);
 vec3 src=samp(duv);vec2 t=uTexel;
 if(uLensVig!=0.){float d=length((duv-.5)*2.)/1.41421;float v=smoothstep(uLensVigMid*.8,1.05,d);src*=max(0.,1.+uLensVig*v*.9);}
 if(uLNR>0.){float Lc0=luma(src);vec3 acc=src;float ws=1.;float sig=.012+uLNR*.07;
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){if(i==0&&j==0)continue;vec3 s=texture(uTex,duv+vec2(i,j)*t*1.5).rgb;float dl=luma(s)-Lc0;
   float w=exp(-dl*dl/(2.*sig*sig))*((i*j!=0)?.6:.85);acc+=s*w;ws+=w;}
  src=mix(src,acc/ws,clamp(uLNR*1.3,0.,1.));}
 vec3 midc=texture(uMid,duv).rgb;
 vec2 tl=vec2(duv.x,1.-duv.y);float skyM=0.;
 if(uPortOn==1){vec4 PA=uPA,PB=uPB,MK=uMK;vec2 MH=uMH;float fwt=1.;int fi=faceIdx(tl);
  if(fi>=0){PA=uFD[fi*4];vec4 fb=uFD[fi*4+1];PB=vec4(fb.xyz,uPB.w);fwt=fb.w;MK=uFD[fi*4+2];MH=uFD[fi*4+3].xy;}
  vec4 pm=texture(uPort,tl);pm*=min(fwt,1.5);float sk=min(pm.r,1.);
  if(sk>.01&&PA.x>0.){vec2 rr=t*PB.w;vec3 acc=vec3(0.),accL=vec3(0.);float ws=0.;float Lc0=luma(src);
   for(int i=0;i<20;i++){float fi=float(i)+.5;float a=fi*2.39996;float r=sqrt(fi/20.);vec3 s=texture(uTex,duv+vec2(cos(a),sin(a))*r*rr).rgb;
    float dl=luma(s)-Lc0;float w=exp(-dl*dl/(2.*.05*.05));acc+=s*w;ws+=w;accL+=s;}
   vec3 sm=(acc+src)/(ws+1.);vec3 lpf=(accL+src)/21.;src=mix(src,sm+(src-lpf)*PA.y,clamp(PA.x,0.,1.)*sk);}
  if(sk>.01&&PA.z>0.){vec3 hh=rgb2hsl(clamp(src,0.,1.));float rw=1.-smoothstep(.03,.09,hueDist(hh.x,.0));
   hh.y*=1.-PA.z*.45*rw*sk;hh.x=fract(hh.x+.015*rw*PA.z*sk);src=hsl2rgb(hh);}
  if(sk>.01&&PA.w!=0.)src=mix(src,1.-(1.-src)*(1.-.22*PA.w),sk);
  if(pm.g>.01&&PB.x>0.){float L=luma(src);float sat=max(src.r,max(src.g,src.b))-min(src.r,min(src.g,src.b));
   float wh=smoothstep(.3,.65,L)*(1.-smoothstep(.12,.3,sat));src=mix(src,min(vec3(1.),src*1.2+.04),PB.x*pm.g*wh);}
  if(pm.a>.01&&PB.y>0.){src+=(src-midc)*PB.y*1.6*pm.a;src=mix(src,(src-.5)*1.12+.5,PB.y*.5*pm.a);}
  if(pm.b>.01&&PB.z>0.){vec3 hh=rgb2hsl(clamp(src,0.,1.));float yel=1.-smoothstep(.04,.1,hueDist(hh.x,.13));float br=smoothstep(.22,.5,hh.z);
   float w=PB.z*pm.b*br;hh.y*=1.-w*(.75*yel+.25);hh.z=min(1.,hh.z+.07*w);src=hsl2rgb(hh);}
  vec4 p2=texture(uPort2,tl)*min(fwt,1.5);
  if(p2.r>.01&&MK.x>0.){vec3 hh=rgb2hsl(clamp(src,0.,1.));vec3 tg=hsl2rgb(vec3(MH.x,clamp(hh.y*.4+.5,0.,1.),clamp(hh.z*.92,0.,1.)));src=mix(src,tg,clamp(MK.x*p2.r*.75,0.,1.));}
  if(p2.g>.01&&MK.y>0.){vec3 bc=hsl2rgb(vec3(MH.y,.7,.62));src=mix(src,src*mix(vec3(1.),bc*1.35,.55),clamp(MK.y*p2.g*.65,0.,1.));}
  if(p2.b>.01&&MK.z!=0.){float k=MK.z*p2.b;src=k>0.?mix(src,src*src*.9,clamp(k*.75,0.,1.)):mix(src,1.-(1.-src)*.8,clamp(-k*.6,0.,1.));}
  if(p2.a>.01&&MK.w>0.){float k=clamp(MK.w*p2.a,0.,1.);vec3 hh=rgb2hsl(clamp(src,0.,1.));float lm=luma(midc);
   float pur=1.-smoothstep(.05,.2,min(hueDist(hh.x,.78),hueDist(hh.x,.62)));hh.y*=1.-k*(.25+.45*pur);hh.z=mix(hh.z,hh.z+(1.-hh.z)*.2,k);src=hsl2rgb(hh);}}
 if(uSkyOn==1){float m=texture(uSkyM,tl).r;float Ls=luma(src);float edge=1.-abs(2.*m-1.);
  m*=mix(1.,smoothstep(uSkyL*.5,uSkyL*.85,Ls),edge*uSkyP.w);m=clamp(m*uSkyP.x,0.,1.);skyM=m;
  vec3 sc=texture(uSky,tl*uSkyT.xy+uSkyT.zw).rgb*uSkyP.z;src=mix(src,src*uSkyTint,(1.-m)*uSkyP.y*.6);src=mix(src,sc,m);}
 if(uCNR>0.){float l=luma(src);src=l+mix(src-l,midc-luma(midc),uCNR);}
 float Lo=luma(src),Lb=luma(texture(uBlur,duv).rgb),Lm=luma(midc);
 if(skyM>0.){Lb=mix(Lb,Lo,skyM);Lm=mix(Lm,Lo,skyM);}
 vec2 sr=t*uSharpRadius;
 float lx1=luma(texture(uTex,duv+vec2(sr.x,0.)).rgb),lx2=luma(texture(uTex,duv-vec2(sr.x,0.)).rgb),ly1=luma(texture(uTex,duv+vec2(0.,sr.y)).rgb),ly2=luma(texture(uTex,duv-vec2(0.,sr.y)).rgb);
 float Ln=(lx1+lx2+ly1+ly2)*.25;
 if(skyM>0.){Ln=mix(Ln,Lo,skyM);lx1=mix(lx1,Lo,skyM);lx2=mix(lx2,Lo,skyM);ly1=mix(ly1,Lo,skyM);ly2=mix(ly2,Lo,skyM);}
 vec4 L0=texture(uL0,suv),L1=texture(uL1,suv);
 float ov=uOverlay==1?clamp(texture(uL2,suv).r,0.,1.):0.;
 float exposure=uExposure+L0.x,contrast=clamp(uContrast+L0.y,-1.,1.),highlights=clamp(uHighlights+L0.z,-1.5,1.5),shadows=clamp(uShadows+L0.w,-1.5,1.5);
 float temp=clamp(uTemp+L1.x,-1.5,1.5),tint=clamp(uTint+L1.y,-1.5,1.5),clarity=clamp(uClarity+L1.z,-1.5,1.5),saturation=max(uSaturation+L1.w,-1.);
 vec3 lin=pow(max(src,0.),vec3(2.2));
 vec3 g=vec3(1.+.35*temp+.08*tint,1.-.25*tint,1.-.35*temp+.08*tint);g=max(g,vec3(.05));g/=luma(g);
 lin*=g*exp2(exposure);
 if(uRelOn==1){float d=texture(uRel,tl).r;vec2 e=uRelTx*3.;
  float dx=texture(uRel,tl+vec2(e.x,0.)).r-texture(uRel,tl-vec2(e.x,0.)).r,dy=texture(uRel,tl+vec2(0.,e.y)).r-texture(uRel,tl-vec2(0.,e.y)).r;
  vec3 n=normalize(vec3(-dx*uRelP.w,-dy*uRelP.w,1.));float df=max(dot(n,uRelL),0.);float lf=df*mix(.3,1.,d);
  float fac=1.+uRelP.x*(lf-.45)*1.3-uRelP.y*(1.-d)*.6;lin*=max(fac,.05)*mix(vec3(1.),uRelC,clamp(uRelP.x*lf*uRelP.z,0.,1.));}
 vec3 c=pow(max(lin,0.),vec3(1./2.2));
 float L=luma(c),Lc=clamp(L,0.,1.),nl=L;
 nl+=shadows*1.6*Lc*(1.-Lc)*(1.-Lc);
 nl+=highlights*1.6*Lc*Lc*(1.-Lc);
 if(highlights<0.)nl+=highlights*.6*max(L-.75,0.);
 nl+=uWhites*.25*smoothstep(.35,1.,Lc);
 nl+=uBlacks*.18*(1.-smoothstep(0.,.45,Lc));
 float k=smoothstep(0.,.08,L);
 c=mix(c+(nl-L),c*(nl/max(L,1e-4)),k);
 if(contrast>0.){vec3 cc=clamp(c,0.,1.);c=mix(c,cc*cc*(3.-2.*cc),contrast);c=mix(c,(c-.5)*1.15+.5,contrast*.5);}
 else c=mix(c,vec3(.5)+(c-.5)*.45,-contrast);
 Lc=clamp(luma(c),0.,1.);
 float mid=1.-pow(abs(Lc*2.-1.),2.);
 c+=(Lo-Lm)*uTexture*1.8*mid;
 c+=(Lo-Lb)*clarity*1.4*mid;
 if(uDehaze>0.){float a=uDehaze*.15;c=(c-a)/(1.-a);c=mix(vec3(luma(c)),c,1.+uDehaze*.3);}
 else c=mix(c,vec3(.82),-uDehaze*.45);
 c=uMix*c;
 c=clamp(c,0.,1.);
 c=vec3(lut1(c.r,0),lut1(c.g,1),lut1(c.b,2));
 vec3 h=rgb2hsl(c);vec3 adj=bandAdj(h.x);float w=smoothstep(0.,.15,h.y);
 h.x=fract(h.x+adj.x*(30./360.)*w);h.y=clamp(h.y*(1.+adj.y*w),0.,1.);h.z=clamp(h.z+adj.z*.2*w,0.,1.);
 c=hsl2rgb(h);
 float L2=luma(c);float sat=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
 c=mix(vec3(L2),c,1.+uVibrance*(1.-sat)*(uVibrance>0.?1.3:1.));
 c=mix(vec3(L2),c,1.+saturation);
 if(uPCn>0){c=clamp(c,0.,1.);vec3 hh=rgb2hsl(c);float keep=0.;
  for(int i=0;i<4;i++){if(i>=uPCn)break;vec4 tg=uPCt[i],ad=uPCa[i];float rng=tg.w;
   float wH=1.-smoothstep(rng*.5,rng,hueDist(hh.x,tg.x));
   float wS=smoothstep(.02,.1,hh.y)*(1.-smoothstep(rng*2.,rng*2.+.35,abs(hh.y-tg.y)));
   float wL=1.-smoothstep(rng*2.,rng*2.+.35,abs(hh.z-tg.z));
   float pw=wH*wS*wL;keep=max(keep,pw);
   hh.x=fract(hh.x+ad.x*pw*(60./360.));hh.y=clamp(hh.y*(1.+ad.y*pw),0.,1.);hh.z=clamp(hh.z+ad.z*.25*pw,0.,1.);}
  c=hsl2rgb(hh);if(uPCRest!=0.){float l=luma(c);c=mix(vec3(l),c,max(0.,1.+uPCRest*(1.-keep)));}}
 if(uBW==1){c=clamp(c,0.,1.);vec3 hh=rgb2hsl(c);float gg=clamp(luma(c)+bwAdj(hh.x)*.4*smoothstep(0.,.25,hh.y),0.,1.);c=vec3(gg);}
 float bal=uBal*.3;L2=luma(c);
 float ms=1.-smoothstep(.05,.55+bal,L2),mh=smoothstep(.45+bal,.95,L2),mm=clamp(1.-ms-mh,0.,1.);
 c+=gradeOff(uGS)*ms+gradeOff(uGM)*mm+gradeOff(uGH)*mh;
 if(uDuo==1){float gg=clamp(luma(c),0.,1.);vec3 dc=gg<.45?mix(uDuoA*.12,uDuoA,gg/.45):gg<.8?mix(uDuoA,uDuoB,(gg-.45)/.35):mix(uDuoB,mix(uDuoB,vec3(1.),.7),(gg-.8)/.2);
  c=mix(c,dc,uDuoAmt);}
 if(uLut3On==1){vec3 cc=clamp(c,0.,1.);vec3 lc=texture(uLut3,cc*((uLut3Size-1.)/uLut3Size)+.5/uLut3Size).rgb;c=mix(c,lc,uLut3Amt);}
 float dd=Lo-Ln;float lim=mix(.03,.4,uSharpDetail);dd=clamp(dd,-lim,lim);
 float grad=abs(lx1-lx2)+abs(ly1-ly2);float mk=uSharpMask>0.?smoothstep(uSharpMask*.12,uSharpMask*.12+.05,grad):1.;
 c+=dd*uSharpen*2.5*mk;
 if(uHighPass>0.)c=mix(c,overlayB(clamp(c,0.,1.),vec3(clamp(.5+(Lo-Lm)*4.,0.,1.))),uHighPass);
 if(uDefringe>0.){vec3 hh=rgb2hsl(clamp(c,0.,1.));float pw=1.-smoothstep(.04,.1,hueDist(hh.x,.8));float gw=1.-smoothstep(.04,.1,hueDist(hh.x,.36));
  float edge=smoothstep(.03,.12,abs(Lo-Lm)+grad);float dw=max(pw,gw*.6)*edge*uDefringe*smoothstep(.08,.25,hh.y);c=mix(c,vec3(luma(c)),dw);}
 float d=length((ouv-.5)*2.)/1.41421;float v=smoothstep(uVigMid*.85,uVigMid*.85+.6,d);
 if(uVig<0.)c*=1.+uVig*v;else c=mix(c,vec3(1.),uVig*v);
 if(uGrain>0.){vec2 sc=vec2(uOutAspect,1.)*mix(1600.,280.,uGrainSize);
  float n=(vnoise(ouv*sc)+.5*vnoise(ouv*sc*2.07+13.1))/1.5-.5;c+=n*uGrain*.22*(1.-.5*abs(luma(c)*2.-1.));}
 c=clamp(c,0.,1.);c=mix(c,vec3(1.,.18,.18),ov*.55);if(uAIOv==1)c=aiOverlay(c,tl);o=vec4(c,1.);}`;

const FS_FX=HDR+COMMON+`out vec4 o;
uniform sampler2D uBase,uBA,uBB,uFocus;uniform mat3 uGeo;uniform vec4 uRegion;uniform vec2 uRad,uTC;
uniform float uSplit,uOutAspect,uOrton,uGlow,uGlowT,uHal,uBlurAmt,uTAng,uTW,uTF,uBoost,uFSharp,uFDepth,uDof;
uniform int uTilt,uShape,uFocusType,uFocusFlip;
float blurAt(vec2 v){vec2 ou=uRegion.xy+v*uRegion.zw;vec2 p=vec2(ou.x,1.-ou.y);vec2 q=(p-uTC)*vec2(uOutAspect,1.);
 if(uTilt==1){vec2 n=vec2(-sin(uTAng),cos(uTAng));return smoothstep(uTW,uTW+uTF+.001,abs(dot(q,n)));}
 if(uTilt==2)return smoothstep(uTW,uTW+uTF+.001,length(q));
 vec3 h=uGeo*vec3(v,1.);vec2 s=clamp(h.xy/h.z,0.,1.);float f=texture(uFocus,uFocusFlip==1?vec2(s.x,1.-s.y):s).r;
 if(uFocusType==1)return smoothstep(uDof,uDof+uTF+.001,abs(f-uFDepth));
 return 1.-smoothstep(.1,.9,f);}
vec3 bokeh(vec2 uv,float r){if(r<.003)return texture(uBase,uv).rgb;vec3 acc=texture(uBase,uv).rgb;float ws=1.;
 for(int i=0;i<64;i++){float fi=float(i)+.5;float rr=sqrt(fi/64.);float a=fi*2.39996;vec2 d=vec2(cos(a),sin(a))*rr;
  if(uShape==1){float ang=mod(a,1.0472)-.5236;d*=.866/cos(ang);}
  vec2 su=uv+d*uRad*r;vec3 c=texture(uBase,su).rgb;float sb=blurAt(su)*uBlurAmt;
  float cov=smoothstep(rr*r-.08,rr*r,sb+.02);float hl=max(max(c.r,c.g),c.b);float w=(1.+uBoost*8.*pow(hl,6.))*max(cov,.02);
  acc+=c*w;ws+=w;}
 return acc/ws;}
void main(){vec2 ouv=uRegion.xy+vUv*uRegion.zw;vec3 c=texture(uBase,vUv).rgb;if(ouv.x<uSplit){o=vec4(c,1.);return;}
 vec3 a=texture(uBA,vUv).rgb,b=texture(uBB,vUv).rgb;
 if(uTilt>0&&uBlurAmt>0.){float bw=blurAt(vUv);c=bokeh(vUv,bw*uBlurAmt);if(uFSharp>0.)c+=(c-a)*uFSharp*(1.-bw);}
 if(uOrton>0.){vec3 bb=mix(a,b,.4);vec3 sc=1.-(1.-c)*(1.-bb);vec3 mu=sc*mix(vec3(1.),min(bb*1.4,vec3(1.)),.5);c=mix(c,mu,uOrton);}
 if(uGlow>0.){vec3 br=max(mix(a,b,.5)-uGlowT,0.)/(1.-uGlowT+.001);c+=br*uGlow*1.2;}
 if(uHal>0.){float hl=max(luma(a)-.62,0.)*2.6;c+=hl*vec3(1.,.32,.12)*uHal*.7;}
 o=vec4(clamp(c,0.,1.),1.);}`;

const FS_LAYER=HDR+COMMON+`out vec4 o;
uniform sampler2D uBase,uTex;uniform vec4 uRegion;uniform int uType,uBlend,uMType,uMInv,uAdjInv;uniform mat3 uXf;uniform float uOp,uSplit,uOutAspect,uMF;
uniform vec3 uColor;uniform vec4 uMP,uAdj;
vec3 blendMode(vec3 b,vec3 s,int m){
 if(m==1)return b*s;if(m==2)return 1.-(1.-b)*(1.-s);if(m==3)return overlayB(b,s);
 if(m==4)return mix(2.*b*s+b*b*(1.-2.*s),sqrt(b)*(2.*s-1.)+2.*b*(1.-s),step(.5,s));
 if(m==5)return overlayB(s,b);if(m==6)return min(b,s);if(m==7)return max(b,s);
 if(m==8)return min(vec3(1.),b/(1.-s+1e-4));if(m==9)return 1.-min(vec3(1.),(1.-b)/(s+1e-4));
 if(m==10)return abs(b-s);
 if(m>=11){vec3 hb=rgb2hsl(b),hs=rgb2hsl(s);
  if(m==11)return hsl2rgb(vec3(hs.x,hb.y,hb.z));if(m==12)return hsl2rgb(vec3(hb.x,hs.y,hb.z));
  if(m==13){vec3 r=hsl2rgb(vec3(hs.x,hs.y,hb.z));return r+(luma(b)-luma(r));}
  vec3 r=b+(luma(s)-luma(b));return r;}
 return s;}
void main(){vec2 ouv=uRegion.xy+vUv*uRegion.zw;vec3 b=texture(uBase,vUv).rgb;if(ouv.x<uSplit){o=vec4(b,1.);return;}
 vec4 s;
 if(uType<=1){vec3 lu=uXf*vec3(vUv,1.);vec2 q=lu.xy;if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)s=vec4(0.);else s=texture(uTex,q);}
 else if(uType==2)s=vec4(uColor,1.);
 else{vec3 a=b*exp2(uAdj.x);a=(a-.5)*(1.+uAdj.y)+.5;a=mix(vec3(luma(a)),a,1.+uAdj.z);vec3 hh=rgb2hsl(clamp(a,0.,1.));hh.x=fract(hh.x+uAdj.w);a=hsl2rgb(hh);
  if(uAdjInv==1)a=1.-a;s=vec4(clamp(a,0.,1.),1.);}
 float m=1.;vec2 p=vec2(ouv.x,1.-ouv.y);vec2 asp=vec2(uOutAspect,1.);
 if(uMType==1){vec2 dir=vec2(cos(uMP.z),sin(uMP.z));float d=dot((p-uMP.xy)*asp,dir);m=smoothstep(-uMP.w-.001,uMP.w+.001,d);}
 else if(uMType==2){float d=length((p-uMP.xy)*asp)/max(uMP.z,.001);m=1.-smoothstep(1.-uMF,1.,d);}
 if(uMType>0&&uMInv==1)m=1.-m;
 vec3 r=blendMode(clamp(b,0.,1.),clamp(s.rgb,0.,1.),uBlend);float al=s.a*uOp*m;o=vec4(mix(b,r,al),1.);}`;

const FS_PRESENT=HDR+`out vec4 o;uniform sampler2D uTex;uniform vec2 uTexel;uniform int uClip;uniform float uOS;
void main(){vec3 c=texture(uTex,vUv).rgb;
 if(uOS>0.){vec3 n=(texture(uTex,vUv+vec2(uTexel.x,0.)).rgb+texture(uTex,vUv-vec2(uTexel.x,0.)).rgb+texture(uTex,vUv+vec2(0.,uTexel.y)).rgb+texture(uTex,vUv-vec2(0.,uTexel.y)).rgb)*.25;
  c=clamp(c+(c-n)*uOS,0.,1.);}
 if(uClip==1){if(max(c.r,max(c.g,c.b))>=.996)c=vec3(1.,.1,.1);else if(max(c.r,max(c.g,c.b))<=.006)c=vec3(.15,.35,1.);}
 o=vec4(c,1.);}`;

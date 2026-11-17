"use strict";
/* 3x3 matrices, row-major: [m00,m01,m02,m10,m11,m12,m20,m21,m22]; points use homogeneous divide */
const M3={
  I:()=>[1,0,0,0,1,0,0,0,1],
  mul:(a,b)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return r;},
  chain:(...ms)=>ms.reduce((acc,m)=>M3.mul(acc,m)),
  inv:m=>{const [a,b,c,d,e,f,g,h,i]=m;const A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;
    return[A/det,-(b*i-c*h)/det,(b*f-c*e)/det,B/det,(a*i-c*g)/det,-(a*f-c*d)/det,C/det,-(a*h-b*g)/det,(a*e-b*d)/det];},
  ap:(m,p)=>{const w=m[6]*p[0]+m[7]*p[1]+m[8];return[(m[0]*p[0]+m[1]*p[1]+m[2])/w,(m[3]*p[0]+m[4]*p[1]+m[5])/w];},
  T:(x,y)=>[1,0,x,0,1,y,0,0,1],
  S:(x,y)=>[x,0,0,0,y===undefined?x:y,0,0,0,1],
  R:t=>{const c=Math.cos(t),s=Math.sin(t);return[c,-s,0,s,c,0,0,0,1];},
  col:m=>[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]],
};
const PERSP_K=0.004;
/* straighten + perspective in the oriented frame (W x H px) */
function sqMatrix(W,H,g){
  const N=M3.mul(M3.S(2/W,2/H),M3.T(-W/2,-H/2)),Ni=M3.inv(N);
  const sc=(g.pscale||100)/100;
  const P=[1,0,0,0,1,0,(g.ph||0)*PERSP_K,(g.pv||0)*PERSP_K,1];
  const Q=M3.chain(Ni,M3.S(sc,sc),P,N);
  const th=g.angle*Math.PI/180;
  const St=M3.chain(M3.T(W/2,H/2),M3.R(th),M3.T(-W/2,-H/2));
  return M3.mul(St,Q);
}
function cropValid(cr,SQi,W,H){const e=1e-4;if(cr.x<-e||cr.y<-e||cr.x+cr.w>1+e||cr.y+cr.h>1+e||cr.w<=0||cr.h<=0)return false;
  for(const [u,v] of [[cr.x,cr.y],[cr.x+cr.w,cr.y],[cr.x,cr.y+cr.h],[cr.x+cr.w,cr.y+cr.h]]){
    const q=M3.ap(SQi,[u*W,v*H]);if(!(q[0]>=-.5&&q[1]>=-.5&&q[0]<=W+.5&&q[1]<=H+.5))return false;}return true;}
function fitCrop(cr,SQi,W,H){let x=Math.max(0,cr.x),y=Math.max(0,cr.y),w=Math.min(cr.w,1-x),h=Math.min(cr.h,1-y);const r={x,y,w,h};
  if(cropValid(r,SQi,W,H))return r;const mx=x+w/2,my=y+h/2;
  const cand=t=>{const ww=w*(1-t),hh=h*(1-t),cx=mx+(.5-mx)*t,cy=my+(.5-my)*t;return{x:cx-ww/2,y:cy-hh/2,w:ww,h:hh};};
  let lo=0,hi=1;for(let i=0;i<26;i++){const m=(lo+hi)/2;if(cropValid(cand(m),SQi,W,H))hi=m;else lo=m;}return cand(hi);}
function orientMatrix(w,h,g){let M=M3.I(),cw=w,ch=h;
  for(let i=0;i<g.rot;i++){M=M3.mul([0,-1,ch,1,0,0,0,0,1],M);[cw,ch]=[ch,cw];}
  if(g.fh)M=M3.mul([-1,0,cw,0,1,0,0,0,1],M);
  if(g.fv)M=M3.mul([1,0,0,0,-1,ch,0,0,1],M);
  return{M,W:cw,H:ch};}
/* source px -> output px */
function geoMats(w,h,g,full){
  const o=orientMatrix(w,h,g),W=o.W,H=o.H;
  const SQ=sqMatrix(W,H,g),SQi=M3.inv(SQ);
  let M=M3.mul(SQ,o.M);
  const eff=fitCrop(g.crop,SQi,W,H),cr=full?{x:0,y:0,w:1,h:1}:eff;
  M=M3.mul(M3.T(-cr.x*W,-cr.y*H),M);
  return{F:M,T:M3.inv(M),outW:Math.max(1,Math.round(cr.w*W)),outH:Math.max(1,Math.round(cr.h*H)),W,H,eff,SQ,SQi,O:o.M};
}

"use strict";
/* ================= Face finding: full image + YuNet (small / side faces) + crops, tap-to-add, profile handling ================= */
AI_MODELS.yunet={name:'얼굴 찾기',size:'약 0.3MB',url:'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'};
const FACE_HI=2048,FACE_MAX=20;
const iou=(a,b)=>{const x0=Math.max(a[0],b[0]),y0=Math.max(a[1],b[1]),x1=Math.min(a[2],b[2]),y1=Math.min(a[3],b[3]);const i=Math.max(0,x1-x0)*Math.max(0,y1-y0);
  const u=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-i;return u>0?i/u:0;};
const covers=(a,b)=>{const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;return cx>a[0]&&cx<a[2]&&cy>a[1]&&cy<a[3];};
/* landmarks (normalized to the full image) -> face record; aspect = full image W/H */
function mkFace(pts,bs,aspect){const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);const box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  const l=pts[234],r=pts[454],n=pts[1];const w=Math.hypot(r[0]-l[0],(r[1]-l[1])/aspect);
  const dx=(r[0]-l[0])*aspect,yaw=Math.abs(dx)>1e-6?((n[0]-l[0])*aspect)/dx:.5;
  return{lm:pts,box,bs:bs||{},w,yaw:+yaw.toFixed(3),profile:yaw<.2||yaw>.8};}
function lmRun(m,c){const r=m.detect(c);return(r.faceLandmarks||[]).map((lm,i)=>{const bs={};((r.faceBlendshapes||[])[i]?.categories||[]).forEach(cg=>bs[cg.categoryName]=cg.score);
  return{pts:lm.map(q=>[q.x,q.y]),bs};});}
/* run the landmarker on a crop (b = normalized box) of the hi-res canvas, scaled so the crop is ~cs px; returns faces in full-image coords */
function lmInCrop(m,hi,b,cs=512){const W=hi.width,H=hi.height;let sx=Math.max(0,b[0]*W),sy=Math.max(0,b[1]*H),ex=Math.min(W,b[2]*W),ey=Math.min(H,b[3]*H);
  const sw=ex-sx,sh=ey-sy;if(sw<8||sh<8)return[];const k=cs/Math.max(sw,sh);const c=document.createElement('canvas');c.width=Math.max(16,Math.round(sw*k));c.height=Math.max(16,Math.round(sh*k));
  const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(hi,sx,sy,sw,sh,0,0,c.width,c.height);
  return lmRun(m,c).map(f=>mkFace(f.pts.map(q=>[(sx+q[0]*sw)/W,(sy+q[1]*sh)/H]),f.bs,W/H));}
/* YuNet (OpenCV, MIT): fixed 640x640 input, BGR 0-255 planar, 12 outputs cls/obj/bbox/kps × stride 8/16/32 */
function yunetInput(src,sx,sy,sw,sh){const S=640,k=S/Math.max(sw,sh),c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#000';x.fillRect(0,0,S,S);x.drawImage(src,sx,sy,sw,sh,0,0,Math.round(sw*k),Math.round(sh*k));const d=x.getImageData(0,0,S,S).data;const t=new Float32Array(3*S*S),P=S*S;
  for(let i=0;i<P;i++){t[i]=d[i*4+2];t[P+i]=d[i*4+1];t[2*P+i]=d[i*4];}return{t,k};}
function yunetDecode(out,k,sx,sy,W,H,thr){const S=640,res=[];[8,16,32].forEach(st=>{const cls=out['cls_'+st],obj=out['obj_'+st],bb=out['bbox_'+st];if(!cls||!obj||!bb)throw new Error('YuNet 출력 형식이 달라요');
    const cols=S/st,rows=S/st,C=cls.data,O=obj.data,B=bb.data;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=r*cols+c;const sc=Math.sqrt(Math.min(1,Math.max(0,C[i]))*Math.min(1,Math.max(0,O[i])));if(sc<thr)continue;
      const cx=(c+B[i*4])*st,cy=(r+B[i*4+1])*st,w=Math.exp(B[i*4+2])*st,h=Math.exp(B[i*4+3])*st;
      res.push({s:sc,b:[(sx+(cx-w/2)/k)/W,(sy+(cy-h/2)/k)/H,(sx+(cx+w/2)/k)/W,(sy+(cy+h/2)/k)/H]});}});return res;}
function nms(list,t=.3){list.sort((a,b)=>b.s-a.s);const keep=[];for(const d of list)if(!keep.some(q=>iou(q.b,d.b)>t))keep.push(d);return keep;}
async function yunetFaces(hi){const ses=await getModel('yunet'),ort=AI.ort;const W=hi.width,H=hi.height;const regions=[[0,0,W,H]];
  if(Math.max(W,H)>900){const tw=W*.6,th=H*.6;for(const fx of[0,.4])for(const fy of[0,.4])regions.push([W*fx,H*fy,tw,th]);}
  let all=[];for(const [sx,sy,sw,sh] of regions){const {t,k}=yunetInput(hi,sx,sy,sw,sh);const feeds={[ses.inputNames[0]]:new ort.Tensor('float32',t,[1,3,640,640])};
    const out=await ses.run(feeds);all=all.concat(yunetDecode(out,k,sx,sy,W,H,.6));}
  return nms(all).slice(0,40).map(d=>d.b);}
function tileBoxes(){const b=[];for(const n of[2,3]){const s=1/n*1.5;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=i/n-(s-1/n)/2,y=j/n-(s-1/n)/2;b.push([x,y,x+s,y+s]);}}return b;}
async function aiFaces(ph){if(ph._faces)return ph._faces;const m=await getModel('face');const full=aiCanvas(ph,1024),hi=aiCanvas(ph,FACE_HI);
  const faces=lmRun(m,full).map(f=>mkFace(f.pts,f.bs,full.width/full.height));
  const add=f=>{if(faces.length<FACE_MAX&&!faces.some(g=>iou(g.box,f.box)>.3||covers(g.box,f.box)))faces.push(f);};
  let boxes=null;try{boxes=await yunetFaces(hi);}catch(e){console.warn('YuNet',e);}
  if(boxes){for(const b of boxes){if(faces.length>=FACE_MAX)break;if(faces.some(g=>covers(g.box,b)||iou(g.box,b)>.3))continue;
      const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,s=Math.max(b[2]-b[0],(b[3]-b[1])*hi.height/hi.width)*1.1;const sy=s*hi.width/hi.height;
      const got=lmInCrop(m,hi,[cx-s,cy-sy,cx+s,cy+sy],384);const f=got.find(q=>covers(q.box,b))||got[0];if(f)add(f);}}
  else for(const b of tileBoxes()){if(faces.length>=FACE_MAX)break;lmInCrop(m,hi,b,768).forEach(add);}
  ph._faces=faces;return faces;}
/* tap a face the automatic search missed */
async function addFaceAt(uv){const ph=cur;let none=false;const f=await aiRun(async()=>{busy(true,'AI가 그 위치의 얼굴을 찾는 중…');await nextFrame();
    const m=await getModel('face');const hi=aiCanvas(ph,FACE_HI);const ar=hi.width/hi.height;
    for(const s of[.08,.14,.24,.38]){const sx=s/Math.max(1,ar),sy=s*Math.min(1,ar);const box=[uv[0]-sx,uv[1]-sy,uv[0]+sx,uv[1]+sy];
      const hit=lmInCrop(m,hi,box,512).find(q=>uv[0]>q.box[0]&&uv[0]<q.box[2]&&uv[1]>q.box[1]&&uv[1]<q.box[3]);if(hit){busy(false);return hit;}}
    busy(false);none=true;return null;});
  if(cur!==ph)return;if(!f){if(none)toast('그 위치에서 얼굴을 찾지 못했어요. 얼굴 한가운데(코 근처)를 눌러 보세요');return;}
  const faces=await aiFaces(ph);if(faces.some(g=>iou(g.box,f.box)>.3)){toast('이미 찾은 얼굴이에요');return;}
  const keep=(P().portrait.fw||[]).slice(),keepPf=clone(P().portrait.pf||[]);faces.push(f);await analyzePortrait({quiet:true});
  if(cur===ph){P().portrait.fw=faces.map((_,i)=>keep[i]??100);P().portrait.pf=keepPf;syncUI();requestRender();toast(`얼굴을 추가했어요 (모두 ${faces.length}명)`+(f.profile?' · 옆모습이라 피부 보정만 적용돼요':''));}}

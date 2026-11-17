"use strict";
/* ---------- RAW embedded preview ---------- */
const RAW_RE=/\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|rwl|pef|srw|3fr|erf|kdc|dcr|mrw|mos|iiq|x3f)$/i;
function parseJpeg(b,s){const N=b.length;let p=s+2,w=0,h=0,sof=0;
  while(p<N-1){if(b[p]!==0xFF)return null;let m=b[p+1];while(m===0xFF&&p<N-2){p++;m=b[p+1];}p+=2;
    if(m===0xD9)return(sof===0xC0||sof===0xC1||sof===0xC2)&&w>0&&h>0?{s,e:p,w,h,area:w*h}:null;
    if(m===0x01||(m>=0xD0&&m<=0xD7))continue;
    if(p+1>=N)return null;const L=(b[p]<<8)|b[p+1];if(L<2)return null;
    if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){sof=m;h=(b[p+3]<<8)|b[p+4];w=(b[p+5]<<8)|b[p+6];}
    p+=L;
    if(m===0xDA){while(p<N-1){if(b[p]===0xFF){const n=b[p+1];if(n===0x00||(n>=0xD0&&n<=0xD7)){p+=2;continue;}if(n===0xFF){p++;continue;}break;}p++;}}
  }return null;}
function findTiffs(b,limit,max){const out=[];const lim=Math.min(b.length-8,limit);
  for(let i=0;i<lim&&out.length<max;i++){const le=b[i]===0x49&&b[i+1]===0x49&&(b[i+2]===0x2A||b[i+2]===0x55||b[i+2]===0x52)&&b[i+3]===0;
    const be=b[i]===0x4D&&b[i+1]===0x4D&&b[i+2]===0&&b[i+3]===0x2A;if(le||be)out.push(i);}return out;}
function readTiff(b,t){const le=b[t]===0x49;const N=b.length;
  const r16=o=>o+1<N?(le?b[o]|(b[o+1]<<8):(b[o]<<8)|b[o+1]):0;
  const r32=o=>o+3<N?(le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16))+b[o+3]*16777216:b[o]*16777216+((b[o+1]<<16)|(b[o+2]<<8)|b[o+3])):0;
  const out={};
  const val=(e)=>{const type=r16(e+2),cnt=r32(e+4);const sz={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8}[type]||1;const off=cnt*sz>4?t+r32(e+8):e+8;
    if(type===2){let s='';for(let i=0;i<cnt&&off+i<N;i++){const c=b[off+i];if(!c)break;s+=String.fromCharCode(c);}return s.trim();}
    if(type===3)return r16(off);if(type===4)return r32(off);
    if(type===5||type===10){const n=r32(off),d=r32(off+4);return d?n/d:0;}return null;};
  const walk=(ifd,depth)=>{if(ifd<=t||ifd+2>N||depth>2)return;const n=r16(ifd);if(n>600)return;
    for(let k=0;k<n;k++){const e=ifd+2+k*12;if(e+12>N)break;const tag=r16(e);
      const map={0x010F:'make',0x0110:'model',0x0112:'orient',0x829A:'exp',0x829D:'fnum',0x8827:'iso',0x920A:'focal',0x9003:'date',0xA434:'lens',0x0132:'date2'};
      if(map[tag]&&out[map[tag]]===undefined){const v=val(e);if(v!==null&&v!=='')out[map[tag]]=v;}
      if(tag===0x8769)walk(t+r32(e+8),depth+1);}};
  walk(t+r32(t+4),0);return out;}
function exifFrom(b){let ex={};
  if(b[0]===0xFF&&b[1]===0xD8){let p=2;while(p<b.length-4){if(b[p]!==0xFF)break;const m=b[p+1],L=(b[p+2]<<8)|b[p+3];
      if(m===0xE1&&b[p+4]===0x45&&b[p+5]===0x78&&b[p+6]===0x69&&b[p+7]===0x66){ex=readTiff(b,p+10);break;}if(m===0xDA)break;p+=2+L;}}
  else for(const t of findTiffs(b,1<<21,4)){const r=readTiff(b,t);for(const k in r)if(ex[k]===undefined)ex[k]=r[k];}
  return ex;}
function exifText(e){if(!e)return'';const parts=[];let cam=[e.make,e.model].filter(Boolean);
  if(cam.length===2&&cam[1].toLowerCase().startsWith(cam[0].toLowerCase().split(' ')[0]))cam=[cam[1]];
  if(cam.length)parts.push(cam.join(' '));if(e.lens)parts.push(e.lens);
  const s=[];if(e.exp)s.push(e.exp>=1?`${+e.exp.toFixed(1)}s`:`1/${Math.round(1/e.exp)}s`);if(e.fnum)s.push(`f/${+e.fnum.toFixed(1)}`);
  if(e.iso)s.push(`ISO ${e.iso}`);if(e.focal)s.push(`${Math.round(e.focal)}mm`);if(s.length)parts.push(s.join(' · '));
  const d=e.date||e.date2;if(d)parts.push(d.replace(/^(\d{4}):(\d\d):(\d\d)/,'$1.$2.$3'));return parts.join('\n');}
async function rawPreview(b){let best=null;
  for(let i=0;i<b.length-3;i++){if(b[i]===0xFF&&b[i+1]===0xD8&&b[i+2]===0xFF){const r=parseJpeg(b,i);if(r){if(!best||r.area>best.area)best=r;i=r.e-1;}}}
  if(!best)throw new Error('이 RAW 파일에서 미리보기 이미지를 찾지 못했어요');
  const bm=await createImageBitmap(new Blob([b.subarray(best.s,best.e)],{type:'image/jpeg'}),{imageOrientation:'none'});
  let o=1;for(const t of findTiffs(b,1<<20,3)){const r=readTiff(b,t);if(r.orient){o=r.orient;break;}}
  const W=bm.width,H=bm.height,sw=o>=5;const c=document.createElement('canvas');c.width=sw?H:W;c.height=sw?W:H;const x=c.getContext('2d');
  switch(o){case 2:x.setTransform(-1,0,0,1,W,0);break;case 3:x.setTransform(-1,0,0,-1,W,H);break;case 4:x.setTransform(1,0,0,-1,0,H);break;
    case 5:x.setTransform(0,1,1,0,0,0);break;case 6:x.setTransform(0,1,-1,0,H,0);break;case 7:x.setTransform(0,-1,-1,0,H,W);break;case 8:x.setTransform(0,-1,1,0,0,W);break;}
  x.drawImage(bm,0,0);bm.close&&bm.close();return c;}

/* ---------- .cube LUT ---------- */
function parseCube(text){let size=0;const data=[];let dmin=[0,0,0],dmax=[1,1,1];
  for(const raw of text.split(/\r?\n/)){const l=raw.trim();if(!l||l[0]==='#')continue;
    if(/^LUT_3D_SIZE/i.test(l)){size=parseInt(l.split(/\s+/)[1]);continue;}
    if(/^LUT_1D_SIZE/i.test(l))throw new Error('1D LUT은 지원하지 않아요 (3D .cube만 가능)');
    if(/^DOMAIN_MIN/i.test(l)){dmin=l.split(/\s+/).slice(1).map(Number);continue;}if(/^DOMAIN_MAX/i.test(l)){dmax=l.split(/\s+/).slice(1).map(Number);continue;}
    if(/^[A-Za-z]/.test(l))continue;const v=l.split(/\s+/).map(Number);if(v.length>=3&&v.every(n=>!isNaN(n)))data.push((v[0]-dmin[0])/(dmax[0]-dmin[0]),(v[1]-dmin[1])/(dmax[1]-dmin[1]),(v[2]-dmin[2])/(dmax[2]-dmin[2]));}
  if(!size||data.length!==size*size*size*3)throw new Error('올바른 .cube 파일이 아니에요');if(size>65)throw new Error('LUT 크기가 너무 커요 (최대 65)');
  return{size,data:new Float32Array(data)};}

/* ---------- ZIP (store) ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function makeZip(files){const enc=new TextEncoder();const parts=[],central=[];let off=0;const d=new Date();
  const dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
    h.setUint16(10,dt,true);h.setUint16(12,dd,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);h.setUint16(28,0,true);
    parts.push(h.buffer,name,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
    c.setUint16(12,dt,true);c.setUint16(14,dd,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);
    c.setUint32(42,off,true);central.push(c.buffer,name);off+=30+name.length+data.length;}
  const csize=central.reduce((s,x)=>s+(x.byteLength??x.length),0);
  const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,e.buffer],{type:'application/zip'});}

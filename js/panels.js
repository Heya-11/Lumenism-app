"use strict";
/* ================= EDIT PANEL ================= */
const curveCv=el('canvas','curve');
function tatBtn(p,kind){const b=btn(p,'◎ 사진에서 드래그',()=>{UI.tat=UI.tat===kind?null:kind;UI.pick=null;updateModeUI();},'btn sm',{title:'사진 위에서 위아래로 드래그해 조절 (타깃 조정 도구)'});
  b.style.marginLeft='auto';controls.push({sync(){b.classList.toggle('on',UI.tat===kind);}});return b;}
function buildEdit(){const root=$('pEdit');
  section(root,'기본',b=>{
    const t=el('div','inline');t.style.margin='4px 0 6px';b.appendChild(t);
    const wb=btn(t,'흰색 균형 스포이드',()=>startPick('wb'),'btn sm',{title:'회색이어야 할 곳을 클릭'});controls.push({sync(){wb.classList.toggle('on',UI.pick==='wb');}});
    btn(t,'자동 톤',autoTone,'btn sm');
    const tr=el('div','inline');tr.style.marginBottom='4px';b.appendChild(tr);sub(tr,'처리').style.margin='0 6px 0 0';chipsCtl(tr,'bw',[[false,'컬러'],[true,'흑백']],{hl:'처리'});
    sub(b,'화이트 밸런스');
    slider(b,{path:'temp',label:'색온도',min:-100,max:100,track:TR.temp});
    slider(b,{path:'tint',label:'색조',min:-100,max:100,track:TR.tint});
    sub(b,'톤');
    slider(b,{path:'exposure',label:'노출',min:-5,max:5,step:0.05,track:TR.exp});
    slider(b,{path:'contrast',label:'대비',min:-100,max:100});
    slider(b,{path:'highlights',label:'밝은 영역',min:-100,max:100});
    slider(b,{path:'shadows',label:'어두운 영역',min:-100,max:100});
    slider(b,{path:'whites',label:'흰색 계열',min:-100,max:100});
    slider(b,{path:'blacks',label:'검정 계열',min:-100,max:100});
    sub(b,'외관');
    slider(b,{path:'texture',label:'텍스처',min:-100,max:100});
    slider(b,{path:'clarity',label:'부분 대비',min:-100,max:100});
    slider(b,{path:'dehaze',label:'디헤이즈',min:-100,max:100});
    slider(b,{path:'vibrance',label:'생동감',min:-100,max:100,track:TR.vib});
    slider(b,{path:'saturation',label:'채도',min:-100,max:100,track:TR.sat});
  });
  section(root,'톤 곡선',b=>{
    const h=el('div','inline');b.appendChild(h);tabsCtl(h,'ui:curveTab',[['point','포인트'],['param','파라메트릭']],{onSet:()=>setTimeout(drawCurve)}).style.flex='1';tatBtn(h,'curve');
    const gp=group(b,()=>UI.curveTab==='point');tabsCtl(gp,'ui:curveCh',[['rgb','RGB'],['r','빨강'],['g','녹색'],['b','파랑']],{onSet:()=>drawCurve()});
    b.appendChild(curveCv);
    const gp2=group(b,()=>UI.curveTab==='point');
    const hn=el('div','hint','클릭해 점 추가 · 드래그로 조절 · 점을 더블클릭하면 삭제');gp2.appendChild(hn);
    btn(gp2,'이 채널 곡선 초기화',()=>{P().curves[UI.curveCh]=ID();drawCurve();requestRender();commit('톤 곡선 초기화');},'btn sm').style.marginTop='6px';
    const gq=group(b,()=>UI.curveTab==='param');gq.style.marginTop='8px';
    const pc=(k,l)=>slider(gq,{path:'pcurve.'+k,label:l,hl:'곡선 '+l,min:-100,max:100,onSet:drawCurve});
    pc('hl','밝은 영역');pc('lt','밝음');pc('dk','어두움');pc('sh','어두운 영역');
    sub(gq,'영역 분할');
    [['s1','어두움 경계',10,45],['s2','중간 경계',30,70],['s3','밝음 경계',55,90]].forEach(([k,l,a,z])=>slider(gq,{path:'pcurve.'+k,label:l,min:a,max:z,def:{s1:25,s2:50,s3:75}[k],fmt:v=>Math.round(v),onSet:drawCurve}));
  },true);
  section(root,'색상 혼합',(b,sec)=>{
    const h=el('div','inline');b.appendChild(h);const t=el('span','sub');t.style.margin='0';h.appendChild(t);tatBtn(h,'hsl');
    controls.push({sync(){t.textContent=P().bw?'흑백 혼합 (색상별 밝기)':'HSL';sec.querySelector('.sech span').textContent=P().bw?'흑백 혼합':'색상 혼합 (HSL)';}});
    const gh=group(b,()=>!P().bw);tabsCtl(gh,'ui:hslTab',[['H','색조'],['S','채도'],['L','광도']]);
    ['H','S','L'].forEach(k=>{const g=group(gh,()=>UI.hslTab===k);
      BANDS.forEach((bd,i)=>{const tr=k==='H'?()=>G(hueCss(bd.h-30),hueCss(bd.h),hueCss(bd.h+30)):k==='S'?()=>G('#8a8a8a',hueCss(bd.h,90,50)):()=>G(hueCss(bd.h,70,15),hueCss(bd.h,80,50),hueCss(bd.h,80,85));
        slider(g,{path:`hsl${k}.${i}`,label:bd.n,hl:`${{H:'색조',S:'채도',L:'광도'}[k]} ${bd.n}`,min:-100,max:100,track:tr});});});
    const gb=group(b,()=>P().bw);
    BANDS.forEach((bd,i)=>slider(gb,{path:`bwMix.${i}`,label:bd.n,hl:'흑백 '+bd.n,min:-100,max:100,track:()=>G('#111',hueCss(bd.h,60,50),'#eee')}));
    btn(gb,'자동 흑백 혼합',()=>{P().bwMix=[-8,-4,6,-12,-8,-18,-6,4];syncUI();requestRender();commit('자동 흑백 혼합');},'btn sm').style.marginTop='6px';
  },true);
  section(root,'색상 그레이딩',b=>{
    [['gs','어두운 영역'],['gm','중간 톤'],['gh','밝은 영역']].forEach(([k,n])=>{sub(b,n);
      slider(b,{path:k+'H',label:'색조',hl:n+' 색조',min:0,max:360,def:{gs:220,gm:30,gh:45}[k],fmt:v=>Math.round(v)+'°',track:TR.rain,onSet:()=>syncUI()});
      slider(b,{path:k+'S',label:'채도',hl:n+' 채도',min:0,max:100,fmt:v=>Math.round(v),track:()=>G('#8a8a8a',hueCss(getP(k+'H'),75,50))});
      slider(b,{path:k+'L',label:'광도',hl:n+' 광도',min:-100,max:100});});
    sub(b,'전체');slider(b,{path:'gBal',label:'균형',hl:'그레이딩 균형',min:-100,max:100});
  },true);
  section(root,'세부',b=>{sub(b,'선명하게');
    slider(b,{path:'sharpen',label:'양',hl:'선명하게',min:0,max:150,fmt:v=>Math.round(v)});
    slider(b,{path:'sharpRadius',label:'반경',hl:'선명 반경',min:.5,max:3,step:.1,def:1,fmt:v=>(+v).toFixed(1)});
    slider(b,{path:'sharpDetail',label:'세부',hl:'선명 세부',min:0,max:100,def:25,fmt:v=>Math.round(v)});
    slider(b,{path:'sharpMask',label:'마스킹',hl:'선명 마스킹',min:0,max:100,fmt:v=>Math.round(v)});
    slider(b,{path:'highPass',label:'하이패스',hl:'하이패스 선명도',min:0,max:100,fmt:v=>Math.round(v)});
    sub(b,'노이즈 감소');
    slider(b,{path:'lnr',label:'광도',hl:'광도 노이즈 감소',min:0,max:100,fmt:v=>Math.round(v)});
    slider(b,{path:'cnr',label:'색상',hl:'색상 노이즈 감소',min:0,max:100,fmt:v=>Math.round(v)});
  },true);
  section(root,'효과',b=>{sub(b,'자르기 후 비네팅');
    slider(b,{path:'vig',label:'양',hl:'비네팅',min:-100,max:100,track:TR.dark});
    slider(b,{path:'vigMid',label:'중간점',hl:'비네팅 중간점',min:0,max:100,def:50,fmt:v=>Math.round(v)});
    sub(b,'그레인');
    slider(b,{path:'grain',label:'양',hl:'그레인',min:0,max:100,fmt:v=>Math.round(v)});
    slider(b,{path:'grainSize',label:'크기',hl:'그레인 크기',min:0,max:100,def:25,fmt:v=>Math.round(v)});
    sub(b,'빛 효과');
    slider(b,{path:'fx.orton',label:'오톤 효과',min:0,max:100,fmt:v=>Math.round(v)});
    slider(b,{path:'fx.glow',label:'글로우',min:0,max:100,fmt:v=>Math.round(v)});
    slider(b,{path:'fx.glowT',label:'글로우 기준',min:20,max:95,def:60,fmt:v=>Math.round(v)});
    slider(b,{path:'fx.hal',label:'할레이션',min:0,max:100,fmt:v=>Math.round(v)});
    buildBokeh(b);
  },true);
  section(root,'하늘 교체 · 입체 조명',b=>buildSkyLight(b),true);
  let adv;section(root,'고급 색상',b=>{adv=b;b.classList.add('nest');},true);
  section(adv,'포인트 컬러 / 색상 대체',b=>{
    const t=el('div','inline');b.appendChild(t);const pk=btn(t,'＋ 사진에서 색 선택',()=>startPick('pc'),'btn sm');controls.push({sync(){pk.classList.toggle('on',UI.pick==='pc');}});
    dyn(b,d=>{d.innerHTML='';const pcs=P().pcs;if(!pcs.length){d.innerHTML='<div class="hint">스포이드로 바꾸고 싶은 색을 찍으세요. 최대 4개까지 가능하고, ‘나머지 채도’를 -100으로 하면 고른 색만 남는 흑백(컬러 스플래시)이 돼요.</div>';return;}
      const sw=el('div','swatches');d.appendChild(sw);
      pcs.forEach((c,i)=>{const s=el('div','swatch'+((cur.selPC|0)===i?' on':''));s.style.background=hueCss(c.h*360,c.s*100,c.l*100);s.title='선택';s.onclick=()=>{cur.selPC=i;syncUI();};sw.appendChild(s);});});
    const g=group(b,()=>!!selPC());
    slider(g,{path:'pc:dh',label:'색조 이동',hl:'포인트 색조',min:-100,max:100,track:()=>{const c=selPC();const h=c?c.h*360:0;return G(hueCss(h-60),hueCss(h),hueCss(h+60));}});
    slider(g,{path:'pc:ds',label:'채도',hl:'포인트 채도',min:-100,max:100});
    slider(g,{path:'pc:dl',label:'광도',hl:'포인트 광도',min:-100,max:100});
    slider(g,{path:'pc:range',label:'범위',hl:'포인트 범위',min:5,max:100,def:35,fmt:v=>Math.round(v)});
    btn(g,'이 색 삭제',()=>{P().pcs.splice(cur.selPC|0,1);cur.selPC=0;syncUI();requestRender();commit('포인트 컬러 삭제');},'btn sm').style.margin='6px 0';
    const g2=group(b,()=>P().pcs.length>0);
    slider(g2,{path:'pcRest',label:'나머지 채도',min:-100,max:0,track:()=>G('#888','#e05050')});
  },true);
  section(adv,'듀오톤',b=>{chk(b,'듀오톤 사용','duo.on',{hl:'듀오톤'});
    colorCtl(b,'어두운 색','duo.a',{hl:'듀오톤 어두운 색'});colorCtl(b,'밝은 색','duo.b',{hl:'듀오톤 밝은 색'});
    slider(b,{path:'duo.amt',label:'강도',hl:'듀오톤 강도',min:0,max:100,def:100,fmt:v=>Math.round(v)});
    const pr=el('div','chips');pr.style.marginTop='6px';b.appendChild(pr);
    [['#1d3557','#f4a261','블루·오렌지'],['#2b2d42','#ef233c','레드'],['#283618','#dda15e','올리브'],['#3a0ca3','#f72585','네온'],['#1b1b1b','#c9a227','골드']].forEach(([a,c,n])=>{
      const x=el('button');x.textContent=n;x.onclick=()=>{if(!cur)return;Object.assign(P().duo,{on:true,a,b:c});syncUI();requestRender();commit('듀오톤 '+n);};pr.appendChild(x);});
  },true);
  section(adv,'채널 혼합기',b=>{tabsCtl(b,'ui:mixOut',[['r','빨강 출력'],['g','녹색 출력'],['b','파랑 출력']]);
    ['r','g','b'].forEach(o=>{const g=group(b,()=>UI.mixOut===o);[['빨강',0,'#e05050'],['녹색',1,'#4fd36a'],['파랑',2,'#5b8bff']].forEach(([n,i,c])=>
      slider(g,{path:`mix.${o}.${i}`,label:n,hl:`채널 ${o.toUpperCase()}←${n}`,min:-200,max:200,def:o==='rgb'[i]?100:0,track:()=>G('#111',c)}));});
    btn(b,'채널 혼합 초기화',()=>{P().mix={r:[100,0,0],g:[0,100,0],b:[0,0,100]};syncUI();requestRender();commit('채널 혼합 초기화');},'btn sm').style.marginTop='6px';
  },true);
  section(adv,'LUT (.cube)',b=>{
    const t=el('div','inline');b.appendChild(t);btn(t,'LUT 불러오기…',()=>pickFile('.cube',loadLutFile),'btn sm');
    const rm=btn(t,'해제',()=>{P().lut.id=null;P().lut.name='';syncUI();requestRender();commit('LUT 해제');},'btn sm');
    const nm=el('div','hint');b.appendChild(nm);
    controls.push({sync(){const L=P().lut;const ok=L.id&&STORE.luts.has(L.id);nm.textContent=ok?'적용 중: '+L.name:(L.id?'LUT 데이터를 다시 불러와 주세요: '+L.name:'영화용 3D LUT(.cube) 파일을 불러와 적용해요.');rm.disabled=!L.id;}});
    slider(b,{path:'lut.amt',label:'강도',hl:'LUT 강도',min:0,max:100,def:100,fmt:v=>Math.round(v)});
  },true);
}
/* ---- curve canvas ---- */
const CH_COL={rgb:'#e8e8e8',r:'#ff5a5a',g:'#4fd36a',b:'#5b8bff'};let dragPt=null;
function drawCurve(){if(!curveCv.clientWidth)return;const dpr=window.devicePixelRatio||1,W=Math.round(curveCv.clientWidth*dpr);if(curveCv.width!==W){curveCv.width=W;curveCv.height=W;}
  const c=curveCv.getContext('2d');c.clearRect(0,0,W,W);c.fillStyle='#171717';c.fillRect(0,0,W,W);const p=P();
  if(UI.curveTab==='param'){const pc=p.pcurve;[[0,pc.s1],[pc.s1,pc.s2],[pc.s2,pc.s3],[pc.s3,100]].forEach(([a,b2],i)=>{c.fillStyle=i%2?'#1c1c1c':'#191919';c.fillRect(a/100*W,0,(b2-a)/100*W,W);});}
  c.strokeStyle='#2a2a2a';c.lineWidth=1;for(let i=1;i<4;i++){const v=Math.round(W*i/4)+.5;c.beginPath();c.moveTo(v,0);c.lineTo(v,W);c.moveTo(0,v);c.lineTo(W,v);c.stroke();}
  c.strokeStyle='#333';c.beginPath();c.moveTo(0,W);c.lineTo(W,0);c.stroke();
  const cv=p.curves,PC=paramCurve(p.pcurve);
  if(UI.curveTab==='param'){const M=evalCurve(cv.rgb);c.strokeStyle='#e8e8e8';c.lineWidth=1.6*dpr;c.beginPath();for(let i=0;i<256;i++){const y=sampleArr(PC,M[i]);i?c.lineTo(i/255*W,(1-y)*W):c.moveTo(0,(1-y)*W);}c.stroke();return;}
  ['rgb','r','g','b'].forEach(k=>{if(k===UI.curveCh)return;const pts=cv[k];if(JSON.stringify(pts)==='[[0,0],[1,1]]')return;
    const a=evalCurve(pts);c.strokeStyle=CH_COL[k]+'55';c.lineWidth=1.2*dpr;c.beginPath();for(let i=0;i<256;i++){const x=i/255*W,y=(1-a[i])*W;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();});
  const a=evalCurve(cv[UI.curveCh]);c.strokeStyle=CH_COL[UI.curveCh];c.lineWidth=1.6*dpr;c.beginPath();
  for(let i=0;i<256;i++){const x=i/255*W,y=(1-a[i])*W;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  cv[UI.curveCh].forEach((pt,i)=>{c.beginPath();c.arc(pt[0]*W,(1-pt[1])*W,(i===dragPt?5:4)*dpr,0,7);c.fillStyle=i===dragPt?'#fff':'#1a1a1a';c.fill();c.strokeStyle=CH_COL[UI.curveCh];c.lineWidth=1.5*dpr;c.stroke();});}
function cvPos(e){const r=curveCv.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp(1-(e.clientY-r.top)/r.height,0,1),r};}
function hitPt(e){const {x,y,r}=cvPos(e);const pts=P().curves[UI.curveCh];let best=-1,bd=1e9;
  pts.forEach((p,i)=>{const d=Math.hypot((p[0]-x)*r.width,(p[1]-y)*r.height);if(d<bd){bd=d;best=i;}});return bd<11?best:-1;}
curveCv.addEventListener('pointerdown',e=>{if(!cur||UI.curveTab!=='point')return;const pts=P().curves[UI.curveCh];let i=hitPt(e);
  if(i<0){const {x,y}=cvPos(e);if(pts.some(p=>Math.abs(p[0]-x)<0.02))return;i=pts.findIndex(p=>p[0]>x);pts.splice(i,0,[x,y]);}
  dragPt=i;curveCv.setPointerCapture(e.pointerId);drawCurve();requestRender();});
curveCv.addEventListener('pointermove',e=>{if(dragPt===null)return;const pts=P().curves[UI.curveCh],{x,y}=cvPos(e);
  const lo=dragPt>0?pts[dragPt-1][0]+0.01:0,hi=dragPt<pts.length-1?pts[dragPt+1][0]-0.01:1;pts[dragPt]=[clamp(x,lo,hi),y];drawCurve();requestRender();});
curveCv.addEventListener('pointerup',()=>{if(dragPt===null)return;dragPt=null;drawCurve();commit('톤 곡선');});
curveCv.addEventListener('dblclick',e=>{if(!cur||UI.curveTab!=='point')return;const pts=P().curves[UI.curveCh],i=hitPt(e);if(i>0&&i<pts.length-1){pts.splice(i,1);drawCurve();requestRender();commit('톤 곡선 점 삭제');}});

/* ================= CROP PANEL ================= */
const ASPECTS=[['free','자유'],['orig','원본'],['1:1','1:1'],['4:5','4:5'],['5:4','5:4'],['3:2','3:2'],['2:3','2:3'],['16:9','16:9'],['9:16','9:16']];
const ASP_INV={'4:5':'5:4','5:4':'4:5','3:2':'2:3','2:3':'3:2','16:9':'9:16','9:16':'16:9'};
function buildCrop(){const b=el('div','pad');$('pCrop').appendChild(b);
  sub(b,'비율');const ch=el('div','chips');b.appendChild(ch);
  ASPECTS.forEach(([k,n])=>{const x=el('button');x.textContent=n;x._v=k;x.onclick=()=>cur&&setAspect(k);ch.appendChild(x);});
  controls.push({sync(){[...ch.children].forEach(x=>x.classList.toggle('on',x._v===P().geo.aspect));}});
  sub(b,'수평 맞춤');
  slider(b,{path:'geo.angle',label:'각도',hl:'수평 각도',min:-45,max:45,step:0.1,fmt:v=>(+v).toFixed(1)+'°'});
  const st=btn(b,'수평 맞춤 도구 — 수평선을 따라 선 긋기',()=>{UI.straighten=!UI.straighten;UI.guide=false;updateModeUI();},'btn full');st.style.marginTop='6px';
  controls.push({sync(){st.classList.toggle('on',UI.straighten);}});
  sub(b,'원근 보정 (Upright)');
  slider(b,{path:'geo.pv',label:'수직',hl:'수직 원근',min:-100,max:100});
  slider(b,{path:'geo.ph',label:'수평',hl:'수평 원근',min:-100,max:100});
  slider(b,{path:'geo.pscale',label:'확대',hl:'원근 확대',min:50,max:150,def:100,fmt:v=>Math.round(v)+'%'});
  const gg=el('div','grid2');gg.style.marginTop='6px';b.appendChild(gg);
  const gb=btn(gg,'가이드 업라이트',()=>{UI.guide=!UI.guide;UI.straighten=false;updateModeUI();},'btn',{title:'건물의 세로선·가로선을 따라 선을 2~4개 그으면 자동으로 원근을 맞춰요'});
  btn(gg,'가이드 지우기',()=>{UI.guideLines=[];drawOverlay();},'btn');
  controls.push({sync(){gb.classList.toggle('on',UI.guide);}});
  sub(b,'렌즈 보정');slider(b,{path:'lens.dist',label:'왜곡',hl:'렌즈 왜곡',min:-100,max:100});
    
    slider(b,{path:'lens.ca',label:'색수차',hl:'색수차 보정',min:-100,max:100});
    slider(b,{path:'lens.defringe',label:'프린지 제거',hl:'프린지 제거',min:0,max:100,fmt:v=>Math.round(v)});
    
    slider(b,{path:'lens.vig',label:'렌즈 비네팅',hl:'렌즈 비네팅',min:-100,max:100});
    slider(b,{path:'lens.vigMid',label:'비네팅 중간점',hl:'렌즈 비네팅 중간점',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  sub(b,'회전 · 반전');const g2=el('div','grid2');b.appendChild(g2);
  btn(g2,'↺ 왼쪽 90°',()=>rotate90(-1));btn(g2,'↻ 오른쪽 90°',()=>rotate90(1));
  const fh=btn(g2,'⇋ 좌우 반전',()=>flip('h'));const fv=btn(g2,'⇵ 상하 반전',()=>flip('v'));
  controls.push({sync(){fh.classList.toggle('on',P().geo.fh);fv.classList.toggle('on',P().geo.fv);}});
  const g3=el('div','grid2');g3.style.marginTop='14px';b.appendChild(g3);
  btn(g3,'자르기 초기화',()=>{cur.params.geo=defGeo();UI.guideLines=[];syncUI();requestRender();commit('자르기 초기화');});
  btn(g3,'완료',()=>setTool('edit'),'tb primary');
  b.appendChild(el('div','hint','핸들을 드래그해 자르고 안쪽을 드래그해 옮기세요. 각도·원근을 바꾸면 빈 모서리가 생기지 않게 자르기 영역이 자동으로 맞춰져요. <kbd>Enter</kbd> 완료'));}

/* ================= MASK PANEL ================= */
const MASK_N={linear:'선형',radial:'원형',brush:'브러시',ai:'AI',outline:'테두리'};
const ICON={linear:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/></svg>',
  radial:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="5"/></svg>',
  brush:'<svg class="ic" viewBox="0 0 24 24"><path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5"/></svg>',
  outline:'<svg class="ic" viewBox="0 0 24 24"><path d="M7 5c4-3 12-2 13 3s-3 10-9 10-8-3-8-6 1-5 4-7z" stroke-dasharray="3 2.2"/><circle cx="12" cy="11" r="3"/></svg>',
  ai:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>'};
const MODE_N={add:'＋',sub:'－',int:'∩'};
function buildMask(){const b=el('div','pad');$('pMask').appendChild(b);
  const ng=el('div','hint');ng.id='maskNoGL';ng.style.display='none';ng.textContent='이 기기에서는 마스크를 지원하지 않아요 (WebGL 부동소수점 렌더링 필요).';b.appendChild(ng);
  const nb=el('div','sec mnew');nb.innerHTML='<div class="sech"><i class="tri"></i><span>새 마스크</span><span class="badge2"></span></div><div class="secb"></div>';b.appendChild(nb);
  const nbody=nb.lastChild;let lastSel=null;
  nb.firstChild.onclick=()=>{UI.maskNewOpen=nb.classList.contains('closed');nb.classList.toggle('closed',!UI.maskNewOpen);};
  controls.push({sync(){const sel=cur?cur.sel:null;if(sel!==lastSel){lastSel=sel;UI.maskNewOpen=undefined;}
    const open=UI.pendingCreate||UI.pick==='aisubject'?true:UI.maskNewOpen!==undefined?UI.maskNewOpen:!selMask();nb.classList.toggle('closed',!open);}});
  const dh=el('div','sub');dh.textContent='그려서 만들기';nbody.appendChild(dh);
  const add=el('div','grid4');add.id='maskNew';nbody.appendChild(add);
  [['linear','선형'],['radial','원형'],['brush','브러시'],['outline','테두리']].forEach(([t,n])=>{const x=btn(add,ICON[t].replace('class="ic"','')+n,()=>startNewMask(t,'new'));x._t=t;});
  controls.push({sync(){[...add.children].forEach(x=>x.classList.toggle('on',UI.pendingCreate===x._t&&UI.pendingMode==='new'));}});
  const po=group(nbody,()=>UI.pendingCreate==='outline');po.className='olpre';
  po.appendChild(el('div','hint','그리기 전에 고르세요. 그린 뒤에도 바꿀 수 있어요.'));
  slider(po,{path:'ui:outline.snap',label:'경계 맞춤',min:0,max:100,def:70,noCommit:true,noRender:true,fmt:v=>Math.round(v),always:true,onDone:saveOl});
  chk(po,'AI로 물체 경계 찾기 '+(typeof aiBadge==='function'?aiBadge():''),'ui:outline.ai',{noCommit:true,always:true,onSet:saveOl});
  const hint=el('div','hint');hint.id='mHint';b.appendChild(hint);
  sub(b,'마스크');
  dyn(b,d=>{d.innerHTML='';const ms=cur?cur.params.masks:[];if(!ms.length){d.innerHTML='<div class="hint">아직 마스크가 없어요.</div>';return;}const l=el('div','list');d.appendChild(l);
    ms.slice().reverse().forEach(m=>{const r=el('div','li'+(cur.sel===m.id?' on':''));r.innerHTML=`${ICON[m.comps[0]?.type||'brush']}<span class="nm"></span><button class="ib del" title="삭제">×</button>`;
      r.querySelector('.nm').textContent=m.name;r.onclick=e=>{if(e.target.classList.contains('del')){cur.sel=m.id;deleteMask();return;}cur.sel=m.id;cur.selComp=m.comps[0]?.id;UI.pendingCreate=null;syncUI();requestRender();};l.appendChild(r);});});
  const me=group(b,()=>!!selMask());
  chk(me,'마스크 영역 빨간색으로 표시 (O)','ui:showOverlay',{noCommit:true});
  sub(me,'보정');
  [['exposure','노출',-4,4,.05,TR.exp],['contrast','대비',-100,100],['highlights','밝은 영역',-100,100],['shadows','어두운 영역',-100,100],
   ['temp','색온도',-100,100,1,TR.temp],['tint','색조',-100,100,1,TR.tint],['clarity','부분 대비',-100,100],['saturation','채도',-100,100,1,TR.sat]]
   .forEach(([k,n,mn,mx,st,tr])=>slider(me,{path:'m:adj.'+k,label:n,hl:'마스크 '+n,min:mn,max:mx,step:st||1,track:tr}));
  const g4=el('div','grid2');g4.style.marginTop='10px';me.appendChild(g4);
  btn(g4,'보정값 초기화',()=>{const m=selMask();ADJ_KEYS.forEach(k=>m.adj[k]=0);syncUI();requestRender();commit(m.name+' 보정 초기화');});
  btn(g4,'마스크 삭제',deleteMask);
  sub(me,'구성 요소 (더하기 · 빼기 · 교차)');
  dyn(me,d=>{d.innerHTML='';const m=selMask();if(!m)return;const l=el('div','list');d.appendChild(l);
    m.comps.forEach((c,i)=>{const r=el('div','li'+(selComp()===c?' on':''));r.innerHTML=`${ICON[c.type]}<span class="nm">${c.type==='ai'&&typeof AI_MASKS!=='undefined'?'AI '+((AI_MASKS.find(a=>a[0]===c.kind)||[,''])[1]).replace(' (클릭)',''):MASK_N[c.type]}</span>${i?`<span class="tag">${MODE_N[c.mode]}</span>`:''}<button class="ib del" title="삭제">×</button>`;
      r.onclick=e=>{if(e.target.classList.contains('del')){m.comps.splice(m.comps.indexOf(c),1);if(!m.comps.length){deleteMask();return;}cur.selComp=m.comps[0].id;syncUI();requestRender();commit('구성 요소 삭제');return;}
        cur.selComp=c.id;syncUI();drawOverlay();};l.appendChild(r);});});
  const ar=el('div','inline');ar.style.margin='6px 0';me.appendChild(ar);
  [['add','＋ 더하기'],['sub','－ 빼기'],['int','∩ 교차']].forEach(([md,n])=>{const s=el('select','txt');s.style.flex='1';s.innerHTML=`<option value="">${n}</option><option value="linear">선형</option><option value="radial">원형</option><option value="brush">브러시</option><option value="outline">테두리</option>`;
    s.onchange=()=>{if(s.value)startNewMask(s.value,md);s.value='';};ar.appendChild(s);});
  const cg=group(me,()=>!!selComp());
  chk(cg,'반전','mc:inv',{hl:'구성 요소 반전'});
  const fg=group(cg,()=>selComp()?.type==='radial');slider(fg,{path:'mc:feather',label:'페더',hl:'마스크 페더',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  const og=group(cg,()=>selComp()?.type==='outline');
  slider(og,{path:'mc:snap',label:'경계 맞춤',hl:'테두리 경계 맞춤',min:0,max:100,def:70,noRender:true,fmt:v=>Math.round(v),onSet:v=>{UI.outline.snap=v;},onDone:()=>{saveOl();requestRender();}});
  chk(og,'AI로 물체 경계 찾기 '+(typeof aiBadge==='function'?aiBadge():''),'mc:ai',{hl:'테두리 AI',onSet:v=>{UI.outline.ai=v;saveOl();const c=selComp();if(v&&c)outlineAI(c);}});
  og.appendChild(el('div','hint','경계 맞춤 0이면 그린 그대로, 높일수록 그린 선에서 더 안쪽까지 경계를 찾아 붙어요. 더하기·빼기로 테두리를 여러 번 그려 다듬을 수 있어요.'));
  const bg=group(cg,()=>selComp()?.type==='brush');
  tabsCtl(bg,'ui:brush.erase',[[false,'칠하기'],[true,'지우개']],{onSet:updateModeUI});
  slider(bg,{path:'ui:brush.size',label:'크기',min:3,max:400,def:60,noCommit:true,noRender:true,fmt:v=>Math.round(v),always:true});
  slider(bg,{path:'ui:brush.feather',label:'페더',min:0,max:100,def:50,noCommit:true,noRender:true,fmt:v=>Math.round(v),always:true});
  slider(bg,{path:'ui:brush.flow',label:'흐름',min:5,max:100,def:60,noCommit:true,noRender:true,fmt:v=>Math.round(v),always:true});
  chk(bg,'자동 마스크 (가장자리 따라 칠하기)','ui:brush.auto',{noCommit:true,always:true});
  sub(me,'범위 마스크');
  chipsCtl(me,'m:range.type',[['none','없음'],['lum','광도'],['color','색상']],{hl:'범위 마스크'});
  const rl=group(me,()=>selMask()?.range.type==='lum');
  slider(rl,{path:'m:range.lo',label:'하한',hl:'범위 하한',min:0,max:100,fmt:v=>Math.round(v)});
  slider(rl,{path:'m:range.hi',label:'상한',hl:'범위 상한',min:0,max:100,def:100,fmt:v=>Math.round(v)});
  slider(rl,{path:'m:range.sm',label:'부드럽게',hl:'범위 부드럽게',min:0,max:100,def:20,fmt:v=>Math.round(v)});
  const rc=group(me,()=>selMask()?.range.type==='color');
  const rci=el('div','inline');rc.appendChild(rci);const rp=btn(rci,'스포이드로 색 선택',()=>startPick('range'),'btn sm');const sw=el('div','swatch');sw.style.cursor='default';rci.appendChild(sw);
  controls.push({sync(){rp.classList.toggle('on',UI.pick==='range');const m=selMask();if(m&&m.range.color){const [r,g,b2]=m.range.color.map(v=>Math.round(v*255));sw.style.background=`rgb(${r},${g},${b2})`;}}});
  slider(rc,{path:'m:range.tol',label:'허용 범위',hl:'색상 허용 범위',min:1,max:100,def:30,fmt:v=>Math.round(v)});
  slider(rc,{path:'m:range.sm',label:'부드럽게',hl:'범위 부드럽게',min:0,max:100,def:20,fmt:v=>Math.round(v)});
  me.appendChild(el('div','hint','<kbd>Space</kbd>+드래그로 화면 이동 · <kbd>[</kbd> <kbd>]</kbd> 브러시 크기 · <kbd>Delete</kbd> 마스크 삭제'));}

/* ================= RETOUCH PANEL ================= */
const RET_MODES=[['heal','스팟 복구'],['clone','스팟 복제'],['stamp','복제 도장'],['redeye','적목 제거'],['fill','내용 인식 채우기']];
const RET_N={heal:'복구',clone:'복제',stamp:'복제 도장',redeye:'적목',fill:'내용 인식 채우기'};
function buildRetouch(){const b=el('div','pad');$('pRetouch').appendChild(b);
  sub(b,'도구');chipsCtl(b,'ui:ret.mode',RET_MODES,{noCommit:true,always:true,onSet:()=>{UI.ret.off=null;updateModeUI();}});
  const h=el('div','hint');h.id='retHint';b.appendChild(h);
  sub(b,'브러시');
  slider(b,{path:'ui:ret.size',label:'크기',min:3,max:400,def:40,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v),onSet:drawOverlay});
  slider(b,{path:'ui:ret.feather',label:'페더',min:0,max:100,def:50,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v)});
  slider(b,{path:'ui:ret.op',label:'불투명도',min:5,max:100,def:100,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v)});
  const sg=group(b,()=>UI.ret.mode==='stamp');const sb=btn(sg,'복제 소스 지정 (Alt+클릭과 같음)',()=>{UI.ret.awaitSrc=true;updateModeUI();},'btn full');sb.style.marginTop='6px';
  controls.push({sync(){sb.classList.toggle('on',UI.ret.awaitSrc);}});
  sub(b,'적용된 항목');
  dyn(b,d=>{d.innerHTML='';const it=cur?cur.params.retouch:[];if(!it.length){d.innerHTML='<div class="hint">아직 없어요.</div>';return;}const l=el('div','list');d.appendChild(l);
    const cnt={};it.slice().reverse().forEach(r=>{const n=(cnt[r.type]=(cnt[r.type]||0)+1);const row=el('div','li'+(cur.selRet===r.id?' on':''));
      row.innerHTML=`<span class="nm">${RET_N[r.type]}</span><button class="ib del" title="삭제">×</button>`;
      row.onclick=e=>{if(e.target.classList.contains('del')){cur.selRet=r.id;deleteRet();return;}cur.selRet=r.id;syncUI();drawOverlay();};l.appendChild(row);});});
  const eg=group(b,()=>{const r=selRet();return r&&(r.type==='heal'||r.type==='clone'||r.type==='redeye');});
  sub(eg,'선택한 항목');
  const tg=group(eg,()=>{const r=selRet();return r&&r.type!=='redeye';});chipsCtl(tg,'r:type',[['heal','복구'],['clone','복제']],{hl:'스팟 방식'});
  slider(eg,{path:'r:r',label:'크기',hl:'스팟 크기',min:.003,max:.25,step:.001,fmt:v=>(v*100).toFixed(1)});
  slider(eg,{path:'r:f',label:'페더',hl:'스팟 페더',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  slider(eg,{path:'r:op',label:'불투명도',hl:'스팟 불투명도',min:0,max:100,def:100,fmt:v=>Math.round(v)});
  const g2=el('div','grid2');g2.style.marginTop='10px';b.appendChild(g2);
  btn(g2,'선택 삭제',deleteRet);btn(g2,'모두 지우기',()=>{cur.params.retouch=[];cur.selRet=null;syncUI();requestRender();commit('리터칭 모두 지우기');});
  b.appendChild(el('div','hint','원(흰색)은 고칠 곳, 점선 원은 가져올 곳이에요. 둘 다 드래그해서 옮길 수 있어요. <kbd>Delete</kbd> 선택 삭제'));}

/* ================= LAYERS PANEL ================= */
const FONTS=['Noto Sans KR','Noto Serif KR','Black Han Sans','Nanum Pen Script','Gowun Batang','Inter','Playfair Display','Bebas Neue'];
const LAYER_N={image:'이미지',text:'텍스트',color:'색상 채우기',adjust:'조정 레이어'};
function buildLayers(){const b=el('div','pad');$('pLayers').appendChild(b);
  sub(b,'레이어 추가');const g=el('div','grid4');b.appendChild(g);
  btn(g,'🖼<br>이미지',()=>pickFile('image/*',f=>addImageLayer(f)));btn(g,'T<br>텍스트',()=>addLayer('text'));btn(g,'■<br>색상',()=>addLayer('color'));btn(g,'◐<br>조정',()=>addLayer('adjust'));
  sub(b,'레이어 (위가 앞)');
  dyn(b,d=>{d.innerHTML='';if(!cur)return;const p=cur.params;const l=el('div','list');d.appendChild(l);
    layerStack(p).slice().reverse().forEach(L=>{const isB=L==='BASE',vis=isB?!p.baseHidden:L.visible;
      const r=el('div','li'+((isB?UI.baseSel:cur.selLayer===L.id)?' on':'')+(vis?'':' hidden')+(isB?' base':''));
      r.innerHTML=`<button class="ib vis" title="보이기/숨기기">${vis?'◉':'○'}</button><span class="nm"></span><button class="ib up" title="위로">↑</button><button class="ib dn" title="아래로">↓</button>${isB?'':'<button class="ib del" title="삭제">×</button>'}`;
      r.querySelector('.nm').textContent=isB?'배경 (보정된 사진)':L.name;const nm=isB?'배경':L.name;
      r.onclick=e=>{const c=e.target.classList;
        if(c.contains('vis')){if(isB)p.baseHidden=!p.baseHidden;else L.visible=!L.visible;syncUI();requestRender();commit(nm+(vis?' 숨기기':' 보이기'));return;}
        if(c.contains('up')){if(moveInStack(L,1)){syncUI();requestRender();commit('레이어 순서');}return;}
        if(c.contains('dn')){if(moveInStack(L,-1)){syncUI();requestRender();commit('레이어 순서');}return;}
        if(c.contains('del')){cur.selLayer=L.id;deleteLayer();return;}
        if(isB){UI.baseSel=true;cur.selLayer=null;}else{UI.baseSel=false;cur.selLayer=L.id;}UI.layerCut=false;UI.olDraft=null;syncUI();updateModeUI();drawOverlay();};
      onDouble(r,e=>{if(e.target.closest('.ib'))return;if(isB)fitView();else{UI.baseSel=false;cur.selLayer=L.id;fitToSelected();}});l.appendChild(r);});
    const fr=el('div','grid2');fr.style.margin='4px 0';d.appendChild(fr);btn(fr,'선택한 것에 맞춰 보기',fitToSelected,'btn sm',{title:'화면만 움직여서 선택한 레이어(없으면 배경)를 꽉 차게 보여요 (Shift+Z) · 목록 항목을 두 번 눌러도 돼요'});btn(fr,'전체 보기',fitView,'btn sm');
    if(p.baseHidden||p.baseZ>0||p.baseCut){const h=el('div','hint','배경이 비는 곳은 체크무늬로 보여요. PNG·WebP로 저장하면 투명하게, JPEG는 흰색으로 저장돼요.');d.appendChild(h);}});
  /* cut-out: the selected image layer, or the background photo itself */
  const cutBox=group(b,()=>!!cur&&(UI.baseSel||selLayer()?.type==='image'));
  const ch=el('div','sub');cutBox.appendChild(ch);controls.push({sync(){ch.textContent=UI.baseSel?'배경 사진 따내기':'이미지 따내기';}});
  const row=el('div','grid2');row.style.margin='2px 0 4px';cutBox.appendChild(row);
  const bb=el('button','btn');bb.innerHTML='배경 제거 '+(typeof aiBadge==='function'?aiBadge():'');bb.onclick=()=>{if(!cur)return;if(UI.baseSel)removeBaseBg();else removeLayerBg();};row.appendChild(bb);
  const ob=el('button','btn');ob.textContent='테두리로 따기';ob.onclick=()=>{if(!cur)return;UI.layerCut=!UI.layerCut;UI.olDraft=null;syncUI();updateModeUI();drawOverlay();};row.appendChild(ob);
  controls.push({sync(){ob.classList.toggle('on',!!UI.layerCut);}});
  const kg=group(cutBox,()=>!!UI.layerCut);kg.appendChild(el('div','hint','남길 부분을 테두리로 둘러 그리세요. 그린 선 안쪽의 가까운 경계에 맞춰 따내요.'));
  slider(kg,{path:'ui:outline.snap',label:'경계 맞춤',min:0,max:100,def:70,noCommit:true,noRender:true,fmt:v=>Math.round(v),always:true,onDone:saveOl});
  chk(kg,'AI로 물체 경계 찾기 '+(typeof aiBadge==='function'?aiBadge():''),'ui:outline.ai',{noCommit:true,always:true,onSet:saveOl});
  const rb=group(cutBox,()=>{if(UI.baseSel)return !!(cur&&P().baseCut);const L=selLayer();return !!(L&&L.imgOrig&&L.img!==L.imgOrig);});
  btn(rb,'따내기 전 원래대로',()=>{if(UI.baseSel)baseRestore();else layerRestore();},'btn full');
  const lg=group(b,()=>!!selLayer());
  sub(lg,'속성');textCtl(lg,'이름','l:name',{hl:'레이어 이름',onSet:()=>dynHooks.forEach(f=>f())});
  selectCtl(lg,'혼합 모드','l:blend',BLENDS,{hl:'혼합 모드'});
  slider(lg,{path:'l:opacity',label:'불투명도',hl:'레이어 불투명도',min:0,max:100,def:100,fmt:v=>Math.round(v)});
  const ti=group(lg,()=>selLayer()?.type==='text');
  textCtl(ti,'','l:text',{area:true,hl:'텍스트'});selectCtl(ti,'글꼴','l:font',FONTS.map(f=>[f,f]),{hl:'글꼴',onSet:f=>document.fonts&&document.fonts.load(`700 40px "${f}"`).then(()=>{R&&R.layerTex.delete(selLayer()?.id);requestRender();})});
  slider(ti,{path:'l:size',label:'글자 크기',hl:'글자 크기',min:1,max:40,step:.5,def:8,fmt:v=>(+v).toFixed(1)});
  colorCtl(ti,'색상','l:color',{hl:'글자 색'});const tb=el('div','inline');ti.appendChild(tb);chk(tb,'굵게','l:bold');chk(tb,'그림자','l:shadow');
  const im=group(lg,()=>selLayer()?.type==='image');
  selectCtl(im,'소스','l:img',()=>imageSources(),{hl:'이미지 소스',onSet:v=>ensureImageSource(v)});
  const tr=group(lg,()=>{const t=selLayer()?.type;return t==='image'||t==='text';});
  slider(tr,{path:'l:scale',label:'크기',hl:'레이어 크기',min:1,max:1000,def:100,fmt:v=>(v<10?(+v).toFixed(1):Math.round(v))+'%'});
  slider(tr,{path:'l:rot',label:'회전',hl:'레이어 회전',min:-180,max:180,fmt:v=>Math.round(v)+'°'});
  slider(tr,{path:'l:x',label:'가로 위치',min:-.5,max:1.5,step:.005,def:.5,fmt:v=>Math.round(v*100)});
  slider(tr,{path:'l:y',label:'세로 위치',min:-.5,max:1.5,step:.005,def:.5,fmt:v=>Math.round(v*100)});
  sub(tr,'정렬');const al=el('div','grid2');tr.appendChild(al);
  const ib=group(al,()=>selLayer()?.type==='image');ib.style.gridColumn='1 / -1';
  btn(ib,'배경 사진과 똑같이 겹치기',()=>alignLayer('base'),'btn full',{title:'배경 사진과 같은 크기·위치·각도로 맞춰요. 같은 카메라로 찍은 사진을 겹칠 때 좋아요'});
  btn(al,'화면 채우기',()=>alignLayer('fill'),'btn sm');btn(al,'전체 보이기',()=>alignLayer('fit'),'btn sm');btn(al,'가운데 정렬',()=>alignLayer('center'),'btn sm');
  const sm=el('select','txt');sm.style.minWidth='0';al.appendChild(sm);sm.onchange=()=>{if(sm.value)alignLayer('same',sm.value);sm.value='';};
  controls.push({sync(){const L=selLayer();const o=cur?cur.params.layers.filter(x=>x!==L&&(x.type==='image'||x.type==='text')):[];
    sm.innerHTML='<option value="">다른 레이어와 같게…</option>'+o.map(x=>`<option value="${x.id}"></option>`).join('');[...sm.options].slice(1).forEach((op,i)=>op.textContent=o[i].name);sm.disabled=!o.length;}});
  chk(tr,'겹침 확인 (차이로 보기)','ui:onion',{noCommit:true,always:true,hl:'겹침 확인'});
  tr.appendChild(el('div','hint','겹침 확인을 켜면 선택한 레이어가 "차이"로 보여서, 정확히 겹친 곳이 검게 보여요. PC에서는 방향키로 1px씩(Shift는 10px) 옮길 수 있어요.'));
  const cg=group(lg,()=>selLayer()?.type==='color');colorCtl(cg,'색상','l:color',{hl:'채우기 색'});
  const ag=group(lg,()=>selLayer()?.type==='adjust');
  slider(ag,{path:'l:exp',label:'노출',hl:'조정 노출',min:-3,max:3,step:.05,track:TR.exp});
  slider(ag,{path:'l:con',label:'대비',hl:'조정 대비',min:-100,max:100});
  slider(ag,{path:'l:sat',label:'채도',hl:'조정 채도',min:-100,max:100,track:TR.sat});
  slider(ag,{path:'l:hue',label:'색조 회전',hl:'조정 색조',min:-180,max:180,track:TR.rain,fmt:v=>Math.round(v)+'°'});
  chk(ag,'반전 (네거티브)','l:invert');
  sub(lg,'레이어 마스크');chipsCtl(lg,'l:mask.type',[['none','없음'],['linear','선형'],['radial','원형']],{hl:'레이어 마스크'});
  const mg=group(lg,()=>selLayer()&&selLayer().mask.type!=='none');
  slider(mg,{path:'l:mask.x',label:'중심 가로',min:0,max:1,step:.005,def:.5,fmt:v=>Math.round(v*100)});
  slider(mg,{path:'l:mask.y',label:'중심 세로',min:0,max:1,step:.005,def:.5,fmt:v=>Math.round(v*100)});
  const ml=group(mg,()=>selLayer()?.mask.type==='linear');slider(ml,{path:'l:mask.ang',label:'방향',min:-180,max:180,def:90,fmt:v=>Math.round(v)+'°'});
  const mr=group(mg,()=>selLayer()?.mask.type==='radial');slider(mr,{path:'l:mask.size',label:'크기',min:1,max:150,def:40,fmt:v=>Math.round(v)});
  slider(mg,{path:'l:mask.f',label:'페더',min:0,max:100,def:50,fmt:v=>Math.round(v)});chk(mg,'반전','l:mask.inv');
  const g5=el('div','grid2');g5.style.marginTop='10px';lg.appendChild(g5);btn(g5,'복제',dupLayer);btn(g5,'삭제',deleteLayer);
  b.appendChild(el('div','hint','이미지·텍스트 레이어는 사진 위에서 드래그해 옮길 수 있어요. 레이어는 자르기 후 화면 기준으로 합성돼요.'));}

/* ================= LEFT PANEL ================= */
function buildLeft(){const root=$('left');
  section(root,'사진',b=>{
    const st=el('div','stars');b.appendChild(st);for(let i=1;i<=5;i++){const x=el('button');x.textContent='★';x.title=i+'점 ('+i+')';x.onclick=()=>setRating(i);st.appendChild(x);}
    controls.push({sync(){const r=cur?cur.rating:0;[...st.children].forEach((x,i)=>x.classList.toggle('on',i<r));}});
    const fl=el('div','grid3');fl.style.margin='6px 0';b.appendChild(fl);
    const fp=btn(fl,'⚑ 픽 (P)',()=>setFlag(1));const fx=btn(fl,'✕ 거부 (X)',()=>setFlag(-1));btn(fl,'해제 (U)',()=>setFlag(0));
    controls.push({sync(){fp.classList.toggle('on',cur?.flag===1);fx.classList.toggle('on',cur?.flag===-1);}});
    const g=el('div','btnrow');b.appendChild(g);
    btn(g,'가상 사본 만들기',virtualCopy);
    const hb=btn(g,'HDR 병합 (선택한 사진)',hdrMerge);
    const info=el('div','hint');b.appendChild(info);
    controls.push({sync(){const n=photos.filter(p=>p.selected).length;hb.disabled=n<2;info.textContent=n>1?`${n}장 선택됨`:(typeof MB!=='undefined'&&MB.touch?'필름 스트립에서 사진을 길게 누르는 방법으':'필름 스트립에서 Ctrl/⌘ 또는 Shift+클릭으')+'로 여러 장을 선택하면 HDR 병합·일괄 내보내기를 할 수 있어요.';}});});
  section(root,'프리셋',b=>{const l=el('div','list');b.appendChild(l);
    PRESETS.forEach((pr,i)=>{const d=el('div','li');d.textContent=pr.n;d.onclick=()=>applyPreset(pr);l.appendChild(d);if(i===0)buildRecUI(l);});
    sub(b,'내 프리셋');dyn(b,d=>{d.innerHTML='';const ups=loadUserPresets();if(!ups.length){d.innerHTML='<div class="hint">저장한 프리셋이 없어요.</div>';return;}
      const ll=el('div','list');d.appendChild(ll);ups.forEach((pr,i)=>{const r=el('div','li');r.innerHTML='<span class="nm"></span><button class="ib del" title="삭제">×</button>';r.querySelector('.nm').textContent=pr.n;
        r.onclick=e=>{if(e.target.classList.contains('del')){ups.splice(i,1);saveUserPresets(ups);syncUI();return;}applyPreset(pr);};ll.appendChild(r);});});
    const g=el('div','grid2');g.style.marginTop='6px';b.appendChild(g);
    btn(g,'현재 설정 저장',saveCurrentPreset);btn(g,'가져오기',()=>pickFile('.json,application/json',importPresets),'btn',{always:true});
    btn(b,'내 프리셋 내보내기 (.json)',exportPresets,'btn full',{always:true}).style.marginTop='4px';});
  section(root,'스냅샷',b=>{btn(b,'＋ 현재 상태를 스냅샷으로',makeSnapshot,'btn full');
    dyn(b,d=>{d.innerHTML='';const s=cur?cur.snaps:[];if(!s.length)return;const l=el('div','list');l.style.marginTop='6px';d.appendChild(l);
      s.forEach((sn,i)=>{const r=el('div','li');r.innerHTML='<span class="nm"></span><button class="ib del">×</button>';r.querySelector('.nm').textContent=sn.name;
        r.onclick=e=>{if(e.target.classList.contains('del')){s.splice(i,1);syncUI();return;}replaceParams(clone(sn.state));commit('스냅샷: '+sn.name);};l.appendChild(r);});});},true);
  section(root,'히스토리',b=>{const l=el('div','list');l.id='histList';b.appendChild(l);});
  section(root,'여러 사진에 적용',b=>{b.id='secSync';sub(b,'보정 설정 복사');const g=el('div','btnrow');b.appendChild(g);
    btn(g,'보정 설정 복사',()=>{clipboard=clone(cur.params);PHOTO_ONLY.forEach(k=>delete clipboard[k]);syncUI();toast('보정 설정을 복사했어요 (자르기·리터칭·레이어 제외)');});
    const pb=btn(g,'붙여넣기',()=>{if(!clipboard)return;replaceParams(adaptParams(clipboard,cur));commit('설정 붙여넣기');});
    controls.push({sync(){pb.disabled=!clipboard;}});
    btn(g,'선택/전체 사진에 적용',syncToOthers);},true);
  section(root,'단축키',b=>{b.className='secb note';b.style.margin='0';b.innerHTML=
    '<kbd>E</kbd> 편집 · <kbd>R</kbd> 자르기 · <kbd>M</kbd> 마스크 · <kbd>Q</kbd> 리터칭 · <kbd>L</kbd> 레이어<br><kbd>\\</kbd> 보정 전 · <kbd>Y</kbd> 분할 비교 · <kbd>Z</kbd> 확대 · <kbd>J</kbd> 클리핑<br><kbd>O</kbd> 마스크 오버레이 · <kbd>[</kbd><kbd>]</kbd> 브러시 크기<br><kbd>Space</kbd>+드래그 화면 이동<br><kbd>0</kbd>~<kbd>5</kbd> 별점 · <kbd>P</kbd> 픽 · <kbd>X</kbd> 거부 · <kbd>U</kbd> 해제<br><kbd>←</kbd><kbd>→</kbd> 사진 이동 · <kbd>Ctrl</kbd>+<kbd>\'</kbd> 가상 사본<br><kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행 취소';},true);}

"use strict";
/* ================= AI-related UI builders ================= */
function aiBadge(t){return `<span class="aib">${t||'AI'}</span>`;}
/* ---- 효과 › 보케 · 포커스 ---- */
function buildBokeh(b){
  const h=el('div','sub');h.innerHTML='보케 · 포커스 '+aiBadge('일부 AI');b.appendChild(h);
  const ch=el('div','chips');b.appendChild(ch);
  FOCUS_MODES.forEach(([v,t])=>{const x=el('button');x.textContent=t;x._v=v;x.onclick=()=>cur&&setFocusMode(v);ch.appendChild(x);});
  controls.push({sync(){[...ch.children].forEach(x=>x.classList.toggle('on',x._v===P().fx.tilt));}});
  const g=group(b,()=>P().fx.tilt>0);g.style.marginTop='6px';
  slider(g,{path:'fx.blur',label:'흐림 양',hl:'보케 흐림',min:0,max:100,fmt:v=>Math.round(v)});
  const sh=el('div','inline');sh.style.margin='2px 0';g.appendChild(sh);sub(sh,'조리개 모양').style.margin='0 8px 0 0';
  chipsCtl(sh,'fx.shape',[['circle','원형'],['hex','육각형']],{hl:'보케 모양'});
  slider(g,{path:'fx.boost',label:'빛망울 강조',min:0,max:100,def:30,fmt:v=>Math.round(v)});
  slider(g,{path:'fx.fsharp',label:'초점 선명하게',min:0,max:100,fmt:v=>Math.round(v)});
  const gt=group(g,()=>P().fx.tilt===1||P().fx.tilt===2);
  slider(gt,{path:'fx.tx',label:'초점 가로',min:0,max:1,step:.01,def:.5,fmt:v=>Math.round(v*100)});
  slider(gt,{path:'fx.ty',label:'초점 세로',min:0,max:1,step:.01,def:.5,fmt:v=>Math.round(v*100)});
  const ga=group(gt,()=>P().fx.tilt===1);slider(ga,{path:'fx.tang',label:'각도',min:-90,max:90,fmt:v=>Math.round(v)+'°'});
  slider(gt,{path:'fx.tw',label:'선명 범위',min:0,max:60,def:12,fmt:v=>Math.round(v)});
  const gd=group(g,()=>P().fx.tilt===4);
  const fp=btn(gd,'초점 지점 클릭해서 고르기',()=>{UI.pick='focusDepth';updateModeUI();},'btn full');fp.style.margin='4px 0';controls.push({sync(){fp.classList.toggle('on',UI.pick==='focusDepth');}});
  slider(gd,{path:'fx.fdepth',label:'초점 거리',min:0,max:1,step:.01,def:.5,fmt:v=>Math.round(v*100)});
  slider(gd,{path:'fx.dof',label:'심도 범위',min:0,max:60,def:8,fmt:v=>Math.round(v)});
  const gs=group(g,()=>P().fx.tilt===5);const sp=btn(gs,'다른 피사체 클릭해서 고르기',()=>{UI.pick='focusSubject';updateModeUI();},'btn full');sp.style.margin='4px 0';
  const gm=group(g,()=>P().fx.tilt===6);selectCtl(gm,'초점 마스크','fx.maskId',()=>P().masks.map(m=>[m.id,m.name]),{hl:'초점 마스크'});
  gm.appendChild(el('div','hint','선택한 마스크 영역이 선명하게 남고 나머지가 흐려져요. 마스크 탭에서 피사체를 칠하거나 AI로 선택하세요.'));
  const gf=group(g,()=>P().fx.tilt!==0);slider(gf,{path:'fx.tf',label:'전환 폭',min:1,max:80,def:18,fmt:v=>Math.round(v)});
  const st=el('div','hint');g.appendChild(st);
  controls.push({sync(){const fx=P().fx;st.textContent=(fx.tilt>=3&&fx.tilt<=5&&!fx.aid)?'AI 분석이 필요해요. 위의 모드 버튼을 다시 눌러 주세요.':(fx.tilt===6&&!P().masks.length?'먼저 마스크 탭에서 마스크를 만들어 주세요.':'');}});}
/* ---- 인물 tool ---- */
function buildPortrait(){let b=el('div','pad');const pRoot=$('pPortrait');pRoot.appendChild(b);const S=(t,closed)=>section(pRoot,t,x=>{b=x;},closed);
  const h=el('div','sub');h.innerHTML='얼굴 · 피부 분석 '+aiBadge();b.appendChild(h);
  btn(b,'얼굴·피부 분석하기',analyzePortrait,'btn full');
  const info=el('div','hint');b.appendChild(info);
  const fbox=el('div');b.appendChild(fbox);let fkey='';
  controls.push({sync(){const po=P().portrait,pd=STORE.portrait.get(po.aid),n=pd?pd.faces.length:0;if(!Array.isArray(po.fw))po.fw=[];while(po.fw.length<n)po.fw.push(100);
    if(UI.face>=n)UI.face=-1;const own=(po.pf||[]).map(o=>o?1:0).join('');
    const k=po.aid+':'+n+':'+UI.face+':'+own;if(k===fkey)return;fkey=k;fbox.innerHTML='';if(n<2)return;const st=controls.length;
    sub(fbox,'보정할 얼굴');const ch=el('div','chips facechips');fbox.appendChild(ch);
    [[-1,'전체'],...Array.from({length:n},(_,i)=>[i,`얼굴 ${i+1}${(po.pf||[])[i]?' •':''}`])].forEach(([i,t])=>{const x=el('button',UI.face===i?'on':'',t);x.onclick=()=>selectFace(i);ch.appendChild(x);});
    if(UI.face<0){fbox.appendChild(el('div','hint','아래 설정은 모든 얼굴에 적용돼요. 얼굴 하나만 따로 보정하려면 번호를 누르거나 사진에서 그 얼굴을 누르세요. • 표시는 개별 설정이 있는 얼굴이에요.'));
      sub(fbox,'얼굴별 강도');for(let i=0;i<n;i++)slider(fbox,{path:'portrait.fw.'+i,label:`얼굴 ${i+1}`,hl:`얼굴 ${i+1} 강도`,min:0,max:150,def:100,fmt:v=>Math.round(v)+'%'});}
    else{const i=UI.face;fbox.appendChild(el('div','hint',`지금은 얼굴 ${i+1}만 보정해요. 아래 피부·눈·윤곽·메이크업 값과 잡티 자동 제거가 이 얼굴에만 적용돼요.`));
      slider(fbox,{path:'portrait.fw.'+i,label:'강도',hl:`얼굴 ${i+1} 강도`,min:0,max:150,def:100,fmt:v=>Math.round(v)+'%'});
      if((po.pf||[])[i])btn(fbox,'이 얼굴 개별 설정 지우기 (전체 설정 따르기)',clearFaceOverrides,'btn full');}
    controls.slice(st).forEach(c=>c.sync());}});
  const af=btn(b,'못 찾은 얼굴 추가 (얼굴을 눌러서)',()=>{if(!STORE.portrait.get(P().portrait.aid)&&!cur._faces){toast('먼저 ‘얼굴·피부 분석’을 해 주세요');return;}UI.pick='addFace';updateModeUI();},'btn full');af.style.marginTop='4px';
  const bl=el('button','btn full');bl.innerHTML='역광 인물 살리기 '+aiBadge();bl.style.marginTop='6px';bl.onclick=backlitFix;b.appendChild(bl);
  controls.push({sync(){const pd=STORE.portrait.get(P().portrait.aid);info.textContent=pd?`얼굴 ${pd.faces.length}개 인식됨. 아래 슬라이더로 보정하세요.`:'먼저 분석하면 피부·눈·치아·윤곽 보정을 쓸 수 있어요. (처음 한 번 약 20MB를 내려받아요)';}});
  S('피부');
  slider(b,{path:'portrait.smooth',label:'부드럽게',hl:'피부 부드럽게',min:0,max:100,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.keep',label:'결 살리기',hl:'피부결',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.red',label:'붉은기 줄이기',min:0,max:100,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.bright',label:'화사하게',hl:'피부 화사하게',min:-50,max:100});
  slider(b,{path:'ui:blemSens',label:'잡티 감도',min:0,max:100,def:50,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v)});
  btn(b,'잡티 자동 제거',autoBlemish,'btn full').style.marginTop='4px';
  b.appendChild(el('div','hint','콧구멍·눈·눈썹·입술 주변과 길쭉한 주름은 건너뛰어요. 너무 많이 지워지면 감도를 낮추세요.'));
  S('적용 범위 다듬기',true);
  b.appendChild(el('div','hint','AI가 잡은 범위가 어색하면 직접 칠해서 고쳐요. 고를 부위를 누르면 그 범위가 분홍색으로 보여요.'));
  chipsCtl(b,'ui:pe.c',Object.entries(PE_CH).map(([k,v])=>[k,v[0]]),{noCommit:true,always:true,onSet:()=>{if(!UI.pe.on)peToggle(true);else{requestRender();updateModeUI();}}});
  chipsCtl(b,'ui:pe.m',[['add','더하기'],['erase','지우기']],{noCommit:true,always:true,onSet:()=>{updateModeUI();drawOverlay();}});
  slider(b,{path:'ui:pe.size',label:'브러시 크기',min:4,max:200,def:30,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v),onSet:drawOverlay});
  const pr=el('div','row2');pr.style.marginTop='6px';b.appendChild(pr);
  const pt=btn(pr,'다듬기 시작',()=>peToggle(),'btn',{always:true});btn(pr,'이 부위 되돌리기',peReset,'btn');
  controls.push({sync(){pt.textContent=UI.pe.on?'다듬기 끝내기':'다듬기 시작';pt.classList.toggle('primary',UI.pe.on);}});
  S('눈 · 치아');
  slider(b,{path:'portrait.eyes',label:'흰자 밝게',min:0,max:100,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.iris',label:'눈동자 선명',min:0,max:100,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.teeth',label:'치아 미백',min:0,max:100,fmt:v=>Math.round(v)});
  slider(b,{path:'portrait.dark',label:'다크서클 완화',min:0,max:100,fmt:v=>Math.round(v)});
  S('메이크업');
  slider(b,{path:'portrait.lip',label:'입술 색',min:0,max:100,fmt:v=>Math.round(v)});
  chipsCtl(b,'portrait.lipH',[[352,'로즈'],[2,'레드'],[14,'코랄'],[335,'핑크'],[22,'누드'],[320,'플럼']],{hl:'입술 색상'});
  slider(b,{path:'portrait.blush',label:'볼 터치',min:0,max:100,fmt:v=>Math.round(v)});
  chipsCtl(b,'portrait.blushH',[[6,'코랄'],[350,'로즈'],[20,'피치'],[330,'핑크']],{hl:'볼 터치 색상'});
  slider(b,{path:'portrait.brow',label:'눈썹 진하게',min:-100,max:100});
  S('얼굴 윤곽');
  slider(b,{path:'portrait.slim',label:'턱선 갸름',min:-100,max:100});
  slider(b,{path:'portrait.width',label:'얼굴 폭',hl:'얼굴 폭 줄이기',min:-100,max:100});
  slider(b,{path:'portrait.eye',label:'눈 크기',min:-100,max:100});
  slider(b,{path:'portrait.nose',label:'코 폭',hl:'코 폭 줄이기',min:-100,max:100});
  slider(b,{path:'portrait.smile',label:'입꼬리',min:-100,max:100});
  btn(b,'인물 보정 초기화',()=>{const a=P().portrait.aid;P().portrait=Object.assign(defaults().portrait,{aid:a});syncUI();requestRender();commit('인물 보정 초기화');},'btn sm').style.marginTop='6px';
  S('픽셀 유동화 (수동)',true);
  chipsCtl(b,'ui:liq.mode',[['off','끄기'],['push','밀기'],['bloat','부풀리기'],['pucker','오므리기'],['restore','복원']],{noCommit:true,always:true,onSet:v=>{if(v!=='off'&&(UI.pe.on||UI.pv)){UI.pe.on=false;UI.pv=false;requestRender();syncUI();}updateModeUI();}});
  slider(b,{path:'ui:liq.size',label:'크기',min:5,max:500,def:80,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v),onSet:drawOverlay});
  slider(b,{path:'ui:liq.str',label:'강도',min:5,max:100,def:35,noCommit:true,noRender:true,always:true,fmt:v=>Math.round(v)});
  const sr=el('div','msens');sr.innerHTML='<span>조절 감도 (유동화 · 터치 슬라이더)</span>';b.appendChild(sr);sensChips(sr);
  btn(b,'유동화 모두 지우기',()=>{P().liquify=[];requestRender();commit('유동화 지우기');},'btn sm').style.marginTop='6px';
  b.appendChild(el('div','hint',(typeof MB!=='undefined'&&MB.touch?'유동화는 AI 없이 쓸 수 있어요. 확대해서 작게, 여러 번 나눠 밀면 자연스러워요. 두 손가락 탭 = 실행 취소, 세 손가락 탭 = 다시 실행':'유동화는 AI 없이 쓸 수 있어요. 브러시로 밀어서 턱선이나 머리 모양을 직접 다듬으세요. <kbd>[</kbd> <kbd>]</kbd> 크기')));
  S('얼굴 가리기 (초상권 보호)',true);
  b.appendChild(el('div','hint','함께 찍힌 다른 사람의 얼굴을 모자이크로 가려요. 가린 부분은 원본 픽셀 단계에서 처리돼서, 다른 보정으로 되살아나지 않고 내보낸 파일에 항상 들어가요.'));
  const pvb=btn(b,'가리기 시작',()=>pvToggleMode(),'btn full',{always:true});
  const pr0=el('div','row2');pr0.style.margin='6px 0';b.appendChild(pr0);btn(pr0,'모든 얼굴 가리기',()=>pvAll(),'btn');btn(pr0,'모두 해제',pvClear,'btn');
  const pvx=btn(b,'고른 얼굴만 빼고 모두 가리기',()=>{if(UI.face<0){toast('위 ‘보정할 얼굴’에서 내 얼굴 번호를 먼저 고르세요');return;}pvAll(UI.face);},'btn full');
  const pvc=el('div','chips facechips');b.appendChild(pvc);let pvk='';
  controls.push({sync(){pvb.textContent=UI.pv?'가리기 끝내기':'가리기 시작';pvb.classList.toggle('primary',UI.pv);
    pvx.textContent=UI.face>=0?`얼굴 ${UI.face+1}만 빼고 모두 가리기`:'고른 얼굴만 빼고 모두 가리기';
    const fs=pvFaces(),k=fs.length+':'+fs.map((_,i)=>pvCovered(i)?1:0).join('');if(k===pvk)return;pvk=k;pvc.innerHTML='';
    fs.forEach((_,i)=>{const x=el('button',pvCovered(i)?'on':'',`얼굴 ${i+1}${pvCovered(i)?' 가림':''}`);x.onclick=()=>pvToggleFace(i);pvc.appendChild(x);});}});
  chipsCtl(b,'privacy.style',[['mosaic','모자이크'],['blur','흐리게'],['solid','검게 칠하기']],{hl:'가리기 방식'});
  slider(b,{path:'privacy.amt',label:'가리는 세기',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  slider(b,{path:'privacy.expand',label:'범위 넓히기',min:0,max:100,def:35,fmt:v=>Math.round(v)});
}
/* ---- 편집 › 하늘 교체 · 조명 ---- */
function buildSkyLight(b){
  const h=el('div','sub');h.innerHTML='하늘 교체 '+aiBadge();b.appendChild(h);
  const g0=group(b,()=>!P().sky.on);btn(g0,'AI로 하늘 찾아서 바꾸기',skyEnable,'btn full');g0.appendChild(el('div','hint','처음 한 번 장면 분할 모델(약 15MB)을 내려받아요.'));
  const g=group(b,()=>P().sky.on);chk(g,'하늘 교체 사용','sky.on',{hl:'하늘 교체'});
  const gal=el('div','skygal');g.appendChild(gal);
  SKIES.forEach(([k,n])=>{const x=el('button','skyit');x.innerHTML=`<img alt=""><span>${n}</span>`;x._k=k;x.onclick=()=>setSky(k);gal.appendChild(x);});
  const up=el('button','skyit');up.innerHTML='<i>＋</i><span>내 사진</span>';up.onclick=loadSkyFile;gal.appendChild(up);
  controls.push({sync(){const s=P().sky.src||'';[...gal.children].forEach(x=>x.classList.toggle('on',x._k?x._k===s:s.startsWith('file:')));
    if(P().sky.on&&!gal._th){gal._th=1;let i=0;const step=()=>{const x=gal.children[i++];if(!x||!x._k)return;x.querySelector('img').src=skyThumb(x._k);setTimeout(step,0);};setTimeout(step,0);}}});
  slider(g,{path:'sky.amt',label:'적용 양',hl:'하늘 적용 양',min:0,max:100,def:100,fmt:v=>Math.round(v)});
  slider(g,{path:'sky.fg',label:'전경 색 맞추기',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  slider(g,{path:'sky.bright',label:'하늘 밝기',min:-100,max:100});
  slider(g,{path:'sky.shift',label:'하늘 위치',min:-100,max:100});
  slider(g,{path:'sky.scale',label:'하늘 크기',min:100,max:250,def:100,fmt:v=>Math.round(v)+'%'});
  slider(g,{path:'sky.edge',label:'가장자리 다듬기',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  chk(g,'하늘 좌우 반전','sky.flip');
  const h2=el('div','sub');h2.innerHTML='입체 조명 (리라이팅) '+aiBadge();b.appendChild(h2);
  const l0=group(b,()=>!P().light.on);btn(l0,'AI로 입체 조명 넣기',lightEnable,'btn full');l0.appendChild(el('div','hint','깊이 모델(27~100MB)로 거리를 계산해 가까운 물체에 빛을 더해요.'));
  const l1=group(b,()=>P().light.on);chk(l1,'조명 사용','light.on',{hl:'입체 조명'});
  slider(l1,{path:'light.amt',label:'빛 세기',min:0,max:100,def:50,fmt:v=>Math.round(v)});
  slider(l1,{path:'light.ang',label:'빛 방향',min:-180,max:180,def:-45,fmt:v=>Math.round(v)+'°'});
  slider(l1,{path:'light.elev',label:'빛 높이',min:5,max:85,def:35,fmt:v=>Math.round(v)+'°'});
  slider(l1,{path:'light.warm',label:'빛 색',hl:'빛 색 (차갑게↔따뜻하게)',min:-100,max:100,def:20});
  slider(l1,{path:'light.amb',label:'배경 어둡게',min:0,max:100,def:20,fmt:v=>Math.round(v)});
  l1.appendChild(el('div','hint','빛 방향: -90°는 위, 0°는 오른쪽, 180°는 왼쪽에서 비춰요.'));}
/* ---- injections into existing panels ---- */
function injectAI(){
  // mask panel
  const mp=$('maskNew');const box=el('div');mp.parentNode.appendChild(box);
  const h=el('div','sub');h.innerHTML='AI로 만들기 '+aiBadge();box.appendChild(h);
  const mr=el('div','inline');mr.style.marginBottom='4px';box.appendChild(mr);
  selectCtl(mr,'적용','ui:aiMode',[['new','새 마스크로'],['add','선택 마스크에 더하기'],['sub','선택 마스크에서 빼기'],['int','선택 마스크와 교차']],{always:true,noCommit:true,noRender:true}).style.flex='1';
  const g=el('div','chips');box.appendChild(g);
  AI_MASKS.forEach(([k,n])=>{const x=el('button');x.textContent=n;x.onclick=()=>{if(!cur)return;if(k==='subject'){UI.pick='aisubject';updateModeUI();}else makeAiMask(k);};g.appendChild(x);});
  box.appendChild(el('div','hint','처음 쓸 때 모델을 내려받아요 (인물·부위 약 16MB, 하늘·건물 등 약 15MB, 피사체 약 6MB).'));
  // crop panel
  const cp=$('pCrop').querySelector('.pad');const anchor=[...cp.querySelectorAll('.sub')].find(x=>x.textContent.startsWith('회전'));
  const cb=el('div');cp.insertBefore(cb,anchor);const ch=el('div','sub');ch.innerHTML='AI 구도 추천 '+aiBadge();cb.appendChild(ch);
  btn(cb,'주요 피사체를 찾아 구도 추천받기',aiCropSuggest,'btn full');
  dyn(cb,d=>{d.innerHTML='';if(!UI.cropSug||!cur)return;const c=el('div','chips');c.style.marginTop='6px';d.appendChild(c);
    UI.cropSug.forEach((s,i)=>{const x=el('button');x.textContent=`추천 ${i+1} · ${s.label}`;x.onclick=()=>{const g2=P().geo;g2.aspect=s.k;g2.crop=clone(s.crop);syncUI();requestRender();commit('AI 구도 추천 '+(i+1));};c.appendChild(x);});});
  // retouch
  const rp=$('pRetouch').querySelector('.pad');const rh=$('retHint');const rbox=el('div');rh.after(rbox);
  const fg=group(rbox,()=>UI.ret.mode==='fill');chk(fg,'AI 고품질 채우기 (LaMa · 처음 한 번 약 200MB)','ui:ret.ai',{noCommit:true,always:true});
  // left › 사진
  const left=$('left').querySelector('.sec .secb');const lb=el('div');left.appendChild(lb);const lh=el('div','sub');lh.innerHTML='AI 선별 '+aiBadge();lb.appendChild(lh);
  const lg=el('div','btnrow');lb.appendChild(lg);btn(lg,'흐림·눈 감은 사진 찾기',aiCull,'btn',{always:true});btn(lg,'문제 사진 거부 표시',rejectProblems,'btn',{always:true});btn(lg,'비슷한 사진에서 베스트 컷 픽',bestShots,'btn',{always:true});
  lb.appendChild(el('div','hint','선택한 사진(없으면 필터에 보이는 전체)을 검사해요.'));
  const sy=$('secSync'),ab=el('div');sy.appendChild(ab);
  const bh=el('div','sub');bh.innerHTML='AI 보정 다시 계산해서 적용 '+aiBadge();ab.appendChild(bh);
  [['portrait','인물 보정 (피부·눈·윤곽)'],['makeup','메이크업'],['bokeh','보케 · 포커스'],['sky','하늘 교체'],['light','입체 조명']].forEach(([k,n])=>chk(ab,n,'ui:batch.'+k,{noCommit:true,noRender:true,always:true}));
  btn(ab,'현재 사진의 AI 보정을 다른 사진에 적용',batchAI,'btn full',{always:true});
  ab.appendChild(el('div','hint',(MB.touch?'필름 스트립에서 사진을 길게 눌러':'필름 스트립에서 Ctrl/⌘+클릭으로')+' 고른 사진(없으면 필터에 보이는 전체)에, 사진마다 AI 분석을 새로 해서 같은 값을 적용해요.'));
  if(pwaOK()){const pb=btn(lb,'AI 모델 모두 받기 (오프라인용)',packAll,'btn full',{always:true});pb.style.marginTop='8px';}
  // film search
  const film=$('film');const sw=el('div','fsearch');sw.innerHTML='<input class="txt" placeholder="AI 태그 검색 (예: 바다)" list="tagList"><datalist id="tagList"></datalist><button class="btn sm" title="AI로 사진 태그 만들기">태그 생성</button>';
  film.insertBefore(sw,$('thumbs'));
  const stk=el('label','chk fstack');stk.innerHTML='<input type="checkbox"><span>비슷한 사진 묶기</span>';stk.title='연속 촬영처럼 비슷한 사진을 하나로 묶어서 보여줘요';sw.appendChild(stk);
  stk.firstChild.onchange=e=>toggleStacks(e.target.checked);
  // AI overlay toggle (top bar)
  const sp=$('bSplit');const ov=el('button','tb');ov.id='bAIOv';ov.title='AI가 보정한 영역 표시 (I)';ov.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg><span class="lbl">AI 영역</span>';
  sp.after(ov);ov.onclick=()=>toggleAIOv();controls.push({sync(){ov.classList.toggle('on',UI.aiOv);ov.disabled=!cur;}});const inp=sw.querySelector('input');inp.oninput=()=>{UI.tagQuery=inp.value.trim();applyFilter();};
  sw.querySelector('button').onclick=()=>photos.length&&aiTagAll();sw.querySelector('datalist').innerHTML=TAGS.map(t=>`<option value="${t[0]}">`).join('');
  // rec box AI toggle
  const rb=document.querySelector('.recbox');if(rb){const lab=el('label','chk');lab.innerHTML='<input type="checkbox"><span>AI 장면 인식 사용 (얼굴·장면 모델 약 9MB)</span>';rb.insertBefore(lab,rb.firstChild);
    const i=lab.firstChild;i.onchange=async()=>{UI.recAI=i.checked;if(i.checked&&cur){const ph=cur;const r=await aiRun(async()=>{busy(true,'AI가 장면을 분석하는 중…');await nextFrame();const x=await recAIInfo(ph);busy(false);return x;});if(!r)i.checked=UI.recAI=false;}
      recCache=null;syncUI();};}
}

function toggleAIOv(v){UI.aiOv=v??!UI.aiOv;syncUI();requestRender();if(UI.aiOv)toast('분홍: 피부 · 하늘색: 눈·치아 · 자주: 메이크업 · 파랑: 하늘 교체 · 초록: 초점 영역 · 노랑: 윤곽 변형');}

"use strict";
const controls=[];
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;}
function sub(p,t){const d=el('div','sub');d.textContent=t;p.appendChild(d);return d;}
function btn(p,label,fn,cls,o={}){const b=el('button',cls||'btn',label);if(o.id)b.id=o.id;if(o.title)b.title=o.title;b.onclick=e=>{if(!cur&&!o.always)return;fn(e);};p.appendChild(b);return b;}
function group(p,visFn){const g=el('div');p.appendChild(g);controls.push({sync(){g.style.display=visFn()?'':'none';}});return g;}
function section(root,title,build,closed){const sec=el('div','sec'+(closed?' closed':''));
  sec.innerHTML=`<div class="sech"><i class="tri"></i><span>${title}</span><span class="badge2"></span></div><div class="secb"></div>`;
  sec.querySelector('.sech').onclick=()=>{sec.classList.toggle('closed');drawCurve();};build(sec.querySelector('.secb'),sec);root.appendChild(sec);return sec;}
const fmtSigned=v=>(v>0?'+':'')+Math.round(v);
const hueCss=(h,s=100,l=50)=>`hsl(${h},${s}%,${l}%)`;
const G=(...c)=>`linear-gradient(90deg,${c.join(',')})`;
const TR={temp:()=>G('#3f74c9','#9a9a9a','#d8b23a'),tint:()=>G('#3ea34a','#9a9a9a','#c443b4'),exp:()=>G('#111','#eee'),
  vib:()=>G('#8a8a8a','#c25bd1','#e0a03c'),sat:()=>G('#8a8a8a','#e04545','#3ccf6a','#4a6cf0'),dark:()=>G('#111','#777','#eee'),
  rain:()=>G(...[0,60,120,180,240,300,360].map(h=>hueCss(h,75,50)))};
function slider(parent,o){
  const st=o.step||1,fmt=o.fmt||(st<1?(v=>(v>0?'+':'')+(+v).toFixed(st<.1?2:1)):fmtSigned);
  const e=el('div','sl');e.innerHTML=`<label title="더블클릭: 초기화">${o.label}</label><input type="range" min="${o.min}" max="${o.max}" step="${st}"><input class="val" inputmode="decimal">`;
  const [lab,rng,val]=e.children;const def=o.def??0;
  const s={el:e,o,sync(){const v=getP(o.path)??def;rng.value=v;val.value=fmt(+v);e.classList.toggle('changed',+v!==def);if(o.track)rng.style.setProperty('--track',o.track());}};
  const set=v=>{setP(o.path,v);val.value=fmt(v);e.classList.toggle('changed',v!==def);if(o.onSet)o.onSet(v);if(!o.noRender)requestRender();};
  const done=v=>{if(!o.noCommit)commit(`${o.hl||o.label} ${fmt(v)}`);if(o.onDone)o.onDone(v);};
  rng.addEventListener('input',()=>{if(!cur&&!o.always)return;set(+rng.value);});
  rng.addEventListener('change',()=>{if(!cur&&!o.always)return;done(+rng.value);});
  const reset=()=>{if(!cur&&!o.always)return;rng.value=def;set(def);done(def);};
  lab.addEventListener('dblclick',reset);rng.addEventListener('dblclick',reset);
  val.addEventListener('change',()=>{let v=parseFloat(val.value);if(isNaN(v))v=getP(o.path);v=clamp(v,o.min,o.max);rng.value=v;set(v);done(v);val.blur();});
  val.addEventListener('keydown',ev=>{if(ev.key==='Escape'){val.value=fmt(getP(o.path));val.blur();}});
  parent.appendChild(e);controls.push(s);return s;}
function chk(parent,label,path,o={}){const l=el('label','chk');l.innerHTML=`<input type="checkbox"><span>${label}</span>`;const i=l.firstChild;
  i.onchange=()=>{if(!cur&&!o.always){i.checked=false;return;}setP(path,i.checked);if(o.onSet)o.onSet(i.checked);requestRender();if(!o.noCommit)commit(`${o.hl||label} ${i.checked?'켜기':'끄기'}`);};
  parent.appendChild(l);controls.push({sync(){i.checked=!!getP(path);}});return l;}
function colorCtl(parent,label,path,o={}){const r=el('div','frow');r.innerHTML=`<label>${label}</label><input type="color">`;const i=r.lastChild;
  i.oninput=()=>{if(!cur&&!o.always)return;setP(path,i.value);if(o.onSet)o.onSet();requestRender();};i.onchange=()=>{if(!cur&&!o.always)return;if(!o.noCommit)commit(`${o.hl||label} 색상`);};
  parent.appendChild(r);controls.push({sync(){i.value=getP(path)||'#ffffff';}});return r;}
function selectCtl(parent,label,path,opts,o={}){const r=el('div','frow');r.innerHTML=`<label>${label}</label><select></select>`;const s=r.lastChild;
  const fill=()=>{const list=typeof opts==='function'?opts():opts;s.innerHTML='';list.forEach(([v,t])=>{const op=el('option');op.value=v;op.textContent=t;s.appendChild(op);});};fill();
  s.onchange=()=>{if(!cur&&!o.always)return;setP(path,s.value);if(o.onSet)o.onSet(s.value);requestRender();if(!o.noCommit)commit(`${o.hl||label}: ${s.options[s.selectedIndex].text}`);};
  parent.appendChild(r);controls.push({sync(){if(typeof opts==='function')fill();s.value=getP(path)??'';}});return r;}
function chipsCtl(parent,path,opts,o={}){const c=el('div','chips');
  opts.forEach(([v,t])=>{const b=el('button');b.textContent=t;b.onclick=()=>{if(!cur&&!o.always)return;setP(path,v);if(o.onSet)o.onSet(v);syncUI();requestRender();if(!o.noCommit)commit(`${o.hl||''} ${t}`.trim());};b._v=v;c.appendChild(b);});
  parent.appendChild(c);controls.push({sync(){const v=getP(path);[...c.children].forEach(b=>b.classList.toggle('on',b._v===v));}});return c;}
function tabsCtl(parent,path,opts,o={}){const c=el('div','tabs');
  opts.forEach(([v,t])=>{const b=el('button');b.textContent=t;b.onclick=()=>{setP(path,v);if(o.onSet)o.onSet(v);syncUI();};b._v=v;c.appendChild(b);});
  parent.appendChild(c);controls.push({sync(){const v=getP(path);[...c.children].forEach(b=>b.classList.toggle('on',b._v===v));}});return c;}
function textCtl(parent,label,path,o={}){const r=el('div',o.area?'':'frow');r.innerHTML=o.area?`<textarea class="txt"></textarea>`:`<label>${label}</label><input class="txt">`;
  const i=r.lastChild;i.oninput=()=>{if(!cur&&!o.always)return;setP(path,i.value);if(o.onSet)o.onSet();requestRender();};
  i.onchange=()=>{if(!cur&&!o.always)return;if(!o.noCommit)commit(`${o.hl||label} 변경`);};parent.appendChild(r);controls.push({sync(){if(document.activeElement!==i)i.value=getP(path)??'';}});return r;}
function dyn(parent,render){const d=el('div');parent.appendChild(d);controls.push({sync(){render(d);}});return d;}
const dynHooks=[];
const SEC_MOD={};
function secMarks(){[...document.querySelectorAll('.sec')].reverse().forEach(sec=>{if(sec.classList.contains('mnew'))return;let m=false;
  if(cur){const t=sec.querySelector(':scope>.sech span')?.textContent,f=SEC_MOD[t];try{m=(f&&f())||[...sec.querySelectorAll(':scope>.secb .sl.changed')].some(x=>!x.closest('[style*="display: none"]'))||[...sec.querySelectorAll(':scope>.secb .sec')].some(x=>x.classList.contains('mod'));}catch(e){m=false;}}
  sec.classList.toggle('mod',m);});}
function syncUI(){controls.forEach(c=>c.sync());dynHooks.forEach(f=>f());secMarks();drawCurve();renderHistory();
  $('bUndo').disabled=!cur||cur.hi<=0;$('bRedo').disabled=!cur||cur.hi>=cur.history.length-1;}

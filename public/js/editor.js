/* ================= Trazo MEP · interfaz (núcleo + editor) ================= */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=p=>p+Math.random().toString(36).slice(2,8);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const BUILTIN_BG={'builtin:p1':'assets/planos/piso-1.jpg','builtin:p2':'assets/planos/piso-2.jpg'};
const NET_COLOR=k=>css('--'+k);
const ST={P:null,norms:[],R:null,prevR:null,stale:false,view:'plano',lv:null,tool:'sel',sel:null,cam:{k:30,ox:40,oy:40},showBg:true,showNets:true,cal:null,dirty:false,caps:{},imgs:{},autoNav:false,anim:null,pdf:null};
const toast=(m,ms=3200)=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,ms)};
const loadScript=src=>new Promise((res,rej)=>{if([...document.scripts].some(s=>s.src===src))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('No se pudo cargar '+src));document.head.appendChild(s)});
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};

/* ---------- capacidades ---------- */
async function initCaps(){if(!window.claude||!window.claude.use)return;
 const want=['db','sample','downloads','assets'];
 await Promise.all(want.map(async n=>{try{ST.caps[n]=await window.claude.use(n)}catch(e){ST.caps[n]=null}}));
 renderNormas&&ST.view==='normas'&&renderNormas();}

/* ---------- almacenamiento ---------- */
const store={
 async listProjects(){const db=ST.caps.db;let out=[];
  if(db){try{const s=await withTimeout(db.collection('proyectos').get());out=s.docs.map(d=>{const x=d.data();return {id:d.id,nombre:x.nombre,actualizado:x.actualizado,json:x.json,src:'nube'}})}catch(e){}}
  const loc=LS.get('trazo.proyectos',{});for(const id in loc)if(!out.some(o=>o.id===id))out.push({id,nombre:loc[id].nombre,actualizado:loc[id].actualizado,json:loc[id].json,src:'local'});
  return out.sort((a,b)=>(b.actualizado||0)-(a.actualizado||0))},
 async saveProject(P){const json=JSON.stringify(P),rec={nombre:P.nombre,actualizado:Date.now(),json};let where='este navegador';
  const db=ST.caps.db;if(db){try{await withTimeout(db.collection('proyectos').doc(P.id).set(rec));where='la nube del artifact'}catch(e){}}
  const loc=LS.get('trazo.proyectos',{});loc[P.id]=rec;if(!LS.set('trazo.proyectos',loc)&&where==='este navegador')throw new Error('sin espacio');
  LS.set('trazo.last',P.id);return where},
 async deleteProject(id){const db=ST.caps.db;if(db){try{await withTimeout(db.collection('proyectos').doc(id).delete())}catch(e){}}const loc=LS.get('trazo.proyectos',{});delete loc[id];LS.set('trazo.proyectos',loc)},
 async listNorms(){const db=ST.caps.db;let out=[];
  if(db){try{const s=await withTimeout(db.collection('normativas').get());out=s.docs.map(d=>{try{return JSON.parse(d.data().json)}catch(e){return null}}).filter(Boolean)}catch(e){}}
  const loc=LS.get('trazo.normas',{});for(const id in loc)if(!out.some(o=>o.id===id))out.push(loc[id]);return out},
 async saveNorm(N){const db=ST.caps.db;let where='este navegador';if(db){try{await withTimeout(db.collection('normativas').doc(N.id).set({nombre:N.nombre,actualizado:Date.now(),json:JSON.stringify(N)}));where='la nube del artifact'}catch(e){}}
  const loc=LS.get('trazo.normas',{});loc[N.id]=N;LS.set('trazo.normas',loc);return where},
 async deleteNorm(id){const db=ST.caps.db;if(db){try{await withTimeout(db.collection('normativas').doc(id).delete())}catch(e){}}const loc=LS.get('trazo.normas',{});delete loc[id];LS.set('trazo.normas',loc)}};
function withTimeout(p,ms=10000){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))])}

async function download(filename,data,mime){const dl=ST.caps.downloads;const blob=data instanceof Blob?data:new Blob([data],{type:mime||'text/plain'});
 if(dl){try{await dl.save({filename,data:blob});toast('Archivo listo: '+filename);return}catch(e){if(e&&e.code==='declined')return;}}
 if(!window.claude){const u=URL.createObjectURL(blob),el=document.createElement('a');el.href=u;el.download=filename;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Descargado: '+filename);return}
 if(data instanceof Blob){const u=URL.createObjectURL(data);showModal(`<h3>${esc(filename)}</h3><p class="hint">La descarga directa no está disponible en esta vista. Mantén presionada o haz clic derecho sobre la imagen para guardarla.</p><img src="${u}" alt="Vista 3D" style="max-width:100%;border-radius:8px"><div class="row"><button class="btn" data-act="mclose" type="button">Cerrar</button></div>`);return}
 showModal(`<h3>${esc(filename)}</h3><p class="hint">La descarga directa no está disponible en esta vista. Copia el contenido y guárdalo como <b>${esc(filename)}</b>.</p><textarea id="mtext" rows="14" class="mono" readonly>${esc(data)}</textarea><div class="row"><button class="btn primary" data-act="mcopy" type="button">Copiar</button><button class="btn" data-act="mclose" type="button">Cerrar</button></div>`)}
function showModal(html){const m=$('#modal');m.innerHTML=`<div class="card" role="dialog" aria-modal="true">${html}</div>`;m.hidden=false}
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;const act=a.dataset.act;
 if(act==='mclose'){$('#modal').hidden=true}
 if(act==='mcopy'){const t=$('#mtext');navigator.clipboard?.writeText(t.value).then(()=>toast('Copiado'),()=>{t.select();toast('Selecciona y copia el texto')})}
 if(act==='calc')runCalc();
 if(act==='zin')zoomAt(1.25);if(act==='zout')zoomAt(0.8);if(act==='fit'){fitView();drawEd()}});

/* ---------- normativas ---------- */
const normById=id=>ST.norms.find(n=>n.id===id)||ST.norms[0];
async function loadNorms(){const custom=await store.listNorms();ST.norms=BUILTIN_NORMS.map(clone).concat(custom.filter(c=>!BUILTIN_NORMS.some(b=>b.id===c.id)));renderNormSel()}
function renderNormSel(){const s=$('#normSel');s.innerHTML=ST.norms.map(n=>`<option value="${esc(n.id)}">${esc(n.nombre)}${n.builtin?'':' · propia'}</option>`).join('');if(ST.P)s.value=ST.P.normId}
$('#normSel').addEventListener('change',e=>setNorm(e.target.value));
function setNorm(id){if(!ST.P)return;ST.P.normId=id;$('#normSel').value=id;markDirty();
 if(ST.R){const before=ST.R;const R=computeFull(ST.P,normById(id));if(!R.error){ST.prevR=before;ST.R=R;ST.stale=false;updateStale();renderAfterCalc(false);toast(`Recalculado con ${normById(id).nombre}: ${R.ok} cumplen · ${R.warn} advertencias · ${R.fail} no cumplen`,4500)}}
 else toast('Normativa activa: '+normById(id).nombre);
 if(ST.view==='normas')renderNormas()}

/* ---------- proyecto ---------- */
function setProject(P){ST.P=P;ST.R=null;ST.prevR=null;ST.stale=false;ST.sel=null;ST.lv=P.levels[0]&&P.levels[0].id;ST.imgs={};
 $('#pname').value=P.nombre||'';$('#ploc').value=P.ubicacion||'';renderNormSel();updateStale();renderLevels();renderSide();fitView();drawEd();updateBadges();
 LS.set('trazo.last',P.id);$('#saveSt').textContent=P.example?'ejemplo':'';}
function newProject(){return {id:uid('p'),nombre:'Proyecto nuevo',ubicacion:'',normId:ST.P?ST.P.normId:'pe-rne',params:{presion:18,f_acc:1.2},points:{},levels:[{id:uid('l'),name:'Piso 1',elev:0,h:2.5,rooms:[],fixtures:[]}]}}
function markDirty(){if(!ST.P)return;ST.dirty=true;$('#saveSt').textContent='sin guardar';if(ST.R){ST.stale=true;updateStale()}}
function updateStale(){$('#stale').hidden=!(ST.R&&ST.stale)}
$('#pname').addEventListener('input',e=>{ST.P.nombre=e.target.value;markDirty()});
$('#ploc').addEventListener('input',e=>{ST.P.ubicacion=e.target.value;markDirty()});
$('#btnSave').addEventListener('click',saveProject);
async function saveProject(){const P=clone(ST.P);delete P.example;
 // fondos: subir a assets si es posible
 for(const l of P.levels){if(!l.bg||!l.bg.src||l.bg.src.startsWith('builtin:')||!l.bg.src.startsWith('data:'))continue;
  if(ST.caps.assets){try{const blob=await (await fetch(l.bg.src)).blob();const up=await ST.caps.assets.upload(blob);const live=ST.P.levels.find(x=>x.id===l.id);live.bg.src=up.url;l.bg.src=up.url;ST.imgs={};continue}catch(e){}}
  if(l.bg.src.length>1500000){l.bg.src='';toast('El fondo es muy pesado para guardarse aquí; vuelve a subirlo al abrir el proyecto.',5000)}}
 try{const where=await store.saveProject(P);ST.P.example=false;ST.dirty=false;$('#saveSt').textContent='guardado';toast('Proyecto guardado en '+where)}catch(e){toast('No se pudo guardar: '+e.message)}}

/* ---------- pestañas ---------- */
const VIEWS=['plano','calculo','modelo','verif','metrados','normas','proyectos'];
function showView(v,fromHash){if(!VIEWS.includes(v))v='plano';ST.view=v;$$('.tab').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.v===v)));VIEWS.forEach(x=>$('#v-'+x).hidden=x!==v);
 if(!fromHash&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);
 if(v==='plano'){requestAnimationFrame(()=>{drawEd()})}
 if(v==='calculo')renderCalc();if(v==='modelo')show3D();if(v==='verif')renderVerif();if(v==='metrados')renderBom();if(v==='normas')renderNormas();if(v==='proyectos')renderProjects()}
$('#tabs').addEventListener('click',e=>{const t=e.target.closest('.tab');if(t){ST.autoNav=false;showView(t.dataset.v)}});
addEventListener('hashchange',()=>showView(location.hash.slice(1),true));
function updateBadges(){const b=$('#bVerif');if(!ST.R||ST.R.error){b.hidden=true;return}b.hidden=false;b.textContent=ST.R.fail?`${ST.R.fail} ✕`:`${ST.R.ok} ✓`;b.className='badge '+(ST.R.fail?'bad':'ok')}

/* ---------- calcular ---------- */
$('#btnCalc').addEventListener('click',runCalc);
function runCalc(){if(!ST.P)return;const N=normById(ST.P.normId);const R=computeFull(ST.P,N);
 if(R.error){toast(R.error,5000);showView('plano');renderSide();return}
 ST.prevR=ST.R&&ST.R.norm!==R.norm?ST.R:null;ST.R=R;ST.stale=false;updateStale();updateBadges();ST.autoNav=true;showView('calculo')}
function renderAfterCalc(anim){updateBadges();drawEd();if(ST.view==='calculo')renderCalc(anim);if(ST.view==='modelo')show3D(true);if(ST.view==='verif')renderVerif();if(ST.view==='metrados')renderBom()}

/* ================= Editor ================= */
const cv=$('#ed');let ctx=cv.getContext('2d'),DPR=1;
const FX_COL={wc:'#cfd8e1',lav:'#cfd8e1',ducha:'#cfd8e1',lavaplatos:'#cfd8e1',lavadora:'#cfd8e1',lavadero:'#cfd8e1',terma:'#ff9f43',cocina:'#f0c84a',extractor:'#79d2e6'};
const PT_COL={medidor:'--cold',salida:'--drain',tablero:'--power',ducto:'--fg'};
const ROOM_FILL={dormitorio:'105,179,255',sala:'121,210,230',comedor:'121,210,230',cocina:'240,200,74',bano:'63,140,255',lavanderia:'63,140,255',pasillo:'129,144,160',closet:'129,144,160',estudio:'105,179,255',balcon:'70,194,138'};
$('#fxType').innerHTML=Object.entries(FX).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('');
$('#ptType').innerHTML=Object.entries(PTS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
const curLv=()=>ST.P&&(ST.P.levels.find(l=>l.id===ST.lv)||ST.P.levels[0]);
function setTool(t){ST.tool=t;ST.cal=t==='cal'?{pts:[]}:null;$$('#toolbar .tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));
 const H={sel:'Selecciona y arrastra para mover. Arrastra un vértice de un ambiente para cambiar su tamaño. Arrastra el fondo vacío para desplazarte.',room:'Arrastra para dibujar un ambiente rectangular. Se ajusta a 5 cm.',fx:`Haz clic para colocar: ${FX[$('#fxType').value].n}.`,pt:`Haz clic para ubicar: ${PTS[$('#ptType').value]}.`,del:'Haz clic sobre un elemento para borrarlo.',cal:'Marca dos puntos de una cota conocida del plano (por ejemplo, el ancho 4.55 m).',bg:'Arrastra para alinear el plano de fondo con los ambientes.',op:`Arrastra a lo largo de un muro para colocar: ${$('#opType').value}. Se ajusta al eje del muro.`,stair:'Arrastra un rectángulo para la escalera. Define peldaños y sentido en el panel.'};
 $('#edhelp').textContent=H[t]||'';drawEd();renderSide()}
$('#toolbar').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b||e.target.tagName==='SELECT')return;setTool(b.dataset.tool)});
$('#fxType').addEventListener('change',()=>setTool('fx'));$('#opType').addEventListener('change',()=>setTool('op'));$('#ptType').addEventListener('change',()=>setTool('pt'));
$('#showBg').addEventListener('change',e=>{ST.showBg=e.target.checked;drawEd()});$('#showNets').addEventListener('change',e=>{ST.showNets=e.target.checked;drawEd()});

function renderLevels(){const P=ST.P;$('#levels').innerHTML=P.levels.slice().sort((a,b)=>a.elev-b.elev).map(l=>`<button class="lvbtn" type="button" data-lv="${l.id}" aria-pressed="${l.id===ST.lv}">${esc(l.name)}</button>`).join('')+`<button class="lvbtn" type="button" data-lv="+">+ Nivel</button>`}
$('#levels').addEventListener('click',e=>{const b=e.target.closest('[data-lv]');if(!b)return;
 if(b.dataset.lv==='+'){const top=ST.P.levels.reduce((a,l)=>l.elev>a.elev?l:a,ST.P.levels[0]);const l={id:uid('l'),name:`Piso ${ST.P.levels.length+1}`,elev:+(top.elev+top.h+0.2).toFixed(2),h:top.h,rooms:[],fixtures:[]};ST.P.levels.push(l);ST.lv=l.id;markDirty();toast('Nivel agregado. Sube su plano o dibuja los ambientes.')}
 else ST.lv=b.dataset.lv;ST.sel=null;renderLevels();renderSide();fitView();drawEd()});

/* cámara */
function resizeEd(){const r=cv.getBoundingClientRect();DPR=Math.min(devicePixelRatio||1,2);const w=Math.round(r.width*DPR),h=Math.round(r.height*DPR);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}}
new ResizeObserver(()=>{if(ST.view==='plano'){resizeEd();drawEd()}}).observe(cv);
const M2S=(x,y)=>[x*ST.cam.k+ST.cam.ox,y*ST.cam.k+ST.cam.oy];
const S2M=(sx,sy)=>[(sx-ST.cam.ox)/ST.cam.k,(sy-ST.cam.oy)/ST.cam.k];
function levelBounds(l){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const e=(x,y)=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)};
 l.rooms.forEach(r=>{e(r.x0,r.y0);e(r.x1,r.y1)});l.fixtures.forEach(f=>e(f.x,f.y));for(const k in ST.P.points){const p=ST.P.points[k];if(p&&(k==='ducto'||p.lv===l.id))e(p.x,p.y)}
 if(!isFinite(x0)&&l.bg&&l.bg.src){const im=bgImg(l);if(im&&im.naturalWidth){e(l.bg.ox,l.bg.oy);e(l.bg.ox+im.naturalWidth/l.bg.pxPerM,l.bg.oy+im.naturalHeight/l.bg.pxPerM)}}
 if(!isFinite(x0)){x0=0;y0=0;x1=10;y1=10}return [x0,y0,x1,y1]}
function fitView(){resizeEd();const l=curLv();if(!l)return;const [x0,y0,x1,y1]=levelBounds(l),W=cv.width,H=cv.height,pad=40*DPR;
 const k=Math.min((W-2*pad)/Math.max(1,x1-x0),(H-2*pad)/Math.max(1,y1-y0));ST.cam.k=k;ST.cam.ox=(W-(x1-x0)*k)/2-x0*k;ST.cam.oy=(H-(y1-y0)*k)/2-y0*k}
function zoomAt(f,sx,sy){if(sx===undefined){sx=cv.width/2;sy=cv.height/2}const [mx,my]=S2M(sx,sy);ST.cam.k=Math.max(2*DPR,Math.min(600*DPR,ST.cam.k*f));ST.cam.ox=sx-mx*ST.cam.k;ST.cam.oy=sy-my*ST.cam.k;drawEd()}
function bgImg(l){if(!l.bg||!l.bg.src)return null;const src=BUILTIN_BG[l.bg.src]||l.bg.src;let im=ST.imgs[src];if(!im){im=new Image();im.onload=()=>{drawEd()};im.src=src;ST.imgs[src]=im}return im}

/* dibujo */
function drawEd(){if(!ST.P||ST.view!=='plano')return;resizeEd();const l=curLv();const W=cv.width,H=cv.height,k=ST.cam.k;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
 // grilla
 const step=k>60*DPR?0.5:1;const [gx0,gy0]=S2M(0,0),[gx1,gy1]=S2M(W,H);ctx.lineWidth=1;
 for(let x=Math.floor(gx0/step)*step;x<=gx1;x+=step){const sx=M2S(x,0)[0];ctx.strokeStyle=Math.abs(x%5)<1e-6?'rgba(127,145,160,.16)':'rgba(127,145,160,.07)';ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,H);ctx.stroke()}
 for(let y=Math.floor(gy0/step)*step;y<=gy1;y+=step){const sy=M2S(0,y)[1];ctx.strokeStyle=Math.abs(y%5)<1e-6?'rgba(127,145,160,.16)':'rgba(127,145,160,.07)';ctx.beginPath();ctx.moveTo(0,sy);ctx.lineTo(W,sy);ctx.stroke()}
 // fondo
 if(ST.showBg&&l.bg&&l.bg.src&&l.bg.show!==false){const im=bgImg(l);if(im&&im.complete&&im.naturalWidth){const [sx,sy]=M2S(l.bg.ox,l.bg.oy);ctx.save();ctx.globalAlpha=l.bg.op??0.55;ctx.filter='invert(1) hue-rotate(180deg)';ctx.drawImage(im,sx,sy,im.naturalWidth/l.bg.pxPerM*k,im.naturalHeight/l.bg.pxPerM*k);ctx.restore()}}
 // ambientes
 l.rooms.forEach(r=>{const [ax,ay]=M2S(r.x0,r.y0),[bx,by]=M2S(r.x1,r.y1);const sel=ST.sel&&ST.sel.t==='room'&&ST.sel.id===r.id;
  ctx.fillStyle=`rgba(${ROOM_FILL[r.type]||'129,144,160'},${sel?.2:.09})`;ctx.fillRect(ax,ay,bx-ax,by-ay);ctx.strokeStyle=sel?css('--brand'):'rgba(205,218,230,.75)';ctx.lineWidth=(sel?2.2:1.6)*DPR;ctx.strokeRect(ax,ay,bx-ax,by-ay);
  const fs=Math.max(9,Math.min(13,k/DPR*0.32))*DPR;if((bx-ax)>40*DPR&&(by-ay)>22*DPR){ctx.fillStyle='rgba(219,228,236,.9)';ctx.font=`600 ${fs}px "IBM Plex Sans",sans-serif`;ctx.textAlign='center';ctx.fillText(r.name,(ax+bx)/2,(ay+by)/2-fs*0.2);
   ctx.fillStyle='rgba(129,144,160,.95)';ctx.font=`${fs*0.85}px "IBM Plex Mono",monospace`;ctx.fillText(`${fmt((r.x1-r.x0)*(r.y1-r.y0),1)} m²`,(ax+bx)/2,(ay+by)/2+fs*1.0)}
  if(sel){ctx.fillStyle=css('--brand');[[ax,ay],[bx,ay],[bx,by],[ax,by]].forEach(([x,y])=>ctx.fillRect(x-4*DPR,y-4*DPR,8*DPR,8*DPR));
   ctx.fillStyle=css('--brand');ctx.font=`${11*DPR}px "IBM Plex Mono",monospace`;ctx.textAlign='center';ctx.fillText(`${fmt(r.x1-r.x0)} m`,(ax+bx)/2,ay-6*DPR);ctx.save();ctx.translate(bx+12*DPR,(ay+by)/2);ctx.rotate(Math.PI/2);ctx.fillText(`${fmt(r.y1-r.y0)} m`,0,0);ctx.restore()}});
 // muros, vanos y escaleras
 {const wm=wallsOf(l);ctx.fillStyle='rgba(150,166,182,.55)';wm.full.forEach(b=>{const [ax,ay]=M2S(b[0],b[1]),[bx,by]=M2S(b[2],b[3]);ctx.fillRect(ax,ay,bx-ax,by-ay)});
  (l.openings||[]).forEach(o=>{const [ax,ay]=M2S(o.x0,o.y0),[bx,by]=M2S(o.x1,o.y1);const sel=ST.sel&&ST.sel.t==='op'&&ST.sel.id===o.id;const horiz=Math.abs(o.x1-o.x0)>=Math.abs(o.y1-o.y0);const L=Math.hypot(bx-ax,by-ay);
   ctx.strokeStyle=sel?css('--brand'):o.type==='ventana'?css('--vent'):'rgba(219,228,236,.85)';ctx.lineWidth=(sel?2.4:1.4)*DPR;
   if(o.type==='ventana'){const t=0.06*k;[-1,0,1].forEach(s=>{ctx.beginPath();ctx.moveTo(ax+(horiz?0:s*t),ay+(horiz?s*t:0));ctx.lineTo(bx+(horiz?0:s*t),by+(horiz?s*t:0));ctx.stroke()})}
   else if(o.type==='puerta'){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(horiz?ax:ax+L,horiz?ay+L:ay);ctx.stroke();ctx.setLineDash([3*DPR,3*DPR]);ctx.beginPath();if(horiz)ctx.arc(ax,ay,L,0,Math.PI/2*Math.sign(bx-ax||1),bx<ax);else ctx.arc(ax,ay,L,Math.PI/2,0,true);ctx.stroke();ctx.setLineDash([])}
   else{ctx.setLineDash([5*DPR,4*DPR]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();ctx.setLineDash([])}});
  (l.stairs||[]).forEach(s=>{const [ax,ay]=M2S(s.x0,s.y0),[bx,by]=M2S(s.x1,s.y1);const sel=ST.sel&&ST.sel.t==='stair'&&ST.sel.id===s.id;ctx.strokeStyle=sel?css('--brand'):'rgba(219,228,236,.7)';ctx.lineWidth=1.2*DPR;ctx.strokeRect(ax,ay,bx-ax,by-ay);
   const n=s.steps||11,alongY=s.dir==='y'||s.dir==='-y';for(let i=1;i<n;i++){ctx.beginPath();if(alongY){const y=ay+(by-ay)*i/n;ctx.moveTo(ax,y);ctx.lineTo(bx,y)}else{const x=ax+(bx-ax)*i/n;ctx.moveTo(x,ay);ctx.lineTo(x,by)}ctx.stroke()}
   const cx=(ax+bx)/2,cy=(ay+by)/2,d={'-y':[0,-1],'y':[0,1],'-x':[-1,0],'x':[1,0]}[s.dir||'-y'],len=(alongY?Math.abs(by-ay):Math.abs(bx-ax))*0.35;ctx.strokeStyle=css('--brand');ctx.lineWidth=1.6*DPR;ctx.beginPath();ctx.moveTo(cx-d[0]*len,cy-d[1]*len);ctx.lineTo(cx+d[0]*len,cy+d[1]*len);ctx.stroke();ctx.beginPath();ctx.arc(cx+d[0]*len,cy+d[1]*len,3*DPR,0,7);ctx.fillStyle=css('--brand');ctx.fill()})}
 // instalaciones calculadas
 if(ST.showNets&&ST.R&&!ST.R.error){ctx.save();ctx.globalAlpha=ST.stale?0.35:0.95;const order=['drain','water','vent','fire','power'];
  for(const s of order)for(const e of ST.R.D2[s]){if(e.lv!==l.id||e.route)continue;const [ax,ay]=M2S(...e.a),[bx,by]=M2S(...e.b);ctx.strokeStyle=NET_COLOR(e.k);
   ctx.lineWidth=(e.k==='drain'?Math.max(1.5,e.d/40):e.k==='vent'?3.2:e.k==='power'?1:1.6)*DPR;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke()}
  ctx.restore()}
 // aparatos
 const fsz=Math.max(7,Math.min(14,k/DPR*0.22))*DPR;
 l.fixtures.forEach(f=>{const [x,y]=M2S(f.x,f.y);const sel=ST.sel&&ST.sel.t==='fx'&&ST.sel.id===f.id;const s=fsz*1.1;
  ctx.fillStyle='rgba(13,20,27,.9)';ctx.strokeStyle=sel?css('--brand'):FX_COL[f.type]||'#cfd8e1';ctx.lineWidth=(sel?2.2:1.4)*DPR;
  ctx.beginPath();if(f.type==='terma'||f.type==='extractor'||f.type==='lavadora')ctx.arc(x,y,s,0,7);else ctx.rect(x-s,y-s,2*s,2*s);ctx.fill();ctx.stroke();
  ctx.fillStyle=FX_COL[f.type]||'#cfd8e1';ctx.font=`600 ${fsz*0.8}px "IBM Plex Mono",monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(FX[f.type].ab,x,y+0.5);ctx.textBaseline='alphabetic'});
 // puntos
 for(const kk in ST.P.points){const p=ST.P.points[kk];if(!p||(kk!=='ducto'&&p.lv!==l.id))continue;const [x,y]=M2S(p.x,p.y);const s=fsz*1.15;const sel=ST.sel&&ST.sel.t==='pt'&&ST.sel.id===kk;
  ctx.fillStyle=css(PT_COL[kk]);ctx.strokeStyle=sel?css('--brand'):'#0b1016';ctx.lineWidth=2*DPR;ctx.beginPath();
  if(kk==='ducto'){ctx.rect(x-s,y-s*0.6,2*s,1.2*s)}else{ctx.moveTo(x,y-s);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s,y)}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(219,228,236,.95)';ctx.font=`600 ${10*DPR}px "IBM Plex Sans",sans-serif`;ctx.textAlign='left';ctx.fillText(PTS[kk].split(' ')[0]+(kk==='ducto'?' (shaft)':''),x+s+4*DPR,y+4*DPR)}
 // dibujo en curso
 if(drag&&drag.mode==='new'&&drag.kind==='op'){const [ax,ay]=M2S(drag.x0,drag.y0);const horiz=Math.abs(drag.x1-drag.x0)>=Math.abs(drag.y1-drag.y0);const [bx,by]=M2S(horiz?drag.x1:drag.x0,horiz?drag.y0:drag.y1);ctx.strokeStyle=css('--brand');ctx.lineWidth=3*DPR;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke()}
 else if(drag&&drag.mode==='new'){const [ax,ay]=M2S(drag.x0,drag.y0),[bx,by]=M2S(drag.x1,drag.y1);ctx.setLineDash([6*DPR,4*DPR]);ctx.strokeStyle=css('--brand');ctx.lineWidth=2*DPR;ctx.strokeRect(ax,ay,bx-ax,by-ay);ctx.setLineDash([]);
  ctx.fillStyle=css('--brand');ctx.font=`${11*DPR}px "IBM Plex Mono",monospace`;ctx.fillText(`${fmt(Math.abs(drag.x1-drag.x0))} × ${fmt(Math.abs(drag.y1-drag.y0))} m`,Math.min(ax,bx),Math.min(ay,by)-6*DPR)}
 if(ST.cal&&ST.cal.pts.length){ctx.strokeStyle=css('--warn');ctx.fillStyle=css('--warn');ctx.lineWidth=2*DPR;const ps=ST.cal.pts.map(p=>M2S(...p));ps.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,5*DPR,0,7);ctx.fill()});if(ps.length===2){ctx.beginPath();ctx.moveTo(...ps[0]);ctx.lineTo(...ps[1]);ctx.stroke()}}}

/* interacción */
let drag=null;const snap=v=>Math.round(v*20)/20;const pointers=new Map();let pinch=null;
function hit(l,mx,my){const tol=Math.max(0.18,10*DPR/ST.cam.k);
 for(const kk in ST.P.points){const p=ST.P.points[kk];if(p&&(kk==='ducto'||p.lv===l.id)&&Math.hypot(p.x-mx,p.y-my)<tol*1.3)return {t:'pt',id:kk}}
 for(let i=l.fixtures.length-1;i>=0;i--){const f=l.fixtures[i];if(Math.hypot(f.x-mx,f.y-my)<tol*1.3)return {t:'fx',id:f.id}}
 for(const o of (l.openings||[])){const dx=o.x1-o.x0,dy=o.y1-o.y0,L2=dx*dx+dy*dy||1e-9,t=Math.max(0,Math.min(1,((mx-o.x0)*dx+(my-o.y0)*dy)/L2));if(Math.hypot(o.x0+t*dx-mx,o.y0+t*dy-my)<tol)return {t:'op',id:o.id}}
 for(const s of (l.stairs||[]))if(mx>=s.x0&&mx<=s.x1&&my>=s.y0&&my<=s.y1)return {t:'stair',id:s.id};
 for(let i=l.rooms.length-1;i>=0;i--){const r=l.rooms[i];if(mx>=r.x0&&mx<=r.x1&&my>=r.y0&&my<=r.y1)return {t:'room',id:r.id}}return null}
const itemOf=(l,h)=>h.t==='room'?l.rooms.find(r=>r.id===h.id):h.t==='fx'?l.fixtures.find(f=>f.id===h.id):h.t==='op'?(l.openings||[]).find(o=>o.id===h.id):h.t==='stair'?(l.stairs||[]).find(s=>s.id===h.id):ST.P.points[h.id];
const WCACHE={};function wallsOf(l){const key=l.id+JSON.stringify([l.rooms,l.openings||[]]);if(WCACHE[l.id]&&WCACHE[l.id].key===key)return WCACHE[l.id].wm;const wm=wallModel(l);WCACHE[l.id]={key,wm};return wm}
function cornerHit(l,sx,sy){if(!ST.sel||ST.sel.t!=='room')return null;const r=l.rooms.find(x=>x.id===ST.sel.id);if(!r)return null;const cs=[['x0','y0'],['x1','y0'],['x1','y1'],['x0','y1']];
 for(const [a,b] of cs){const [x,y]=M2S(r[a],r[b]);if(Math.hypot(x-sx,y-sy)<10*DPR)return {r,a,b}}return null}
const evPos=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*DPR,(e.clientY-r.top)*DPR]};
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,evPos(e));
 if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),k:ST.cam.k,c:[(a[0]+b[0])/2,(a[1]+b[1])/2]};drag=null;return}
 const [sx,sy]=evPos(e),[mx,my]=S2M(sx,sy),l=curLv(),t=ST.tool;
 if(e.button===1||(t==='sel'&&e.altKey)){drag={mode:'pan',sx,sy,ox:ST.cam.ox,oy:ST.cam.oy};return}
 if(t==='room'||t==='stair'||t==='op'){drag={mode:'new',kind:t,x0:snap(mx),y0:snap(my),x1:snap(mx),y1:snap(my)};return}
 if(t==='fx'){const f={id:uid('f'),type:$('#fxType').value,x:snap(mx),y:snap(my)};l.fixtures.push(f);ST.sel={t:'fx',id:f.id};markDirty();renderSide();drawEd();return}
 if(t==='pt'){const k=$('#ptType').value;ST.P.points[k]=k==='ducto'?{x:snap(mx),y:snap(my)}:{lv:l.id,x:snap(mx),y:snap(my)};ST.sel={t:'pt',id:k};markDirty();renderSide();drawEd();return}
 if(t==='del'){const h=hit(l,mx,my);if(h){delItem(h);}return}
 if(t==='cal'){ST.cal.pts.push([mx,my]);if(ST.cal.pts.length>2)ST.cal.pts=[[mx,my]];renderSide();drawEd();return}
 if(t==='bg'){if(l.bg)drag={mode:'bg',mx,my,ox:l.bg.ox,oy:l.bg.oy};return}
 const c=cornerHit(l,sx,sy);if(c){drag={mode:'corner',...c};return}
 const h=hit(l,mx,my);ST.sel=h;renderSide();drawEd();
 if(h){const it=itemOf(l,h);drag={mode:'move',h,it,mx,my,orig:clone(it)}}
 else drag={mode:'pan',sx,sy,ox:ST.cam.ox,oy:ST.cam.oy}});
cv.addEventListener('pointermove',e=>{const p=evPos(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
 if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const f=d/pinch.d;const [mx,my]=S2M(...pinch.c);ST.cam.k=Math.max(2,Math.min(600*DPR,pinch.k*f));ST.cam.ox=pinch.c[0]-mx*ST.cam.k;ST.cam.oy=pinch.c[1]-my*ST.cam.k;drawEd();return}
 const [mx,my]=S2M(...p);$('#coords').textContent=`x ${fmt(mx)} · y ${fmt(my)} m`;if(!drag)return;
 if(drag.mode==='pan'){ST.cam.ox=drag.ox+p[0]-drag.sx;ST.cam.oy=drag.oy+p[1]-drag.sy}
 else if(drag.mode==='new'){drag.x1=snap(mx);drag.y1=snap(my)}
 else if(drag.mode==='corner'){drag.r[drag.a]=snap(mx);drag.r[drag.b]=snap(my);drag.moved=true}
 else if(drag.mode==='bg'){const l=curLv();l.bg.ox=drag.ox+mx-drag.mx;l.bg.oy=drag.oy+my-drag.my;drag.moved=true}
 else if(drag.mode==='move'){const dx=snap(mx-drag.mx),dy=snap(my-drag.my),o=drag.orig,it=drag.it;if(dx||dy)drag.moved=true;
  if(drag.h.t==='room'||drag.h.t==='op'||drag.h.t==='stair'){it.x0=+(o.x0+dx).toFixed(2);it.x1=+(o.x1+dx).toFixed(2);it.y0=+(o.y0+dy).toFixed(2);it.y1=+(o.y1+dy).toFixed(2)}else{it.x=+(o.x+dx).toFixed(2);it.y=+(o.y+dy).toFixed(2)}}
 drawEd()});
function endPtr(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!drag)return;const l=curLv();
 if(drag.mode==='new'&&drag.kind==='op'){const dx=drag.x1-drag.x0,dy=drag.y1-drag.y0,horiz=Math.abs(dx)>=Math.abs(dy),len=Math.max(Math.abs(dx),Math.abs(dy));
  if(len>=0.3){const wm=wallsOf(l);let best=null,bd=1e9;for(const b of wm.full.concat(...wm.ops.map(x=>x.boxes))){const cx=Math.max(b[0],Math.min(b[2],drag.x0)),cy=Math.max(b[1],Math.min(b[3],drag.y0)),d=Math.hypot(cx-drag.x0,cy-drag.y0);
    const bh=(b[2]-b[0])>=(b[3]-b[1]);if(bh===horiz&&d<bd){bd=d;best=b}}
   let cross=horiz?drag.y0:drag.x0;if(best&&bd<0.4)cross=horiz?+((best[1]+best[3])/2).toFixed(3):+((best[0]+best[2])/2).toFixed(3);
   const tp=$('#opType').value,a0=horiz?Math.min(drag.x0,drag.x1):Math.min(drag.y0,drag.y1),a1=a0+len;
   const o={id:uid('o'),type:tp,x0:horiz?a0:cross,y0:horiz?cross:a0,x1:horiz?a1:cross,y1:horiz?cross:a1,h:tp==='ventana'?1.0:2.0,sill:tp==='ventana'?1.0:0};(l.openings=l.openings||[]).push(o);ST.sel={t:'op',id:o.id};markDirty()}}
 else if(drag.mode==='new'&&drag.kind==='stair'){const x0=Math.min(drag.x0,drag.x1),x1=Math.max(drag.x0,drag.x1),y0=Math.min(drag.y0,drag.y1),y1=Math.max(drag.y0,drag.y1);
  if(x1-x0>=0.5&&y1-y0>=0.5){const s={id:uid('e'),x0,y0,x1,y1,steps:Math.max(6,Math.round(Math.max(x1-x0,y1-y0)/0.28)),dir:(y1-y0)>=(x1-x0)?'-y':'x'};(l.stairs=l.stairs||[]).push(s);ST.sel={t:'stair',id:s.id};markDirty()}}
 else if(drag.mode==='new'){const x0=Math.min(drag.x0,drag.x1),x1=Math.max(drag.x0,drag.x1),y0=Math.min(drag.y0,drag.y1),y1=Math.max(drag.y0,drag.y1);
  if(x1-x0>=0.4&&y1-y0>=0.4){const r={id:uid('r'),name:`Ambiente ${l.rooms.length+1}`,type:'dormitorio',x0,y0,x1,y1,ventana:true};l.rooms.push(r);ST.sel={t:'room',id:r.id};markDirty();toast('Ambiente creado. Define su nombre y tipo en el panel.')}}
 else if(drag.moved){if(drag.mode==='corner'){const r=drag.r;if(r.x0>r.x1)[r.x0,r.x1]=[r.x1,r.x0];if(r.y0>r.y1)[r.y0,r.y1]=[r.y1,r.y0]}markDirty()}
 drag=null;renderSide();drawEd()}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{e.preventDefault();const [sx,sy]=evPos(e);zoomAt(e.deltaY<0?1.12:1/1.12,sx,sy)},{passive:false});
addEventListener('keydown',e=>{if(ST.view!=='plano'||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
 if((e.key==='Delete'||e.key==='Backspace')&&ST.sel){e.preventDefault();delItem(ST.sel)}if(e.key==='Escape'){ST.sel=null;setTool('sel')}});
function delItem(h){const l=curLv();if(h.t==='room')l.rooms=l.rooms.filter(r=>r.id!==h.id);if(h.t==='fx')l.fixtures=l.fixtures.filter(f=>f.id!==h.id);if(h.t==='pt')delete ST.P.points[h.id];if(h.t==='op')l.openings=(l.openings||[]).filter(o=>o.id!==h.id);if(h.t==='stair')l.stairs=(l.stairs||[]).filter(o=>o.id!==h.id);ST.sel=null;markDirty();renderSide();drawEd()}

/* panel lateral */
function renderSide(){if(!ST.P)return;const l=curLv(),P=ST.P,s=ST.sel;let h='';
 if(ST.tool==='cal'){const n=ST.cal?ST.cal.pts.length:0;const d=n===2?Math.hypot(ST.cal.pts[1][0]-ST.cal.pts[0][0],ST.cal.pts[1][1]-ST.cal.pts[0][1]):0;
  h+=`<div class="card"><h3>Calibrar escala del fondo</h3>${l.bg&&l.bg.src?`<p class="hint">${n<2?`Marca el punto ${n+1} de 2 sobre una cota conocida.`:`Distancia medida: <b class="mono">${fmt(d)} m</b>. Escribe la medida real.`}</p>
   ${n===2?`<label class="f">Distancia real (m)<input type="number" id="calD" step="0.01" min="0.1" value="${fmt(d).replace(',','')}"></label><div class="row"><button class="btn primary" data-side="calapply" type="button">Aplicar escala</button><button class="btn" data-side="calreset" type="button">Repetir</button></div>`:''}`:'<p class="hint">Primero sube un plano de fondo en este nivel.</p>'}</div>`}
 if(s){const it=itemOf(l,s);
  if(it){if(s.t==='room')h+=`<div class="card"><h3>Ambiente</h3><label class="f">Nombre<input type="text" data-f="name" value="${esc(it.name)}"></label>
   <label class="f">Tipo<select data-f="type">${Object.entries(ROOM_TYPES).map(([k,v])=>`<option value="${k}"${k===it.type?' selected':''}>${v}</option>`).join('')}</select></label>
   <label class="chk"><input type="checkbox" data-f="ventana"${it.ventana?' checked':''}> Tiene ventana / ventilación natural</label><label class="f">Altura de cielo propia (m, vacío = la del nivel)<input type="number" step="0.05" min="1.8" data-f="rh" value="${it.h??''}"></label>
   <div class="g2"><label class="f">X (m)<input type="number" step="0.05" data-f="x0" value="${it.x0}"></label><label class="f">Y (m)<input type="number" step="0.05" data-f="y0" value="${it.y0}"></label>
   <label class="f">Ancho (m)<input type="number" step="0.05" min="0.3" data-f="w" value="${fmt(it.x1-it.x0).replace(',','')}"></label><label class="f">Largo (m)<input type="number" step="0.05" min="0.3" data-f="h" value="${fmt(it.y1-it.y0).replace(',','')}"></label></div>
   <div class="row"><span class="hint">${fmt((it.x1-it.x0)*(it.y1-it.y0),2)} m²</span><button class="btn sm danger" data-side="del" type="button" style="margin-left:auto">Borrar ambiente</button></div></div>`;
   else if(s.t==='op')h+=`<div class="card"><h3>Vano</h3><label class="f">Tipo<select data-f="type">${[['puerta','Puerta'],['ventana','Ventana'],['vano','Vano libre']].map(([k,v])=>`<option value="${k}"${k===it.type?' selected':''}>${v}</option>`).join('')}</select></label>
   <div class="g2"><label class="f">Ancho (m)<input type="number" step="0.05" min="0.3" data-f="ow" value="${fmt(Math.hypot(it.x1-it.x0,it.y1-it.y0)).replace(',','')}"></label><label class="f">Alto (m)<input type="number" step="0.05" min="0.3" data-f="oh" value="${it.h}"></label>${it.type==='ventana'?`<label class="f">Antepecho (m)<input type="number" step="0.05" min="0" data-f="sill" value="${it.sill}"></label>`:''}</div><button class="btn sm danger" data-side="del" type="button">Borrar vano</button></div>`;
   else if(s.t==='stair')h+=`<div class="card"><h3>Escalera</h3><div class="g2"><label class="f">Peldaños<input type="number" step="1" min="3" data-f="steps" value="${it.steps}"></label><label class="f">Sube hacia<select data-f="dir">${[['-y','arriba del plano'],['y','abajo del plano'],['x','la derecha'],['-x','la izquierda']].map(([k,v])=>`<option value="${k}"${k===it.dir?' selected':''}>${v}</option>`).join('')}</select></label></div><p class="hint">Sube hasta el nivel siguiente.</p><button class="btn sm danger" data-side="del" type="button">Borrar escalera</button></div>`;
   else if(s.t==='fx')h+=`<div class="card"><h3>Aparato</h3><label class="f">Tipo<select data-f="type">${Object.entries(FX).map(([k,v])=>`<option value="${k}"${k===it.type?' selected':''}>${v.n}</option>`).join('')}</select></label>
   <div class="g2"><label class="f">X (m)<input type="number" step="0.05" data-f="x" value="${it.x}"></label><label class="f">Y (m)<input type="number" step="0.05" data-f="y" value="${it.y}"></label></div><p class="hint">${(roomOfPt(l,it.x,it.y)||{name:'Fuera de un ambiente'}).name}</p><button class="btn sm danger" data-side="del" type="button">Borrar aparato</button></div>`;
   else h+=`<div class="card"><h3>${PTS[s.id]}</h3><div class="g2"><label class="f">X (m)<input type="number" step="0.05" data-f="x" value="${it.x}"></label><label class="f">Y (m)<input type="number" step="0.05" data-f="y" value="${it.y}"></label></div>${s.id==='ducto'?'<p class="hint">El ducto vertical es común a todos los niveles: por él suben el montante de desagüe y los alimentadores.</p>':''}<button class="btn sm danger" data-side="del" type="button">Quitar punto</button></div>`}}
 // requisitos
 const req=[['medidor','Medidor de agua'],['salida','Salida de desagüe'],['tablero','Tablero eléctrico']];if(P.levels.length>1)req.push(['ducto','Ducto vertical']);
 const nR=P.levels.reduce((a,x)=>a+x.rooms.length,0),nF=P.levels.reduce((a,x)=>a+x.fixtures.length,0);
 h+=`<div class="card"><h3>Para calcular</h3><div class="req"><span class="${nR?'ok':''}">Ambientes dibujados (${nR})</span><span class="${nF?'ok':''}">Aparatos sanitarios y equipos (${nF})</span>${req.map(([k,n])=>`<span class="${P.points[k]?'ok':''}">${n}</span>`).join('')}</div>
  <p class="hint">Usa la herramienta <b>◆ Punto</b> para ubicar el medidor, la salida, el tablero y el ducto.</p></div>`;
 // nivel
 h+=`<div class="card"><h3>Nivel · ${esc(l.name)}</h3><div class="g2"><label class="f">Nombre<input type="text" data-lvf="name" value="${esc(l.name)}"></label><label class="f">Nivel de piso (m)<input type="number" step="0.05" data-lvf="elev" value="${l.elev}"></label>
  <label class="f">Altura libre (m)<input type="number" step="0.05" min="2" data-lvf="h" value="${l.h}"></label></div>
  <h4>Plano de fondo</h4><div class="row"><button class="btn sm" data-side="upbg" type="button">Subir PDF o imagen</button>${l.bg&&l.bg.src?`<button class="btn sm" data-side="cal" type="button">Calibrar</button><button class="btn sm danger" data-side="rmbg" type="button">Quitar</button>`:''}</div>
  ${ST.pdf&&ST.pdf.lv===l.id&&ST.pdf.n>1?`<label class="f">Página del PDF<select data-side-sel="pdfpage">${Array.from({length:ST.pdf.n},(_,i)=>`<option value="${i+1}"${i+1===ST.pdf.page?' selected':''}>Página ${i+1}</option>`).join('')}</select></label>`:''}
  ${l.bg&&l.bg.src?`<label class="f">Opacidad<input type="range" min="0.1" max="1" step="0.05" data-bgop value="${l.bg.op??0.55}"></label>`:'<p class="hint">Sube la planta de este nivel, calíbrala con una cota y dibuja los ambientes encima.</p>'}
  ${P.levels.length>1?`<button class="btn sm danger" data-side="dellv" type="button">Eliminar este nivel</button>`:''}</div>`;
 // parámetros
 h+=`<div class="card"><h3>Datos del proyecto</h3><div class="g2"><label class="f">Presión de red (m.c.a.)<input type="number" step="0.5" min="1" data-pf="presion" value="${P.params.presion}"></label><label class="f">Factor de accesorios<input type="number" step="0.05" min="1" data-pf="f_acc" value="${P.params.f_acc}"></label></div></div>`;
 // superficies
 {const A=areas(P);const tc=A.reduce((a,x)=>a+x.constr,0);h+=`<div class="card"><h3>Cuadro de superficies</h3><div class="tbl-wrap"><table><thead><tr><th>Nivel</th><th style="text-align:right">Útil</th><th style="text-align:right">Muros</th><th style="text-align:right">Construida</th></tr></thead><tbody>${A.map(x=>`<tr><td>${esc(x.l.name)}</td><td class="n">${fmt(x.util,1)}</td><td class="n">${fmt(x.muros,1)}</td><td class="n">${fmt(x.constr,1)}</td></tr>`).join('')}<tr class="grp"><td>Total</td><td class="n">${fmt(A.reduce((a,x)=>a+x.util,0),1)}</td><td class="n">${fmt(A.reduce((a,x)=>a+x.muros,0),1)}</td><td class="n">${fmt(tc,1)} m²</td></tr></tbody></table></div>
  ${P.ref&&P.ref.superficie_plano?`<p class="hint">El plano declara ${fmt(P.ref.superficie_plano,1)} m² de superficie total edificada: diferencia de ${fmt(Math.abs(tc-P.ref.superficie_plano)/P.ref.superficie_plano*100,1)} %.</p>`:'<p class="hint">Los muros se generan a partir de los ambientes: espesor según la separación entre ellos y 15 cm en el perímetro.</p>'}</div>`}
 // listado
 h+=`<div class="card"><h3>Ambientes de ${esc(l.name)}</h3><div class="list">${l.rooms.map(r=>`<button class="li${s&&s.id===r.id?' sel':''}" data-pick="${r.id}" type="button"><span class="sw" style="background:rgba(${ROOM_FILL[r.type]||'129,144,160'},.8)"></span>${esc(r.name)}<em>${fmt((r.x1-r.x0)*(r.y1-r.y0),1)} m²</em></button>`).join('')||'<p class="hint">Sin ambientes todavía.</p>'}</div>
  <p class="hint">Área total: ${fmt(l.rooms.reduce((a,r)=>a+(r.x1-r.x0)*(r.y1-r.y0),0),1)} m²</p></div>`;
 $('#side').innerHTML=h}
$('#side').addEventListener('input',e=>{const t=e.target,l=curLv(),s=ST.sel;
 if(t.dataset.f&&s){const it=itemOf(l,s);if(!it)return;const f=t.dataset.f;
  if(f==='rh'){if(t.value==='')delete it.h;else it.h=+t.value;markDirty();return}
  if(f==='ow'){const v=+t.value;if(v>0.2){if(Math.abs(it.x1-it.x0)>=Math.abs(it.y1-it.y0))it.x1=+(it.x0+v).toFixed(2);else it.y1=+(it.y0+v).toFixed(2)}markDirty();drawEd();return}
  if(f==='oh'){it.h=+t.value;markDirty();return}if(f==='sill'||f==='steps'){it[f]=+t.value;markDirty();drawEd();return}if(f==='dir'){it.dir=t.value;markDirty();drawEd();return}
  if(f==='name')it.name=t.value;else if(f==='type'){it.type=t.value}else if(f==='ventana')it.ventana=t.checked;
  else if(f==='w'){const v=+t.value;if(v>0.2)it.x1=+(it.x0+v).toFixed(2)}else if(f==='h'){const v=+t.value;if(v>0.2)it.y1=+(it.y0+v).toFixed(2)}
  else if(f==='x0'){const w=it.x1-it.x0;it.x0=+t.value;it.x1=+(it.x0+w).toFixed(2)}else if(f==='y0'){const h=it.y1-it.y0;it.y0=+t.value;it.y1=+(it.y0+h).toFixed(2)}
  else if(f==='x'||f==='y')it[f]=+t.value;markDirty();drawEd();if(t.tagName==='SELECT'||t.type==='checkbox')renderSide()}
 if(t.dataset.lvf){const f=t.dataset.lvf;l[f]=f==='name'?t.value:+t.value;markDirty();if(f==='name')renderLevels()}
 if(t.dataset.pf){ST.P.params[t.dataset.pf]=+t.value;markDirty()}
 if(t.dataset.bgop!==undefined){l.bg.op=+t.value;drawEd()}});
$('#side').addEventListener('change',e=>{if(e.target.dataset.sideSel==='pdfpage'){ST.pdf.page=+e.target.value;renderPdfPage()}});
$('#side').addEventListener('click',e=>{const b=e.target.closest('[data-side],[data-pick]');if(!b)return;const l=curLv();
 if(b.dataset.pick){ST.sel={t:'room',id:b.dataset.pick};renderSide();drawEd();return}
 const a=b.dataset.side;
 if(a==='del'&&ST.sel)delItem(ST.sel);
 if(a==='upbg')$('#fileBg').click();
 if(a==='rmbg'){l.bg=null;markDirty();renderSide();drawEd()}
 if(a==='cal')setTool('cal');
 if(a==='calreset'){ST.cal.pts=[];renderSide();drawEd()}
 if(a==='calapply'){const [A,B]=ST.cal.pts,meas=Math.hypot(B[0]-A[0],B[1]-A[1]),real=+$('#calD').value;if(!(real>0)||!(meas>0))return;
  const f=real/meas,bg=l.bg;const ia=[(A[0]-bg.ox)*bg.pxPerM,(A[1]-bg.oy)*bg.pxPerM];bg.pxPerM=bg.pxPerM/f;const nA=[A[0]*f,A[1]*f];bg.ox=nA[0]-ia[0]/bg.pxPerM;bg.oy=nA[1]-ia[1]/bg.pxPerM;
  ST.cal.pts=[];markDirty();setTool('sel');fitView();drawEd();toast(`Escala aplicada: ${fmt(bg.pxPerM,1)} px por metro.`)}
 if(a==='dellv'){if(b.dataset.confirm!=='1'){b.dataset.confirm='1';b.textContent='Confirmar: eliminar nivel y su contenido';return}ST.P.levels=ST.P.levels.filter(x=>x.id!==l.id);ST.lv=ST.P.levels[0].id;markDirty();renderLevels();renderSide();fitView();drawEd()}});

/* subir fondo (PDF o imagen) */
$('#fileBg').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const l=curLv();
 try{if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){toast('Leyendo PDF…');await ensurePdf();const buf=await f.arrayBuffer();const doc=await pdfjsLib.getDocument({data:buf}).promise;ST.pdf={doc,n:doc.numPages,page:1,lv:l.id,name:f.name};await renderPdfPage()}
  else{const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});const im=new Image();await new Promise(r=>{im.onload=r;im.src=url});
   l.bg={src:url,pxPerM:im.naturalWidth/20,ox:0,oy:0,op:0.6,show:true};afterBg()}}
 catch(err){toast('No se pudo leer el archivo: '+err.message,5000)}});
async function ensurePdf(){if(window.pdfjsLib)return;await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
 try{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}catch(e){}}
async function renderPdfPage(){const p=ST.pdf,l=ST.P.levels.find(x=>x.id===p.lv);const page=await p.doc.getPage(p.page);const vp0=page.getViewport({scale:1});const sc=Math.min(4,5000/Math.max(vp0.width,vp0.height));const vp=page.getViewport({scale:sc});
 const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);await page.render({canvasContext:cx,viewport:vp}).promise;
 const url=c.toDataURL('image/jpeg',0.72);
 // escala inicial suponiendo 1:50 (puntos PDF a 72 ppp)
 const pxPerM=sc*72/0.0254/50;l.bg={src:url,pxPerM,ox:0,oy:0,op:0.6,show:true};afterBg(true)}
function afterBg(pdf){markDirty();ST.imgs={};renderSide();setTimeout(()=>{fitView();drawEd()},60);toast(pdf?'Plano cargado con escala 1:50 supuesta. Calíbralo con una cota conocida para mayor precisión.':'Imagen cargada. Calíbrala con una cota conocida.',6000)}

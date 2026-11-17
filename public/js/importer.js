/* ================= Trazo MEP · importador automático de planos =================
   PDF vectorial con textos → proyecto editable:
   1. Lee los textos con su posición (pdf.js) y reconoce nombres de recintos y títulos de planta.
   2. Agrupa los recintos por planta y deduce el piso de cada grupo.
   3. Renderiza cada planta, borra los textos y obtiene una máscara de muros
      (cierre de 10 cm para unir muros de doble línea, apertura de 3.5 cm para quitar líneas finas).
   4. Desde el nombre de cada recinto lanza rayos en 4 direcciones hasta los muros → rectángulo interior.
   5. Elige la escala que mejor coincide con las cotas escritas en el plano.
   6. Propone aparatos por tipo de recinto, medidor, salida, tablero y ducto. */
const IMP_R=2;               // píxeles por punto PDF al renderizar
const PT_M=72/0.0254;        // puntos PDF por metro real a escala 1:1
const nrm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const ROOM_RX=[[/^(BANO|BANOS|S\.?S\.?H\.?H?\.?|SSHH|W\.?C\.?|TOILET|ASEO|MEDIO BANO)\b/,'bano'],[/^(COCINA|KITCHEN|KITCHENETTE|COCINETA)\b/,'cocina'],[/^(LAVANDERIA|LOGIA|LAVADERO|PATIO DE SERVICIO|LAUNDRY|CUARTO DE LAVADO)\b/,'lavanderia'],
 [/^(DORMITORIO|DORM\.?|HABITACION|HAB\.?|RECAMARA|BEDROOM|PIEZA|ALCOBA|SUITE)\b/,'dormitorio'],[/^(LIVING|SALA|ESTAR|STAR|LIVING-COMEDOR|SALA-COMEDOR)\b/,'sala'],[/^(COMEDOR|DINING)\b/,'comedor'],
 [/^(PASILLO|CIRCULACION|HALL|DISTRIBUIDOR|VESTIBULO|RECIBIDOR|ESCALERA|CORREDOR)\b/,'pasillo'],[/^(WALKING|WALK-IN|CLOSET|VESTIDOR|DESPENSA|BODEGA|DEPOSITO|ROPERO)\b/,'closet'],
 [/^(ESTUDIO|ESCRITORIO|OFICINA|BIBLIOTECA|SALA DE ESTUDIO)\b/,'estudio'],[/^(BALCON|TERRAZA|LOGGIA)\b/,'balcon']];
const FX_RX=[[/^(EXTRACTOR|EXTRACCION)\b/,'extractor'],[/^(INODORO|WATER|EXCUSADO)\b/,'wc'],[/^(LAVAMANOS|LAVATORIO|LAVABO)\b/,'lav'],[/^(DUCHA|TINA|BANERA)\b/,'ducha'],[/^(LAVAPLATOS|LAVAVAJILLA)/,'lavaplatos'],[/^(LAVADORA)\b/,'lavadora'],[/^(TERMA|TERMO|CALEFON|CALENTADOR)\b/,'terma']];
const NOT_ROOM=/(PROPIETARIO|MURO|ANTEJARD|TERRENO|VIVIENDA|LINEA|DESLINDE|SUPERFICIE|ELEVACI|CORTE|PLANTA|EMPLAZ|UBICACI|CUADRO|POLIGONO|ESQ\.|ESCALA|LAMINA|CONTENIDO)/;
const TITLE_RX=/PLANTA|NIVEL|PISO/,TITLE_OK=/(PISO|NIVEL|PRIMER|SEGUND|TERCER|CUART|1ER|2DO|3ER|4TO|SOTANO|ZOCALO|AZOTEA|ALTA|BAJA|TIPICA|ARQ)/,TITLE_NO=/(CUBIERTA|TECHO|EMPLAZ|UBICACI|ESQ\.|SUP\.|ELEVACI|CORTE|FUNDAC|ESTRUCT)/;
const roomTypeOf=n=>{if(NOT_ROOM.test(n)||/[,#@]|\d{3,}/.test(n)||n.length>34)return null;for(const [rx,t] of ROOM_RX)if(rx.test(n))return t;return null};
const fxTypeOf=n=>{for(const [rx,t] of FX_RX)if(rx.test(n))return t;return null};
const titleCase=s=>s.toLowerCase().replace(/(^|[\s(-])([a-záéíóúñ])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\bDe\b/g,'de').replace(/\bDel\b/g,'del');
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};

/* ---------- textos del PDF ---------- */
async function pdfTexts(page){const vp=page.getViewport({scale:1});const tc=await page.getTextContent();
 return tc.items.filter(i=>i.str&&i.str.trim()).map(i=>{const t=pdfjsLib.Util.transform(vp.transform,i.transform);const fh=Math.hypot(t[2],t[3])||8,dl=Math.hypot(t[0],t[1])||1;
  const dx=t[0]/dl,dy=t[1]/dl,ux=t[2]/fh*fh,uy=t[3]/fh*fh;const w=(i.width||fh*i.str.length*0.5);const x0=t[4],y0=t[5],x1=x0+dx*w,y1=y0+dy*w;
  const xs=[x0,x1,x0+ux,x1+ux],ys=[y0,y1,y0+uy,y1+uy];return {s:i.str.trim(),n:nrm(i.str),x:(x0+x1+ux)/2,y:(y0+y1+uy)/2,bb:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],h:fh}})}

/* ---------- morfología binaria (ventana cuadrada separable) ---------- */
function morph(src,w,h,r,dil){if(r<1)return src.slice();const tmp=new Uint8Array(w*h),out=new Uint8Array(w*h),ps=new Int32Array(Math.max(w,h)+1);
 const pass=(get,set,n,m)=>{for(let a=0;a<m;a++){ps[0]=0;for(let b=0;b<n;b++)ps[b+1]=ps[b]+get(a,b);for(let b=0;b<n;b++){const lo=Math.max(0,b-r),hi=Math.min(n,b+r+1),c=ps[hi]-ps[lo];set(a,b,dil?(c>0?1:0):(c===hi-lo&&lo===b-r&&hi===b+r+1?1:0))}}};
 pass((y,x)=>src[y*w+x],(y,x,v)=>tmp[y*w+x]=v,w,h);pass((x,y)=>tmp[y*w+x],(x,y,v)=>out[y*w+x]=v,h,w);return out}
function wallMask(ctx,w,h,pxPerM,texts,org){const d=ctx.getImageData(0,0,w,h).data,m=new Uint8Array(w*h);
 for(let i=0,j=0;i<m.length;i++,j+=4)m[i]=(0.3*d[j]+0.59*d[j+1]+0.11*d[j+2])<165?1:0;
 // borrar textos
 for(const t of texts){const x0=Math.max(0,Math.floor((t.bb[0]-org[0])*IMP_R)-2),y0=Math.max(0,Math.floor((t.bb[1]-org[1])*IMP_R)-2),x1=Math.min(w,Math.ceil((t.bb[2]-org[0])*IMP_R)+2),y1=Math.min(h,Math.ceil((t.bb[3]-org[1])*IMP_R)+2);for(let y=y0;y<y1;y++)m.fill(0,y*w+x0,y*w+Math.max(x0,x1))}
 const rc=Math.max(2,Math.round(0.10*pxPerM)),ro=Math.max(1,Math.round(0.035*pxPerM));
 return morph(morph(morph(morph(m,w,h,rc,true),w,h,rc,false),w,h,ro,false),w,h,ro,true)}

/* ---------- recintos por rayos ---------- */
function castRoom(mask,w,h,cx,cy,pxPerM){const span=Math.round(0.6*pxPerM),step=Math.max(2,Math.round(span/5)),maxD=Math.round(14*pxPerM);
 const ray=(x,y,dx,dy)=>{for(let d=1;d<maxD;d++){const xx=Math.round(x+dx*d),yy=Math.round(y+dy*d);if(xx<0||yy<0||xx>=w||yy>=h)return {d,open:true};if(mask[yy*w+xx])return {d,open:false}}return {d:maxD,open:true}};
 const go=(dx,dy)=>{const ds=[];let open=0;for(let o=-span;o<=span;o+=step){const r=dx?ray(cx,cy+o,dx,0):ray(cx+o,cy,0,dy);ds.push(r.d);if(r.open)open++}return {d:median(ds),open:open>ds.length/2}};
 const L=go(-1,0),R=go(1,0),U=go(0,-1),D=go(0,1);return {x0:cx-L.d,x1:cx+R.d,y0:cy-U.d,y1:cy+D.d,open:L.open||R.open||U.open||D.open}}
function splitOverlaps(rooms){for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j];
 const ix=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),iy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);if(ix<=0.05||iy<=0.05)continue;
 const small=Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0));if(ix*iy<0.08*small)continue;
 const ddx=Math.abs(a.lx-b.lx)/Math.max(0.1,ix),ddy=Math.abs(a.ly-b.ly)/Math.max(0.1,iy);
 if(ddy>=ddx){const [u,d]=a.ly<b.ly?[a,b]:[b,a];const cut=(u.ly+d.ly)/2;if(u.y1>cut)u.y1=cut;if(d.y0<cut)d.y0=cut}
 else{const [l,r]=a.lx<b.lx?[a,b]:[b,a];const cut=(l.lx+r.lx)/2;if(l.x1>cut)l.x1=cut;if(r.x0<cut)r.x0=cut}}}
function snapEdges(rooms){const vals=k=>rooms.flatMap(r=>k.map(q=>({r,q,v:r[q]})));
 for(const ks of [['x0','x1'],['y0','y1']]){const vs=vals(ks).sort((a,b)=>a.v-b.v);let g=[];const flush=()=>{if(g.length>1){const m=g.reduce((s,e)=>s+e.v,0)/g.length;g.forEach(e=>e.r[e.q]=m)}g=[]};
  for(const e of vs){if(g.length&&e.v-g[g.length-1].v>0.05)flush();g.push(e)}flush()}
 rooms.forEach(r=>['x0','x1','y0','y1'].forEach(k=>r[k]=Math.round(r[k]*100)/100))}

/* ---------- aparatos y puntos propuestos ---------- */
function defaultFixtures(rooms,given,state){const out=[];const put=(r,type,u,v)=>{const W=r.x1-r.x0,H=r.y1-r.y0,vert=H>=W,L=vert?H:W,Wd=vert?W:H;u=Math.max(0.3,Math.min(L-0.3,u<0?L+u:u));v=Math.max(0.25,Math.min(Wd-0.25,v<0?Wd+v:v));
  out.push({id:uid('f'),type,x:+(vert?r.x0+v:r.x0+u).toFixed(2),y:+(vert?r.y0+u:r.y0+v).toFixed(2),auto:true})};
 const has=(r,t)=>given.some(f=>f.type===t&&f.x>=r.x0&&f.x<=r.x1&&f.y>=r.y0&&f.y<=r.y1);
 for(const r of rooms){const L=Math.max(r.x1-r.x0,r.y1-r.y0);
  if(r.type==='bano'){if(!has(r,'ducha')&&L>=1.6)put(r,'ducha',-0.45,-0.45);if(!has(r,'wc'))put(r,'wc',L>=1.6?L/2:-0.4,0.3);if(!has(r,'lav'))put(r,'lav',0.35,0.25)}
  if(r.type==='cocina'){if(!has(r,'lavaplatos'))put(r,'lavaplatos',-0.6,0.3);if(!has(r,'cocina'))put(r,'cocina',L>2.2?-1.7:0.4,0.3);if(!state.terma&&!state.hasLav){put(r,'terma',0.3,-0.3);state.terma=true}}
  if(r.type==='lavanderia'){if(!has(r,'lavadora'))put(r,'lavadora',-0.45,-0.35);if(!has(r,'lavadero'))put(r,'lavadero',-1.2,-0.35);if(!state.terma&&!has(r,'terma')){put(r,'terma',0.35,-0.3);state.terma=true}}}
 return out}

/* ---------- importación completa de un PDF ---------- */
async function importPdfProject(file,onStep){const step=m=>onStep&&onStep(m);await ensurePdf();step('Leyendo el PDF…');
 const doc=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;const levels=[],warns=[];let ubic='',bestDoc=null;
 for(let pn=1;pn<=Math.min(doc.numPages,8);pn++){const page=await doc.getPage(pn);const T=await pdfTexts(page);
  // unir "DORMITORIO" + "2"
  const labels=[];T.forEach(t=>{const ty=roomTypeOf(t.n);if(!ty)return;let name=t.s;const nb=T.find(o=>o!==t&&/^\d{1,2}$/.test(o.n)&&Math.abs(o.y-t.y)<t.h*0.8&&o.bb[0]-t.bb[2]<t.h*1.5&&o.bb[0]>=t.bb[2]-1);if(nb&&!/\d$/.test(name))name+=' '+nb.s;labels.push({t,type:ty,name:titleCase(name),x:t.x,y:t.y})});
  if(!ubic){const u=T.find(t=>/^UBICACI/.test(t.n));if(u){const c=T.filter(o=>o!==u&&o.x>u.x-20&&Math.hypot(o.x-u.x,o.y-u.y)<160&&!/:\s*$/.test(o.s)&&/[A-Z]{3}/.test(o.n)).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y));if(c[0])ubic=titleCase(c.slice(0,2).map(o=>o.s).join(', '))}}
  if(labels.length<2)continue;
  // agrupar por cercanía
  const nn=labels.map(a=>Math.min(...labels.filter(b=>b!==a).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));const thr=Math.max(80,Math.min(420,2.6*median(nn)));
  const cl=[];const seen=new Set();for(const a of labels){if(seen.has(a))continue;const g=[a];seen.add(a);for(let k=0;k<g.length;k++)for(const b of labels)if(!seen.has(b)&&Math.hypot(g[k].x-b.x,g[k].y-b.y)<thr){seen.add(b);g.push(b)}cl.push(g)}
  let titles=T.filter(t=>TITLE_RX.test(t.n)&&TITLE_OK.test(t.n)&&!TITLE_NO.test(t.n));if(titles.some(t=>/PLANTA/.test(t.n)))titles=titles.filter(t=>/PLANTA/.test(t.n));
  const groups=[];for(const g of cl){const bx0=Math.min(...g.map(a=>a.x)),bx1=Math.max(...g.map(a=>a.x)),by0=Math.min(...g.map(a=>a.y)),by1=Math.max(...g.map(a=>a.y));
   const cand=titles.filter(t=>t.y<by0+40&&t.x>bx0-420&&t.x<bx1+120).sort((a,b)=>(by0-a.y)-(by0-b.y));const title=cand[0];
   if(g.length<2)continue;if(titles.length&&!title)continue;if(!titles.length&&!(g.length>=3&&bx1-bx0>40&&by1-by0>40))continue;
   groups.push({g,title,bb:[bx0,by0,bx1,by1]})}
  // un grupo por título (el más cercano)
  const byTitle=new Map();for(const G of groups){const k=G.title?G.title.s+G.title.x:'_'+groups.indexOf(G);const prev=byTitle.get(k);if(!prev||G.g.length>prev.g.length)byTitle.set(k,G)}
  const order=s=>{const n=nrm(s||'');if(/SOTANO|ZOCALO/.test(n))return 0;if(/PRIMER|1ER|PISO 1\b|NIVEL 1\b|BAJA/.test(n))return 1;if(/SEGUND|2DO|PISO 2\b|NIVEL 2\b|ALTA/.test(n))return 2;if(/TERCER|3ER|PISO 3\b|NIVEL 3\b/.test(n))return 3;if(/CUART|4TO|PISO 4\b/.test(n))return 4;if(/AZOTEA/.test(n))return 9;return 5};
  const G2=[...byTitle.values()].sort((a,b)=>(order(a.title&&a.title.s)-order(b.title&&b.title.s))||(a.bb[0]-b.bb[0]));
  // escala escrita
  const scaleTxt=T.map(t=>{const m=t.n.match(/\b1\s*[:\/]\s*(\d{2,3})\b/);return m?{t,D:+m[1]}:null}).filter(Boolean);
  const prep=[];for(const G of G2){step(`Analizando ${G.title?titleCase(G.title.s):'planta'}…`);
   const sz=Math.max(G.bb[2]-G.bb[0],G.bb[3]-G.bb[1],120),pad=Math.max(200,0.55*sz);const vp1=page.getViewport({scale:1});
   const org=[Math.max(0,G.bb[0]-pad),Math.max(0,G.bb[1]-pad*0.7)];const end=[Math.min(vp1.width,G.bb[2]+pad),Math.min(vp1.height,G.bb[3]+pad*0.7)];
   const W=Math.round((end[0]-org[0])*IMP_R),H=Math.round((end[1]-org[1])*IMP_R);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,W,H);
   await page.render({canvasContext:x,viewport:page.getViewport({scale:IMP_R}),transform:[1,0,0,1,-org[0]*IMP_R,-org[1]*IMP_R]}).promise;
   const texts=T.filter(t=>t.bb[2]>org[0]&&t.bb[0]<end[0]&&t.bb[3]>org[1]&&t.bb[1]<end[1]);
   const near=scaleTxt.filter(s=>s.t.x>org[0]-100&&s.t.x<end[0]&&s.t.y>org[1]-150&&s.t.y<end[1]);
   const rooms4=D=>{const pxm=IMP_R*PT_M/D;const mask=wallMask(x,W,H,pxm,texts,org);return {mask,pxm,D,rs:G.g.map(a=>{const cx=Math.round((a.x-org[0])*IMP_R),cy=Math.round((a.y-org[1])*IMP_R);const r=castRoom(mask,W,H,cx,cy,pxm);return {...a,px:r,open:r.open}})}};
   const D0=near.length?near[0].D:(scaleTxt.length===1?scaleTxt[0].D:50);
   prep.push({G,c,x,W,H,org,end,texts,rooms4,D0,pass:rooms4(D0),nums:texts.map(t=>t.n.replace(',','.')).filter(s=>/^\d{1,2}\.\d{2}$/.test(s)).map(Number).filter(v=>v>=0.4&&v<=30)})}
  // escala común de la página según coincidencia con las cotas
  const allNums=prep.reduce((a,q)=>a+q.nums.length,0);let Dp=null;
  if(allNums>=4){const D0=prep[0]?prep[0].D0:50;const score=cand=>prep.reduce((acc,q)=>{const k=q.pass.D/cand;const dims=q.pass.rs.flatMap(r=>[(r.px.x1-r.px.x0)/q.pass.pxm*k,(r.px.y1-r.px.y0)/q.pass.pxm*k]);return acc+q.nums.filter(n=>dims.some(dd=>Math.abs(dd-n)<=Math.max(0.04,n*0.025))).length},0);
   const base=score(D0);let best=D0,bs=base;for(const cand of [20,25,50,75,100,125,200]){const sc=score(cand);if(sc>bs+2&&sc>=base*1.5){bs=sc;best=cand}}Dp=best}
  for(const q of prep){const {G,c,x,W,H,org,texts}=q;let pass=q.pass;if(Dp&&Dp!==pass.D)pass=q.rooms4(Dp);const D=pass.D;
   const pxm=pass.pxm;
   // a metros, origen en la esquina superior izquierda del conjunto
   let rooms=pass.rs.map(r=>({id:uid('r'),name:r.name,type:r.type,x0:r.px.x0/pxm,y0:r.px.y0/pxm,x1:r.px.x1/pxm,y1:r.px.y1/pxm,lx:(r.x-org[0])*IMP_R/pxm,ly:(r.y-org[1])*IMP_R/pxm,ventana:true,open:r.open}));
   rooms.forEach(r=>{if(r.open){warns.push(`${r.name}: no se encontró muro en una dirección; revisa su tamaño.`);const cap=6;if(r.x1-r.x0>cap){r.x0=Math.max(r.x0,r.lx-cap/2);r.x1=r.x0+cap}if(r.y1-r.y0>cap){r.y0=Math.max(r.y0,r.ly-cap/2);r.y1=r.y0+cap}}});
   splitOverlaps(rooms);rooms=rooms.filter(r=>r.x1-r.x0>=0.5&&r.y1-r.y0>=0.5);{const cnt={};rooms.forEach(r=>cnt[r.name]=(cnt[r.name]||0)+1);const k={};rooms.slice().sort((a,b)=>a.y0-b.y0||a.x0-b.x0).forEach(r=>{if(cnt[r.name]>1&&!/\d$/.test(r.name)){k[r.name]=(k[r.name]||0)+1;r.name+=' '+k[r.name]}})}
   rooms.filter(r=>r.type==='balcon').forEach(r=>{const o=rooms.filter(q=>q!==r&&q.type!=='balcon');const M=1.8;
    if(o.some(q=>Math.abs(q.y1-r.y0)<0.35))r.y1=Math.min(r.y1,r.y0+M);if(o.some(q=>Math.abs(q.y0-r.y1)<0.35))r.y0=Math.max(r.y0,r.y1-M);
    if(o.some(q=>Math.abs(q.x1-r.x0)<0.35))r.x1=Math.min(r.x1,r.x0+M);if(o.some(q=>Math.abs(q.x0-r.x1)<0.35))r.x0=Math.max(r.x0,r.x1-M)});
   const base=rooms.filter(r=>r.type!=='balcon').length?rooms.filter(r=>r.type!=='balcon'):rooms;const ox=Math.min(...base.map(r=>r.x0)),oy=Math.min(...base.map(r=>r.y0));rooms.forEach(r=>{r.x0-=ox;r.x1-=ox;r.y0-=oy;r.y1-=oy;r.lx-=ox;r.ly-=oy});snapEdges(rooms);
   // aparatos escritos en el plano
   const toM=t=>[(t.x-org[0])*IMP_R/pxm-ox,(t.y-org[1])*IMP_R/pxm-oy];
   const given=texts.map(t=>{const ty=fxTypeOf(t.n);if(!ty)return null;const [mx,my]=toM(t);const r=rooms.find(q=>mx>=q.x0&&mx<=q.x1&&my>=q.y0&&my<=q.y1);if(!r)return null;return {id:uid('f'),type:ty,x:+mx.toFixed(2),y:+my.toFixed(2),r}}).filter(Boolean);
   given.forEach(f=>{if(f.type==='extractor'&&f.r.type==='bano'||f.type==='extractor'&&f.r.type==='cocina')f.r.ventana=false;f.x=Math.min(f.r.x1-0.15,Math.max(f.r.x0+0.15,f.x));f.y=Math.min(f.r.y1-0.15,Math.max(f.r.y0+0.15,f.y));delete f.r});
   const front=texts.filter(t=>/(ANTEJARD|ACCESO|LINEA OFICIAL|CALLE|VEREDA|ENTRADA|INGRESO|AV\.|AVENIDA)/.test(t.n)).map(toM);
   // fondo
   let bgc=c;const maxS=2600;if(Math.max(W,H)>maxS){const f=maxS/Math.max(W,H);bgc=document.createElement('canvas');bgc.width=Math.round(W*f);bgc.height=Math.round(H*f);bgc.getContext('2d').drawImage(c,0,0,bgc.width,bgc.height)}
   const bgPx=pxm*bgc.width/W;
   levels.push({title:G.title?titleCase(G.title.s.replace(/^PLANTA\s*(ARQ\.?|ARQUITECTURA)?\s*/i,'')):`Nivel ${levels.length+1}`,D,rooms:rooms.map(({lx,ly,open,...r})=>r),given,front,
    bg:{src:bgc.toDataURL('image/jpeg',0.72),pxPerM:bgPx,ox:-ox,oy:-oy,op:0.55,show:true}});
   if(!bestDoc)bestDoc={page:pn}}}
 if(!levels.length)return {error:'No encontré nombres de recintos en el PDF (por ejemplo COCINA, BAÑO, DORMITORIO). Si es un plano escaneado o una imagen, súbelo como fondo, calibra la escala y usa "Detectar ambientes".'};
 // armar proyecto
 const P={id:uid('p'),nombre:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim(),ubicacion:ubic,normId:ST.P?ST.P.normId:'pe-rne',params:{presion:18,f_acc:1.2},points:{},levels:[],auto:true};
 const st={terma:false,hasLav:levels.some(l=>l.rooms.some(r=>r.type==='lavanderia'))};let elev=0;
 levels.forEach((L,i)=>{const id='n'+(i+1);const fx=L.given.concat(defaultFixtures(L.rooms,L.given,st));if(fx.some(f=>f.type==='terma'))st.terma=true;
  P.levels.push({id,name:/^(piso|nivel|s[oó]tano)/i.test(L.title)?L.title:(L.title||`Piso ${i+1}`),elev:+elev.toFixed(2),h:2.4,rooms:L.rooms,fixtures:fx,openings:[],stairs:[],bg:L.bg});elev+=2.4+0.2});
 // puntos
 const L1=P.levels[0],F=levels[0].front;const bx=[0,0,Math.max(...L1.rooms.map(r=>r.x1)),Math.max(...L1.rooms.map(r=>r.y1))];
 let side='bottom';if(F.length){const fx=F.reduce((a,p)=>a+p[0],0)/F.length,fy=F.reduce((a,p)=>a+p[1],0)/F.length;const d={top:fy-bx[1],bottom:bx[3]-fy,left:fx-bx[0],right:bx[2]-fx};side=Object.entries(d).sort((a,b)=>a[1]-b[1])[0][0];
  if(fy>bx[3])side='bottom';else if(fy<bx[1])side='top';else if(fx<bx[0])side='left';else if(fx>bx[2])side='right'}
 const along=(t,off)=>side==='bottom'?{x:bx[0]+(bx[2]-bx[0])*t,y:bx[3]+off}:side==='top'?{x:bx[0]+(bx[2]-bx[0])*t,y:bx[1]-off}:side==='left'?{x:bx[0]-off,y:bx[1]+(bx[3]-bx[1])*t}:{x:bx[2]+off,y:bx[1]+(bx[3]-bx[1])*t};
 const r2=v=>+v.toFixed(2);const md=along(0.12,0.45),sl=along(0.6,0.5);P.points.medidor={lv:L1.id,x:r2(md.x),y:r2(md.y)};P.points.salida={lv:L1.id,x:r2(sl.x),y:r2(sl.y)};
 const frontRoom=L1.rooms.slice().sort((a,b)=>{const c=r=>side==='bottom'?-r.y1:side==='top'?r.y0:side==='left'?r.x0:-r.x1;return c(a)-c(b)})[0];
 if(frontRoom){const tb=side==='bottom'?{x:frontRoom.x0+0.15,y:frontRoom.y1-0.3}:side==='top'?{x:frontRoom.x0+0.15,y:frontRoom.y0+0.3}:side==='left'?{x:frontRoom.x0+0.15,y:frontRoom.y0+0.3}:{x:frontRoom.x1-0.15,y:frontRoom.y0+0.3};P.points.tablero={lv:L1.id,x:r2(tb.x),y:r2(tb.y)}}
 if(P.levels.length>1){const up=P.levels.slice(1).flatMap(l=>l.rooms.filter(r=>r.type==='bano'));const low=L1.rooms.filter(r=>['bano','cocina','lavanderia'].includes(r.type));const b=up[0]||L1.rooms.find(r=>r.type==='bano')||L1.rooms[0];
  const tgt=low.length?low.map(r=>[(r.x0+r.x1)/2,(r.y0+r.y1)/2]).sort((p,q)=>Math.hypot(p[0]-(b.x0+b.x1)/2,p[1]-(b.y0+b.y1)/2)-Math.hypot(q[0]-(b.x0+b.x1)/2,q[1]-(b.y0+b.y1)/2))[0]:[(b.x0+b.x1)/2,b.y1];
  const cx=Math.max(b.x0+0.15,Math.min(b.x1-0.15,tgt[0])),cands=[{x:cx,y:b.y0-0.07,d:Math.abs(tgt[1]-b.y0)},{x:cx,y:b.y1+0.07,d:Math.abs(tgt[1]-b.y1)}].sort((p,q)=>p.d-q.d);P.points.ducto={x:r2(cands[0].x),y:r2(cands[0].y)}}
 const nR=P.levels.reduce((a,l)=>a+l.rooms.length,0),nF=P.levels.reduce((a,l)=>a+l.fixtures.length,0);
 return {P,report:{levels:P.levels.length,rooms:nR,fixtures:nF,scale:levels.map(l=>'1:'+l.D).join(', '),warns}}}

/* ---------- detección sobre un fondo ya calibrado (imágenes o PDF escaneado) usando IA para leer los nombres ---------- */
async function detectOnLevel(l,onStep){const step=m=>onStep&&onStep(m);if(!l.bg||!l.bg.src)throw new Error('Este nivel no tiene plano de fondo.');
 const im=bgImg(l);if(!im||!im.complete||!im.naturalWidth)throw new Error('El plano de fondo aún no termina de cargar.');
 const W=im.naturalWidth,H=im.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(im,0,0);
 // nombres de recintos con IA de visión
 const f=Math.min(1,1600/Math.max(W,H)),sc=document.createElement('canvas');sc.width=Math.round(W*f);sc.height=Math.round(H*f);sc.getContext('2d').drawImage(c,0,0,sc.width,sc.height);
 const blob=await new Promise(r=>sc.toBlob(r,'image/jpeg',0.8));step('La IA está leyendo los nombres de los recintos…');
 const prompt=`Esta imagen es la planta de arquitectura de un nivel de una vivienda (${sc.width}×${sc.height} píxeles). Ubica cada recinto con nombre escrito o reconocible (dormitorio, baño, cocina, living, comedor, pasillo, lavandería, closet, estudio, balcón). Devuelve SOLO JSON: {"recintos":[{"nombre":"Baño 1","tipo":"bano|cocina|lavanderia|dormitorio|sala|comedor|pasillo|closet|estudio|balcon","x":0,"y":0}],"aparatos":[{"tipo":"wc|lav|ducha|lavaplatos|lavadora|terma|extractor","x":0,"y":0}]} donde x,y son píxeles del centro del recinto o del aparato. No incluyas cotas ni textos que no sean recintos.`;
 let out;if(ST.caps.sample){out=await ST.caps.sample.json(prompt,{images:[blob],modelTier:'complex'})}else if(CLD()&&window.TrazoCloud.aiImageJSON){out=await window.TrazoCloud.aiImageJSON(prompt,blob)}else throw new Error('Para planos escaneados o imágenes la detección necesita la IA (inicia sesión en la versión publicada en Firebase).');
 const labs=(out&&out.recintos||[]).filter(r=>r&&isFinite(r.x)&&isFinite(r.y)).map(r=>({name:String(r.nombre||ROOM_TYPES[r.tipo]||'Ambiente'),type:ROOM_TYPES[r.tipo]?r.tipo:(roomTypeOf(nrm(r.nombre))||'dormitorio'),cx:Math.round(r.x/f),cy:Math.round(r.y/f)}));
 if(!labs.length)throw new Error('La IA no encontró recintos en la imagen.');step('Detectando muros…');
 const pxm=l.bg.pxPerM,d=x.getImageData(0,0,W,H).data,m=new Uint8Array(W*H);for(let i=0,j=0;i<m.length;i++,j+=4)m[i]=(0.3*d[j]+0.59*d[j+1]+0.11*d[j+2])<165?1:0;
 labs.forEach(a=>{const r=Math.round(0.35*pxm);for(let yy=Math.max(0,a.cy-r/3);yy<Math.min(H,a.cy+r/3);yy++)m.fill(0,yy*W+Math.max(0,a.cx-r),yy*W+Math.min(W,a.cx+r))});
 const rc=Math.max(2,Math.round(0.10*pxm)),ro=Math.max(1,Math.round(0.035*pxm));const mask=morph(morph(morph(morph(m,W,H,rc,true),W,H,rc,false),W,H,ro,false),W,H,ro,true);
 const rooms=labs.map(a=>{const r=castRoom(mask,W,H,a.cx,a.cy,pxm);return {id:uid('r'),name:a.name,type:a.type,x0:r.x0/pxm+l.bg.ox,x1:r.x1/pxm+l.bg.ox,y0:r.y0/pxm+l.bg.oy,y1:r.y1/pxm+l.bg.oy,lx:a.cx/pxm+l.bg.ox,ly:a.cy/pxm+l.bg.oy,ventana:true}});
 splitOverlaps(rooms);const ok=rooms.filter(r=>r.x1-r.x0>=0.5&&r.y1-r.y0>=0.5);snapEdges(ok);ok.forEach(r=>{delete r.lx;delete r.ly});
 const given=(out.aparatos||[]).filter(a=>a&&FX[a.tipo]&&isFinite(a.x)).map(a=>({id:uid('f'),type:a.tipo,x:+(a.x/f/pxm+l.bg.ox).toFixed(2),y:+(a.y/f/pxm+l.bg.oy).toFixed(2)})).filter(fx=>ok.some(r=>fx.x>=r.x0&&fx.x<=r.x1&&fx.y>=r.y0&&fx.y<=r.y1));
 const st={terma:ST.P.levels.some(q=>q!==l&&q.fixtures.some(fx=>fx.type==='terma')),hasLav:ok.some(r=>r.type==='lavanderia')};
 return {rooms:ok,fixtures:given.concat(defaultFixtures(ok,given,st))}}

/* ---------- interfaz del importador ---------- */
function progressModal(msg){showModal(`<h3>Generando el proyecto desde el plano</h3><p class="hint" id="impMsg">${esc(msg)}</p><div class="bar"><i id="impBar" style="width:15%;background:var(--brand);transition:width .4s"></i></div>`)}
function stepModal(m){const el=$('#impMsg');if(el)el.textContent=m;const b=$('#impBar');if(b)b.style.width=Math.min(95,parseFloat(b.style.width)+20)+'%'}
async function runImport(file){progressModal('Leyendo el PDF…');let r;
 try{r=await importPdfProject(file,stepModal)}catch(e){r={error:'No se pudo analizar el PDF: '+e.message}}
 if(r.error){$('#modal').hidden=true;toast(r.error,8000);return false}
 const {P,report}=r;setProject(P);markDirty();setTool('sel');showView('plano');
 showModal(`<h3>Proyecto generado desde «${esc(file.name)}»</h3>
  <div class="kpis"><div class="kpi"><b>${report.levels}</b><span>niveles</span></div><div class="kpi"><b>${report.rooms}</b><span>ambientes</span></div><div class="kpi"><b>${report.fixtures}</b><span>aparatos propuestos</span></div><div class="kpi"><b>${esc(report.scale)}</b><span>escala detectada</span></div></div>
  <div class="diff">${P.levels.map(l=>`<div><span><b>${esc(l.name)}</b> · ${l.rooms.map(x=>esc(x.name)).join(', ')}</span><b>${fmt(l.rooms.reduce((a,x)=>a+(x.x1-x.x0)*(x.y1-x.y0),0),1)} m²</b></div>`).join('')}</div>
  ${report.warns.length?`<p class="hint" style="color:var(--warn)">${report.warns.map(esc).join('<br>')}</p>`:''}
  <p class="hint">Revisa antes de calcular: los ambientes sin nombre en el plano (pasillos, halls) no se detectan y puedes dibujarlos con <b>▭ Ambiente</b>. Los aparatos, el medidor, la salida, el tablero y el ducto son propuestas: muévelos si no coinciden. Ajusta la altura de cada nivel en el panel.</p>
  <div class="row"><button class="btn primary" type="button" data-act="mclose">Revisar el plano</button><button class="btn" type="button" data-act="calc" onclick="document.getElementById('modal').hidden=true">▶ Calcular ahora</button></div>`);
 return true}
async function runDetect(){const l=curLv();progressModal('Preparando…');try{const r=await detectOnLevel(l,stepModal);
  if(!r.rooms.length)throw new Error('No se detectaron ambientes.');l.rooms=l.rooms.concat(r.rooms);l.fixtures=l.fixtures.concat(r.fixtures);markDirty();renderSide();drawEd();$('#modal').hidden=true;
  toast(`Se detectaron ${r.rooms.length} ambientes y ${r.fixtures.length} aparatos en ${l.name}. Revísalos.`,6000)}
 catch(e){$('#modal').hidden=true;toast(e.message,7000)}}

/* ================= Trazo MEP · importador de planos (PDF multipágina, varios archivos, DXF) =================
   Flujo: escanear (todas las hojas de todos los archivos) → elegir plantas/pisos → construir niveles → armar proyecto.
   Cada "hoja" expone: textos con posición (en puntos PDF), tamaño y una función para dibujar una región.
   - PDF: pdf.js (textos y dibujo vectorial).
   - DXF: lector propio (LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, TEXT, MTEXT, INSERT); unidades exactas.
   Detección por planta: nombres de recintos → muros (máscara) → rectángulo por rayos → escala por cotas. */
const PT_M=72/0.0254;
const nrm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const E_=`(?![A-Z0-9])`;
const ROOM_RX=[
 [new RegExp(`^(BANO|BANOS|S\\.?S\\.?H\\.?H?\\.?|SSHH|W\\.?C\\.?|TOILET|ASEO|MEDIO BANO|BANO VISITA)${E_}`),'bano'],
 [new RegExp(`^(COCINA|KITCHEN|KITCHENETTE|COCINETA|COCINA-COMEDOR)${E_}`),'cocina'],
 [new RegExp(`^(LAVANDERIA|LOGIA|LAVADERO|PATIO DE SERVICIO|LAUNDRY|CUARTO DE LAVADO)${E_}`),'lavanderia'],
 [new RegExp(`^(DORMITORIO|DORM\\.?|HABITACION|HAB\\.?|RECAMARA|BEDROOM|PIEZA|ALCOBA|SUITE|DORMITORIO PRINCIPAL)${E_}`),'dormitorio'],
 [new RegExp(`^(LIVING|SALA|ESTAR|STAR|LIVING-COMEDOR|SALA-COMEDOR|ESTAR-COMEDOR|QUINCHO|SALA DE ESTAR|SALON|MULTIUSO|SUM)${E_}`),'sala'],
 [new RegExp(`^(COMEDOR|DINING)${E_}`),'comedor'],
 [new RegExp(`^(PASILLO|CIRCULACION|HALL|DISTRIBUIDOR|VESTIBULO|RECIBIDOR|ESCALERA|CORREDOR|LOBBY|RECEPCION|CAJA ESCALA|CAJA DE ESCALA|ACCESO HOTEL|HALL DE ACCESO|ZONA VERTICAL)${E_}`),'pasillo'],
 [new RegExp(`^(WALKING|WALK-IN|CLOSET|VESTIDOR|DESPENSA|BODEGA|DEPOSITO|ROPERO)${E_}`),'closet'],
 [new RegExp(`^(ESTUDIO|ESCRITORIO|OFICINA|BIBLIOTECA|SALA DE ESTUDIO|ADMINISTRACION)${E_}`),'estudio'],
 [new RegExp(`^(BALCON|TERRAZA|LOGGIA)${E_}`),'balcon'],
 [new RegExp(`^(LOCAL|LOCAL COMERCIAL|TIENDA|COMERCIO)${E_}`),'local'],
 [new RegExp(`^(SALA DE (BOMBAS|MAQUINAS|BASURA|CALDERAS|TABLEROS|MEDIDORES|BASURAS)|SALA ELECTRICA|ESTANQUES?|CUARTO TECNICO|BASURERO|SALA TECNICA|GRUPO ELECTROGENO|MEDIDORES|SUBESTACION|SALA DE GAS)${E_}`),'tecnico']];
const FX_RX=[[/^(EXTRACTOR|EXTRACCION)/,'extractor'],[/^(INODORO|EXCUSADO)\b/,'wc'],[/^(LAVAMANOS|LAVATORIO|LAVABO)\b/,'lav'],[/^(DUCHA|TINA|BANERA)\b/,'ducha'],[/^(LAVAPLATOS|LAVAVAJILLA)/,'lavaplatos'],[/^(LAVADORA)\b/,'lavadora'],[/^(TERMA|TERMO|CALEFON|CALENTADOR)\b/,'terma']];
const NOT_ROOM=/(PROPIETARIO|MURO|ANTEJARD|TERRENO|VIVIENDA|LINEA|DESLINDE|SUPERFICIE|ELEVACI|CORTE|PLANTA|EMPLAZ|UBICACI|CUADRO|POLIGONO|ESQ\.|ESCALA 1|LAMINA|CONTENIDO|ESTACIONAMIENTO|^EST\.|BICICLET|RAMPA|AREA VERDE|JARDIN|PROYECC|FRANJA|SOBRELOSA|VACIO|VOLADIZO|ASCENSOR|DEPTO|DEPARTAMENTO TIPO|NIVEL|PISO|LOSA|CUBIERTA|ALERO|PERGOLA|ESTANQUE ELEVADO|CIELO)/;
const TITLE_RX=/(PLANTA|NIVEL|PISO|SUBTERRANEO|SOTANO)/,TITLE_OK=/(PISO|NIVEL|PRIMER|SEGUND|TERCER|CUART|QUINT|1ER|2DO|3ER|4TO|SOTANO|SUBTERRANEO|ZOCALO|AZOTEA|ALTA|BAJA|TIPICA|TIPO|ARQ|TERRAZA|MECANICO|\d)/,TITLE_NO=/(CUBIERTA|TECHUMBRE|TECHO|EMPLAZ|UBICACI|ESQ\.|SUP\.|ELEVACI|CORTE|FUNDAC|ESTRUCT|DE ESTACIONAMIENTOS? \d|CUADRO|ESQUEMA|SUPERFICIE|NIVEL DE PISO|NPT|N\.P\.T|N\.T\.N|COTA)/;
const roomTypeOf=n=>{if(NOT_ROOM.test(n)||/[,#@]|\d{3,}/.test(n)||n.length>34)return null;for(const [rx,t] of ROOM_RX)if(rx.test(n))return t;return null};
const fxTypeOf=n=>{for(const [rx,t] of FX_RX)if(rx.test(n))return t;return null};
const titleCase=s=>s.toLowerCase().replace(/(^|[\s(-])([a-záéíóúñ])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(De|Del|La|Y)\b/g,m=>m.toLowerCase());
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
const levelNumOf=s=>{const n=nrm(s);let m=n.match(/(?:NIVEL|PISO|(?<![A-Z])N[°º.]?)\s*(-\s*\d{1,3}|\d{1,3})(?!\d)/);if(m)return parseInt(m[1].replace(/\s/g,''),10);if(/SUBTERRANEO|SOTANO/.test(n))return -1;
 const W={PRIMER:1,'1ER':1,SEGUND:2,'2DO':2,TERCER:3,'3ER':3,CUART:4,'4TO':4,QUINT:5,'5TO':5};for(const k in W)if(n.includes(k))return W[k];if(/BAJA|ZOCALO/.test(n))return 1;if(/ALTA/.test(n))return 2;return null};

/* ---------- hojas PDF ---------- */
async function pdfSheets(file){await ensurePdf();const doc=await pdfjsLib.getDocument({data:await file.arrayBuffer(),verbosity:0}).promise;const out=[];
 for(let pn=1;pn<=doc.numPages;pn++){const page=await doc.getPage(pn);const vp=page.getViewport({scale:1});const tc=await page.getTextContent();
  const T=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>{const t=pdfjsLib.Util.transform(vp.transform,i.transform);const fh=Math.hypot(t[2],t[3])||8,dl=Math.hypot(t[0],t[1])||1;
   const dx=t[0]/dl,dy=t[1]/dl,ux=t[2],uy=t[3];const w=(i.width||fh*i.str.length*0.5);const x0=t[4],y0=t[5],x1=x0+dx*w,y1=y0+dy*w;
   const xs=[x0,x1,x0+ux,x1+ux],ys=[y0,y1,y0+uy,y1+uy];return {s:i.str.trim(),x:(x0+x1+ux)/2,y:(y0+y1+uy)/2,bb:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],h:fh,dx,dy}});
  out.push({file:file.name,kind:'pdf',pn,npages:doc.numPages,W:vp.width,H:vp.height,T:mergeLines(T),fixedD:null,
   render:async(ctx,org,R)=>{await page.render({canvasContext:ctx,viewport:page.getViewport({scale:R}),transform:[1,0,0,1,-org[0]*R,-org[1]*R]}).promise}})}
 return out}
/* une textos de la misma línea separados por poco espacio ("SALA DE" + "BOMBAS") */
function mergeLines(T){const used=new Set(),out=[];const srt=T.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
 for(const a of srt){if(used.has(a))continue;used.add(a);let cur={...a};
  for(;;){const nb=srt.find(b=>!used.has(b)&&Math.abs(b.dx-cur.dx)<0.1&&Math.abs(b.dy-cur.dy)<0.1&&Math.abs(b.h-cur.h)<cur.h*0.3&&
    (Math.abs(cur.dx)>0.7?Math.abs(b.y-cur.y)<cur.h*0.5&&b.bb[0]-cur.bb[2]<cur.h*1.1&&b.bb[0]>=cur.bb[2]-cur.h*0.3:Math.abs(b.x-cur.x)<cur.h*0.5&&Math.abs(b.bb[1]-cur.bb[3])<cur.h*1.1));
   if(!nb||/^\d+([.,]\d+)?$/.test(nb.s)&&!/^\d{1,2}$/.test(nb.s))break;used.add(nb);cur={...cur,s:cur.s+' '+nb.s,bb:[Math.min(cur.bb[0],nb.bb[0]),Math.min(cur.bb[1],nb.bb[1]),Math.max(cur.bb[2],nb.bb[2]),Math.max(cur.bb[3],nb.bb[3])]};cur.x=(cur.bb[0]+cur.bb[2])/2;cur.y=(cur.bb[1]+cur.bb[3])/2}
  cur.n=nrm(cur.s);out.push(cur)}return out}

/* ---------- morfología binaria rápida ---------- */
function morph(src,w,h,r,dil){if(r<1)return src.slice();const tmp=new Uint8Array(w*h),out=new Uint8Array(w*h),ps=new Int32Array(Math.max(w,h)+1);
 for(let y=0;y<h;y++){const o=y*w;ps[0]=0;for(let x=0;x<w;x++)ps[x+1]=ps[x]+src[o+x];for(let x=0;x<w;x++){const lo=x-r,hi=x+r+1;if(dil){const c=ps[hi>w?w:hi]-ps[lo<0?0:lo];tmp[o+x]=c>0?1:0}else tmp[o+x]=(lo>=0&&hi<=w&&ps[hi]-ps[lo]===2*r+1)?1:0}}
 for(let x=0;x<w;x++){ps[0]=0;for(let y=0;y<h;y++)ps[y+1]=ps[y]+tmp[y*w+x];for(let y=0;y<h;y++){const lo=y-r,hi=y+r+1;if(dil){const c=ps[hi>h?h:hi]-ps[lo<0?0:lo];out[y*w+x]=c>0?1:0}else out[y*w+x]=(lo>=0&&hi<=h&&ps[hi]-ps[lo]===2*r+1)?1:0}}
 return out}
// muros = trazos gruesos rellenos (poché) o pares de líneas paralelas a 6–26 cm, de al menos ~45 cm de largo.
// Las líneas sueltas (muebles, cotas, ejes) no forman muro.
function wallMaskFrom(ctx,w,h,pxPerM,boxes){const d=ctx.getImageData(0,0,w,h).data,N=w*h,m=new Uint8Array(N);
 for(let i=0,j=0;i<N;i++,j+=4)m[i]=(0.3*d[j]+0.59*d[j+1]+0.11*d[j+2])<(window.WTH||228)?1:0;
 for(const b of boxes){const x0=Math.max(0,Math.floor(b[0])-2),y0=Math.max(0,Math.floor(b[1])-2),x1=Math.min(w,Math.ceil(b[2])+2),y1=Math.min(h,Math.ceil(b[3])+2);for(let y=y0;y<y1;y++)if(x1>x0)m.fill(0,y*w+x0,y*w+x1)}
 const P=pxPerM,gIn=Math.max(2,Math.round(0.035*P)),tMin=Math.max(3,Math.round(0.07*P)),tMax=Math.round(0.6*P),gMax=Math.round(0.27*P),Lmin=Math.round(0.45*P);
 // scan a line (stride, count): clusters of dark runs → evidence
 const ev=(start,stride,n,out)=>{let cl=null;const cls=[];let i=0;while(i<n){if(m[start+i*stride]){let j=i;while(j<n&&m[start+j*stride])j++;if(cl&&i-cl.b<=gIn){cl.b=j;cl.k++}else{cl={a:i,b:j,k:1};cls.push(cl)}i=j}else i++}
  for(let k=0;k<cls.length;k++){const c=cls[k],t=c.b-c.a;if(t>=tMin&&t<=tMax)for(let q=c.a;q<c.b;q++)out[start+q*stride]=1;
   const nx=cls[k+1];if(nx){const g=nx.a-c.b;if(g>gIn&&g<=gMax&&c.b-c.a<tMin*2&&nx.b-nx.a<tMin*2)for(let q=c.a;q<nx.b;q++)out[start+q*stride]=1}}};
 const eh=new Uint8Array(N),evv=new Uint8Array(N);for(let x=0;x<w;x++)ev(x,w,h,eh);for(let y=0;y<h;y++)ev(y*w,1,w,evv);
 // largo mínimo: muros horizontales en eh (runs en x), verticales en evv (runs en y)
 const out=new Uint8Array(N);
 for(let y=0;y<h;y++){const o=y*w;let x=0;while(x<w){if(eh[o+x]){let j=x;while(j<w&&eh[o+j])j++;if(j-x>=Lmin)out.fill(1,o+x,o+j);x=j}else x++}}
 for(let x=0;x<w;x++){let y=0;while(y<h){if(evv[y*w+x]){let j=y;while(j<h&&evv[j*w+x])j++;if(j-y>=Lmin)for(let q=y;q<j;q++)out[q*w+x]=1;y=j}else y++}}
 // unir esquinas y pequeños cortes
 const rc=Math.max(1,Math.round(0.05*P));const res=morph(morph(out,w,h,rc,true),w,h,rc,false);
 // máscara clásica (cierre + apertura): segunda opinión para cada recinto
 const m2=new Uint8Array(N);for(let i=0,j=0;i<N;i++,j+=4)m2[i]=(0.3*d[j]+0.59*d[j+1]+0.11*d[j+2])<165?1:0;for(const b of boxes){const x0=Math.max(0,Math.floor(b[0])-2),y0=Math.max(0,Math.floor(b[1])-2),x1=Math.min(w,Math.ceil(b[2])+2),y1=Math.min(h,Math.ceil(b[3])+2);for(let y=y0;y<y1;y++)if(x1>x0)m2.fill(0,y*w+x0,y*w+x1)}
 const r2=Math.max(2,Math.round(0.10*P)),ro=Math.max(1,Math.round(0.035*P));res.alt=morph(morph(morph(morph(m2,w,h,r2,true),w,h,r2,false),w,h,ro,false),w,h,ro,true);return res}

/* ---------- recintos por rayos ---------- */
function castRoom(mask,w,h,cx,cy,pxPerM){const A=castRoom1(mask,w,h,cx,cy,pxPerM);if(!mask.alt)return A;const B=castRoom1(mask.alt,w,h,cx,cy,pxPerM);
 if(!A)return B;if(!B)return A;if(A.open&&!B.open)return B;if(B.open&&!A.open)return A;const ar=r=>(r.x1-r.x0)*(r.y1-r.y0);return ar(A)>=ar(B)?A:B}
function castRoom1(mask,w,h,cx,cy,pxPerM){const span=Math.round(0.6*pxPerM),step=Math.max(2,Math.round(span/5)),maxD=Math.round(14*pxPerM);
 const ray=(x,y,dx,dy)=>{for(let d=1;d<maxD;d++){const xx=Math.round(x+dx*d),yy=Math.round(y+dy*d);if(xx<0||yy<0||xx>=w||yy>=h)return {d,open:true};if(mask[yy*w+xx])return {d,open:false}}return {d:maxD,open:true}};
 const go=(dx,dy)=>{const ds=[];let open=0;for(let o=-span;o<=span;o+=step){const r=dx?ray(cx,cy+o,dx,0):ray(cx+o,cy,0,dy);ds.push(r.d);if(r.open)open++}return {d:median(ds),open:open>ds.length/2}};
 const inside=cx>=0&&cy>=0&&cx<w&&cy<h&&mask[cy*w+cx];if(inside)return null;
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
 rooms.forEach(r=>['x0','x1','y0','y1'].forEach(k=>r[k]=Math.round(r[k]*20)/20))}

/* ---------- 1. escaneo: plantas por hoja ---------- */
async function scanSheet(sh){const T=sh.T;
 const labels=[];T.forEach(t=>{const ty=roomTypeOf(t.n);if(!ty)return;let name=t.s;labels.push({t,type:ty,name:titleCase(name.replace(/\s+/g,' ')),x:t.x,y:t.y})});
 const shafts=T.filter(t=>/^(SHAFT|DUCTO)(?![A-Z])/.test(t.n)).map(t=>({x:t.x,y:t.y}));
 const titles=(()=>{let ts=T.filter(t=>TITLE_RX.test(t.n)&&TITLE_OK.test(t.n)&&!TITLE_NO.test(t.n)&&t.n.length<70&&t.h>=median(T.map(q=>q.h))*0.9);if(ts.some(t=>/PLANTA/.test(t.n)))ts=ts.filter(t=>/PLANTA/.test(t.n));return ts})();
 // "PLANTA DE ARQUITECTURA" + "NIVEL 2" en líneas separadas: completar con el texto de abajo
 titles.forEach(t=>{if(levelNumOf(t.s)===null){const nb=T.filter(o=>o!==t&&/NIVEL|PISO|SUBTERRANEO|SOTANO|TERRAZA/.test(o.n)&&Math.abs(o.bb[0]-t.bb[0])<t.h*4&&o.y>t.y&&o.y-t.y<t.h*3.5).sort((a,b)=>a.y-b.y)[0];if(nb){t.s2=nb.s}}});
 if(labels.length<2)return [];
 const nn=labels.map(a=>Math.min(...labels.filter(b=>b!==a).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));const thr=Math.max(60,Math.min(420,3*median(nn)));
 const cl=[];const seen=new Set();for(const a of labels){if(seen.has(a))continue;const g=[a];seen.add(a);for(let k=0;k<g.length;k++)for(const b of labels)if(!seen.has(b)&&Math.hypot(g[k].x-b.x,g[k].y-b.y)<thr){seen.add(b);g.push(b)}cl.push(g)}
 const bbOf=g=>[Math.min(...g.map(a=>a.x)),Math.min(...g.map(a=>a.y)),Math.max(...g.map(a=>a.x)),Math.max(...g.map(a=>a.y))];
 const dist=(t,b)=>{const dx=Math.max(b[0]-t.x,0,t.x-b[2]),dy=Math.max(b[1]-t.y,0,t.y-b[3]);return Math.hypot(dx,dy)};
 const groups=new Map(),orph=[];
 for(const g of cl){const bb=bbOf(g),sz=Math.max(bb[2]-bb[0],bb[3]-bb[1],100);let title=null;
  if(titles.length){const c=titles.map(t=>({t,d:dist(t,bb)})).sort((a,b)=>a.d-b.d)[0];if(c.d<Math.max(320,0.9*sz))title=c.t;else if(titles.length===1&&g.length>=3)title=titles[0];else if(g.length>=6){orph.push(g);continue}}
  if(titles.length&&!title)continue;if(!titles.length&&!(g.length>=3&&bb[2]-bb[0]>30&&bb[3]-bb[1]>30))continue;if(g.length<2&&!(title&&groups.has(title)))continue;
  const key=title||g;if(!groups.has(key))groups.set(key,{title,g:[]});groups.get(key).g.push(...g)}
 // grupos grandes sin título cercano → al título más cercano que quedó sin planta
 for(const g of orph){const bb=bbOf(g);const free=titles.filter(t=>!groups.has(t)).map(t=>({t,d:dist(t,bb)})).sort((a,b)=>a.d-b.d)[0];if(free){groups.set(free.t,{title:free.t,g:[...g]})}}
 const scaleTxt=T.map(t=>{const m=t.n.match(/(?:^|[^0-9])1\s*[:\/]\s*(\d{2,3})(?![0-9])/);return m?{t,D:+m[1]}:null}).filter(Boolean);
 const fileNum=levelNumOf(sh.file.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/°|º/g,''));
 const out=[];for(const {title,g} of groups.values()){if(g.length<2)continue;const bb=bbOf(g);
  const ttxt=title?(title.s+(title.s2?' '+title.s2:'')):'';let num=title?levelNumOf(ttxt):null;
  if(num===null&&groups.size===1&&fileNum!==null)num=fileNum;
  let D=sh.fixedD;if(!D){const ref=title||{x:(bb[0]+bb[2])/2,y:(bb[1]+bb[3])/2};const c=scaleTxt.map(s=>({s,d:Math.hypot(s.t.x-ref.x,s.t.y-ref.y)})).sort((a,b)=>a.d-b.d);D=c.length&&c[0].d<600?c[0].s.D:(scaleTxt.length?median(scaleTxt.map(s=>s.D)):50)}
  let name=ttxt?titleCase(ttxt.replace(/_+/g,' ').replace(/^PLANTA\s*(DE\s*)?(ARQUITECTURA|ARQ\.?)?\s*/i,'').replace(/\s+/g,' ').trim()):'';if(!name&&num!==null)name=num<0?'Subterráneo':`Nivel ${num}`;
  out.push({sheet:sh,title:ttxt,name:name||`Planta ${out.length+1}`,num,labels:g,bb,D,shafts:shafts.filter(s=>s.x>bb[0]-200&&s.x<bb[2]+200&&s.y>bb[1]-200&&s.y<bb[3]+200),T})}
 // misma hoja, mismo nivel (p.ej. título de lámina + título de planta): una sola planta
 const merged=[];for(const p of out){const q=p.num!=null&&merged.find(m=>m.num===p.num);if(q){const ids=new Set(q.labels);p.labels.forEach(a=>{if(!ids.has(a))q.labels.push(a)});q.bb=bbOf(q.labels);q.shafts=shafts.filter(s=>s.x>q.bb[0]-200&&s.x<q.bb[2]+200&&s.y>q.bb[1]-200&&s.y<q.bb[3]+200);if(p.title.length>q.title.length){q.title=p.title;q.name=p.name}}else merged.push(p)}
 return merged}
async function thumbOf(pl){const pad=Math.max(40,0.25*Math.max(pl.bb[2]-pl.bb[0],pl.bb[3]-pl.bb[1]));const org=[Math.max(0,pl.bb[0]-pad),Math.max(0,pl.bb[1]-pad)],end=[Math.min(pl.sheet.W,pl.bb[2]+pad),Math.min(pl.sheet.H,pl.bb[3]+pad)];
 const R=Math.min(2,220/Math.max(end[0]-org[0],end[1]-org[1]));const c=document.createElement('canvas');c.width=Math.max(1,Math.round((end[0]-org[0])*R));c.height=Math.max(1,Math.round((end[1]-org[1])*R));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 try{await pl.sheet.render(x,org,R)}catch(e){}return c.toDataURL('image/jpeg',0.7)}

/* ---------- 2. construir una planta ---------- */
async function buildPlanta(pl,step){const sh=pl.sheet,ptm=PT_M/pl.D;const R=Math.max(0.3,Math.min(3,42/ptm)),pxm=R*ptm;
 const sz=Math.max(pl.bb[2]-pl.bb[0],pl.bb[3]-pl.bb[1]),pad=Math.max(4*ptm,0.08*sz);
 const org=[Math.max(0,pl.bb[0]-pad),Math.max(0,pl.bb[1]-pad)],end=[Math.min(sh.W,pl.bb[2]+pad),Math.min(sh.H,pl.bb[3]+pad)];
 const W=Math.round((end[0]-org[0])*R),H=Math.round((end[1]-org[1])*R);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,W,H);
 step&&step(`Dibujando ${pl.name}…`);await sh.render(x,org,R);
 const texts=pl.T.filter(t=>t.bb[2]>org[0]&&t.bb[0]<end[0]&&t.bb[3]>org[1]&&t.bb[1]<end[1]);
 step&&step(`Detectando muros de ${pl.name}…`);await new Promise(r=>setTimeout(r,0));
 let mx=x;if(sh.renderMask){const c2=document.createElement('canvas');c2.width=W;c2.height=H;mx=c2.getContext('2d',{willReadFrequently:true});mx.fillStyle='#fff';mx.fillRect(0,0,W,H);await sh.renderMask(mx,org,R)}
 const mask=wallMaskFrom(mx,W,H,pxm,texts.map(t=>[(t.bb[0]-org[0])*R,(t.bb[1]-org[1])*R,(t.bb[2]-org[0])*R,(t.bb[3]-org[1])*R]));
 const toM=(px,py)=>[px/pxm+org[0]/ptm,py/pxm+org[1]/ptm];// metros "de hoja"
 let rooms=[];const warns=[];
 for(const a of pl.labels){const cx=Math.round((a.x-org[0])*R),cy=Math.round((a.y-org[1])*R);const r=castRoom(mask,W,H,cx,cy,pxm);if(!r)continue;
  const [x0,y0]=toM(r.x0,r.y0),[x1,y1]=toM(r.x1,r.y1),[lx,ly]=toM(cx,cy);const q={id:uid('r'),name:a.name,type:a.type,x0,y0,x1,y1,lx,ly,ventana:true};
  if(r.open){const cap=a.type==='local'?14:a.type==='pasillo'?10:7;if(x1-x0>cap){q.x0=Math.max(x0,lx-cap/2);q.x1=q.x0+cap}if(y1-y0>cap){q.y0=Math.max(y0,ly-cap/2);q.y1=q.y0+cap}warns.push(`${pl.name} · ${a.name}: sin muro en una dirección, revisa su tamaño.`)}
  rooms.push(q)}
 splitOverlaps(rooms);rooms=rooms.filter(r=>r.x1-r.x0>=0.5&&r.y1-r.y0>=0.5&&(r.x1-r.x0)*(r.y1-r.y0)<1500);
 rooms.filter(r=>r.type==='balcon').forEach(r=>{const o=rooms.filter(q=>q!==r&&q.type!=='balcon');const M=2.2;
  if(o.some(q=>Math.abs(q.y1-r.y0)<0.35))r.y1=Math.min(r.y1,r.y0+M);if(o.some(q=>Math.abs(q.y0-r.y1)<0.35))r.y0=Math.max(r.y0,r.y1-M);
  if(o.some(q=>Math.abs(q.x1-r.x0)<0.35))r.x1=Math.min(r.x1,r.x0+M);if(o.some(q=>Math.abs(q.x0-r.x1)<0.35))r.x0=Math.max(r.x0,r.x1-M)});
 snapEdges(rooms);{const cnt={};rooms.forEach(r=>cnt[r.name]=(cnt[r.name]||0)+1);const k={};rooms.slice().sort((a,b)=>a.y0-b.y0||a.x0-b.x0).forEach(r=>{if(cnt[r.name]>1){const b0=r.name;k[b0]=(k[b0]||0)+1;r.name+=/\d$/.test(b0)?' '+String.fromCharCode(64+k[b0]):' '+k[b0]}})}
 const ptM=t=>[t.x/ptm,t.y/ptm];
 const given=texts.map(t=>{const ty=fxTypeOf(t.n);if(!ty)return null;const [mx,my]=ptM(t);const r=rooms.find(q=>mx>=q.x0&&mx<=q.x1&&my>=q.y0&&my<=q.y1);if(!r)return null;return {id:uid('f'),type:ty,x:mx,y:my,r}}).filter(Boolean);
 const seenX=new Set();const giv=[];given.forEach(f=>{if(f.type==='extractor'&&(f.r.type==='bano'||f.r.type==='cocina'))f.r.ventana=false;const k=f.type+f.r.id;if(seenX.has(k))return;seenX.add(k);f.x=Math.min(f.r.x1-0.15,Math.max(f.r.x0+0.15,f.x));f.y=Math.min(f.r.y1-0.15,Math.max(f.r.y0+0.15,f.y));delete f.r;giv.push(f)});
 const front=texts.filter(t=>/(ANTEJARD|ACCESO|LINEA OFICIAL|CALLE|VEREDA|ENTRADA|INGRESO|AV\.|AVENIDA)/.test(t.n)).map(ptM);
 // fondo
 let bgc=c;const maxS=4096;if(Math.max(W,H)>maxS){const f=maxS/Math.max(W,H);bgc=document.createElement('canvas');bgc.width=Math.round(W*f);bgc.height=Math.round(H*f);bgc.getContext('2d').drawImage(c,0,0,bgc.width,bgc.height)}
 return {pl,rooms,given:giv,front,shafts:pl.shafts.map(ptM),warns,bg:{src:bgc.toDataURL('image/jpeg',0.7),pxPerM:pxm*bgc.width/W,ox:org[0]/ptm,oy:org[1]/ptm,op:0.55,show:true},sheetKey:sh.file+'#'+sh.pn,sheetW:sh.W/ptm,sheetH:sh.H/ptm,D:pl.D}}

/* ---------- 3. aparatos propuestos ---------- */
function defaultFixtures(rooms,given,state){const out=[];const put=(r,type,u,v)=>{const W=r.x1-r.x0,H=r.y1-r.y0,vert=H>=W,L=vert?H:W,Wd=vert?W:H;u=Math.max(0.3,Math.min(L-0.3,u<0?L+u:u));v=Math.max(0.25,Math.min(Wd-0.25,v<0?Wd+v:v));
  out.push({id:uid('f'),type,x:+(vert?r.x0+v:r.x0+u).toFixed(2),y:+(vert?r.y0+u:r.y0+v).toFixed(2),auto:true})};
 const has=(r,t)=>given.some(f=>f.type===t&&f.x>=r.x0&&f.x<=r.x1&&f.y>=r.y0&&f.y<=r.y1);
 for(const r of rooms){const L=Math.max(r.x1-r.x0,r.y1-r.y0);
  if(r.type==='bano'){if(!has(r,'ducha')&&L>=1.6)put(r,'ducha',-0.45,-0.45);if(!has(r,'wc'))put(r,'wc',L>=1.6?L/2:-0.4,0.3);if(!has(r,'lav'))put(r,'lav',0.35,0.25)}
  if(r.type==='cocina'){if(!has(r,'lavaplatos'))put(r,'lavaplatos',-0.6,0.3);if(!has(r,'cocina'))put(r,'cocina',L>2.2?-1.7:0.4,0.3);if(state.termaPer==='cocina'||(!state.terma&&!state.hasLav)){put(r,'terma',0.3,-0.3);state.terma=true}}
  if(r.type==='lavanderia'){if(!has(r,'lavadora'))put(r,'lavadora',-0.45,-0.35);if(!has(r,'lavadero'))put(r,'lavadero',-1.2,-0.35);if(!state.terma&&!has(r,'terma')){put(r,'terma',0.35,-0.3);state.terma=true}}}
 return out}

/* ---------- 4. armar el proyecto ---------- */
function assembleProject(built,opts,base){const P=base||{id:uid('p'),nombre:opts.nombre||'Proyecto importado',ubicacion:opts.ubicacion||'',normId:ST.P?ST.P.normId:'pe-rne',params:{presion:18,f_acc:1.2},points:{},levels:[],auto:true};
 const warns=built.flatMap(b=>b.warns);
 // alineación: hojas distintas con el mismo formato → coordenadas de hoja; varias plantas en una hoja → cada una por su esquina
 const bySheet={};built.forEach(b=>{(bySheet[b.sheetKey]=bySheet[b.sheetKey]||[]).push(b)});
 const multiOnSheet=Object.values(bySheet).some(a=>a.length>1);
 const nonBal=b=>b.rooms.filter(r=>r.type!=='balcon').length?b.rooms.filter(r=>r.type!=='balcon'):b.rooms;
 const minOf=b=>[Math.min(...nonBal(b).map(r=>r.x0)),Math.min(...nonBal(b).map(r=>r.y0))];
 // alineación entre láminas: votación por textos idénticos (ejes, letras de corte, recintos) → funciona con escalas distintas
 const tokOf=b=>{const ptm=PT_M/b.D,bb=b.pl.bb,pd=0.35*Math.max(bb[2]-bb[0],bb[3]-bb[1]);const inR=b.pl.T.filter(t=>t.x>bb[0]-pd&&t.x<bb[2]+pd&&t.y>bb[1]-pd&&t.y<bb[3]+pd&&t.n.length<=24&&/[A-Z0-9]/.test(t.n));
  const cnt={};inR.forEach(t=>cnt[t.n]=(cnt[t.n]||0)+1);return inR.filter(t=>cnt[t.n]===1).map(t=>[t.n,t.x/ptm,t.y/ptm])};
 const vote=(tA,offA,tB)=>{const mA=new Map(tA.map(t=>[t[0],t]));const c=[];for(const t of tB){const a=mA.get(t[0]);if(a)c.push([t[1]-a[1]+offA[0],t[2]-a[2]+offA[1]])}
  if(c.length<3)return null;const bin={};let best=null;c.forEach(o=>{const k=Math.round(o[0]/0.4)+','+Math.round(o[1]/0.4);bin[k]=(bin[k]||0)+1;if(!best||bin[k]>bin[best])best=k});
  const [bx,by]=best.split(',').map(v=>+v*0.4);const sel=c.filter(o=>Math.abs(o[0]-bx)<=0.6&&Math.abs(o[1]-by)<=0.6);if(sel.length<3||sel.length<0.12*c.length)return null;
  return [sel.reduce((a,o)=>a+o[0],0)/sel.length,sel.reduce((a,o)=>a+o[1],0)/sel.length,sel.length]};
 let common=null;const offs=new Map();
 if(!multiOnSheet&&built.length){const withR=built.filter(b=>b.rooms.length);
  let refTok,refOff,refMin;
  if(P.importRef&&P.importRef.tok){refTok=P.importRef.tok;refOff=[P.importRef.ox,P.importRef.oy];refMin=P.importRef.min||[0,0]}
  else if(withR.length){const ref=withR.slice().sort((a,b)=>b.rooms.length-a.rooms.length)[0];refTok=tokOf(ref);refOff=minOf(ref);refMin=[0,0];
   offs.set(ref,refOff);P.importRef={ox:refOff[0],oy:refOff[1],sw:ref.sheetW,D:ref.D,tok:refTok.filter(t=>t[0].length<=12).slice(0,500),min:[0,0]}}
  for(const b of withR){if(offs.has(b))continue;const v=vote(refTok,refOff,tokOf(b));
   if(v){offs.set(b,[v[0],v[1]]);continue}
   if(P.importRef&&P.importRef.D===b.D&&Math.abs(P.importRef.sw-b.sheetW)<0.5){offs.set(b,refOff);continue}
   offs.set(b,minOf(b))}
  common=true}
 const ftf=opts.ftf||2.6,hl=opts.h||2.4;
 const sorted=built.filter(b=>b.rooms.length).sort((a,b)=>((a.pl.num??999)-(b.pl.num??999))||a.sheetKey.localeCompare(b.sheetKey));
 const st={terma:P.levels.some(l=>l.fixtures.some(f=>f.type==='terma')),hasLav:sorted.some(b=>b.rooms.some(r=>r.type==='lavanderia'))};
 const multiUnit=sorted.some(b=>b.rooms.filter(r=>r.type==='cocina').length>1);if(multiUnit)st.termaPer='cocina';
 // pisos tipo: plantas con el mismo conjunto de recintos → copiar geometría exacta
 const sigOf=b=>b.rooms.map(r=>r.type).sort().join(',');const typical={};
 sorted.forEach((b,i)=>{const [ox,oy]=(common&&offs.get(b))||minOf(b);const sh=r=>{r.x0=+(r.x0-ox).toFixed(2);r.x1=+(r.x1-ox).toFixed(2);r.y0=+(r.y0-oy).toFixed(2);r.y1=+(r.y1-oy).toFixed(2);r.lx-=ox;r.ly-=oy};
  b.rooms.forEach(sh);b.given.forEach(f=>{f.x=+(f.x-ox).toFixed(2);f.y=+(f.y-oy).toFixed(2)});b.front=b.front.map(p=>[p[0]-ox,p[1]-oy]);b.shafts=b.shafts.map(p=>[p[0]-ox,p[1]-oy]);b.bg.ox-=ox;b.bg.oy-=oy;
  const near=(p,q)=>{if(Math.abs(p.rooms.length-q.rooms.length)>Math.max(2,0.04*p.rooms.length))return 0;let m=0;for(const r of p.rooms)if(q.rooms.some(z=>z.type===r.type&&Math.abs(z.lx-r.lx)<0.5&&Math.abs(z.ly-r.ly)<0.5))m++;return m/Math.max(p.rooms.length,q.rooms.length)};
  const prev=b.rooms.length>=6?Object.values(typical).find(p=>near(p,b)>=0.85):null;
  if(!prev)typical[b.sheetKey+'|'+i]=b;else{b.typicalOf=prev;b.rooms=prev.rooms.map(r=>({...r,id:uid('r')}));b.given=prev.given.map(f=>({...f,id:uid('f')}))}});
 let idx=P.levels.length;const existingNums=new Set(P.levels.map(l=>l.num).filter(n=>n!=null));
 sorted.forEach(b=>b.rooms.forEach(r=>{delete r.lx;delete r.ly}));let maxN=Math.max(0,...P.levels.map(l=>l.num??0),...sorted.map(b=>b.pl.num??0));const addLv=[];sorted.forEach((b,i)=>{const num=b.pl.num??(++maxN);let elev=num>=1?(num-1)*ftf:num*ftf;if(opts.elevBase!=null)elev=opts.elevBase+i*ftf;
  const fx=b.typicalOf&&b.typicalOf.fxDone?b.typicalOf.fxDone.map(f=>({...f,id:uid('f')})):b.given.concat(defaultFixtures(b.rooms,b.given,st));if(!b.typicalOf)b.fxDone=fx;
  const name=b.pl.name+(existingNums.has(num)?' (2)':'');
  const L={id:uid('l'),name,num,elev:+elev.toFixed(2),h:hl,rooms:b.rooms,fixtures:fx,openings:[],stairs:[],bg:b.bg,src:{sheet:b.sheetKey,D:b.D},typical:b.typicalOf?b.typicalOf.pl.name:null};
  P.levels.push(L);addLv.push(L)});
 // puntos (solo si faltan)
 const lv=P.levels.slice().sort((a,b)=>a.elev-b.elev);const ground=lv.find(l=>l.elev>=-0.01)||lv[0];const gB=sorted.find(b=>P.levels.find(l=>l.rooms===b.rooms)===ground);
 if(ground&&ground.rooms.length&&(!P.points.medidor||!P.points.salida||!P.points.tablero)){const F=gB?gB.front:[];const bx=[Math.min(...ground.rooms.map(r=>r.x0)),Math.min(...ground.rooms.map(r=>r.y0)),Math.max(...ground.rooms.map(r=>r.x1)),Math.max(...ground.rooms.map(r=>r.y1))];
  let side='bottom';if(F.length){const fx=F.reduce((a,p)=>a+p[0],0)/F.length,fy=F.reduce((a,p)=>a+p[1],0)/F.length;const d={top:fy-bx[1],bottom:bx[3]-fy,left:fx-bx[0],right:bx[2]-fx};side=Object.entries(d).sort((a,b)=>a[1]-b[1])[0][0];if(fy>bx[3])side='bottom';else if(fy<bx[1])side='top';else if(fx<bx[0])side='left';else if(fx>bx[2])side='right'}
  const along=(t,off)=>side==='bottom'?{x:bx[0]+(bx[2]-bx[0])*t,y:bx[3]+off}:side==='top'?{x:bx[0]+(bx[2]-bx[0])*t,y:bx[1]-off}:side==='left'?{x:bx[0]-off,y:bx[1]+(bx[3]-bx[1])*t}:{x:bx[2]+off,y:bx[1]+(bx[3]-bx[1])*t};
  const r2=v=>+v.toFixed(2);if(!P.points.medidor){const p=along(0.12,0.45);P.points.medidor={lv:ground.id,x:r2(p.x),y:r2(p.y)}}if(!P.points.salida){const p=along(0.6,0.5);P.points.salida={lv:ground.id,x:r2(p.x),y:r2(p.y)}}
  if(!P.points.tablero){const fr=ground.rooms.slice().sort((a,b)=>{const c=r=>side==='bottom'?-r.y1:side==='top'?r.y0:side==='left'?r.x0:-r.x1;return c(a)-c(b)})[0];
   const tb=side==='bottom'?{x:fr.x0+0.15,y:fr.y1-0.3}:side==='top'?{x:fr.x0+0.15,y:fr.y0+0.3}:side==='left'?{x:fr.x0+0.15,y:fr.y0+0.3}:{x:fr.x1-0.15,y:fr.y0+0.3};P.points.tablero={lv:ground.id,x:r2(tb.x),y:r2(tb.y)}}}
 if(P.levels.length>1&&!P.points.ducto){const allSh=sorted.flatMap(b=>b.shafts);const pts=autoShafts(P,allSh);
  if(pts.length){P.points.ducto={x:pts[0][0],y:pts[0][1]};P.shafts=pts.slice(1).map(p=>({x:p[0],y:p[1]}))}}
 const nR=addLv.reduce((a,l)=>a+l.rooms.length,0),nF=addLv.reduce((a,l)=>a+l.fixtures.length,0),typ=addLv.filter(l=>l.typical).length;
 return {P,report:{levels:addLv.length,rooms:nR,fixtures:nF,scale:[...new Set(built.map(b=>'1:'+b.D))].join(', '),warns,typical:typ,names:addLv.map(l=>l.name)}}}

// ductos verticales: uno por grupo de recintos húmedos (edificios) o uno solo (casas)
function autoShafts(P,labeled){const lv=P.levels.slice().sort((a,b)=>a.elev-b.elev);const wetT=r=>r.type==='bano'||r.type==='cocina'||r.type==='lavanderia';
 const cand=lv.filter(l=>l.elev>0.1).sort((a,b)=>b.rooms.filter(wetT).length-a.rooms.filter(wetT).length);const tl=cand[0]||lv[0];if(!tl)return [];
 const wet=tl.rooms.filter(wetT);const ctr=r=>[(r.x0+r.x1)/2,(r.y0+r.y1)/2];const r2=v=>+v.toFixed(2);
 const edge=b=>[r2((b.x0+b.x1)/2),r2(b.y0-0.07)];
 if(wet.filter(r=>r.type==='bano').length<=4){if(labeled.length){const baths=lv.flatMap(l=>l.rooms.filter(r=>r.type==='bano'));return [labeled.map(s=>({s,d:Math.min(...baths.map(r=>Math.hypot(s[0]-ctr(r)[0],s[1]-ctr(r)[1])),99)})).sort((a,b)=>a.d-b.d)[0].s.map(r2)]}
  const b=tl.rooms.find(r=>r.type==='bano')||lv.flatMap(l=>l.rooms).find(r=>r.type==='bano')||tl.rooms[0];return b?[edge(b)]:[]}
 const cl=[];wet.slice().sort((a,b)=>ctr(a)[0]-ctr(b)[0]||ctr(a)[1]-ctr(b)[1]).forEach(r=>{const c=ctr(r);let best=null,bd=6;for(const k of cl){const d=Math.hypot(k.c[0]-c[0],k.c[1]-c[1]);if(d<bd){bd=d;best=k}}
  if(best){best.r.push(r);best.c=[best.r.reduce((a,q)=>a+ctr(q)[0],0)/best.r.length,best.r.reduce((a,q)=>a+ctr(q)[1],0)/best.r.length]}else cl.push({r:[r],c:c})});
 const out=[];const place=k=>{const lab=labeled.find(s=>Math.hypot(s[0]-k.c[0],s[1]-k.c[1])<6);
  if(lab){out.push(lab.map(r2));return}const pool=k.r.some(r=>r.type==='bano')?k.r.filter(r=>r.type==='bano'):k.r;const b=pool.sort((a,b)=>Math.hypot(ctr(a)[0]-k.c[0],ctr(a)[1]-k.c[1])-Math.hypot(ctr(b)[0]-k.c[0],ctr(b)[1]-k.c[1]))[0];out.push(edge(b))};
 cl.filter(k=>k.r.some(r=>r.type==='bano')).sort((a,b)=>b.r.length-a.r.length).forEach(place);
 // recintos húmedos de otros pisos lejos de todo ducto (locales, áreas comunes) → ductos propios
 for(const l of lv){if(l===tl)continue;const far=l.rooms.filter(r=>wetT(r)&&Math.min(99,...out.map(p=>Math.abs(p[0]-ctr(r)[0])+Math.abs(p[1]-ctr(r)[1])))>12);const c2=[];
  far.forEach(r=>{const c=ctr(r);const k=c2.find(k=>Math.hypot(k.c[0]-c[0],k.c[1]-c[1])<8);if(k)k.r.push(r);else c2.push({r:[r],c})});c2.forEach(place)}
 return out}

/* ---------- interfaz: diálogo de importación ---------- */
const IMPS={plantas:[],files:[]};
function progressModal(msg){showModal(`<h3>Leyendo el plano</h3><p class="hint" id="impMsg">${esc(msg)}</p><div class="bar"><i id="impBar" style="width:8%;background:var(--brand);transition:width .3s"></i></div>`)}
function stepModal(m,f){const el=$('#impMsg');if(el)el.textContent=m;const b=$('#impBar');if(b)b.style.width=(f!=null?Math.round(f*100):Math.min(95,parseFloat(b.style.width)+6))+'%'}
async function sheetsOf(file){if(/\.dxf$/i.test(file.name))return dxfSheets(file);if(/\.dwg$/i.test(file.name))return dwgSheets(file);return pdfSheets(file)}
async function openImport(files,mode){files=[...files];if(!files.length)return;progressModal('Abriendo archivos…');const pls=[];const errs=[];
 try{for(let i=0;i<files.length;i++){const f=files[i];stepModal(`Leyendo ${f.name}…`,i/files.length*0.6);let shs;try{shs=await sheetsOf(f)}catch(e){errs.push(`${f.name}: ${e.message}`);continue}
   for(const sh of shs){stepModal(`${f.name} · hoja ${sh.pn} de ${sh.npages}`);const ps=await scanSheet(sh);pls.push(...ps)}}
  stepModal('Preparando vistas previas…',0.8);for(const p of pls)p.thumb=await thumbOf(p)}
 catch(e){$('#modal').hidden=true;toast('No se pudo leer: '+e.message,7000);return}
 if(!pls.length){$('#modal').hidden=true;toast((errs.length?errs.join(' · ')+' · ':'')+'No encontré plantas con nombres de recintos (COCINA, BAÑO, DORMITORIO…). Si es un plano escaneado, súbelo como fondo, calibra la escala y usa "Detectar ambientes".',9000);return}
 pls.sort((a,b)=>((a.num??999)-(b.num??999))||a.sheet.file.localeCompare(b.sheet.file)||a.sheet.pn-b.sheet.pn);
 // marcar duplicados (misma planta en compilado y hoja suelta)
 const seenK=new Set();pls.forEach(p=>{const k=(p.num??'x')+'|'+p.labels.length+'|'+p.labels.map(l=>l.type).sort().join('');p.dup=seenK.has(k);seenK.add(k);p.on=!p.dup});
 const mxL=Math.max(...pls.map(p=>p.labels.length));pls.forEach(p=>{if(p.on&&((p.num==null&&p.labels.length<10&&mxL>=60)||p.D>=250)){p.on=false;p.minor=true}});
 IMPS.plantas=pls;IMPS.mode=mode||(ST.P&&ST.P.levels.some(l=>l.rooms.length)?'add':'new');IMPS.files=files.map(f=>f.name);IMPS.errs=errs;renderImportDialog()}
function renderImportDialog(){const pls=IMPS.plantas,nOn=pls.filter(p=>p.on).length,nSheets=new Set(pls.map(p=>p.sheet.file+p.sheet.pn)).size;
 showModal(`<h3>Importar plano · ${pls.length} planta${pls.length>1?'s':''} encontradas</h3>
  <p class="hint">${esc(IMPS.files.join(', '))} · ${nSheets} hoja${nSheets>1?'s':''} con plantas. Marca los pisos que quieres traer; puedes cambiar el nombre, el número de nivel y la escala.${IMPS.errs&&IMPS.errs.length?`<br><span style="color:var(--warn)">${IMPS.errs.map(esc).join('<br>')}</span>`:''}</p>
  <div class="row"><button class="btn sm" type="button" data-imp="all">Marcar todas</button><button class="btn sm" type="button" data-imp="none">Ninguna</button><span class="hint" style="margin-left:auto">${nOn} seleccionadas</span></div>
  <div style="display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto;padding-right:4px">${pls.map((p,i)=>`<div class="row" style="flex-wrap:nowrap;gap:10px;align-items:center;background:var(--plan);border:1px solid ${p.on?'var(--brand)':'var(--line)'};border-radius:8px;padding:6px">
   <input type="checkbox" data-ipon="${i}"${p.on?' checked':''} aria-label="Incluir">
   <img src="${p.thumb}" alt="" style="width:110px;height:70px;object-fit:contain;background:#fff;border-radius:4px;flex:none">
   <div style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:1"><div class="row" style="gap:6px"><input type="text" data-ipname="${i}" value="${esc(p.name)}" style="flex:1;min-width:120px"><label class="hint">Nivel <input type="number" data-ipnum="${i}" value="${p.num??''}" style="width:64px"></label>
    <label class="hint">Escala 1:<select data-ipd="${i}">${[...new Set([20,25,50,75,100,125,150,200,250,500,p.D])].sort((a,b)=>a-b).map(d=>`<option${d===p.D?' selected':''}>${d}</option>`).join('')}</select></label></div>
    <span class="hint mono">${esc(p.sheet.file)} · hoja ${p.sheet.pn} · ${p.labels.length} recintos${p.dup?' · posible duplicado':''}${p.minor?' · plano secundario (pocos recintos)':''}</span></div></div>`).join('')}</div>
  <div class="row"><label class="f">Destino<select id="impMode"><option value="new"${IMPS.mode==='new'?' selected':''}>Proyecto nuevo</option><option value="add"${IMPS.mode==='add'?' selected':''}>Agregar al proyecto actual</option></select></label>
   <label class="f">Piso a piso (m)<input type="number" id="impFtf" step="0.05" value="2.6" style="width:90px"></label><label class="f">Altura libre (m)<input type="number" id="impH" step="0.05" value="2.4" style="width:90px"></label></div>
  ${nOn===1&&pls.find(p=>p.on).num>1&&IMPS.mode==='new'?`<p class="hint" style="color:var(--warn)">Estás importando un solo piso de un edificio. Para calcular montantes, bombeo y ductos de todo el edificio, sube todas las plantas juntas (el PDF compilado o varios archivos a la vez).</p>`:''}
  <div class="row"><button class="btn primary" type="button" data-imp="go"${nOn?'':' disabled'}>Importar ${nOn} piso${nOn===1?'':'s'}</button><button class="btn" type="button" data-act="mclose">Cancelar</button></div>`)}
document.addEventListener('change',e=>{const t=e.target,P=IMPS.plantas;if(t.dataset.ipon){P[+t.dataset.ipon].on=t.checked;renderImportDialog()}if(t.dataset.ipd)P[+t.dataset.ipd].D=+t.value;if(t.id==='impMode')IMPS.mode=t.value});
document.addEventListener('input',e=>{const t=e.target,P=IMPS.plantas;if(t.dataset.ipname)P[+t.dataset.ipname].name=t.value;if(t.dataset.ipnum)P[+t.dataset.ipnum].num=t.value===''?null:+t.value});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-imp]');if(!b)return;const a=b.dataset.imp;
 if(a==='all'||a==='none'){IMPS.plantas.forEach(p=>p.on=a==='all');renderImportDialog();return}
 if(a==='go'){const sel=IMPS.plantas.filter(p=>p.on),mode=$('#impMode').value,ftf=+$('#impFtf').value||2.6,h=+$('#impH').value||2.4;progressModal('Construyendo pisos…');const built=[];
  try{for(let i=0;i<sel.length;i++){stepModal(`Piso ${i+1} de ${sel.length}: ${sel[i].name}`,i/sel.length);built.push(await buildPlanta(sel[i],m=>stepModal(m)))}}
  catch(err){$('#modal').hidden=true;toast('Error al construir: '+err.message,7000);return}
  const base=mode==='add'&&ST.P?ST.P:null;const ubic=(()=>{const T=sel[0].T;const u=T.find(t=>/^UBICACI/.test(t.n));if(!u)return '';const c=T.filter(o=>o!==u&&Math.hypot(o.x-u.x,o.y-u.y)<160&&/[A-Z]{3}/.test(o.n)&&!/:\s*$/.test(o.s)).sort((p,q)=>Math.hypot(p.x-u.x,p.y-u.y)-Math.hypot(q.x-u.x,q.y-u.y));return c[0]?titleCase(c[0].s):''})();
  const {P,report}=assembleProject(built,{ftf,h,nombre:IMPS.files[0].replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim(),ubicacion:ubic},base);
  if(base){markDirty();renderLevels();renderSide();ST.lv=P.levels[P.levels.length-1].id}else{setProject(P);markDirty()}
  setTool('sel');showView('plano');ST.lv=(P.levels.find(l=>l.name===report.names[0])||P.levels[0]).id;renderLevels();renderSide();fitView();drawEd();
  showModal(`<h3>${base?'Pisos agregados al proyecto':'Proyecto generado'}</h3>
   <div class="kpis"><div class="kpi"><b>${report.levels}</b><span>niveles</span></div><div class="kpi"><b>${report.rooms}</b><span>ambientes</span></div><div class="kpi"><b>${report.fixtures}</b><span>aparatos propuestos</span></div><div class="kpi"><b>${esc(report.scale)}</b><span>escala</span></div></div>
   ${P.shafts&&P.shafts.length?`<p class="hint">${P.shafts.length+1} ductos verticales propuestos, uno por grupo de baños y cocinas. Muévelos con <b>Seleccionar</b> o agrega más con <b>◆ Punto → Ducto adicional</b>.</p>`:''}
   ${report.typical?`<p class="hint">${report.typical} nivel${report.typical>1?'es':''} reconocido${report.typical>1?'s':''} como piso tipo: comparten la misma geometría y se calculan una sola vez.</p>`:''}
   <div class="diff" style="max-height:30vh;overflow:auto">${P.levels.filter(l=>report.names.includes(l.name)).map(l=>`<div><span><b>${esc(l.name)}</b> · ${l.rooms.length} ambientes${l.typical&&l.typical!==l.name?` · tipo de ${esc(l.typical)}`:''}</span><b>${fmt(l.rooms.reduce((a,x)=>a+(x.x1-x.x0)*(x.y1-x.y0),0),0)} m²</b></div>`).join('')}</div>
   ${report.warns.length?`<details><summary class="hint">${report.warns.length} avisos</summary><p class="hint" style="color:var(--warn)">${report.warns.slice(0,40).map(esc).join('<br>')}</p></details>`:''}
   <p class="hint">Revisa antes de calcular: los recintos sin nombre escrito (pasillos, halls) no se detectan; dibújalos con <b>▭ Ambiente</b>. Aparatos, medidor, salida, tablero y ducto son propuestas.</p>
   <div class="row"><button class="btn primary" type="button" data-act="mclose">Revisar el plano</button><button class="btn" type="button" data-act="calc" onclick="document.getElementById('modal').hidden=true">▶ Calcular ahora</button></div>`)}});
async function runImport(file){return openImport([file])}

/* ---------- detección sobre un fondo calibrado con IA (imágenes y escaneos) ---------- */
async function detectOnLevel(l,onStep){const step=m=>onStep&&onStep(m);if(!l.bg||!l.bg.src)throw new Error('Este nivel no tiene plano de fondo.');
 const im=bgImg(l);if(!im||!im.complete||!im.naturalWidth)throw new Error('El plano de fondo aún no termina de cargar.');
 const W=im.naturalWidth,H=im.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(im,0,0);
 const f=Math.min(1,1600/Math.max(W,H)),sc=document.createElement('canvas');sc.width=Math.round(W*f);sc.height=Math.round(H*f);sc.getContext('2d').drawImage(c,0,0,sc.width,sc.height);
 const blob=await new Promise(r=>sc.toBlob(r,'image/jpeg',0.8));step('La IA está leyendo los nombres de los recintos…');
 const prompt=`Esta imagen es la planta de arquitectura de un nivel (${sc.width}×${sc.height} píxeles). Ubica cada recinto con nombre escrito o reconocible (dormitorio, baño, cocina, living, comedor, pasillo, lavandería, closet, estudio, balcón, local, sala técnica). Devuelve SOLO JSON: {"recintos":[{"nombre":"Baño 1","tipo":"bano|cocina|lavanderia|dormitorio|sala|comedor|pasillo|closet|estudio|balcon|local|tecnico","x":0,"y":0}],"aparatos":[{"tipo":"wc|lav|ducha|lavaplatos|lavadora|terma|extractor","x":0,"y":0}]} con x,y en píxeles del centro. No incluyas cotas ni estacionamientos.`;
 let out;if(ST.caps.sample){out=await ST.caps.sample.json(prompt,{images:[blob],modelTier:'complex'})}else if(CLD()&&window.TrazoCloud.aiImageJSON){out=await window.TrazoCloud.aiImageJSON(prompt,blob)}else throw new Error('Para planos escaneados o imágenes la detección necesita la IA (inicia sesión en la versión publicada).');
 const labs=(out&&out.recintos||[]).filter(r=>r&&isFinite(r.x)&&isFinite(r.y)).map(r=>({name:String(r.nombre||ROOM_TYPES[r.tipo]||'Ambiente'),type:ROOM_TYPES[r.tipo]?r.tipo:(roomTypeOf(nrm(r.nombre))||'dormitorio'),cx:Math.round(r.x/f),cy:Math.round(r.y/f)}));
 if(!labs.length)throw new Error('La IA no encontró recintos en la imagen.');step('Detectando muros…');
 const pxm=l.bg.pxPerM;const mask=wallMaskFrom(x,W,H,pxm,labs.map(a=>{const r=0.35*pxm;return [a.cx-r,a.cy-r/3,a.cx+r,a.cy+r/3]}));
 const rooms=labs.map(a=>{const r=castRoom(mask,W,H,a.cx,a.cy,pxm);if(!r)return null;return {id:uid('r'),name:a.name,type:a.type,x0:r.x0/pxm+l.bg.ox,x1:r.x1/pxm+l.bg.ox,y0:r.y0/pxm+l.bg.oy,y1:r.y1/pxm+l.bg.oy,lx:a.cx/pxm+l.bg.ox,ly:a.cy/pxm+l.bg.oy,ventana:true}}).filter(Boolean);
 splitOverlaps(rooms);const ok=rooms.filter(r=>r.x1-r.x0>=0.5&&r.y1-r.y0>=0.5);snapEdges(ok);ok.forEach(r=>{delete r.lx;delete r.ly});
 const given=(out.aparatos||[]).filter(a=>a&&FX[a.tipo]&&isFinite(a.x)).map(a=>({id:uid('f'),type:a.tipo,x:+(a.x/f/pxm+l.bg.ox).toFixed(2),y:+(a.y/f/pxm+l.bg.oy).toFixed(2)})).filter(fx=>ok.some(r=>fx.x>=r.x0&&fx.x<=r.x1&&fx.y>=r.y0&&fx.y<=r.y1));
 const st={terma:ST.P.levels.some(q=>q!==l&&q.fixtures.some(fx=>fx.type==='terma')),hasLav:ok.some(r=>r.type==='lavanderia')};
 return {rooms:ok,fixtures:given.concat(defaultFixtures(ok,given,st))}}
async function runDetect(){const l=curLv();progressModal('Preparando…');try{const r=await detectOnLevel(l,stepModal);
  if(!r.rooms.length)throw new Error('No se detectaron ambientes.');l.rooms=l.rooms.concat(r.rooms);l.fixtures=l.fixtures.concat(r.fixtures);markDirty();renderSide();drawEd();$('#modal').hidden=true;
  toast(`Se detectaron ${r.rooms.length} ambientes y ${r.fixtures.length} aparatos en ${l.name}. Revísalos.`,6000)}
 catch(e){$('#modal').hidden=true;toast(e.message,7000)}}

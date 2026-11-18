/* ================= Trazo MEP · lectura de archivos de AutoCAD =================
   DXF: lector propio (formato abierto). DWG: LibreDWG compilado a WebAssembly (@mlightcad/libredwg-web, GPL-3.0),
   que se descarga solo cuando se abre un DWG. Ambos se convierten a un modelo común:
   { unit (metros por unidad), lines: [[x,y,x,y,…]], fills: [[x,y,…]], texts: [{s,x,y,h,rot}] } con bloques expandidos. */
const DWG_LIB='https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.8.3';
const UNIT_M={1:0.0254,2:0.3048,4:0.001,5:0.01,6:1,14:0.1};
const m2mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
const m2ap=(M,x,y)=>[M[0]*x+M[2]*y+M[4],M[1]*x+M[3]*y+M[5]];
const m2ins=(x,y,sx,sy,rot,bx,by)=>{const c=Math.cos(rot),s=Math.sin(rot);return m2mul([c*sx,s*sx,-s*sy,c*sy,x,y],[1,0,0,1,-bx,-by])};
const m2arc=(cx,cy,r,a0,a1)=>{while(a1<a0)a1+=2*Math.PI;const n=Math.max(4,Math.ceil((a1-a0)/(Math.PI/12)));const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push(cx+r*Math.cos(a),cy+r*Math.sin(a))}return o};
const cleanMtext=s=>String(s||'').replace(/\\P/g,' ').replace(/\\[ACFHQTWfhpqtw][^;\\{}]*;/g,'').replace(/\\[LlOoKk]/g,'').replace(/\\S([^;]*);/g,'$1').replace(/[{}]/g,'').replace(/%%[cC]/g,'Ø').replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±').replace(/\s+/g,' ').trim();

/* ---------- DXF ---------- */
function parseDxf(txt){const L=txt.split(/\r\n|\n|\r/);const P=[];for(let i=0;i+1<L.length;i+=2){const g=parseInt(L[i],10);if(!isNaN(g))P.push([g,L[i+1]])}
 let i=0;const header={},blocks={},ents=[];
 const readEnt=()=>{const e={type:String(P[i][1]).trim(),c:[]};i++;while(i<P.length&&P[i][0]!==0){e.c.push(P[i]);i++}return e};
 const isEnd=v=>i<P.length&&P[i][0]===0&&String(P[i][1]).trim()===v;
 const group=list=>{const out=[];for(let k=0;k<list.length;k++){const e=list[k];
  if(e.type==='POLYLINE'){e.verts=[];k++;while(k<list.length&&list[k].type==='VERTEX'){e.verts.push(list[k]);k++}out.push(e);continue}
  if(e.type==='INSERT'){e.attribs=[];while(k+1<list.length&&(list[k+1].type==='ATTRIB'||list[k+1].type==='SEQEND')){k++;if(list[k].type==='ATTRIB')e.attribs.push(list[k])}out.push(e);continue}
  if(e.type!=='SEQEND'&&e.type!=='VERTEX'&&e.type!=='ATTRIB')out.push(e)}return out};
 while(i<P.length){if(P[i][0]===0&&String(P[i][1]).trim()==='SECTION'){const name=String((P[i+1]||[])[1]||'').trim();i+=2;
   if(name==='HEADER'){while(i<P.length&&!isEnd('ENDSEC')){if(P[i][0]===9){header[String(P[i][1]).trim()]=P[i+1]?String(P[i+1][1]).trim():null}i++}}
   else if(name==='BLOCKS'){while(i<P.length&&!isEnd('ENDSEC')){if(isEnd('BLOCK')){const b=readEnt();const list=[];while(i<P.length&&!isEnd('ENDBLK')&&!isEnd('ENDSEC'))list.push(readEnt());if(isEnd('ENDBLK'))readEnt();
     blocks[dxV(b,2)]={base:[dxN(b,10),dxN(b,20)],ents:group(list)}}else i++}}
   else if(name==='ENTITIES'){const list=[];while(i<P.length&&!isEnd('ENDSEC'))list.push(readEnt());ents.push(...group(list))}
   else{while(i<P.length&&!isEnd('ENDSEC'))i++}}else i++}
 return {header,blocks,ents}}
const dxV=(e,g)=>{const p=e.c.find(q=>q[0]===g);return p?String(p[1]).trim():undefined};
const dxN=(e,g,d=0)=>{const v=dxV(e,g);const n=parseFloat(v);return isNaN(n)?d:n};
const dxA=(e,g)=>e.c.filter(q=>q[0]===g).map(q=>parseFloat(q[1]));
function dxfModel(txt){const D=parseDxf(txt);const out={lines:[],fills:[],texts:[],ll:[],fl:[]};let CUR='0';const PL=a=>{out.lines.push(a);out.ll.push(CUR)},PF=a=>{out.fills.push(a);out.fl.push(CUR)};
 const emit=(e,M,depth)=>{const prev=CUR,ly=dxV(e,8)||'0';if(ly!=='0'||depth===0)CUR=ly;emit0(e,M,depth);CUR=prev};
 const emit0=(e,M,depth)=>{if(dxN(e,67)===1)return;const t=e.type;
  if(t==='LINE'){const a=m2ap(M,dxN(e,10),dxN(e,20)),b=m2ap(M,dxN(e,11),dxN(e,21));PL([...a,...b])}
  else if(t==='LWPOLYLINE'){const xs=dxA(e,10),ys=dxA(e,20);const pts=[];for(let k=0;k<xs.length;k++)pts.push(...m2ap(M,xs[k],ys[k]||0));if(dxN(e,70)&1&&pts.length>2)pts.push(pts[0],pts[1]);if(pts.length>=4)PL(pts)}
  else if(t==='POLYLINE'){const pts=[];(e.verts||[]).forEach(v=>pts.push(...m2ap(M,dxN(v,10),dxN(v,20))));if(dxN(e,70)&1&&pts.length>2)pts.push(pts[0],pts[1]);if(pts.length>=4)PL(pts)}
  else if(t==='ARC'||t==='CIRCLE'){const p=m2arc(dxN(e,10),dxN(e,20),dxN(e,40),t==='ARC'?dxN(e,50)*Math.PI/180:0,t==='ARC'?dxN(e,51)*Math.PI/180:2*Math.PI);const q=[];for(let k=0;k<p.length;k+=2)q.push(...m2ap(M,p[k],p[k+1]));PL(q)}
  else if(t==='SPLINE'){const xs=dxA(e,11).length?dxA(e,11):dxA(e,10),ys=dxA(e,11).length?dxA(e,21):dxA(e,20);const q=[];for(let k=0;k<xs.length;k++)q.push(...m2ap(M,xs[k],ys[k]||0));if(q.length>=4)PL(q)}
  else if(t==='SOLID'||t==='3DFACE'){const q=[];[[10,20],[11,21],[13,23],[12,22]].forEach(([a,b])=>q.push(...m2ap(M,dxN(e,a),dxN(e,b))));PF(q)}
  else if(t==='TEXT'||t==='ATTRIB'||t==='MTEXT'){if((t==='ATTRIB'&&(dxN(e,70)&1)))return;const al=t!=='MTEXT'&&(dxN(e,72)||dxN(e,73));const x=al?dxN(e,11):dxN(e,10),y=al?dxN(e,21):dxN(e,20);
   let s=t==='MTEXT'?cleanMtext(e.c.filter(q=>q[0]===3).map(q=>q[1]).join('')+(dxV(e,1)||'')):cleanMtext(dxV(e,1));if(!s)return;let rot=dxN(e,50)*Math.PI/180;if(t==='MTEXT'&&dxV(e,11)!==undefined&&!dxV(e,50))rot=Math.atan2(dxN(e,21),dxN(e,11));
   const [px,py]=m2ap(M,x,y),sc=Math.hypot(M[0],M[1]);const h=dxN(e,40,1)*sc,rr=rot+Math.atan2(M[1],M[0]);
   let cx=px,cy=py;if(t==='MTEXT'){const a=dxN(e,71,1),w=h*0.6*s.length;const col=(a-1)%3,row=Math.floor((a-1)/3);cx=px+Math.cos(rr)*w*(0.5-col/2)-Math.sin(rr)*h*(row/2-0.5)*-1;cy=py+Math.sin(rr)*w*(0.5-col/2)+Math.cos(rr)*h*(0.5-row/2)}
   else if(!al){const w=h*0.6*s.length;cx=px+Math.cos(rr)*w/2-Math.sin(rr)*h/2;cy=py+Math.sin(rr)*w/2+Math.cos(rr)*h/2}
   out.texts.push({s,x:cx,y:cy,h,rot:rr})}
  else if(t==='INSERT'||t==='DIMENSION'){const b=D.blocks[dxV(e,2)];if(b&&depth<6){const nc=Math.max(1,dxN(e,70,1)),nr=Math.max(1,dxN(e,71,1));
    for(let r=0;r<nr;r++)for(let k=0;k<nc;k++){const M2=t==='DIMENSION'?M:m2mul(M,m2ins(dxN(e,10)+k*dxN(e,44),dxN(e,20)+r*dxN(e,45),dxN(e,41,1),dxN(e,42,1),dxN(e,50)*Math.PI/180,b.base[0],b.base[1]));b.ents.forEach(x=>emit(x,M2,depth+1))}}
   (e.attribs||[]).forEach(a=>emit(a,M,depth+1))}
  else if(t==='HATCH'&&dxN(e,70)===1){const c=e.c;let k=c.findIndex(q=>q[0]===91);if(k<0)return;const np=parseInt(c[k][1]);k++;
   for(let p=0;p<np&&k<c.length;p++){while(k<c.length&&c[k][0]!==92)k++;if(k>=c.length)break;const fl=parseInt(c[k][1]);k++;const poly=[];
    if(fl&2){while(k<c.length&&c[k][0]!==93)k++;const n=parseInt(c[k][1]);k++;for(let v=0;v<n&&k<c.length;v++){while(k<c.length&&c[k][0]!==10)k++;const x=parseFloat(c[k][1]),y=parseFloat(c[k+1][1]);poly.push(...m2ap(M,x,y));k+=2}}
    else{while(k<c.length&&c[k][0]!==93)k++;const n=parseInt(c[k][1]);k++;for(let v=0;v<n&&k<c.length;v++){while(k<c.length&&c[k][0]!==72)k++;const et=parseInt(c[k][1]);k++;
      if(et===1){const g=()=>{while(k<c.length&&![10,11,20,21].includes(c[k][0]))k++};const vals={};for(let q=0;q<4;q++){g();vals[c[k][0]]=parseFloat(c[k][1]);k++}poly.push(...m2ap(M,vals[10],vals[20]),...m2ap(M,vals[11],vals[21]))}
      else if(et===2){const vals={};for(const code of [10,20,40,50,51]){while(k<c.length&&c[k][0]!==code)k++;vals[code]=parseFloat(c[k][1]);k++}const pp=m2arc(vals[10],vals[20],vals[40],vals[50]*Math.PI/180,vals[51]*Math.PI/180);for(let q=0;q<pp.length;q+=2)poly.push(...m2ap(M,pp[q],pp[q+1]))}}}
    if(poly.length>=6)PF(poly)}}};
 D.ents.forEach(e=>emit(e,[1,0,0,1,0,0],0));
 const iu=parseInt(D.header.$INSUNITS||'0',10);out.unit=UNIT_M[iu]||null;out.unitCode=iu;return out}

/* ---------- DWG (LibreDWG en WebAssembly) ---------- */
let DWGMOD=null;
async function dwgModel(buf){if(!DWGMOD){try{const m=await import(DWG_LIB+'/dist/libredwg-web.js');DWGMOD={m,lib:await m.LibreDwg.create(DWG_LIB+'/wasm/')}}catch(e){throw new Error('No se pudo cargar el lector de DWG ('+e.message+'). Guarda el archivo como DXF o PDF desde AutoCAD e impórtalo.')}}
 const {m,lib}=DWGMOD;const dwg=lib.dwg_read_data(buf,m.Dwg_File_Type.DWG);if(!dwg)throw new Error('El archivo DWG no se pudo leer (versión no soportada o archivo dañado).');const db=lib.convert(dwg);try{lib.dwg_free(dwg)}catch(e){}
 const blocks={};(db.tables.BLOCK_RECORD.entries||[]).forEach(b=>{blocks[b.name]={base:[(b.basePoint||{}).x||0,(b.basePoint||{}).y||0],ents:b.entities||[]}});
 const out={lines:[],fills:[],texts:[],ll:[],fl:[]};let CUR='0';const PL=a=>{out.lines.push(a);out.ll.push(CUR)},PF=a=>{out.fills.push(a);out.fl.push(CUR)};const P2=(M,p)=>m2ap(M,(p&&p.x)||0,(p&&p.y)||0);
 const txt=(M,s,p,h,rot,center)=>{s=cleanMtext(s);if(!s)return;const [px,py]=P2(M,p),sc=Math.hypot(M[0],M[1]);const hh=(h||1)*sc,rr=(rot||0)+Math.atan2(M[1],M[0]);const w=hh*0.6*s.length;
  out.texts.push({s,x:center?px:px+Math.cos(rr)*w/2-Math.sin(rr)*hh/2,y:center?py:py+Math.sin(rr)*w/2+Math.cos(rr)*hh/2,h:hh,rot:rr})};
 const emit=(e,M,depth)=>{if(!e)return;const prev=CUR,ly=e.layer||'0';if(ly!=='0'||depth===0)CUR=ly;emit0(e,M,depth);CUR=prev};
 const emit0=(e,M,depth)=>{if(!e||e.isVisible===false)return;switch(e.type){
  case 'LINE':PL([...P2(M,e.startPoint),...P2(M,e.endPoint)]);break;
  case 'LWPOLYLINE':case 'POLYLINE2D':case 'POLYLINE3D':{const q=[];(e.vertices||[]).forEach(v=>q.push(...P2(M,v.point||v)));if((e.flag&1)&&q.length>2)q.push(q[0],q[1]);if(q.length>=4)PL(q);break}
  case 'ARC':case 'CIRCLE':{const p=m2arc(e.center.x,e.center.y,e.radius,e.type==='ARC'?e.startAngle:0,e.type==='ARC'?e.endAngle:2*Math.PI);const q=[];for(let k=0;k<p.length;k+=2)q.push(...m2ap(M,p[k],p[k+1]));PL(q);break}
  case 'SOLID':{const q=[];[e.corner1,e.corner2,e.corner4||e.corner3,e.corner3].forEach(p=>q.push(...P2(M,p)));PF(q);break}
  case 'TEXT':{const al=e.halign||e.valign;txt(M,e.text,al?e.endPoint:e.startPoint,e.textHeight,e.rotation,false);break}
  case 'MTEXT':{const rot=e.direction&&(e.direction.x||e.direction.y)?Math.atan2(e.direction.y,e.direction.x):(e.rotation||0);txt(M,e.text,e.insertionPoint,e.textHeight,rot,false);break}
  case 'INSERT':case 'DIMENSION':{const b=blocks[e.name];if(b&&depth<6){const nc=Math.max(1,e.columnCount||1),nr=Math.max(1,e.rowCount||1);
    for(let r=0;r<nr;r++)for(let k=0;k<nc;k++){const M2=e.type==='DIMENSION'?M:m2mul(M,m2ins(e.insertionPoint.x+k*(e.columnSpacing||0),e.insertionPoint.y+r*(e.rowSpacing||0),e.xScale||1,e.yScale||1,e.rotation||0,b.base[0],b.base[1]));b.ents.forEach(x=>emit(x,M2,depth+1))}}
   (e.attribs||[]).forEach(a=>{const t=a.text||{};if(!(a.flags&1))txt(M,t.text,(t.halign||t.valign)?t.endPoint:t.startPoint,t.textHeight,t.rotation,false)});break}
  case 'HATCH':{if(e.solidFill!==1)break;(e.boundaryPaths||[]).forEach(bp=>{const q=[];if(bp.vertices)bp.vertices.forEach(v=>q.push(...P2(M,v)));else(bp.edges||[]).forEach(ed=>{if(ed.start&&ed.end)q.push(...P2(M,ed.start),...P2(M,ed.end));else if(ed.center){const p=m2arc(ed.center.x,ed.center.y,ed.radius,ed.startAngle||0,ed.endAngle||2*Math.PI);for(let k=0;k<p.length;k+=2)q.push(...m2ap(M,p[k],p[k+1]))}});if(q.length>=6)PF(q)});break}}};
 (db.entities||[]).forEach(e=>emit(e,[1,0,0,1,0,0],0));
 const iu=db.header&&db.header.INSUNITS||0;out.unit=UNIT_M[iu]||null;out.unitCode=iu;return out}

/* ---------- modelo CAD → hoja del importador ---------- */
function cadSheet(file,model){const all=[];model.lines.forEach(l=>{for(let k=0;k<l.length;k+=2)all.push(l[k],l[k+1])});model.fills.forEach(l=>{for(let k=0;k<l.length;k+=2)all.push(l[k],l[k+1])});model.texts.forEach(t=>all.push(t.x,t.y));
 if(all.length<4)throw new Error('El archivo no tiene dibujo en el espacio modelo.');
 // extensión robusta (percentiles) para ignorar objetos perdidos lejos del dibujo
 const xs=[],ys=[];for(let k=0;k<all.length;k+=2){xs.push(all[k]);ys.push(all[k+1])}xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);const q=(a,p)=>a[Math.min(a.length-1,Math.max(0,Math.floor(a.length*p)))];
 let x0=q(xs,0.002),x1=q(xs,0.998),y0=q(ys,0.002),y1=q(ys,0.998);const mx=(x1-x0)*0.05+1e-9,my=(y1-y0)*0.05+1e-9;x0-=mx;x1+=mx;y0-=my;y1+=my;
 // unidades: encabezado o estimación por la altura típica de textos
 let unit=model.unit;if(!unit){const hs=model.texts.map(t=>t.h).sort((a,b)=>a-b);const hm=hs.length?hs[Math.floor(hs.length/2)]:0;const span=Math.max(x1-x0,y1-y0);
  unit=hm>40||span>20000?0.001:hm>4||span>2000?0.01:1}
 const K=PT_M/50*unit;// puntos de "hoja" por unidad de dibujo, como si fuera 1:50
 const X=x=>(x-x0)*K,Y=y=>(y1-y)*K;
 const T=model.texts.map(t=>{const h=t.h*K,c=Math.cos(t.rot),s=Math.sin(t.rot),w=h*0.6*t.s.length;const cx=X(t.x),cy=Y(t.y);const dx=c,dy=-s;
  const hw=Math.abs(dx)*w/2+Math.abs(dy)*h/2,hh=Math.abs(dy)*w/2+Math.abs(dx)*h/2;return {s:t.s,x:cx,y:cy,bb:[cx-hw,cy-hh,cx+hw,cy+hh],h,dx,dy}});
 const lines=model.lines.map(l=>{const o=new Float32Array(l.length);for(let k=0;k<l.length;k+=2){o[k]=X(l[k]);o[k+1]=Y(l[k+1])}return o}),fills=model.fills.map(l=>{const o=new Float32Array(l.length);for(let k=0;k<l.length;k+=2){o[k]=X(l[k]);o[k+1]=Y(l[k+1])}return o});
 const W=(x1-x0)*K,H=(y1-y0)*K;
 // capas: los muebles, cotas, ejes y puertas no cuentan como muro; si hay capas de muros, la máscara usa solo esas
 const FURN=/MOBIL|MUEBLE|FURN|EQUIP|ARTEF|SANIT|COTA|DIM|EJE|GRID|AXIS|TEXT|TXT|HATCH|ACHUR|TRAMA|PATRON|PUERTA|DOOR|PAVIM|CIELO|PROY|OCULT|HIDDEN|ANNO|SIMB|SYMB|NOTA|NOTE|ROTUL|TITLE|DEFPOINTS|PLOMER|PLUMB|LUMIN|ELECT/i,WALLR=/MURO|WALL|TABIQ|PARED|ALBA|HORMIG|CONCRET|COLUM|PILAR|ESTRUC|STRUCT|VENTAN|WINDOW|VANO/i;
 const ll=model.ll||[],fl=model.fl||[];const nWall=ll.filter(n=>WALLR.test(n)).length+fl.filter(n=>WALLR.test(n)).length;const useWall=nWall>=20;
 const keepL=lines.map((l,i)=>{const n=ll[i]||'0';return useWall?WALLR.test(n):!FURN.test(n)}),keepF=fills.map((f,i)=>{const n=fl[i]||'0';return useWall?WALLR.test(n):!FURN.test(n)});
 const layers=[...new Set(ll.concat(fl))];
 const draw=async(ctx,org,R,mask)=>{ctx.save();ctx.setTransform(R,0,0,R,-org[0]*R,-org[1]*R);ctx.strokeStyle='#000';ctx.fillStyle='#000';ctx.lineWidth=Math.max(0.6,1.1/R);ctx.lineCap='round';
   const vx0=org[0],vy0=org[1],vx1=org[0]+ctx.canvas.width/R,vy1=org[1]+ctx.canvas.height/R;
   ctx.beginPath();lines.forEach((l,i)=>{if(mask&&!keepL[i])return;let inb=false;for(let k=0;k<l.length;k+=2){if(l[k]>=vx0-50&&l[k]<=vx1+50&&l[k+1]>=vy0-50&&l[k+1]<=vy1+50){inb=true;break}}if(!inb)return;ctx.moveTo(l[0],l[1]);for(let k=2;k<l.length;k+=2)ctx.lineTo(l[k],l[k+1])});ctx.stroke();
   fills.forEach((f,i)=>{if(mask&&!keepF[i])return;ctx.beginPath();ctx.moveTo(f[0],f[1]);for(let k=2;k<f.length;k+=2)ctx.lineTo(f[k],f[k+1]);ctx.closePath();ctx.fill()});
   if(!mask){ctx.font=`10px Arial`;ctx.textBaseline='middle';ctx.textAlign='center';for(const t of T){if(t.x<vx0||t.x>vx1||t.y<vy0||t.y>vy1)continue;ctx.save();ctx.translate(t.x,t.y);ctx.rotate(Math.atan2(t.dy,t.dx));ctx.scale(t.h/10,t.h/10);ctx.fillText(t.s,0,0);ctx.restore()}}
   ctx.restore()};
 return {file:file.name,kind:'cad',layers,wallLayers:useWall,pn:1,npages:1,W,H,T:mergeLines(T),fixedD:50,unitInfo:model.unitCode?`unidades del archivo (código ${model.unitCode})`:'unidades estimadas',
  render:(ctx,org,R)=>draw(ctx,org,R,false),renderMask:(ctx,org,R)=>draw(ctx,org,R,true)}}
async function dxfSheets(file){const txt=await file.text();if(!/SECTION/.test(txt.slice(0,4000))&&!/ENTITIES/.test(txt))throw new Error('No parece un DXF de texto (los DXF binarios no son compatibles).');return [cadSheet(file,dxfModel(txt))]}
async function dwgSheets(file){const buf=await file.arrayBuffer();return [cadSheet(file,await dwgModel(buf))]}

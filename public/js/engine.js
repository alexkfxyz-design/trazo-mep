/* ================= Trazo MEP · motor de cálculo ================= */
let CELL=0.1;
const ROOM_TYPES={dormitorio:'Dormitorio',sala:'Sala / living',comedor:'Comedor',cocina:'Cocina',bano:'Baño',lavanderia:'Lavandería',pasillo:'Pasillo / circulación',closet:'Closet / walking',estudio:'Estudio',balcon:'Balcón / terraza',local:'Local comercial',tecnico:'Sala técnica'};
const FX={
 wc:{n:'Inodoro',ab:'WC',dr:1,cold:1,hot:0,zs:0.2},
 lav:{n:'Lavamanos',ab:'LV',dr:1,cold:1,hot:1,zs:0.55},
 ducha:{n:'Ducha',ab:'DU',dr:1,cold:1,hot:1,zs:1.1},
 lavaplatos:{n:'Lavaplatos',ab:'LP',dr:1,cold:1,hot:1,zs:0.6},
 lavadora:{n:'Lavadora',ab:'LR',dr:1,cold:1,hot:0,zs:0.9,el:1},
 lavadero:{n:'Lavadero',ab:'LD',dr:1,cold:1,hot:0,zs:0.9},
 terma:{n:'Terma / termo eléctrico',ab:'TE',cold:1,heater:1,zs:1.6,el:1},
 cocina:{n:'Cocina eléctrica',ab:'CE',el:1},
 extractor:{n:'Extractor',ab:'EX',vent:1}
};
const PTS={medidor:'Medidor de agua',salida:'Salida a red de desagüe',tablero:'Tablero eléctrico',ducto:'Ducto vertical (shaft)'};
const SYS=[
 {key:'drain',n:1,name:'Desagüe y ventilación',short:'Desagüe'},
 {key:'water',n:2,name:'Agua fría y caliente',short:'Agua'},
 {key:'power',n:3,name:'Electricidad',short:'Electricidad'},
 {key:'vent',n:4,name:'Ventilación mecánica',short:'Ventilación'},
 {key:'fire',n:5,name:'Protección contra incendio',short:'Incendio'}];
const NETS={drain:'Desagüe',dvent:'Ventilación sanitaria',cold:'Agua fría',hot:'Agua caliente',power:'Electricidad',vent:'Extracción',fire:'Rociadores'};
const NET_SYS={drain:'drain',dvent:'drain',cold:'water',hot:'water',power:'power',vent:'vent',fire:'fire'};
const PRI={drain:7,dvent:6,vent:5,fire:4,cold:3,hot:2,power:1};
const HUNTER=[[0,0],[1,0.08],[2,0.1],[3,0.12],[5,0.23],[10,0.43],[15,0.55],[20,0.65],[30,0.85],[40,1.0],[50,1.13],[75,1.4],[100,1.67],[150,2.1],[200,2.5],[400,3.6]];
const interp=(T,x)=>{if(x<=T[0][0])return T[0][1];for(let i=1;i<T.length;i++)if(x<=T[i][0]){const [a,b]=T[i-1],[c,d]=T[i];return b+(d-b)*(x-a)/(c-a)}return T[T.length-1][1]};

/* ---------- Normativas de referencia ---------- */
const NOTA_REF='Valores de referencia cargados por NexusCode Systems para la demostración. Verifica cada valor con la versión vigente de la norma antes de usarlos en un proyecto real.';
const BUILTIN_NORMS=[
{id:'cl-ridaa',builtin:true,nombre:'Chile · RIDAA / NCh Elec. 4/2003 / OGUC',pais:'Chile',version:'Referencial 2026',nota:NOTA_REF,fuentes:[],
 desague:{ref:'RIDAA · alcantarillado domiciliario',material:'PVC sanitario',pend_peq:3,pend_gra:1,d_lim:75,prof_ini:0.3,prof_max:1.0,entrepiso:0.30,d_min_wc:100,
  ud:{wc:4,lav:1,ducha:2,lavaplatos:2,lavadora:3,lavadero:3},diam:[[40,2],[50,4],[75,12],[100,160],[150,620]],vent_dist:[[40,1.5],[50,1.8],[75,2.4],[100,3.0]]},
 agua:{ref:'RIDAA · agua potable domiciliaria',material:'Cobre tipo L / PPR',p_min:4,p_max:70,v_max:2.5,c_hw:140,f_acc:1.2,l_max_caliente:15,
  ug:{wc:3,lav:1,ducha:2,lavaplatos:3,lavadora:3,lavadero:3},diams:[['½"',13.8],['¾"',19.9],['1"',26.0],['1¼"',32.1]]},
 elec:{ref:'NCh Elec. 4/2003',cable:'Conductor THHN / EVA',tension:220,tension_ded:220,caida_max:3,sec_min_luz:1.5,sec_min_tomas:2.5,max_luz:15,max_tomas:10,va_luz:100,va_toma:150,m2_luz:12,tomas_cada_m:0,
  va:{cocina:4000,terma:1500,lavadora:1000,extractor:40},diferencial:true,dist_toma_ducha:0.6,
  tomas_min:{dormitorio:3,sala:3,comedor:2,cocina:3,bano:1,lavanderia:2,pasillo:1,closet:0,estudio:3,balcon:0,local:4,tecnico:1},
  ded:{cocina:true,terma:true,lavadora:true,tomas_cocina:false,tomas_bano:false},
  secciones:[[1.5,15],[2.5,21],[4,28],[6,36],[10,50],[16,66]],interruptores:[10,16,20,25,32,40,50,63],demanda:[[3000,1],[1e9,0.35]]},
 vent:{ref:'OGUC · ventilación de recintos',ren_bano:12,ren_cocina:15,q_bano_ls:0,q_cocina_ls:0,l_max:8,v_max:5,diams:[100,125,150]},
 incendio:{ref:'OGUC Título 4 · seguridad contra incendio',rociadores:false,area_max:20,sep_max:4.6,dist_muro:2.3,q_rociador:49,p_min_rociador:5,n_diseno:2,omitir_bano_m2:5.1,detectores:'recomendado'}},
{id:'pe-rne',builtin:true,nombre:'Perú · RNE (IS.010 / EM.010 / A.130)',pais:'Perú',version:'Referencial 2026',nota:NOTA_REF,fuentes:[],
 desague:{ref:'RNE IS.010 · desagüe y ventilación',material:'PVC-SAL',pend_peq:1.5,pend_gra:1,d_lim:75,prof_ini:0.3,prof_max:1.0,entrepiso:0.30,d_min_wc:100,
  ud:{wc:4,lav:2,ducha:3,lavaplatos:3,lavadora:3,lavadero:3},diam:[[40,3],[50,6],[75,20],[100,160],[150,620]],vent_dist:[[40,1.1],[50,1.5],[75,1.8],[100,3.0]]},
 agua:{ref:'RNE IS.010 · agua fría y caliente',material:'PPR / CPVC',p_min:2,p_max:50,v_max:3,c_hw:150,f_acc:1.2,l_max_caliente:15,
  ug:{wc:3,lav:1,ducha:2,lavaplatos:3,lavadora:3,lavadero:3},diams:[['½"',15.8],['¾"',20.9],['1"',26.6],['1¼"',35.1]]},
 elec:{ref:'CNE-Utilización · RNE EM.010',cable:'Conductor LSOH-80',tension:220,tension_ded:220,caida_max:2.5,sec_min_luz:2.5,sec_min_tomas:4,max_luz:12,max_tomas:12,va_luz:100,va_toma:180,m2_luz:12,tomas_cada_m:0,
  va:{cocina:5000,terma:1500,lavadora:1000,extractor:40},diferencial:true,dist_toma_ducha:0.6,
  tomas_min:{dormitorio:3,sala:4,comedor:2,cocina:4,bano:1,lavanderia:2,pasillo:1,closet:0,estudio:3,balcon:0,local:4,tecnico:1},
  ded:{cocina:true,terma:true,lavadora:true,tomas_cocina:false,tomas_bano:false},
  secciones:[[1.5,15],[2.5,21],[4,28],[6,36],[10,50],[16,66]],interruptores:[10,16,20,25,32,40,50,63],demanda:[[2000,1],[1e9,0.35]]},
 vent:{ref:'RNE EM.030 / A.010',ren_bano:10,ren_cocina:15,q_bano_ls:0,q_cocina_ls:0,l_max:8,v_max:5,diams:[100,125,150]},
 incendio:{ref:'RNE A.130',rociadores:false,area_max:20,sep_max:4.6,dist_muro:2.3,q_rociador:49,p_min_rociador:5,n_diseno:2,omitir_bano_m2:5.1,detectores:'recomendado'}},
{id:'us-icc',builtin:true,nombre:'EE.UU. · IPC / NEC 2023 / NFPA 13D',pais:'EE.UU.',version:'Referencial 2026',nota:NOTA_REF,fuentes:[],
 desague:{ref:'IPC 2021 · Ch. 7–9',material:'PVC DWV',pend_peq:2.08,pend_gra:1.04,d_lim:65,prof_ini:0.3,prof_max:1.0,entrepiso:0.30,d_min_wc:75,
  ud:{wc:3,lav:1,ducha:2,lavaplatos:2,lavadora:3,lavadero:2},diam:[[40,3],[50,6],[65,12],[75,20],[100,160],[150,620]],vent_dist:[[32,1.52],[40,1.83],[50,2.44],[75,3.66],[100,4.88]]},
 agua:{ref:'IPC 2021 · Ch. 6',material:'PEX',p_min:5.6,p_max:56,v_max:2.4,c_hw:150,f_acc:1.2,l_max_caliente:15,
  ug:{wc:2.2,lav:0.7,ducha:1.4,lavaplatos:1.4,lavadora:1.4,lavadero:1.4},diams:[['½"',12.1],['¾"',17.0],['1"',22.2],['1¼"',27.5]]},
 elec:{ref:'NEC 2023 · Art. 210/220',cable:'Cable NM-B',tension:120,tension_ded:240,caida_max:3,sec_min_luz:2.08,sec_min_tomas:3.31,max_luz:12,max_tomas:10,va_luz:100,va_toma:180,m2_luz:12,tomas_cada_m:3.6,
  va:{cocina:8000,terma:4500,lavadora:1500,extractor:40},diferencial:true,dist_toma_ducha:0.9,
  tomas_min:{dormitorio:2,sala:3,comedor:2,cocina:4,bano:1,lavanderia:1,pasillo:1,closet:0,estudio:2,balcon:1,local:4,tecnico:1},
  ded:{cocina:true,terma:true,lavadora:true,tomas_cocina:true,tomas_bano:true},
  secciones:[[2.08,15],[3.31,20],[5.26,30],[8.37,40],[13.3,55],[21.2,70]],interruptores:[15,20,30,40,50,60],demanda:[[3000,1],[120000,0.35],[1e9,0.25]]},
 vent:{ref:'IRC M1505',ren_bano:0,ren_cocina:0,q_bano_ls:24,q_cocina_ls:47,l_max:7.6,v_max:5,diams:[100,125,150]},
 incendio:{ref:'NFPA 13D · NFPA 72',rociadores:true,area_max:37,sep_max:6.1,dist_muro:3.05,q_rociador:49,p_min_rociador:7,n_diseno:2,omitir_bano_m2:5.1,detectores:'obligatorio'}}
];

/* ---------- utilidades ---------- */
const DX=[1,0,-1,0],DY=[0,1,0,-1];
function Heap(){this.k=[];this.v=[];this.lastK=0}
Heap.prototype.push=function(key,val){const k=this.k,v=this.v;let i=k.length;k.push(key);v.push(val);while(i>0){const p=(i-1)>>1;if(k[p]<=key)break;k[i]=k[p];v[i]=v[p];i=p}k[i]=key;v[i]=val};
Heap.prototype.pop=function(){const k=this.k,v=this.v,rk=k[0],rv=v[0],lk=k.pop(),lv=v.pop(),n=k.length;if(n){let i=0;for(;;){const l=2*i+1,r=l+1;let m=i,mk=lk;if(l<n&&k[l]<mk){m=l;mk=k[l]}if(r<n&&k[r]<mk){m=r;mk=k[r]}if(m===i)break;k[i]=k[m];v[i]=v[m];i=m}k[i]=lk;v[i]=lv}this.lastK=rk;return rv};
const rnd2=v=>Math.round(v*100)/100;
const fmt=(v,d=2)=>(Math.round(v*10**d)/10**d).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
const roomOfPt=(l,x,y)=>{let out=null;for(const r of l.rooms)if(x>=r.x0-1e-6&&x<=r.x1+1e-6&&y>=r.y0-1e-6&&y<=r.y1+1e-6)out=r;return out};

function makeGrid(l,P){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const e=(x,y)=>{if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y};
 l.rooms.forEach(r=>{e(r.x0,r.y0);e(r.x1,r.y1)});l.fixtures.forEach(f=>e(f.x,f.y));
 for(const k in P.points){const p=P.points[k];if(p&&(k==='ducto'||p.lv===l.id))e(p.x,p.y)}
 if(P.points&&P.points.ducto)(P.shafts||[]).forEach(s=>s&&e(s.x,s.y));
 if(!isFinite(x0)){x0=0;y0=0;x1=5;y1=5}
 x0=Math.floor((x0-0.8)/CELL)*CELL;y0=Math.floor((y0-0.8)/CELL)*CELL;x1+=0.8;y1+=0.8;
 const nx=Math.ceil((x1-x0)/CELL)+1,ny=Math.ceil((y1-y0)/CELL)+1,N=nx*ny;
 const room=new Int16Array(N).fill(-1),near=new Uint8Array(N);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=x0+i*CELL,y=y0+j*CELL,c=j*nx+i;
  for(let k=0;k<l.rooms.length;k++){const r=l.rooms[k];if(x>=r.x0+0.02&&x<=r.x1-0.02&&y>=r.y0+0.02&&y<=r.y1-0.02)room[c]=k}
  if(room[c]>=0){const r=l.rooms[room[c]];if(Math.min(x-r.x0,r.x1-x,y-r.y0,r.y1-y)<=0.32)near[c]=1}}
 const sig=JSON.stringify([l.rooms.map(r=>[r.type,r.x0,r.y0,r.x1,r.y1]),l.fixtures.map(f=>[f.type,f.x,f.y]),Object.entries(P.points).filter(([k,p])=>p&&(k==='ducto'||p.lv===l.id)).map(([k,p])=>[k,p.x,p.y]),(P.shafts||[]).map(s=>[s.x,s.y])]);
 return {l,x0,y0,nx,ny,N,room,near,sig,
  cell(x,y){const i=Math.max(0,Math.min(nx-1,Math.round((x-x0)/CELL))),j=Math.max(0,Math.min(ny-1,Math.round((y-y0)/CELL)));return j*nx+i},
  xy(c){return [rnd2(x0+(c%nx)*CELL),rnd2(y0+((c/nx)|0)*CELL)]}}}

const SYSP={drain:{turn:6,cross:5,ext:3},water:{turn:2,cross:2,ext:2.5},power:{turn:1.2,cross:1,ext:2.5},vent:{turn:4,cross:3,ext:3},fire:{turn:3,cross:2,ext:2.5}};
function costMap(G,sys,occ,own){const c=new Float32Array(G.N),p=SYSP[sys],av=G.avoid;
 for(let k=0;k<G.N;k++){let v=1;const r=G.room[k];
  if(r<0)v=p.ext;else{const t=G.l.rooms[r].type;
   if(sys==='drain'){if(t==='dormitorio'||t==='estudio')v=3;else if(t==='bano'||t==='cocina'||t==='lavanderia'||t==='pasillo')v=0.8}
   if((sys==='water'||sys==='power'||sys==='fire')&&G.near[k])v=0.55}
  if(occ[k]&~own)v+=1.5;if(sys==='power'&&(occ[k]&own))v*=0.6;if(av&&(av[k]&~own))v+=25;c[k]=v}
 return c}
const RB={S:0,dist:null,prev:null,stamp:null,cur:0};
function route(G,cost,sys,src,tgt,stat,goal){if(tgt[src])return [src];const p=SYSP[sys],nx=G.nx,ny=G.ny,S=G.N*5;
 if(RB.S<S){RB.S=S;RB.dist=new Float64Array(S);RB.prev=new Int32Array(S);RB.stamp=new Uint32Array(S);RB.cur=0}
 const dist=RB.dist,prev=RB.prev,stp=RB.stamp;if(++RB.cur>4e9){RB.stamp.fill(0);RB.cur=1}const cur=RB.cur;
 const gi=goal>=0?goal%nx:-1,gj=goal>=0?(goal/nx)|0:-1,hw=0.55;const H=c=>gi<0?0:hw*(Math.abs(c%nx-gi)+Math.abs(((c/nx)|0)-gj));
 const h=new Heap(),s0=src*5+4;dist[s0]=0;prev[s0]=-1;stp[s0]=cur;h.push(H(src),s0);
 while(h.k.length){const s=h.pop();const c=(s/5)|0,dr=s%5,d=dist[s];if(h.lastK>d+H(c)+1e-9)continue;stat.n++;
  if(tgt[c]){const out=[];let q=s;while(q>=0){out.push((q/5)|0);q=prev[q]}return out.reverse()}
  const i=c%nx,j=(c/nx)|0;
  for(let nd=0;nd<4;nd++){const ni=i+DX[nd],nj=j+DY[nd];if(ni<0||nj<0||ni>=nx||nj>=ny)continue;const nc=nj*nx+ni;
   let w=cost[nc];if(G.room[nc]!==G.room[c])w+=p.cross;if(dr!==4&&dr!==nd)w+=p.turn;const ns=nc*5+nd,v=d+w;if(stp[ns]!==cur||v<dist[ns]){stp[ns]=cur;dist[ns]=v;prev[ns]=s;h.push(v+H(nc),ns)}}}
 return null}
const TCACHE=new Map();
function buildTree(G,sys,root,terms,cost,stat,occ,bit){const key=G.sig?sys+'|'+G.sig+'|'+root+'|'+terms.map(t=>t.c+':'+(t.load||0)+':'+(t.dmin||0)).join(','):null;
 if(key&&TCACHE.has(key)){const C=TCACHE.get(key);for(let c=0;c<G.N;c++)if(C.inTree[c])occ[c]|=bit;C.terms.forEach((t,i)=>{if(terms[i]){terms[i].fail=t.fail}});return {...C,G,terms,cached:true}}
 const N=G.N,inTree=new Uint8Array(N),parent=new Int32Array(N).fill(-1),isTerm=new Uint8Array(N),routes=[];
 inTree[root]=1;occ[root]|=bit;const [rx,ry]=G.xy(root);
 const ord=terms.slice().sort((a,b)=>{const A=G.xy(a.c),B=G.xy(b.c);return (Math.abs(A[0]-rx)+Math.abs(A[1]-ry))-(Math.abs(B[0]-rx)+Math.abs(B[1]-ry))});
 for(const t of ord){isTerm[t.c]=1;if(inTree[t.c])continue;const path=route(G,cost,sys,t.c,inTree,stat,root);if(!path){t.fail=true;continue}
  for(let k=0;k<path.length-1;k++){parent[path[k]]=path[k+1];inTree[path[k]]=1;occ[path[k]]|=bit}routes.push(path)}
 const load=new Float64Array(N),dm=new Float32Array(N);
 for(const t of terms){if(t.fail)continue;let c=t.c,g=0;while(c>=0&&g++<N){load[c]+=t.load||0;if((t.dmin||0)>dm[c])dm[c]=t.dmin;if(c===root)break;c=parent[c]}}
 const T={G,root,inTree,parent,isTerm,load,dm,routes,terms};if(key)TCACHE.set(key,T);return T}
function chainCells(T,c){const out=[];let g=0;while(c>=0&&g++<T.G.N){out.push(c);if(c===T.root)break;c=T.parent[c]}return out}
function treeSegs(T,dOf){const {G,parent,inTree,isTerm,root}=T,N=G.N,kids=new Int32Array(N),only=new Int32Array(N).fill(-1);
 for(let c=0;c<N;c++)if(inTree[c]&&parent[c]>=0){kids[parent[c]]++;only[parent[c]]=c}
 let elbows=0,tees=0,len=0;const segs=[];
 for(let c=0;c<N;c++){if(!inTree[c])continue;if(kids[c]>=2)tees+=kids[c]-1;if(kids[c]===1&&parent[c]>=0&&(c-only[c])!==(parent[c]-c))elbows++;if(parent[c]>=0)len+=CELL}
 const start=c=>{if(!inTree[c]||parent[c]<0)return false;if(kids[c]!==1||isTerm[c])return true;const ch=only[c];return (c-ch)!==(parent[c]-c)||dOf(ch)!==dOf(c)};
 for(let c=0;c<N;c++){if(!start(c))continue;let cur=c,g=0;
  for(;;){const nx=parent[cur];if(nx<0)break;const p2=parent[nx];
   if(p2>=0&&nx!==root&&kids[nx]===1&&!isTerm[nx]&&(nx-cur)===(p2-nx)&&dOf(nx)===dOf(cur)&&g++<N){cur=nx;continue}
   const a=G.xy(c),b=G.xy(nx);segs.push({a,b,d:dOf(c),len:Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),load:T.load[c]});break}}
 return {segs,elbows,tees,len}}

/* ---------- interferencias 3D ---------- */
const v3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};
const vlen=a=>Math.sqrt(v3.dot(a,a)),clp=(v,a,b)=>v<a?a:v>b?b:v;
function segDist(p1,q1,p2,q2){const d1=v3.sub(q1,p1),d2=v3.sub(q2,p2),r=v3.sub(p1,p2),a=v3.dot(d1,d1),e=v3.dot(d2,d2),f=v3.dot(d2,r);let s,t;
 if(a<1e-9&&e<1e-9){s=t=0}else if(a<1e-9){s=0;t=clp(f/e,0,1)}else{const c=v3.dot(d1,r);if(e<1e-9){t=0;s=clp(-c/a,0,1)}else{const b=v3.dot(d1,d2),den=a*e-b*b;s=den>1e-12?clp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clp(-c/a,0,1)}else if(t>1){t=1;s=clp((b-c)/a,0,1)}}}
 const c1=v3.add(p1,v3.mul(d1,s)),c2=v3.add(p2,v3.mul(d2,t));return [vlen(v3.sub(c1,c2)),c1,c2]}
function allSegs(P3){const out=[];for(const k in P3)P3[k].forEach((e,pi)=>{if(e.nc)return;const p=e.p;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(vlen(v3.sub(a,b))<1e-4)continue;
 out.push({sys:k,pi,si:i-1,a,b,r:e.r,mnx:Math.min(a[0],b[0])-.3,mxx:Math.max(a[0],b[0])+.3,mny:Math.min(a[1],b[1])-.3,mxy:Math.max(a[1],b[1])+.3,mnz:Math.min(a[2],b[2])-.3,mxz:Math.max(a[2],b[2])+.3})}});return out}
function detect(P3){const S=allSegs(P3),res=[],B=new Map(),BS=1.0,BZ=1.5;
 S.forEach((A,i)=>{const i0=Math.floor(A.mnx/BS),i1=Math.floor(A.mxx/BS),j0=Math.floor(A.mny/BS),j1=Math.floor(A.mxy/BS),k0=Math.floor(A.mnz/BZ),k1=Math.floor(A.mxz/BZ);
  if((i1-i0+1)*(j1-j0+1)*(k1-k0+1)>4000)return;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++)for(let c=k0;c<=k1;c++){const key=a+','+b+','+c;let L=B.get(key);if(!L)B.set(key,L=[]);L.push(i)}});
 const seen=new Set();
 for(const L of B.values()){for(let x=0;x<L.length;x++){const A=S[L[x]];for(let y=x+1;y<L.length;y++){const Bq=S[L[y]];if(A.sys===Bq.sys||NET_SYS[A.sys]===NET_SYS[Bq.sys]&&!(A.sys==='cold'&&Bq.sys==='hot'||A.sys==='hot'&&Bq.sys==='cold'))continue;
  if(A.mxx<Bq.mnx||Bq.mxx<A.mnx||A.mxy<Bq.mny||Bq.mxy<A.mny||A.mxz<Bq.mnz||Bq.mxz<A.mnz)continue;const pk=L[x]<L[y]?L[x]*1e6+L[y]:L[y]*1e6+L[x];if(seen.has(pk))continue;seen.add(pk);
  const [d,c1,c2]=segDist(A.a,A.b,Bq.a,Bq.b);if(d<A.r+Bq.r+0.025)res.push(L[x]<L[y]?{A,B:Bq,c1,c2,d}:{A:Bq,B:A,c1:c2,c2:c1,d})}}}
 return res.sort((p,q)=>(p.A.sys+p.A.pi+'/'+p.A.si).localeCompare(q.A.sys+q.A.pi+'/'+q.A.si)||(p.B.pi-q.B.pi))}
function resolveClashes(P3){const initial=detect(P3).length,steps=[],ign=new Set(),cnt={};let guard=0;const key=c=>[c.A.sys,c.B.sys].sort().join('|')+v3.mul(v3.add(c.c1,c.c2),0.5).map(v=>Math.round(v*20)).join(',');
 while(guard++<120){const cs=detect(P3).filter(c=>!ign.has(key(c)));if(!cs.length)break;const c=cs[0];
  const Y=PRI[c.A.sys]<PRI[c.B.sys]?{seg:c.A,cp:c.c1,o:c.B,oc:c.c2}:{seg:c.B,cp:c.c2,o:c.A,oc:c.c1};
  const path=P3[Y.seg.sys][Y.seg.pi].p,a=path[Y.seg.si],b=path[Y.seg.si+1],L=vlen(v3.sub(b,a)),dir=v3.mul(v3.sub(b,a),1/L);
  const od=v3.sub(Y.o.b,Y.o.a),odir=v3.mul(od,1/vlen(od)),yv=Math.abs(dir[2])>0.9,ov=Math.abs(odir[2])>0.9,need=Y.seg.r+Y.o.r+0.08;let o,act;
  if(!yv&&ov){o=[-dir[1]*need,dir[0]*need,0];act=`rodeo lateral de ${fmt(need)} m`}
  else if(!yv){const nz=Y.oc[2]-(Y.seg.r+Y.o.r+0.05);o=[0,0,nz-Y.cp[2]];act=`baja ${fmt(Math.abs(o[2]))} m bajo ${NETS[Y.o.sys].toLowerCase()}`}
  else{o=[-odir[1]*need,odir[0]*need,0];act=`desplaza ${fmt(need)} m`}
  const tP=v3.dot(v3.sub(Y.cp,a),dir),al=Y.o.r+Y.seg.r+0.18;const kk=key(c);cnt[kk]=(cnt[kk]||0)+1;if(cnt[kk]>2){ign.add(kk);continue}const t1=Math.max(0,tP-al),t2=Math.min(L,tP+al),p1=v3.add(a,v3.mul(dir,t1)),p2=v3.add(a,v3.mul(dir,t2));
  // probar el desvío; si los tramos nuevos chocan con otra red, probar hacia el otro lado; si no, dejarlo para revisión manual
  const famOK=(sa,sb)=>sa===sb||NET_SYS[sa]===NET_SYS[sb]&&!(sa==='cold'&&sb==='hot'||sa==='hot'&&sb==='cold');
  const S0=allSegs(P3);const bad=(q1,q2,q3,q4)=>{const ns=[[q1,q2],[q2,q3],[q3,q4]];for(const [u,w] of ns){const mn=[Math.min(u[0],w[0]),Math.min(u[1],w[1]),Math.min(u[2],w[2])],mx=[Math.max(u[0],w[0]),Math.max(u[1],w[1]),Math.max(u[2],w[2])];
    for(const z of S0){if(famOK(z.sys,Y.seg.sys))continue;if(z.mxx<mn[0]||z.mnx>mx[0]||z.mxy<mn[1]||z.mny>mx[1]||z.mxz<mn[2]||z.mnz>mx[2])continue;if(segDist(u,w,z.a,z.b)[0]<Y.seg.r+z.r+0.02)return true}}return false};
  if(bad(p1,v3.add(p1,o),v3.add(p2,o),p2)){const o2=v3.mul(o,-1);if(!bad(p1,v3.add(p1,o2),v3.add(p2,o2),p2)){o=o2;act=act.replace('baja','sube').replace(' bajo ',' sobre ')}else{ign.add(kk);continue}}
  path.splice(Y.seg.si+1,0,p1,v3.add(p1,o),v3.add(p2,o),p2);
  steps.push({yield:Y.seg.sys,other:Y.o.sys,pi:Y.seg.pi,path:JSON.parse(JSON.stringify(path)),pt:v3.mul(v3.add(c.c1,c.c2),0.5),act})}
 return {initial,steps,remaining:detect(P3).length,manual:ign.size}}

/* ---------- cálculo principal ---------- */
// tablas de la normativa ampliadas con tamaños comerciales mayores (edificios): solo se usan si la normativa se queda corta
function extNorm(N){const X=JSON.parse(JSON.stringify(N));
 if(X.desague&&X.desague.diam){const last=X.desague.diam[X.desague.diam.length-1];[[200,1400],[250,2500],[300,3900]].forEach(e=>{if(e[0]>last[0]&&e[1]>last[1])X.desague.diam.push(e)})}
 if(X.agua&&X.agua.diams){const last=X.agua.diams[X.agua.diams.length-1][1];[['1½"',40.8],['2"',52.5],['2½"',63.5],['3"',76.2],['4"',101.6],['6"',152.4]].forEach(e=>{if(e[1]>last+2)X.agua.diams.push(e)})}
 if(X.elec&&X.elec.secciones){const awg=X.elec.secciones[0][0]===2.08;const sl=X.elec.secciones[X.elec.secciones.length-1];
  (awg?[[33.6,95],[53.5,125],[67.4,145],[85,165],[107,195],[127,215],[177,260]]:[[25,89],[35,111],[50,134],[70,171],[95,207],[120,239],[150,272]]).forEach(e=>{if(e[0]>sl[0])X.elec.secciones.push(e)});
  const il=X.elec.interruptores[X.elec.interruptores.length-1];(awg?[70,80,100,125,150,175,200,225,250]:[80,100,125,160,200,250]).forEach(b=>{if(b>il)X.elec.interruptores.push(b)})}
 if(X.vent&&X.vent.diams){const l=X.vent.diams[X.vent.diams.length-1];[200,250,315,400,500].forEach(d=>{if(d>l)X.vent.diams.push(d)})}
 return X}
function compute(P,N,opts={}){N=extNorm(N);
 const R={checks:[],fixes:[],bom:[],circuits:[],logs:[],ev:{drain:0,water:0,power:0,vent:0,fire:0},D2:{drain:[],water:[],power:[],vent:[],fire:[]},nodes:[],stats:{},norm:N.id,normName:N.nombre,totals:{}};
 const lv=P.levels.slice().sort((a,b)=>a.elev-b.elev);
 if(!lv.length){R.error='El proyecto no tiene niveles.';return R}
 const L1=lv[0],TOP=lv[lv.length-1],roof=TOP.elev+TOP.h,pts=P.points||{};
 const need=['medidor','salida','tablero'];if(lv.length>1)need.push('ducto');
 const miss=need.filter(k=>!pts[k]);if(miss.length){R.error='Faltan puntos en el plano: '+miss.map(k=>PTS[k]).join(', ')+'.';return R}
 if(!lv.some(l=>l.rooms.length)){R.error='Dibuja al menos un ambiente.';return R}
 const lvOf=id=>P.levels.find(l=>l.id===id)||L1;
 {const big=Math.max(...lv.map(l=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;l.rooms.forEach(r=>{x0=Math.min(x0,r.x0);y0=Math.min(y0,r.y0);x1=Math.max(x1,r.x1);y1=Math.max(y1,r.y1)});return l.rooms.length?(x1-x0)*(y1-y0):0}));CELL=opts.cell||(big>1500?0.25:big>400?0.2:0.1);R.cell=CELL}
 TCACHE.clear();
 const G={},occ={};lv.forEach(l=>{G[l.id]=makeGrid(l,P);occ[l.id]=new Uint8Array(G[l.id].N)});
 const BIT={drain:1,water:2,power:4,vent:8,fire:16};
 const SHS=[pts.ducto||{x:pts.tablero.x,y:pts.tablero.y}].concat(pts.ducto?(P.shafts||[]).filter(s=>s&&isFinite(s.x)&&isFinite(s.y)):[]);const sh=SHS[0];
 const OFF={drain:0,cold:-0.3,hot:-0.5,power:-0.7,fire:-0.9,vent:-1.2};
 const shc=(l,k,i=0)=>G[l.id].cell(SHS[i].x+OFF[k],SHS[i].y);
 const shx=(k,i=0)=>rnd2(SHS[i].x+OFF[k]);
 const nearSh=(x,y)=>{let b=0,bd=1e9;SHS.forEach((s,i)=>{const d=Math.abs(s.x-x)+Math.abs(s.y-y);if(d<bd){bd=d;b=i}});return b};
 const split=(arr,xy)=>{const parts=SHS.map(()=>[]);arr.forEach(a=>{const [x,y]=xy(a);parts[nearSh(x,y)].push(a)});return parts};
 const BLD=SHS.length>1||lv.length>=3;R.shafts=SHS.length;
 const BITK={drain:1,dvent:1,cold:2,hot:2,water:2,power:4,vent:8,fire:16};
 lv.forEach(l=>{G[l.id].avoid=opts.noAvoid?null:new Uint8Array(G[l.id].N)});
 const mark=(k,x,y,z0,z1)=>{for(const l of lv){if(Math.max(z0,z1)<l.elev-0.3||Math.min(z0,z1)>l.elev+l.h+0.3)continue;const g=G[l.id];if(!g.avoid)continue;const c=g.cell(x,y);for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const cc=c+di+dj*g.nx;if(cc>=0&&cc<g.N)g.avoid[cc]|=BITK[k]}}};
 if(pts.ducto)SHS.forEach(s=>['drain','cold','hot','power','fire','vent'].forEach(k=>mark(k,s.x+OFF[k],s.y,-1,99)));
 const PR=Object.assign({presion:18,f_acc:1.2},P.params||{});let PUMP=0;
 const ck=(sys,name,ref,val,lim,st,where)=>R.checks.push({sys,name,ref,val,lim,st,where:where||''});
 const fix=(sys,t)=>R.fixes.push({sys,t}),log=(sys,t)=>R.logs.push({sys,t});
 const bomAdd=(sys,item,spec,unit,qty)=>{if(!(qty>0))return;const e=R.bom.find(b=>b.sys===sys&&b.item===item&&b.spec===spec);if(e)e.qty+=qty;else R.bom.push({sys,item,spec,unit,qty})};
 const Zs={drain:l=>l===L1?l.elev-0.35:l.elev-0.10,cold:l=>l.elev+l.h-0.42,hot:l=>l.elev+l.h-0.56,power:l=>l.elev+l.h-0.05,vent:l=>l.elev+l.h-0.27,fire:l=>l.elev+l.h-0.13};
 const P3={drain:[],dvent:[],cold:[],hot:[],power:[],vent:[],fire:[]};
 const add3=(k,l,segs,z,rad)=>segs.forEach(s=>P3[k].push({lv:l.id,p:[[s.a[0],s.a[1],z],[s.b[0],s.b[1],z]],r:rad(s.d),d:s.d}));
 const vert=(k,lid,x,y,z0,z1,r,d,nc)=>{P3[k].push({lv:lid,p:[[x,y,z0],[x,y,z1]],r,d,nc:!!nc});if(!nc)mark(k,x,y,z0,z1)};
 const d2=(sys,k,l,segs,label)=>segs.forEach(s=>R.D2[sys].push({lv:l.id,k,a:s.a,b:s.b,d:s.d,label}));
 const node=(sys,k,l,x,y,label)=>R.nodes.push({sys,k,lv:l.id,x,y,label});
 const routesD2=(sys,k,l,T)=>T.routes.forEach(rt=>R.D2[sys].push({lv:l.id,k,route:rt.map(c=>T.G.xy(c))}));

 /* ===== Agente 1 · Desagüe ===== */
 {const nd=N.desague,st={n:0};
  const udOf=f=>+(nd.ud[f.type]||0),dminFx={wc:nd.d_min_wc,lav:40,ducha:50,lavaplatos:50,lavadora:50,lavadero:50};
  const pend=d=>d<=nd.d_lim?nd.pend_peq:nd.pend_gra;
  const diamUD=u=>{for(const [d,m] of nd.diam)if(u<=m)return d;return nd.diam[nd.diam.length-1][0]};
  const ventLim=d=>{let best=nd.vent_dist[0][1];for(const [dd,m] of nd.vent_dist)if(dd<=d)best=m;return best};
  const dfx=l=>l.fixtures.filter(f=>FX[f.type]&&FX[f.type].dr);
  let upUD=0,upDm=0,totUD=0,nFx=0,Ltot=0,depth=0,dMain=0,stackD=0,elbowsL1=0,teesAll=0,elbowsAll=0;const lenBy={};const addLen=(d,L)=>{lenBy[d]=(lenBy[d]||0)+L};
  const vents=[];
  const doLevel=(l,root,extraTerms,fxList)=>{const g=G[l.id],cost=costMap(g,'drain',occ[l.id],BIT.drain);const fx=fxList||dfx(l);
   const terms=fx.map(f=>({c:g.cell(f.x,f.y),load:udOf(f),dmin:dminFx[f.type]||40,f})).concat(extraTerms);
   if(!terms.length)return null;
   const T=buildTree(g,'drain',root,terms,cost,st,occ[l.id],BIT.drain);const dOf=c=>Math.max(diamUD(T.load[c]),T.dm[c]);
   const S=treeSegs(T,dOf);elbowsAll+=S.elbows;teesAll+=S.tees;
   S.segs.forEach(s=>{addLen(s.d,s.len);Ltot+=s.len});d2('drain','drain',l,S.segs);routesD2('drain','drain',l,T);add3('drain',l,S.segs,Zs.drain(l),d=>d/2000);
   // pendiente / profundidad
   let maxDrop=0;for(const t of terms){if(t.fail||t.stack)continue;let drop=0;for(const c of chainCells(T,t.c))if(c!==T.root)drop+=CELL*pend(dOf(c))/100;if(drop>maxDrop)maxDrop=drop}
   // ventilación de trampas: distancia por el árbol hasta un punto ventilado
   const ventCells=[];if(pts.ducto){if(l===L1)SHS.forEach((s,i)=>ventCells.push(shc(l,'drain',i)));else ventCells.push(root)}
   const adj=new Map();const link=(a,b)=>{(adj.get(a)||adj.set(a,[]).get(a)).push(b)};for(let c=0;c<g.N;c++)if(T.inTree[c]&&T.parent[c]>=0){link(c,T.parent[c]);link(T.parent[c],c)}
   const dist=new Map();const q=[];ventCells.forEach(c=>{if(T.inTree[c]){dist.set(c,0);q.push(c)}});
   while(q.length){const c=q.shift();for(const n of adj.get(c)||[])if(!dist.has(n)){dist.set(n,dist.get(c)+CELL);q.push(n)}}
   for(const t of terms){if(!t.f||t.fail)continue;const dt=dOf(t.c),lim=ventLim(dt),dd=dist.has(t.c)?dist.get(t.c):Infinity;const nm=`${FX[t.f.type].n} · ${(roomOfPt(l,t.f.x,t.f.y)||{}).name||l.name}`;
    if(dd<=lim+1e-6)ck('drain','Distancia trampa–ventilación',nd.ref,`${fmt(dd)} m`,`≤ ${fmt(lim)} m (Ø${dt})`,'ok',nm);
    else{vents.push({l,x:rnd2(t.f.x-0.15),y:t.f.y,d:dt<=50?40:50});ck('drain','Distancia trampa–ventilación',nd.ref,dd===Infinity?'sin ventilación':`${fmt(dd)} m`,`≤ ${fmt(lim)} m (Ø${dt})`,'fix',nm+' · ventilación individual agregada');
     fix('drain',`Se agregó ventilación individual Ø${dt<=50?40:50} en ${nm}: la trampa quedaba a ${dd===Infinity?'más del límite':fmt(dd)+' m'} de un punto ventilado.`)}
    if(t.f.type==='wc')ck('drain','Descarga de inodoro',nd.ref,`Ø${dt} mm`,`≥ Ø${nd.d_min_wc} mm`,dt>=nd.d_min_wc?'ok':'fail',nm);
    vert('drain',l.id,t.f.x,t.f.y,l.elev,Zs.drain(l),t.dmin/2000,t.dmin,1);addLen(t.dmin,Math.abs(l.elev-Zs.drain(l)));
    node('drain','fx',l,t.f.x,t.f.y,FX[t.f.type].ab)}
   // cruces bajo dormitorios
   let dorm=0;for(let c=0;c<g.N;c++)if(T.inTree[c]&&g.room[c]>=0&&g.l.rooms[g.room[c]].type==='dormitorio')dorm++;
   if(dorm)ck('drain','Recorrido bajo dormitorios',nd.ref,`${fmt(dorm*CELL,1)} m`,'evitar','warn',l.name);
   return {T,dOf,S,maxDrop,load:terms.reduce((a,t)=>a+(t.stack?0:t.load),0),dm:Math.max(0,...terms.map(t=>t.dmin||0))}};
  const upS=SHS.map(()=>({ud:0,dm:0}));
  for(const l of lv.slice(1)){const fxs=dfx(l);if(!fxs.length)continue;let maxDrop=0,any=false;
   split(fxs,f=>[f.x,f.y]).forEach((fp,i)=>{if(!fp.length)return;const r=doLevel(l,shc(l,'drain',i),[],fp);if(!r)return;any=true;upS[i].ud+=r.load;upS[i].dm=Math.max(upS[i].dm,r.dm);upUD+=r.load;upDm=Math.max(upDm,r.dm);maxDrop=Math.max(maxDrop,r.maxDrop)});
   if(!any)continue;nFx+=fxs.length;const r={maxDrop};
   const ok=r.maxDrop<=nd.entrepiso;ck('drain','Pendiente en entrepiso',nd.ref,`caída ${fmt(r.maxDrop)} m`,`≤ ${fmt(nd.entrepiso)} m disponibles`,ok?'ok':'fail',l.name);
   if(!ok)log('drain',`${l.name}: el ramal más largo necesita ${fmt(r.maxDrop)} m de caída y el entrepiso tiene ${fmt(nd.entrepiso)} m`)}
  const salida=lvOf(pts.salida.lv);
  const extra=pts.ducto?SHS.map((s,i)=>(i===0||upS[i].ud>0)?{c:shc(L1,'drain',i),load:upS[i].ud,dmin:upS[i].dm,stack:true}:null).filter(Boolean):[];
  const r1=doLevel(L1,G[L1.id].cell(pts.salida.x,pts.salida.y),extra);nFx+=dfx(L1).length;
  totUD=(r1?r1.load:0)+upUD;
  if(r1){depth=nd.prof_ini+r1.maxDrop;elbowsL1=r1.S.elbows;
   let mx=0;for(let c=0;c<r1.T.G.N;c++)if(r1.T.inTree[c]&&r1.T.parent[c]===r1.T.root)mx=Math.max(mx,r1.dOf(c));dMain=mx;
   ck('drain','Profundidad del colector en la salida',nd.ref,`${fmt(depth)} m`,`≤ ${fmt(nd.prof_max)} m`,depth<=nd.prof_max?'ok':'fail',`pendiente ${nd.pend_gra}–${nd.pend_peq} %`);
   let capMain=(nd.diam.find(x=>x[0]===dMain)||[0,0])[1];let nOut=1;
   if(totUD>capMain){const big=nd.diam[nd.diam.length-1];const d2=diamUD(totUD);if(totUD<=big[1]){fix('drain',`Colector principal aumentado de Ø${dMain} a Ø${d2} por la carga total de ${fmt(totUD,0)} UD.`);dMain=d2;capMain=(nd.diam.find(x=>x[0]===d2)||[0,0])[1]}
    else{nOut=Math.ceil(totUD/big[1]);dMain=big[0];capMain=big[1]*nOut;fix('drain',`La carga total (${fmt(totUD,0)} UD) supera un colector Ø${big[0]}: se proyectan ${nOut} uniones domiciliarias independientes.`)}}
   ck('drain','Capacidad del colector principal',nd.ref,`${fmt(totUD,0)} UD`,`${nOut>1?nOut+' × ':''}Ø${dMain}: hasta ${capMain} UD`,totUD<=capMain?(nOut>1||dMain!==mx?'fix':'ok'):'fail','salida a red pública');
   node('drain','pt',L1,pts.salida.x,pts.salida.y,'Salida');log('drain',`Colector Ø${dMain} a ${nd.pend_gra} %: llega a la salida a ${fmt(depth)} m de profundidad`)}
  let nStacks=0;if(pts.ducto){SHS.forEach((s,i)=>{if(i>0&&!(upS[i].ud>0))return;nStacks++;const u=upS[i];const dS=Math.max(nd.d_min_wc&&u.dm>=nd.d_min_wc?nd.d_min_wc:0,diamUD(u.ud),u.dm,50);stackD=Math.max(stackD,dS);
    vert('drain','all',s.x,s.y,Zs.drain(L1),roof+0.5,dS/2000,dS);addLen(dS,roof+0.5-Zs.drain(L1));
    if(lv.length>1)log('drain',`Montante ${SHS.length>1?(i+1)+' ':''}Ø${dS} recibe ${fmt(u.ud,0)} UD de los pisos superiores`)});
   ck('drain',nStacks>1?'Montantes con ventilación a techo':'Montante con ventilación a techo',nd.ref,`${nStacks>1?nStacks+' montantes · hasta ':''}Ø${stackD} mm · ${fmt(roof+0.5-Zs.drain(L1))} m`,'ventilada sobre cubierta','ok',nStacks>1?'un montante por grupo de baños':'ducto vertical')}
  for(const v of vents){if(BLD&&pts.ducto){const zt=v.l.elev+1.15;vert('dvent',v.l.id,v.x,v.y,Zs.drain(v.l),zt,v.d/2000,v.d,1);const s0=SHS[nearSh(v.x,v.y)];addLen(v.d,zt-Zs.drain(v.l)+Math.abs(s0.x-v.x)+Math.abs(s0.y-v.y))}
   else{vert('dvent',v.l.id,v.x,v.y,Zs.drain(v.l),roof+0.5,v.d/2000,v.d);addLen(v.d,roof+0.5-Zs.drain(v.l))}}
  if(BLD&&pts.ducto&&vents.length)log('drain',`${vents.length} ventilaciones individuales se conectan a la columna de ventilación del ducto más cercano sobre el nivel de rebalse`);
  const regs=elbowsL1+1;
  Object.keys(lenBy).sort((a,b)=>a-b).forEach(d=>bomAdd('drain',`Tubería ${nd.material}`,`Ø ${d} mm`,'m',lenBy[d]));
  bomAdd('drain','Codos','varios Ø','u',elbowsAll);bomAdd('drain','Tees / yees','varios Ø','u',teesAll+nFx);
  bomAdd('drain','Registros de limpieza','Ø 100 mm','u',regs);bomAdd('drain','Cámara de inspección','60 × 60 cm','u',1+(R.nOut||0));
  bomAdd('drain','Sombrerete de ventilación','Ø 50–100 mm','u',nStacks+vents.length);
  R.ev.drain=st.n;R.totals.drain={len:Object.values(lenBy).reduce((a,b)=>a+b,0),depth,dMain,stackD,stacks:nStacks,ud:totUD,vents:vents.length,fx:nFx};
  R.stats.drain=[`${fmt(R.totals.drain.len,1)} m ${nd.material} · colector Ø${dMain||'—'}`,`${nFx} aparatos · ${fmt(totUD,0)} UD · salida a ${fmt(depth)} m`]}

 /* ===== Agente 4 · Ventilación (antes que electricidad: crea extractores) ===== */
 const extractors=[];
 {const nv=N.vent,st={n:0};let Ltot=0;const lenBy={};let nNeed=0;const colV={};
  for(const l of lv){const g=G[l.id];for(const r of l.rooms){if(!(r.type==='bano'||r.type==='cocina')||r.ventana)continue;nNeed++;
   let ex=l.fixtures.find(f=>f.type==='extractor'&&roomOfPt(l,f.x,f.y)===r);
   if(!ex){ex={type:'extractor',x:rnd2((r.x0+r.x1)/2),y:rnd2((r.y0+r.y1)/2),auto:true};fix('vent',`Se agregó un extractor en ${r.name} (${l.name}): el recinto no tiene ventilación natural.`)}
   const area=(r.x1-r.x0)*(r.y1-r.y0),vol=area*l.h,ren=r.type==='bano'?nv.ren_bano:nv.ren_cocina,qf=r.type==='bano'?nv.q_bano_ls:nv.q_cocina_ls;
   const q=qf>0?qf:ren*vol/3.6;let dd=nv.diams[nv.diams.length-1];for(const d of nv.diams){if(q/1000/(Math.PI*(d/1000)**2/4)<=nv.v_max){dd=d;break}}
   const v=q/1000/(Math.PI*(dd/1000)**2/4);let horiz=0,vertL;
   let si=-1;if(l===TOP||!pts.ducto){vertL=roof+0.4-Zs.vent(l);vert('vent',l.id,ex.x,ex.y,Zs.vent(l),roof+0.4,dd/2000,dd)}
   else{si=nearSh(ex.x,ex.y);const cost=costMap(g,'vent',occ[l.id],BIT.vent);
    const T=buildTree(g,'vent',shc(l,'vent',si),[{c:g.cell(ex.x,ex.y),load:1}],cost,st,occ[l.id],BIT.vent);const S=treeSegs(T,()=>dd);
    horiz=S.len;d2('vent','vent',l,S.segs);routesD2('vent','vent',l,T);add3('vent',l,S.segs,Zs.vent(l),d=>d/2000);
    vertL=0;const cs=colV[si]||(colV[si]={q:0,z0:Infinity,n:0});cs.q+=q;cs.n++;cs.z0=Math.min(cs.z0,Zs.vent(l))}
   vert('vent',l.id,ex.x,ex.y,l.elev+l.h-0.05,Zs.vent(l),dd/2000,dd,1);
   const L=horiz+vertL+(si>=0?0.5:0);Ltot+=L;lenBy[dd]=(lenBy[dd]||0)+L;const nm=`${r.name} · ${l.name}`;
   ck('vent','Caudal de extracción',nv.ref,`${fmt(q,1)} L/s`,qf>0?`${qf} L/s`:`${ren} ren/h × ${fmt(vol,1)} m³`,'ok',nm);
   ck('vent','Velocidad en ducto',nv.ref,`${fmt(v,1)} m/s (Ø${dd})`,`≤ ${nv.v_max} m/s`,v<=nv.v_max?'ok':'fail',nm);
   ck('vent',si>=0?'Longitud de ramal al shaft':'Longitud de ducto',nv.ref,`${fmt(L,1)} m`,`≤ ${nv.l_max} m`,L<=nv.l_max?'ok':'warn',nm);
   extractors.push({l,x:ex.x,y:ex.y,room:r.name,q});node('vent','fx',l,ex.x,ex.y,'EX');
   log('vent',`${nm}: extractor de ${fmt(q,0)} L/s, ducto Ø${dd} de ${fmt(L,1)} m`)}}
  Object.entries(colV).forEach(([si,cs])=>{const q=cs.q*0.8;let dd=nv.diams[nv.diams.length-1];for(const d of nv.diams){if(q/1000/(Math.PI*(d/1000)**2/4)<=nv.v_max){dd=d;break}}const L=roof+0.4-cs.z0;
   vert('vent','all',shx('vent',+si),SHS[si].y,cs.z0,roof+0.4,dd/2000,dd);lenBy[dd]=(lenBy[dd]||0)+L;Ltot+=L;
   if(cs.n>1)ck('vent','Shaft colectivo de extracción',nv.ref,`Ø${dd} · ${fmt(cs.q,0)} L/s`,`v ≤ ${nv.v_max} m/s`,'ok',`${cs.n} extractores${SHS.length>1?' · ducto '+(+si+1):''}`)});
  if(!nNeed)ck('vent','Recintos sin ventilación natural',nv.ref,'0','—','ok','todos los baños y cocinas tienen ventana');
  Object.keys(lenBy).forEach(d=>bomAdd('vent','Ducto PVC / aluminio flexible',`Ø ${d} mm`,'m',lenBy[d]));
  extractors.forEach(e=>bomAdd('vent','Extractor de aire',`${Math.ceil(e.q/5)*5} L/s`,'u',1));bomAdd('vent','Sombrerete / rejilla exterior','—','u',extractors.length);
  R.ev.vent=st.n;R.totals.vent={n:extractors.length,len:Ltot};
  R.stats.vent=[extractors.length?`${extractors.length} extractores · ${fmt(Ltot,1)} m de ducto`:'Sin extracción mecánica requerida',`${nNeed} recintos sin ventana`]}

 /* ===== Agente 2 · Agua fría y caliente ===== */
 {const na=N.agua,st={n:0};const ugOf=f=>+(na.ug[f.type]||0);const Q=u=>interp(HUNTER,u);
  const dsel=q=>{for(const [nm,di] of na.diams){const v=q/1000/(Math.PI*(di/1000)**2/4);if(v<=na.v_max)return di}return na.diams[na.diams.length-1][1]};
  const nom=di=>(na.diams.find(x=>x[1]===di)||['?'])[0];
  const hf=(L,q,di)=>q<=0?0:10.67*L*Math.pow(q/1000,1.852)/(Math.pow(na.c_hw,1.852)*Math.pow(di/1000,4.87));
  const vel=(q,di)=>q/1000/(Math.PI*(di/1000)**2/4);
  const mLv=lvOf(pts.medidor.lv);let vmax=0,Lc=0,Lh=0,nPts=0,elb=0,tee=0;const lenC={},lenH={};
  const coldFx=l=>l.fixtures.filter(f=>FX[f.type]&&(FX[f.type].cold));
  const hotFx=l=>l.fixtures.filter(f=>FX[f.type]&&FX[f.type].hot);
  const heater=(()=>{for(const l of lv)for(const f of l.fixtures)if(f.type==='terma')return {l,f};return null})();
  const runNet=(kind,l,root,terms,lenBy)=>{const g=G[l.id],cost=costMap(g,'water',occ[l.id],BIT.water),T=buildTree(g,'water',root,terms,cost,st,occ[l.id],BIT.water);
   const dOf=c=>dsel(Q(T.load[c]));const S=treeSegs(T,dOf);elb+=S.elbows;tee+=S.tees;
   S.segs.forEach(s=>{lenBy[s.d]=(lenBy[s.d]||0)+s.len;vmax=Math.max(vmax,vel(Q(s.load),s.d))});
   d2('water',kind,l,S.segs);routesD2('water',kind,l,T);add3(kind,l,S.segs,Zs[kind](l),d=>d/2000+0.004);
   const hfTo=c=>{let s=0;for(const x of chainCells(T,c))if(x!==T.root)s+=hf(CELL,Q(T.load[x]),dOf(x));return s};
   const lenTo=c=>(chainCells(T,c).length-1)*CELL;return {T,dOf,hfTo,lenTo,S}};
  // agua fría: cada nivel se divide por ducto; un montante por ducto
  const nets={};const sLoad=SHS.map(()=>0);let shaftLoad=0;
  for(const l of lv){if(l===mLv)continue;const fx=coldFx(l);if(!fx.length)continue;const g=G[l.id];nets[l.id]=[];
   split(fx,f=>[f.x,f.y]).forEach((fp,i)=>{if(!fp.length)return;const terms=fp.map(f=>({c:g.cell(f.x,f.y),load:f.type==='terma'?0:ugOf(f),f}));const n=runNet('cold',l,shc(l,'cold',i),terms,lenC);n.load=terms.reduce((a,t)=>a+t.load,0);n.si=i;nets[l.id].push(n);sLoad[i]+=n.load;shaftLoad+=n.load})}
  {const g=G[mLv.id],fx=coldFx(mLv),terms=fx.map(f=>({c:g.cell(f.x,f.y),load:f.type==='terma'?0:ugOf(f),f}));SHS.forEach((s,i)=>{if(sLoad[i]>0)terms.push({c:shc(mLv,'cold',i),load:sLoad[i],shaft:true})});
   const n=runNet('cold',mLv,g.cell(pts.medidor.x,pts.medidor.y),terms,lenC);n.si=-1;nets[mLv.id]=[n];
   vert('cold',mLv.id,pts.medidor.x,pts.medidor.y,mLv.elev+0.3,Zs.cold(mLv),0.012,20);lenC[n.dOf(n.T.root)]=(lenC[n.dOf(n.T.root)]||0)+Zs.cold(mLv)-mLv.elev-0.3;
   node('water','pt',mLv,pts.medidor.x,pts.medidor.y,'Medidor')}
  const M0=nets[mLv.id][0];const riserDs=SHS.map(()=>0);let riserD=0;
  SHS.forEach((s,i)=>{if(!(sLoad[i]>0))return;const dR=dsel(Q(sLoad[i]));riserDs[i]=dR;riserD=Math.max(riserD,dR);const zz=lv.filter(l=>l!==mLv&&(nets[l.id]||[]).some(n=>n.si===i)).map(l=>Zs.cold(l)).concat([Zs.cold(mLv)]);const z0=Math.min(...zz),z1=Math.max(...zz);
   vert('cold','all',shx('cold',i),s.y,z0,z1,dR/2000+0.004,dR);lenC[dR]=(lenC[dR]||0)+z1-z0});
  // presiones
  let pmin=Infinity,pminAt='',pstat=0,pstatLv=null;const zm=mLv.elev+0.3;const pAt=[];
  for(const l of lv){for(const n of nets[l.id]||[]){for(const t of n.T.terms){if(!t.f)continue;let h=n.hfTo(t.c);
    if(l!==mLv){h+=hf(Math.abs(l.elev-mLv.elev),Q(sLoad[n.si]),riserDs[n.si])+M0.hfTo(shc(mLv,'cold',n.si))}
    const zf=l.elev+(FX[t.f.type].zs||1),p=PR.presion-(zf-zm)-PR.f_acc*h;if(p<pmin){pmin=p;pminAt=`${FX[t.f.type].n} · ${(roomOfPt(l,t.f.x,t.f.y)||{}).name||''} · ${l.name}`}
    const ps=PR.presion-(zf-zm);if(ps>pstat){pstat=ps;pstatLv=l}pAt.push({l,ps});
    vert('cold',l.id,t.f.x,t.f.y,Zs.cold(l),l.elev+(FX[t.f.type].zs||1),0.0075+0.004,15,1);lenC[na.diams[0][1]]=(lenC[na.diams[0][1]]||0)+Zs.cold(l)-l.elev-(FX[t.f.type].zs||1);
    node('water','fx',l,t.f.x,t.f.y,FX[t.f.type].ab);nPts++}}}
  let pump=0;
  if(isFinite(pmin)){
   if(pmin<na.p_min&&BLD&&PR.bomba!==false){pump=Math.ceil(na.p_min-pmin+3);const qd=Q(shaftLoad+M0.T.terms.filter(t=>t.f).reduce((a,t)=>a+t.load,0));
    fix('water',`Se agregó un equipo de presión (hidropack) de ${pump} m.c.a. sobre la presión de red: con ${PR.presion} m.c.a. el aparato más alto quedaba con ${fmt(pmin,1)} m.c.a.`);
    ck('water','Equipo de presión (bombeo)',na.ref,`${pump} m.c.a. · ${fmt(qd,2)} L/s`,`necesario para ≥ ${na.p_min} m.c.a. arriba`,'fix',pminAt);
    bomAdd('water','Equipo hidropack (2 bombas + estanque)',`${fmt(qd,2)} L/s · ${pump+PR.presion} m.c.a.`,'u',1);
    log('water',`Equipo de presión: ${fmt(qd,2)} L/s a ${pump} m.c.a. adicionales para abastecer los pisos altos`)}
   PUMP=pump;const pm=pmin+pump,psMax=pstat+pump;
   ck('water','Presión mínima en el aparato más desfavorable',na.ref,`${fmt(pm,1)} m.c.a.${pump?' (con bombeo)':''}`,`≥ ${na.p_min} m.c.a.`,pm>=na.p_min?'ok':'fail',pminAt);
   const hiLv=[...new Set(pAt.filter(o=>o.ps+pump>na.p_max).map(o=>o.l))];
   if(psMax>na.p_max&&BLD&&hiLv.length){fix('water',`Se agregaron válvulas reductoras de presión en ${hiLv.length} nivel${hiLv.length>1?'es':''} (${hiLv.slice(0,4).map(l=>l.name).join(', ')}${hiLv.length>4?'…':''}): la presión estática superaba ${na.p_max} m.c.a.`);
    ck('water','Presión estática máxima',na.ref,`${fmt(psMax,1)} m.c.a. → VRP`,`≤ ${na.p_max} m.c.a.`,'fix',`${hiLv.length} niveles con válvula reductora`);bomAdd('water','Válvula reductora de presión','¾" – 1"','u',hiLv.length*Math.max(1,SHS.length))}
   else ck('water','Presión estática máxima',na.ref,`${fmt(psMax,1)} m.c.a.`,`≤ ${na.p_max} m.c.a.`,psMax<=na.p_max?'ok':'fail',pump?`red ${PR.presion} + bombeo ${pump} m.c.a.`:`red pública ${PR.presion} m.c.a.`);
   if(pm<na.p_min)log('water',`Presión insuficiente en ${pminAt}: ${fmt(pm,1)} m.c.a. Evaluar equipo de presión o mayor diámetro`);pmin=pm}
  // agua caliente
  const hotAll=lv.flatMap(l=>hotFx(l).map(f=>({l,f})));let hotMax=0,hotAt='';
  if(hotAll.length&&!heater)ck('water','Equipo de agua caliente',na.ref,'no hay terma','requerido','fail','agrega una terma o calentador en el plano');
  if(hotAll.length&&heater){const hL=heater.l;let hShaft=0;const hn={};const heaters=lv.flatMap(l=>l.fixtures.filter(f=>f.type==='terma').map(f=>({l,f})));const local=l=>heaters.filter(h=>h.l===l);
   const hT=(g,f)=>({c:g.cell(f.x+0.1,f.y),load:ugOf(f)*0.75,f});
   for(const l of lv){if(local(l).length)continue;const fx=hotFx(l);if(!fx.length)continue;const g=G[l.id];const terms=fx.map(f=>hT(g,f));const n=runNet('hot',l,shc(l,'hot'),terms,lenH);n.via=true;hn[l.id]=[n];hShaft+=terms.reduce((a,t)=>a+t.load,0)}
   let mainN=null;
   for(const l of lv){const hs=local(l);if(!hs.length)continue;const g=G[l.id];const parts=hs.map(()=>[]);
    hotFx(l).forEach(f=>{let b=0,bd=1e9;hs.forEach((h,i)=>{const d=Math.abs(h.f.x-f.x)+Math.abs(h.f.y-f.y);if(d<bd){bd=d;b=i}});parts[b].push(f)});hn[l.id]=[];
    hs.forEach((h,i)=>{const terms=parts[i].map(f=>hT(g,f));const isMain=h.f===heater.f;if(isMain&&hShaft>0)terms.push({c:shc(l,'hot'),load:hShaft,shaft:true});if(!terms.length)return;
     const n=runNet('hot',l,g.cell(h.f.x+0.1,h.f.y),terms,lenH);if(isMain)mainN=n;hn[l.id].push(n);vert("hot",l.id,rnd2(h.f.x+0.1),h.f.y,l.elev+Math.min(1.95,l.h-0.7),Zs.hot(l),0.012,20);node('water','fx',l,h.f.x,h.f.y,'TE')})}
   let rL=0;if(hShaft>0){const others=lv.filter(l=>(hn[l.id]||[]).some(n=>n.via));const zs=others.map(l=>Zs.hot(l)).concat([Zs.hot(hL)]);const z0=Math.min(...zs),z1=Math.max(...zs);rL=z1-z0;const dd=dsel(Q(hShaft));
    vert('hot','all',shx('hot'),sh.y,z0,z1,dd/2000+0.004,dd);lenH[dd]=(lenH[dd]||0)+rL}
   for(const l of lv){for(const n of hn[l.id]||[]){for(const t of n.T.terms){if(!t.f)continue;let L=n.lenTo(t.c)+(n.via&&mainN?Math.abs(l.elev-hL.elev)+mainN.lenTo(shc(hL,'hot')):0);
     if(L>hotMax){hotMax=L;hotAt=`${FX[t.f.type].n} · ${(roomOfPt(l,t.f.x,t.f.y)||{}).name||''} · ${l.name}`}
     vert('hot',l.id,rnd2(t.f.x+0.1),t.f.y,Zs.hot(l),l.elev+(FX[t.f.type].zs||1),0.0075+0.004,15,1);lenH[na.diams[0][1]]=(lenH[na.diams[0][1]]||0)+Zs.hot(l)-l.elev-(FX[t.f.type].zs||1)}}}
   const vol=hotMax*Math.PI*(na.diams[0][1]/1000)**2/4*1000,wait=vol/0.1;
   ck('water','Recorrido de agua caliente',na.ref,`${fmt(hotMax,1)} m (espera ≈ ${fmt(wait,0)} s)`,`≤ ${na.l_max_caliente} m sin recirculación`,hotMax<=na.l_max_caliente?'ok':'warn',hotAt);
   log('water',heaters.length>1?`Agua caliente desde ${heaters.length} termas (una por unidad): grifo más lejano a ${fmt(hotMax,1)} m`:`Agua caliente desde la terma de ${hL.name}: grifo más lejano a ${fmt(hotMax,1)} m`)}
  ck('water','Velocidad máxima en tuberías',na.ref,`${fmt(vmax,2)} m/s`,`≤ ${na.v_max} m/s`,vmax<=na.v_max?'ok':'fail','tramo más cargado');
  Lc=Object.values(lenC).reduce((a,b)=>a+b,0);Lh=Object.values(lenH).reduce((a,b)=>a+b,0);
  Object.keys(lenC).sort((a,b)=>a-b).forEach(d=>bomAdd('water',`Tubería agua fría ${na.material}`,`${nom(+d)} (Øi ${d} mm)`,'m',lenC[d]));
  Object.keys(lenH).sort((a,b)=>a-b).forEach(d=>bomAdd('water',`Tubería agua caliente ${na.material}`,`${nom(+d)} (Øi ${d} mm)`,'m',lenH[d]));
  bomAdd('water','Aislamiento térmico agua caliente','espesor 9 mm','m',Lh);bomAdd('water','Codos','varios Ø','u',elb);bomAdd('water','Tees','varios Ø','u',tee);
  const wetRooms=new Set();lv.forEach(l=>l.fixtures.forEach(f=>{if(FX[f.type]&&FX[f.type].cold){const r=roomOfPt(l,f.x,f.y);if(r)wetRooms.add(l.id+r.id)}}));
  bomAdd('water','Llaves de paso','½" – ¾"','u',wetRooms.size+1);
  R.ev.water=st.n;R.totals.water={lc:Lc,lh:Lh,pmin,hot:hotMax,pts:nPts,pump};
  R.stats.water=[`${fmt(Lc+Lh,1)} m ${na.material} · fría y caliente`,`${nPts} puntos · presión mín. ${isFinite(pmin)?fmt(pmin,1):'—'} m.c.a.`];
  log('water',`Red de agua fría desde el medidor con presión de red ${PR.presion} m.c.a.${SHS.length>1?` · ${SHS.length} montantes`:''}`)}

 /* ===== Agente 3 · Electricidad ===== */
 {const ne=N.elec,st={n:0};const tLv=lvOf(pts.tablero.lv),g0=G[tLv.id],panel=g0.cell(pts.tablero.x,pts.tablero.y);
  const items=[];const add=(l,kind,x,y,va,room,label,ded)=>items.push({l,kind,x:rnd2(x),y:rnd2(y),va,room,label,ded});
  for(const l of lv){for(const r of l.rooms){const w=r.x1-r.x0,h=r.y1-r.y0,area=w*h,t=r.type;
    if(t==='balcon'&&w*h<1)continue;
    const nl=(t==='bano'||t==='closet'||t==='balcon')?1:Math.max(1,Math.ceil(area/ne.m2_luz));
    for(let k=0;k<nl;k++){const fx=w>=h?r.x0+w*(k+0.5)/nl:(r.x0+r.x1)/2,fy=w>=h?(r.y0+r.y1)/2:r.y0+h*(k+0.5)/nl;add(l,'luz',fx,fy,ne.va_luz,r,'Luz')}
    let nt=+(ne.tomas_min[t]||0);if(ne.tomas_cada_m>0&&['dormitorio','sala','comedor','estudio'].includes(t))nt=Math.max(nt,Math.ceil(2*(w+h)/ne.tomas_cada_m));
    if(!nt)continue;const i=0.15;
    if(t==='bano'){const lavF=l.fixtures.find(f=>f.type==='lav'&&roomOfPt(l,f.x,f.y)===r),du=l.fixtures.find(f=>f.type==='ducha'&&roomOfPt(l,f.x,f.y)===r);
     let px=lavF?lavF.x:(r.x0+r.x1)/2,py=lavF?lavF.y:r.y0+i;
     if(du){const dirx=Math.sign(px-du.x)||1;px=clp(px+0.35*dirx,r.x0+i,r.x1-i);
      const dd=Math.hypot(px-du.x,py-du.y);if(dd<ne.dist_toma_ducha){let best=null,bd=-1;const cand=[];for(let s=0;s<=1;s+=0.02){cand.push([r.x0+i+(w-2*i)*s,r.y0+i],[r.x0+i+(w-2*i)*s,r.y1-i],[r.x0+i,r.y0+i+(h-2*i)*s],[r.x1-i,r.y0+i+(h-2*i)*s])}
       const ref=lavF||{x:px,y:py};for(const [cx,cy] of cand){const ds=Math.hypot(cx-du.x,cy-du.y);if(ds<ne.dist_toma_ducha)continue;const dl=Math.hypot(cx-ref.x,cy-ref.y);if(best===null||dl<bd){best=[cx,cy];bd=dl}}
       if(best){fix('power',`Tomacorriente de ${r.name} (${l.name}) reubicado a ${fmt(Math.hypot(best[0]-du.x,best[1]-du.y))} m de la ducha (mínimo ${ne.dist_toma_ducha} m).`);px=best[0];py=best[1]}}}
     const dsh=du?Math.hypot(px-du.x,py-du.y):Infinity;
     ck('power','Tomacorriente lejos de la ducha',ne.ref,du?`${fmt(dsh)} m`:'sin ducha',`≥ ${ne.dist_toma_ducha} m`,dsh>=ne.dist_toma_ducha?'ok':'fail',`${r.name} · ${l.name}`);
     add(l,'toma',px,py,ne.va_toma,r,'Toma');continue}
    const per=[[r.x0+i,r.y0+i],[r.x1-i,r.y0+i],[r.x1-i,r.y1-i],[r.x0+i,r.y1-i],[r.x0+i,r.y0+i]];const PL=2*(w+h-4*i);
    for(let k=0;k<nt;k++){let s=PL*(k+0.5)/nt;for(let e=1;e<per.length;e++){const [ax,ay]=per[e-1],[bx,by]=per[e],L=Math.hypot(bx-ax,by-ay);if(s<=L){add(l,'toma',ax+(bx-ax)*s/L,ay+(by-ay)*s/L,ne.va_toma,r,'Toma');break}s-=L}}}
   for(const f of l.fixtures){if(!['cocina','terma','lavadora'].includes(f.type))continue;const r=roomOfPt(l,f.x,f.y)||{name:l.name};
    if(ne.ded[f.type])add(l,'ded',f.x,f.y,ne.va[f.type],r,FX[f.type].n,f.type);else add(l,'toma',f.x,f.y,ne.va[f.type],r,FX[f.type].n)}}
  extractors.forEach(e=>add(e.l,'luz',e.x-0.25,e.y,ne.va.extractor,{name:e.room},'Extractor'));
  // circuitos
  const circs=[];const chunk=(arr,n)=>{const o=[];for(let i=0;i<arr.length;i+=n)o.push(arr.slice(i,i+n));return o};
  const rKey=new Map();const keyOf=x=>{let k=rKey.get(x.room);if(k===undefined){const r=x.room,cx=r.x0!=null?(r.x0+r.x1)/2:x.x,cy=r.y0!=null?(r.y0+r.y1)/2:x.y,si=BLD?nearSh(cx,cy):0,band=Math.floor(cy/7);k=si*1e8+band*1e5+(band%2?1e4-cx*10:cx*10);rKey.set(x.room,k)}return k};
  for(const l of lv){const its=items.filter(x=>x.l===l).sort((a,b)=>keyOf(a)-keyOf(b));
   chunk(its.filter(x=>x.kind==='luz'),Math.max(1,ne.max_luz)).forEach(a=>circs.push({l,type:'luz',items:a,desc:`Alumbrado ${l.name}`}));
   const tom=its.filter(x=>x.kind==='toma');const kit=ne.ded.tomas_cocina?tom.filter(x=>x.room.type==='cocina'):[],bat=ne.ded.tomas_bano?tom.filter(x=>x.room.type==='bano'):[];
   const gen=tom.filter(x=>!kit.includes(x)&&!bat.includes(x));
   chunk(gen,Math.max(1,ne.max_tomas)).forEach(a=>circs.push({l,type:'toma',items:a,desc:`Tomacorrientes ${l.name}`}));
   if(kit.length)chunk(kit,Math.max(1,Math.ceil(kit.length/2))).forEach(a=>circs.push({l,type:'toma',items:a,desc:`Tomas de cocina ${l.name}`,min:20}));
   if(bat.length)circs.push({l,type:'toma',items:bat,desc:`Tomas de baño ${l.name}`,min:20});
   its.filter(x=>x.kind==='ded').forEach(x=>circs.push({l,type:'ded',items:[x],desc:`${x.label} (dedicado)`,ded:x.ded}))}
  // montante tablero → ducto(s). En edificios: un subtablero por ducto y piso, alimentado por el montante
  const cost0=costMap(g0,'power',occ[tLv.id],BIT.power);const up=SHS.map(()=>({len:0,ok:false}));
  const ctr=c=>[c.items.reduce((a,x)=>a+x.x,0)/c.items.length,c.items.reduce((a,x)=>a+x.y,0)/c.items.length];
  circs.forEach(c=>{const [cx,cy]=ctr(c);c.si=nearSh(cx,cy);c.sub=BLD?!(c.l===tLv&&Math.hypot(cx-pts.tablero.x,cy-pts.tablero.y)<=Math.hypot(cx-SHS[c.si].x,cy-SHS[c.si].y)+3):c.l!==tLv});
  if(pts.ducto)SHS.forEach((s,i)=>{if(!circs.some(c=>c.sub&&c.si===i))return;const tg=new Uint8Array(g0.N);tg[shc(tLv,'power',i)]=1;const upPath=route(g0,cost0,'power',panel,tg,st);if(!upPath)return;up[i].ok=true;up[i].len=(upPath.length-1)*CELL;
   for(let k=0;k<upPath.length-1;k++)occ[tLv.id][upPath[k]]|=BIT.power;
   const segsUp=[];let a=g0.xy(upPath[0]);let dir=null;for(let k=1;k<upPath.length;k++){const dd=upPath[k]-upPath[k-1];if(dir!==null&&dd!==dir){const b=g0.xy(upPath[k-1]);segsUp.push({a,b,d:0,len:Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])});a=b}dir=dd}
   const b=g0.xy(upPath[upPath.length-1]);segsUp.push({a,b,d:0,len:0});add3('power',tLv,segsUp,Zs.power(tLv),()=>0.016);d2('power','power',tLv,segsUp,SHS.length>1?'alimentador '+(i+1):'montante');
   const others=lv.filter(l=>circs.some(c=>c.sub&&c.si===i&&c.l===l)).map(l=>Zs.power(l)).concat([Zs.power(tLv)]);vert('power','all',shx('power',i),s.y,Math.min(...others),Math.max(...others),0.016,0)});
  const upLen=up[0].len;
  vert('power',tLv.id,pts.tablero.x,pts.tablero.y,tLv.elev+1.5,Zs.power(tLv),0.02,0,1);node('power','pt',tLv,pts.tablero.x,pts.tablero.y,'Tablero');
  const secs=ne.secciones,amp=s=>(secs.find(x=>x[0]===s)||[0,0])[1];let cable={},conduit=0,elb=0,breakers={},totVA=0,worst=0;
  const subs=new Map();
  circs.forEach((c,ci)=>{const l=c.l,g=G[l.id],root=c.sub?shc(l,'power',c.si):panel,cost=costMap(g,'power',occ[l.id],BIT.power);
   const terms=c.items.map(x=>({c:g.cell(x.x,x.y),load:x.va,it:x}));const T=buildTree(g,'power',root,terms,cost,st,occ[l.id],BIT.power);const S=treeSegs(T,()=>0);elb+=S.elbows;
   const V=(c.type==='ded'&&(c.ded==='cocina'||c.ded==='terma'))?(ne.tension_ded||ne.tension):ne.tension;
   const va=c.items.reduce((a,x)=>a+x.va,0),I=va/V;totVA+=va;
   const extra=!c.sub?0:BLD?0:up[c.si].len+Math.abs(l.elev-tLv.elev);let far=0,drops=0;
   if(BLD&&c.sub){const k=l.id+'|'+c.si;const sb=subs.get(k)||{l,si:c.si,va:0,n:0};sb.va+=va;sb.n++;subs.set(k,sb)}
   for(const t of terms){const dz=t.it.kind==='luz'?0.05:(t.it.kind==='ded'?l.h-1.1:l.h-0.3);drops+=dz;const L=(chainCells(T,t.c).length-1)*CELL+extra+dz+1.5;if(L>far)far=L;
    if(t.it.kind!=='luz')vert('power',l.id,t.it.x,t.it.y,Zs.power(l),l.elev+(t.it.kind==='ded'?1.1:0.3),0.012,0,1);node('power',t.it.kind,l,t.it.x,t.it.y,t.it.label)}
   let smin=c.type==='luz'?ne.sec_min_luz:ne.sec_min_tomas;let si=secs.findIndex(x=>x[0]>=smin);if(si<0)si=secs.length-1;
   const brMin=Math.max(I*1.25,c.min||0);let br=ne.interruptores.find(b=>b>=brMin)||ne.interruptores[ne.interruptores.length-1];
   while(si<secs.length-1&&secs[si][1]<br)si++;
   const vdOf=s=>2*far*I*0.0175/s/V*100;while(si<secs.length-1&&vdOf(secs[si][0])>ne.caida_max)si++;
   const S2=secs[si][0],vd=vdOf(S2);worst=Math.max(worst,vd);const id=`C-${ci+1}`;
   R.circuits.push({id,lv:l.name,desc:c.desc,type:c.type,pts:c.items.length,va,V,I,s:S2,br,vd,len:far});
   ck('power','Caída de tensión',ne.ref,`${fmt(vd,2)} %`,`≤ ${ne.caida_max} %`,vd<=ne.caida_max?'ok':'fail',`${id} · ${c.desc}`);
   ck('power','Protección vs. capacidad del conductor',ne.ref,`${br} A / ${S2} mm²`,`≤ ${amp(S2)} A`,br<=amp(S2)?'ok':'fail',`${id}`);
   if(c.type!=='ded')ck('power','Puntos por circuito',ne.ref,`${c.items.length}`,`≤ ${c.type==='luz'?ne.max_luz:ne.max_tomas}`,'ok',`${id} · ${c.desc}`);
   const run=S.len+extra+drops+1.5;cable[S2]=(cable[S2]||0)+run*3;conduit+=run;breakers[br]=(breakers[br]||0)+1;
   S.segs.forEach(s=>{s.d=S2});d2('power','power',l,S.segs,id);routesD2('power','power',l,T);add3('power',l,S.segs,Zs.power(l),()=>0.012)});
  // alimentadores a subtableros (edificios)
  let fWorst=0,fLen=0;if(subs.size){const fc={};subs.forEach(sb=>{const L=up[sb.si].len+Math.abs(sb.l.elev-tLv.elev)+3,I=sb.va*0.6/ne.tension;let si=secs.findIndex(x=>x[1]>=I*1.25);if(si<0)si=secs.length-1;
    const vdOf=q=>2*L*I*0.0175/q/ne.tension*100;while(si<secs.length-1&&vdOf(secs[si][0])>ne.caida_max)si++;const np=Math.max(1,Math.ceil(vdOf(secs[si][0])/ne.caida_max-1e-9));const vd=vdOf(secs[si][0])/np;fWorst=Math.max(fWorst,vd);fLen+=L;fc[secs[si][0]]=(fc[secs[si][0]]||0)+L*3*np});
   ck('power','Caída de tensión en alimentadores',ne.ref,`${fmt(fWorst,2)} %`,`≤ ${ne.caida_max} %`,fWorst<=ne.caida_max?'ok':'fail',`${subs.size} subtableros (uno por ducto y piso)`);
   Object.keys(fc).sort((a,b)=>a-b).forEach(q=>bomAdd('power',`Alimentador ${ne.cable}`,`${q} mm²`,'m',fc[q]));bomAdd('power','Subtablero de distribución','por piso / ducto','u',subs.size);
   log('power',`${subs.size} subtableros alimentados desde el tablero general por ${SHS.length>1?SHS.length+' montantes':'el montante'} (${fmt(fLen,0)} m de alimentadores)`)}
  // demanda
  let rem=totVA,prevT=0,dem=0;for(const [lim,f] of ne.demanda){const part=Math.min(rem,lim-prevT);if(part<=0)break;dem+=part*f;rem-=part;prevT=lim}
  const Imain=dem/ne.tension;const brMain=ne.interruptores.find(b=>b>=Imain*1.25)||ne.interruptores[ne.interruptores.length-1];let sm=secs.find(x=>x[1]>=brMain)||secs[secs.length-1];
  ck('power','Interruptor diferencial',ne.ref,ne.diferencial?'incluido · 30 mA':'no exigido','30 mA','ok','tablero general');
  ck('power','Demanda máxima y alimentador',ne.ref,`${fmt(dem/1000,2)} kW · ${fmt(Imain,1)} A`,`general ${brMain} A · ${sm[0]} mm²`,'ok',`instalado ${fmt(totVA/1000,2)} kVA`);
  for(const l of lv)for(const r of l.rooms){const n=items.filter(x=>x.l===l&&x.room===r&&x.kind==='toma').length,m=+(ne.tomas_min[r.type]||0);if(m)ck('power','Tomacorrientes mínimos por ambiente',ne.ref,`${n}`,`≥ ${m}`,n>=m?'ok':'fail',`${r.name} · ${l.name}`)}
  Object.keys(cable).sort((a,b)=>a-b).forEach(s=>bomAdd('power',`Conductor ${ne.cable}`,`${s} mm²`,'m',cable[s]));
  bomAdd('power','Tubería conduit PVC','Ø 20 mm','m',conduit);bomAdd('power','Curvas conduit','Ø 20 mm','u',elb);
  bomAdd('power','Tomacorrientes dobles con tierra','—','u',items.filter(x=>x.kind==='toma').length);bomAdd('power','Salidas de fuerza (dedicadas)','—','u',items.filter(x=>x.kind==='ded').length);
  bomAdd('power','Puntos de luz / luminarias','—','u',items.filter(x=>x.kind==='luz').length);
  bomAdd('power','Interruptores de luz','—','u',new Set(items.filter(x=>x.kind==='luz').map(x=>x.l.id+x.room.name)).size);
  Object.keys(breakers).sort((a,b)=>a-b).forEach(b=>bomAdd('power','Interruptor termomagnético 1P+N',`${b} A`,'u',breakers[b]));
  if(ne.diferencial)bomAdd('power','Interruptor diferencial','2 × 40 A · 30 mA','u',Math.ceil(circs.length/4));
  bomAdd('power','Interruptor general',`${brMain} A`,'u',1);bomAdd('power','Tablero de distribución',`${circs.length+2} polos`,'u',1);
  R.ev.power=st.n;R.totals.power={subs:subs.size,circ:circs.length,va:totVA,dem,brMain,worst,tomas:items.filter(x=>x.kind==='toma').length,luz:items.filter(x=>x.kind==='luz').length,cable:Object.values(cable).reduce((a,b)=>a+b,0)};
  R.stats.power=[`${circs.length} circuitos · ${fmt(R.totals.power.cable,0)} m de conductor`,`${R.totals.power.tomas} tomas · ${R.totals.power.luz} luces · ΔV máx. ${fmt(worst,2)} %`];
  log('power',`Tablero en ${tLv.name}: ${circs.length} circuitos, demanda ${fmt(dem/1000,2)} kW, general ${brMain} A`)}

 /* ===== Agente 5 · Incendio ===== */
 {const nf=N.incendio,st={n:0};let nh=0,nd=0,Lf=0;const lenBy={};
  if(nf.detectores!=='no'){for(const l of lv)for(const r of l.rooms){if(!['dormitorio','pasillo'].includes(r.type))continue;nd++;node('fire','det',l,rnd2((r.x0+r.x1)/2),rnd2((r.y0+r.y1)/2),'DH')}
   ck('fire','Detectores de humo',nf.ref,`${nd} detectores`,nf.detectores==='obligatorio'?'dormitorios y circulaciones':'recomendado',nf.detectores==='obligatorio'?'ok':'info','dormitorios y circulaciones de cada nivel');
   bomAdd('fire','Detector de humo fotoeléctrico',nf.detectores==='obligatorio'?'interconectado':'autónomo','u',nd)}
  if(nf.rociadores){const mLv=lvOf(pts.medidor.lv);const byLv={};
   for(const l of lv){byLv[l.id]=[];for(const r of l.rooms){const w=r.x1-r.x0,h=r.y1-r.y0,a=w*h;if(r.type==='balcon')continue;if(r.type==='bano'&&a<=nf.omitir_bano_m2)continue;if(r.type==='closet'&&a<=2.2)continue;
    let nx=Math.max(1,Math.ceil(w/nf.sep_max)),ny=Math.max(1,Math.ceil(h/nf.sep_max));let g2=0;while(a/(nx*ny)>nf.area_max&&g2++<50){if(w/nx>=h/ny)nx++;else ny++}
    const sx=w/nx,sy=h/ny,cov=a/(nx*ny),wall=Math.max(sx,sy)/2;
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)byLv[l.id].push({x:rnd2(r.x0+sx*(i+0.5)),y:rnd2(r.y0+sy*(j+0.5)),r});
    const ok=cov<=nf.area_max&&Math.max(sx,sy)<=nf.sep_max&&wall<=nf.dist_muro;
    ck('fire','Cobertura de rociadores',nf.ref,`${nx*ny} × ${fmt(cov,1)} m² · sep. ${fmt(Math.max(sx,sy),1)} m`,`≤ ${nf.area_max} m² · ≤ ${nf.sep_max} m`,ok?'ok':'fail',`${r.name} · ${l.name}`)}}
   const runF=(l,root,terms)=>{const g=G[l.id],cost=costMap(g,'fire',occ[l.id],BIT.fire),T=buildTree(g,'fire',root,terms,cost,st,occ[l.id],BIT.fire);const dOf=c=>T.load[c]>=2?25:20;const S=treeSegs(T,dOf);
    S.segs.forEach(s=>{lenBy[s.d]=(lenBy[s.d]||0)+s.len});d2('fire','fire',l,S.segs);routesD2('fire','fire',l,T);add3('fire',l,S.segs,Zs.fire(l),d=>d/2000+0.003);return T};
   const nets={};let shLoad=0;const fL=SHS.map(()=>0);
   for(const l of lv){if(l===mLv||!byLv[l.id].length)continue;const g=G[l.id];nets[l.id]=[];split(byLv[l.id],h=>[h.x,h.y]).forEach((hp,i)=>{if(!hp.length)return;const T=runF(l,shc(l,'fire',i),hp.map(h=>({c:g.cell(h.x,h.y),load:1,h})));T.si=i;nets[l.id].push(T);fL[i]+=hp.length;shLoad+=hp.length})}
   {const g=G[mLv.id];const terms=byLv[mLv.id].map(h=>({c:g.cell(h.x,h.y),load:1,h}));SHS.forEach((s,i)=>{if(fL[i])terms.push({c:shc(mLv,'fire',i),load:fL[i],shaft:true})});
    if(terms.length){nets[mLv.id]=[runF(mLv,g.cell(pts.medidor.x+0.3,pts.medidor.y),terms)];vert('fire',mLv.id,rnd2(pts.medidor.x+0.3),pts.medidor.y,mLv.elev+0.3,Zs.fire(mLv),0.0145,25)}}
   SHS.forEach((s,i)=>{if(!fL[i])return;const zz=lv.filter(l=>(nets[l.id]||[]).some(T=>T.si===i)).map(l=>Zs.fire(l)).concat([Zs.fire(mLv)]);const z0=Math.min(...zz),z1=Math.max(...zz);vert('fire','all',shx('fire',i),s.y,z0,z1,0.0145,25);lenBy[25]=(lenBy[25]||0)+z1-z0});
   const M0=(nets[mLv.id]||[])[0];
   let far=0,farZ=0;for(const l of lv){for(const T of nets[l.id]||[]){for(const t of T.terms){if(!t.h)continue;nh++;vert('fire',l.id,t.h.x,t.h.y,Zs.fire(l),Zs.fire(l)-0.08,0.01,15,1);node('fire','head',l,t.h.x,t.h.y,'R');
     const L=(chainCells(T,t.c).length-1)*CELL+(l!==mLv&&M0?Math.abs(l.elev-mLv.elev)+(chainCells(M0,shc(mLv,'fire',T.si)).length-1)*CELL:0);if(L>far){far=L;farZ=Zs.fire(l)}}}}
   if(nh){const q=nf.n_diseno*nf.q_rociador/60/1000;let p=0,Dn=25;for(const [dn,di] of [[25,0.0225],[32,0.0282],[40,0.0354],[50,0.0443]]){const hfv=10.67*far*Math.pow(q,1.852)/(Math.pow(150,1.852)*Math.pow(di,4.87));p=PR.presion+PUMP-(farZ-(mLv.elev+0.3))-PR.f_acc*hfv;Dn=dn;if(p>=nf.p_min_rociador)break}
    if(Dn>25){fix('fire',`La red de rociadores se aumentó a Ø${Dn} mm en la troncal para llegar con ${fmt(p,1)} m.c.a. al rociador más alejado.`);if(lenBy[25]){lenBy[Dn]=(lenBy[Dn]||0)+lenBy[25];delete lenBy[25]}for(const k in P3.fire)P3.fire[k].d===25&&(P3.fire[k].d=Dn,P3.fire[k].r=Dn/2000+0.003);R.D2.fire.forEach(s=>{if(s.d===25)s.d=Dn})}
    ck('fire','Presión en el rociador más desfavorable',nf.ref,`${fmt(p,1)} m.c.a.${Dn>25?' · troncal Ø'+Dn:''}`,`≥ ${nf.p_min_rociador} m.c.a. (${nf.n_diseno} × ${nf.q_rociador} L/min)`,p>=nf.p_min_rociador?(Dn>25?'fix':'ok'):'fail',`recorrido ${fmt(far,1)} m`);
    log('fire',`${nh} rociadores; cálculo con ${nf.n_diseno} rociadores: ${fmt(p,1)} m.c.a. en el más alejado`)}
   Object.keys(lenBy).forEach(d=>bomAdd('fire','Tubería CPVC para rociadores',`Ø ${d} mm`,'m',lenBy[d]));bomAdd('fire','Rociador residencial','K 4.9 · colgante','u',nh);bomAdd('fire','Válvula de control y drenaje','Ø 25 mm','u',nh?1:0);
   Lf=Object.values(lenBy).reduce((a,b)=>a+b,0)}
  else ck('fire','Rociadores automáticos',nf.ref,'no exigidos','según normativa activa','ok','vivienda unifamiliar');
  R.ev.fire=st.n;R.totals.fire={heads:nh,det:nd,len:Lf};
  R.stats.fire=[nf.rociadores?`${nh} rociadores · ${fmt(Lf,1)} m CPVC`:'Rociadores no exigidos',`${nd} detectores de humo (${nf.detectores})`];
  if(!nf.rociadores)log('fire',`La normativa activa no exige rociadores en vivienda; se ubican ${nd} detectores`)}

 /* ===== Coordinación ===== */
 R.p3init=JSON.parse(JSON.stringify(P3));
 if(opts.skipClash){R.clash={initial:0,steps:[],remaining:0};R.p3=P3}
 else{const cl=resolveClashes(P3);R.clash=cl;R.p3=P3;
  const where=pt=>{let l=L1;for(const x of lv)if(pt[2]>=x.elev-0.45)l=x;const r=roomOfPt(l,pt[0],pt[1]);return `${r?r.name:'muro / exterior'} · ${l.name}`};
  cl.steps.forEach(s=>{s.where=where(s.pt);fix('coord',`${NETS[s.yield]} ↔ ${NETS[s.other]} en ${s.where}: ${NETS[s.yield].toLowerCase()} ${s.act}.`)});
  ck('coord','Interferencias entre sistemas','Coordinación 3D',`${cl.initial} detectadas · ${cl.steps.length} resueltas`,'0 pendientes',cl.remaining?'warn':'ok',cl.remaining?`${cl.remaining} pendientes de revisión manual`:'modelo integrado sin choques');}
 R.ok=R.checks.filter(c=>c.st==='ok'||c.st==='fix'||c.st==='info').length;R.fail=R.checks.filter(c=>c.st==='fail').length;R.warn=R.checks.filter(c=>c.st==='warn').length;
 return R}

/* Dos pasadas: agentes independientes → el coordinador detecta choques → re-ruteo coordinado */
function computeFull(P,N){const nR=P.levels.reduce((a,l)=>a+l.rooms.length,0),big=nR>70||P.levels.length>4;
 if(big){const R=compute(P,N);if(R.error)return R;R.first=[];R.p3first=null;R.big=true;const c=R.checks.find(x=>x.sys==='coord');if(c)c.where=(R.clash.steps.length?`${R.clash.steps.length} desvíos locales · `:'')+'proyecto grande: coordinación en una pasada';return R}
 const R1=compute(P,N,{noAvoid:true,skipClash:true});if(R1.error)return R1;
 const first=detect(R1.p3);const R=compute(P,N);if(R.error)return R;
 const lv=P.levels.slice().sort((a,b)=>a.elev-b.elev);
 const where=pt=>{let l=lv[0];for(const x of lv)if(pt[2]>=x.elev-0.45)l=x;const r=roomOfPt(l,pt[0],pt[1]);return `${r?r.name:'muro / ducto'} · ${l.name}`};
 const seen=new Set();R.first=first.map(c=>{const pt=v3.mul(v3.add(c.c1,c.c2),0.5);return {a:c.A.sys,b:c.B.sys,pt,where:where(pt)}}).filter(c=>{const k=[c.a,c.b].sort().join()+c.pt.map(v=>Math.round(v*4)).join();if(seen.has(k))return false;seen.add(k);return true});
 R.p3first=R1.p3;
 const grp={};R.first.forEach(c=>{const k=[NETS[c.a],NETS[c.b]].sort().join(' ↔ ')+' en '+c.where;grp[k]=(grp[k]||0)+1});
 Object.entries(grp).forEach(([k,n])=>R.fixes.push({sys:'coord',t:`${k}: ${n} cruce${n>1?'s':''} en la primera pasada; el coordinador reservó el ducto y re-ruteó el sistema de menor prioridad.`}));
 const c=R.checks.find(x=>x.sys==='coord');if(c){c.val=`${R.first.length} en 1.ª pasada → ${R.clash.remaining} finales`;c.where=R.clash.steps.length?`${R.clash.steps.length} desvíos locales aplicados`:'resueltas por re-ruteo coordinado'}
 return R}

/* ---------- Muros desde los ambientes (raster 5 cm) ---------- */
const WR=0.05;
// los muros se recalculan solo si cambian los ambientes o vanos (pisos tipo comparten el mismo resultado)
const WMC=new Map();
function wallModel(l){const k=l.rooms.map(r=>r.type+r.x0+','+r.y0+','+r.x1+','+r.y1).join(';')+'|'+JSON.stringify(l.openings||[]);let v=WMC.get(k);if(v)return v;v=wallModel0(l);WMC.set(k,v);if(WMC.size>80)WMC.delete(WMC.keys().next().value);return v}
function wallModel0(l){const rooms=l.rooms.filter(r=>r.type!=='balcon'),open=l.rooms.filter(r=>r.type==='balcon');
 if(!rooms.length)return {full:[],ops:[],area:0,bbox:[0,0,0,0]};
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;rooms.forEach(r=>{x0=Math.min(x0,r.x0);y0=Math.min(y0,r.y0);x1=Math.max(x1,r.x1);y1=Math.max(y1,r.y1)});
 x0-=0.3;y0-=0.3;x1+=0.3;y1+=0.3;const nx=Math.ceil((x1-x0)/WR),ny=Math.ceil((y1-y0)/WR),N=nx*ny;
 const R=new Uint8Array(N),O=new Uint8Array(N),W=new Uint8Array(N);
 const fill=(arr,r)=>{const i0=Math.max(0,Math.round((r.x0-x0)/WR)),i1=Math.min(nx,Math.round((r.x1-x0)/WR)),j0=Math.max(0,Math.round((r.y0-y0)/WR)),j1=Math.min(ny,Math.round((r.y1-y0)/WR));for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++)arr[j*nx+i]=1};
 rooms.forEach(r=>fill(R,r));open.forEach(r=>fill(O,r));
 const T=Math.round(0.15/WR);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=j*nx+i;if(R[c]||O[c])continue;let near=false;
  for(let dj=-T;dj<=T&&!near;dj++){const jj=j+dj;if(jj<0||jj>=ny)continue;for(let di=-T;di<=T;di++){const ii=i+di;if(ii>=0&&ii<nx&&R[jj*nx+ii]){near=true;break}}}if(near)W[c]=1}
 let area=0;for(let c=0;c<N;c++)if(W[c])area+=WR*WR;
 // vanos
 const ops=(l.openings||[]).map(o=>{const horiz=Math.abs(o.x1-o.x0)>=Math.abs(o.y1-o.y0);const m=new Uint8Array(N);
  const ax0=Math.min(o.x0,o.x1),ax1=Math.max(o.x0,o.x1),ay0=Math.min(o.y0,o.y1),ay1=Math.max(o.y0,o.y1);
  const r=horiz?{x0:ax0,x1:ax1,y0:ay0-0.2,y1:ay1+0.2}:{x0:ax0-0.2,x1:ax1+0.2,y0:ay0,y1:ay1};fill(m,r);for(let c=0;c<N;c++){m[c]=m[c]&W[c];if(m[c])W[c]=2}return {o,m}});
 const rects=mask=>{const used=new Uint8Array(N),out=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=j*nx+i;if(!mask(c)||used[c])continue;
   let w=0;while(i+w<nx&&mask(j*nx+i+w)&&!used[j*nx+i+w])w++;let h=1;outer:for(;j+h<ny;h++){for(let k=0;k<w;k++){const cc=(j+h)*nx+i+k;if(!mask(cc)||used[cc])break outer}}
   for(let a=0;a<h;a++)for(let k=0;k<w;k++)used[(j+a)*nx+i+k]=1;out.push([x0+i*WR,y0+j*WR,x0+(i+w)*WR,y0+(j+h)*WR])}return out};
 return {full:rects(c=>W[c]===1),ops:ops.map(({o,m})=>({o,boxes:rects(c=>m[c]===1)})),area,bbox:[x0+0.3,y0+0.3,x1-0.3,y1-0.3]}}
function areas(P){return P.levels.slice().sort((a,b)=>a.elev-b.elev).map(l=>{const util=l.rooms.filter(r=>r.type!=='balcon').reduce((a,r)=>a+(r.x1-r.x0)*(r.y1-r.y0),0),bal=l.rooms.filter(r=>r.type==='balcon').reduce((a,r)=>a+(r.x1-r.x0)*(r.y1-r.y0),0),wm=wallModel(l);return {l,util,bal,muros:wm.area,constr:util+wm.area}})}

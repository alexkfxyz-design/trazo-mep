/* ---------- 3D ---------- */
const V3={};const LEG3={};Object.keys(NETS).forEach(k=>LEG3[k]=true);const LEGLV={};
const VOPT={walls:'cut',explode:null,roof:false,labels:true,plan:true,ground:true,cut:1.15};
async function show3D(rebuild){const R=ST.R;$('#msg3').hidden=!!(R&&!R.error);if(!R||R.error){renderSide3();return}
 try{if(!window.THREE)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')}catch(e){$('#msg3').hidden=false;$('#msg3').textContent='No se pudo cargar el motor 3D. Revisa la conexión y recarga.';return}
 if(VOPT.explode===null)VOPT.explode=ST.P.levels.length>1?2.2:0;
 init3D();if(rebuild||V3.builtFor!==R){build3D(R);V3.builtFor=R}else renderSide3()}
function init3D(){if(V3.R)return;const cv=$('#c3d');const R3=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});R3.setPixelRatio(Math.min(devicePixelRatio||1,2));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0e1620');const cam=new THREE.PerspectiveCamera(34,1,0.1,500);
 scene.add(new THREE.HemisphereLight(0xe6eef6,0x18212b,0.75));scene.add(new THREE.AmbientLight(0xffffff,0.18));const dl=new THREE.DirectionalLight(0xffffff,0.75);dl.position.set(10,24,8);scene.add(dl);const dl2=new THREE.DirectionalLight(0x9fc7ff,0.25);dl2.position.set(-12,10,-6);scene.add(dl2);
 Object.assign(V3,{R:R3,scene,cam,root:new THREE.Group(),mk:new THREE.Group(),st:{theta:-0.75,phi:0.95,r:30,auto:true,drag:null,tg:new THREE.Vector3(),moved:0}});scene.add(V3.root);scene.add(V3.mk);
 const tip=document.createElement('div');tip.className='tip3';tip.hidden=true;cv.parentElement.appendChild(tip);V3.tip=tip;
 const st=V3.st;cv.addEventListener('pointerdown',e=>{st.drag=[e.clientX,e.clientY];st.moved=0;st.auto=false;cv.setPointerCapture(e.pointerId)});
 cv.addEventListener('pointermove',e=>{if(!st.drag)return;const dx=e.clientX-st.drag[0],dy=e.clientY-st.drag[1];st.moved+=Math.abs(dx)+Math.abs(dy);st.drag=[e.clientX,e.clientY];
  if(e.shiftKey||e.buttons===2){const right=new THREE.Vector3().setFromMatrixColumn(cam.matrix,0),up=new THREE.Vector3(0,1,0);st.tg.addScaledVector(right,-dx*st.r*0.0015).addScaledVector(up,dy*st.r*0.0015)}
  else{st.theta-=dx*.006;st.phi=Math.max(.02,Math.min(1.52,st.phi-dy*.005))}});
 cv.addEventListener('pointerup',e=>{const was=st.drag;st.drag=null;if(was&&st.moved<4)pick3(e)});cv.addEventListener('pointercancel',()=>st.drag=null);
 cv.addEventListener('contextmenu',e=>e.preventDefault());
 cv.addEventListener('wheel',e=>{e.preventDefault();st.r=Math.max(3,Math.min(120,st.r*(1+e.deltaY*.001)))},{passive:false});
 const loop=()=>{requestAnimationFrame(loop);if(ST.view!=='modelo')return;const r=cv.getBoundingClientRect();if(r.width<2)return;R3.setSize(r.width,r.height,false);cam.aspect=r.width/r.height;cam.updateProjectionMatrix();
  if(st.auto&&!RM)st.theta+=0.0012;cam.position.set(st.tg.x+st.r*Math.sin(st.phi)*Math.sin(st.theta),st.tg.y+st.r*Math.cos(st.phi),st.tg.z+st.r*Math.sin(st.phi)*Math.cos(st.theta));cam.lookAt(st.tg);
  const now=performance.now();V3.mk.children.forEach(m=>{m.quaternion.copy(cam.quaternion);m.scale.setScalar(1+.12*Math.sin(now/160));if(m.userData.fade)m.material.opacity=Math.max(0,1-(now-m.userData.fade)/700)});
  for(let i=V3.mk.children.length-1;i>=0;i--){const m=V3.mk.children[i];if(m.userData.fade&&m.material.opacity<=0){V3.mk.remove(m);m.material.dispose()}}
  R3.render(scene,cam)};loop()}
const V=(p,c)=>new THREE.Vector3(p[0]-c[0],p[2],p[1]-c[1]);
function disposeGroup(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!Array.isArray(o.material)&&o.material.map)o.material.map.dispose()});while(g.children.length)g.remove(g.children[0])}
const lvOrder=()=>ST.P.levels.slice().sort((a,b)=>a.elev-b.elev);
const lvOff=l=>lvOrder().indexOf(l)*(VOPT.explode||0);
function M3(){if(V3.mats)return V3.mats;const S=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:new THREE.Color(c),roughness:.85,metalness:0},o));
 V3.mats={wall:S('#a9b8c7'),wallCap:S('#33414f',{roughness:1}),wallT:S('#a9b8c7',{transparent:true,opacity:.16,depthWrite:false}),wallTCap:S('#33414f',{transparent:true,opacity:.35,depthWrite:false}),
  edge:new THREE.LineBasicMaterial({color:0x6d8297,transparent:true,opacity:.55}),glass:S('#79d2e6',{transparent:true,opacity:.28,roughness:.1,depthWrite:false}),slab:S('#1f2b37'),
  fix:S('#e3e9ef',{roughness:.35}),dark:S('#2a3440',{roughness:.6}),stair:S('#8597a9'),ground:S('#16212b'),rail:S('#79d2e6',{transparent:true,opacity:.35,depthWrite:false}),roof:S('#c98a58',{transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false})};return V3.mats}
function box(w,h,d,mat,x,y,z,g){const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,0.005),Math.max(h,0.005),Math.max(d,0.005)),mat);m.position.set(x,y,z);g.add(m);return m}
function build3D(R){const P=ST.P,root=V3.root,mats=M3();disposeGroup(root);while(V3.mk.children.length)V3.mk.remove(V3.mk.children[0]);V3.lv={};V3.nets={};
 const lvs=lvOrder();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;lvs.forEach(l=>l.rooms.forEach(r=>{x0=Math.min(x0,r.x0);y0=Math.min(y0,r.y0);x1=Math.max(x1,r.x1);y1=Math.max(y1,r.y1)}));
 const c=[(x0+x1)/2,(y0+y1)/2];V3.c=c;V3.bb=[x0,y0,x1,y1];
 // terreno
 const gG=new THREE.Group();root.add(gG);V3.ground=gG;const lot=P.lot||{x0:x0-1,y0:y0-1,x1:x1+1,y1:y1+3,ext:-0.15};
 const gp=new THREE.Mesh(new THREE.BoxGeometry(lot.x1-lot.x0,0.06,lot.y1-lot.y0),mats.ground);gp.position.copy(V([(lot.x0+lot.x1)/2,(lot.y0+lot.y1)/2,(lot.ext??-0.15)-0.03],c));gG.add(gp);
 const pts=[[lot.x0,lot.y0],[lot.x1,lot.y0],[lot.x1,lot.y1],[lot.x0,lot.y1],[lot.x0,lot.y0]].map(p=>V([p[0],p[1],(lot.ext??-0.15)+0.005],c));const lg=new THREE.BufferGeometry().setFromPoints(pts);
 const ll=new THREE.Line(lg,new THREE.LineDashedMaterial({color:0x5f7183,dashSize:0.3,gapSize:0.2}));ll.computeLineDistances();gG.add(ll);
 const grid=new THREE.GridHelper(60,60,0x1d2a36,0x17222c);grid.position.y=(lot.ext??-0.15)-0.07;gG.add(grid);
 lvs.forEach((l,i)=>{if(LEGLV[l.id]===undefined)LEGLV[l.id]=true;const g=new THREE.Group();root.add(g);const nG=new THREE.Group();g.add(nG);const wG=new THREE.Group();g.add(wG);
  V3.lv[l.id]={g,nets:nG,walls:wG,l,next:lvs[i+1]};buildLevelStatic(l,g,c,lvs[i+1]);buildWalls(l)});
 const aG=new THREE.Group();root.add(aG);V3.all=aG;
 // techo
 const rG=new THREE.Group();root.add(rG);V3.roof=rG;buildRoof();
 V3.p3=R.p3first||R.p3;buildNets(V3.p3);applyView();frame3('iso',true);renderSide3('first');
 if(R.first&&R.first.length){R.first.forEach(cl=>{const m=new THREE.Mesh(new THREE.TorusGeometry(.32,.04,8,28),new THREE.MeshBasicMaterial({color:new THREE.Color(css('--bad')),transparent:true,depthTest:false}));m.renderOrder=9;m.userData.pt=cl.pt;V3.mk.add(m)});placeMarkers();
  clearTimeout(V3.tm);V3.tm=setTimeout(()=>{buildNets(R.p3);applyView();V3.mk.children.forEach((m,i)=>{m.material.color.set(css('--ok'));m.userData.fade=performance.now()+300+i*90});renderSide3('final')},RM?50:2600)}
 else renderSide3('final')}
function placeMarkers(){V3.mk.children.forEach(m=>{const pt=m.userData.pt;let l=lvOrder()[0];for(const x of lvOrder())if(pt[2]>=x.elev-0.4)l=x;m.position.copy(V(pt,V3.c));m.position.y+=lvOff(l)})}
function planTexture(l){const rooms=l.rooms;if(!rooms.length)return null;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;rooms.forEach(r=>{x0=Math.min(x0,r.x0);y0=Math.min(y0,r.y0);x1=Math.max(x1,r.x1);y1=Math.max(y1,r.y1)});
 x0-=0.2;y0-=0.2;x1+=0.2;y1+=0.2;const ppm=Math.min(90,4096/Math.max(x1-x0,y1-y0));const W=Math.round((x1-x0)*ppm),H=Math.round((y1-y0)*ppm);const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
 x.fillStyle='#1b2631';x.fillRect(0,0,W,H);
 if(VOPT.plan&&l.bg&&l.bg.src){const im=bgImg(l);if(im&&im.complete&&im.naturalWidth){x.save();x.globalAlpha=0.5;x.filter='invert(1) hue-rotate(180deg)';const s=ppm/l.bg.pxPerM;x.drawImage(im,(l.bg.ox-x0)*ppm,(l.bg.oy-y0)*ppm,im.naturalWidth*s,im.naturalHeight*s);x.restore()}}
 rooms.forEach(r=>{const rx=(r.x0-x0)*ppm,ry=(r.y0-y0)*ppm,rw=(r.x1-r.x0)*ppm,rh=(r.y1-r.y0)*ppm;x.fillStyle=`rgba(${ROOM_FILL[r.type]||'129,144,160'},.13)`;x.fillRect(rx,ry,rw,rh);
  if(VOPT.labels&&rw>40&&rh>30){const fs=Math.max(11,Math.min(26,Math.min(rw/8,rh/3.2)));x.fillStyle='rgba(225,233,240,.92)';x.font=`600 ${fs}px "IBM Plex Sans",Arial,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(r.name,rx+rw/2,ry+rh/2-fs*0.45);
   x.fillStyle='rgba(150,165,180,.9)';x.font=`${fs*0.75}px "IBM Plex Mono",monospace`;x.fillText(`${fmt((r.x1-r.x0)*(r.y1-r.y0),1)} m²`,rx+rw/2,ry+rh/2+fs*0.65)}});
 const t=new THREE.CanvasTexture(cv);t.anisotropy=4;return {t,x0,y0,x1,y1}}
function buildLevelStatic(l,g,c,next){const mats=M3();const st=new THREE.Group();g.add(st);V3.lv[l.id].st=st;
 l.rooms.forEach(r=>{box(r.x1-r.x0,0.14,r.y1-r.y0,mats.slab,(r.x0+r.x1)/2-c[0],l.elev-0.075,(r.y0+r.y1)/2-c[1],st)});
 const wm=wallModel(l);wm.full.concat(...wm.ops.map(o=>o.boxes)).forEach(b=>box(b[2]-b[0],0.14,b[3]-b[1],mats.slab,(b[0]+b[2])/2-c[0],l.elev-0.075,(b[1]+b[3])/2-c[1],st));
 const pt=planTexture(l);if(pt){const m=new THREE.Mesh(new THREE.PlaneGeometry(pt.x1-pt.x0,pt.y1-pt.y0),new THREE.MeshBasicMaterial({map:pt.t,transparent:true,opacity:.96}));m.rotation.x=-Math.PI/2;m.position.set((pt.x0+pt.x1)/2-c[0],l.elev+0.004,(pt.y0+pt.y1)/2-c[1]);st.add(m);V3.lv[l.id].planMesh=m}
 // balcones: baranda
 l.rooms.filter(r=>r.type==='balcon').forEach(r=>{const others=l.rooms.filter(o=>o!==r&&o.type!=='balcon');const near=(axis,v)=>others.some(o=>axis==='y'?Math.abs(o.y1-v)<0.3||Math.abs(o.y0-v)<0.3:Math.abs(o.x1-v)<0.3||Math.abs(o.x0-v)<0.3);
  [['y',r.y0,[r.x0,r.y0,r.x1,r.y0]],['y',r.y1,[r.x0,r.y1,r.x1,r.y1]],['x',r.x0,[r.x0,r.y0,r.x0,r.y1]],['x',r.x1,[r.x1,r.y0,r.x1,r.y1]]].forEach(([ax,v,[a,b,cc,d]])=>{if(near(ax,v))return;const L=Math.hypot(cc-a,d-b);box(ax==='y'?L:0.04,1.0,ax==='y'?0.04:L,mats.rail,(a+cc)/2-c[0],l.elev+0.5,(b+d)/2-c[1],st);box(ax==='y'?L:0.06,0.05,ax==='y'?0.06:L,mats.stair,(a+cc)/2-c[0],l.elev+1.0,(b+d)/2-c[1],st)})});
 // escaleras
 (l.stairs||[]).forEach(s=>{const n=Math.max(2,s.steps||11),rise=((next?next.elev:l.elev+l.h)-l.elev)/n,alongY=s.dir==='y'||s.dir==='-y',len=alongY?s.y1-s.y0:s.x1-s.x0,run=len/n;
  for(let i=0;i<n;i++){const top=(i+1)*rise;let a0,a1;if(s.dir==='-y'||s.dir==='-x'){a1=(alongY?s.y1:s.x1)-i*run;a0=a1-run}else{a0=(alongY?s.y0:s.x0)+i*run;a1=a0+run}
   if(alongY)box(s.x1-s.x0,0.08,a1-a0,mats.stair,(s.x0+s.x1)/2-c[0],l.elev+top-0.04,(a0+a1)/2-c[1],st);else box(a1-a0,0.08,s.y1-s.y0,mats.stair,(a0+a1)/2-c[0],l.elev+top-0.04,(s.y0+s.y1)/2-c[1],st)}});
 // aparatos
 l.fixtures.forEach(f=>fixture3D(l,f,st,c))}
function fixture3D(l,f,g,c){const mats=M3(),E=l.elev,X=f.x-c[0],Z=f.y-c[1];const r=roomOfPt(l,f.x,f.y);let nx=0,nz=0;
 if(r){const ds=[[f.x-r.x0,-1,0],[r.x1-f.x,1,0],[f.y-r.y0,0,-1],[r.y1-f.y,0,1]].sort((a,b)=>a[0]-b[0])[0];nx=ds[1];nz=ds[2]}
 switch(f.type){
  case 'wc':box(.36,.4,.36,mats.fix,X,E+.2,Z,g);box(nx?.18:.4,.36,nz?.18:.4,mats.fix,X+nx*.22,E+.55,Z+nz*.22,g);break;
  case 'lav':{const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.75,12),mats.fix);p.position.set(X,E+.38,Z);g.add(p);box(.5,.14,.4,mats.fix,X,E+.82,Z,g);break}
  case 'ducha':box(.85,.06,.85,mats.fix,X,E+.03,Z,g);box(nx?.02:.85,1.9,nz?.02:.85,mats.glass,X-nx*.42,E+1.0,Z-nz*.42,g);{const h=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.03,14),mats.dark);h.position.set(X+nx*.35,E+2.0,Z+nz*.35);g.add(h)}break;
  case 'lavaplatos':box(nx?.55:.8,.9,nz?.55:.8,mats.fix,X,E+.45,Z,g);box(nx?.35:.45,.02,nz?.35:.45,mats.dark,X,E+.905,Z,g);break;
  case 'cocina':box(.6,.9,.6,mats.fix,X,E+.45,Z,g);[[-.13,-.13],[.13,-.13],[-.13,.13],[.13,.13]].forEach(([a,b])=>{const d=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.01,14),mats.dark);d.position.set(X+a,E+.905,Z+b);g.add(d)});break;
  case 'lavadora':box(.6,.85,.6,mats.fix,X,E+.43,Z,g);{const d=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.02,18),mats.dark);d.rotation.x=nz?0:Math.PI/2;d.rotation.z=nx?Math.PI/2:0;d.position.set(X-nx*.31,E+.5,Z-nz*.31);if(!nx&&!nz)d.position.set(X,E+.86,Z);g.add(d)}break;
  case 'lavadero':box(.6,.85,.5,mats.fix,X,E+.43,Z,g);break;
  case 'terma':{const t=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.9,18),mats.fix);t.position.set(X,E+1.65,Z);g.add(t);break}
  case 'extractor':box(.28,.04,.28,mats.fix,X,E+l.h-.02,Z,g);break}}
function buildWalls(l){const L=V3.lv[l.id],g=L.walls,mats=M3(),c=V3.c;disposeGroup(g);if(VOPT.walls==='none')return;
 const cut=VOPT.walls==='cut',top=cut?Math.min(VOPT.cut,l.h):l.h,E=l.elev;const side=cut?mats.wall:mats.wallT,cap=cut?mats.wallCap:mats.wallTCap;const ms=[side,side,cap,cap,side,side];
 const add=(b,z0,z1)=>{if(z1-z0<0.01)return;const geo=new THREE.BoxGeometry(b[2]-b[0],z1-z0,b[3]-b[1]);const m=new THREE.Mesh(geo,ms);m.position.set((b[0]+b[2])/2-c[0],E+(z0+z1)/2,(b[1]+b[3])/2-c[1]);g.add(m);
  if(!cut){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),mats.edge);e.position.copy(m.position);g.add(e)}};
 const wm=wallModel(l);wm.full.forEach(b=>add(b,0,top));
 wm.ops.forEach(({o,boxes})=>{const s=o.sill||0,h=o.h||2.0;boxes.forEach(b=>{
  if(o.type==='ventana'){add(b,0,Math.min(s,top));if(top>s+h)add(b,s+h,top);const g0=s,g1=Math.min(s+h,top);if(g1>g0){const horiz=(b[2]-b[0])>=(b[3]-b[1]);const gb=horiz?[b[0],(b[1]+b[3])/2-0.01,b[2],(b[1]+b[3])/2+0.01]:[(b[0]+b[2])/2-0.01,b[1],(b[0]+b[2])/2+0.01,b[3]];const gm=new THREE.Mesh(new THREE.BoxGeometry(gb[2]-gb[0],g1-g0,gb[3]-gb[1]),mats.glass);gm.position.set((gb[0]+gb[2])/2-c[0],E+(g0+g1)/2,(gb[1]+gb[3])/2-c[1]);g.add(gm)}}
  else{const dt=o.type==='vano'?Math.max(h,2.1):h;if(top>dt)add(b,dt,top)}})})}
function buildRoof(){const g=V3.roof;disposeGroup(g);const P=ST.P;if(!VOPT.roof)return;const lvs=lvOrder(),t=lvs[lvs.length-1];const rs=t.rooms.filter(r=>r.type!=='balcon');if(!rs.length)return;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;rs.forEach(r=>{x0=Math.min(x0,r.x0);y0=Math.min(y0,r.y0);x1=Math.max(x1,r.x1);y1=Math.max(y1,r.y1)});x0-=0.35;x1+=0.35;y0-=0.35;y1+=0.35;
 const rh=(P.roof&&P.roof.h)||0.85,zb=t.elev+t.h+0.15,c=V3.c,xm=(x0+x1)/2;const v=(x,y,z)=>V([x,y,z],c);
 const quad=(a,b,cc,d)=>{const geo=new THREE.BufferGeometry().setFromPoints([a,b,cc,a,cc,d]);geo.computeVertexNormals();g.add(new THREE.Mesh(geo,M3().roof));const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),M3().edge);g.add(e)};
 quad(v(x0,y0,zb),v(xm,y0,zb+rh),v(xm,y1,zb+rh),v(x0,y1,zb));quad(v(x1,y0,zb),v(xm,y0,zb+rh),v(xm,y1,zb+rh),v(x1,y1,zb));
 [y0,y1].forEach(y=>{const geo=new THREE.BufferGeometry().setFromPoints([v(x0,y,zb),v(xm,y,zb+rh),v(x1,y,zb)]);g.add(new THREE.Mesh(geo,M3().roof))});g.position.y=lvOff(t)}
function buildNets(P3){Object.values(V3.lv).forEach(L=>disposeGroup(L.nets));disposeGroup(V3.all);V3.nets={};const c=V3.c,Y=new THREE.Vector3(0,1,0);V3.netMeshes=[];
 const matOf={};const mat=k=>matOf[k]||(matOf[k]=new THREE.MeshStandardMaterial({color:new THREE.Color(NET_COLOR(k)),emissive:new THREE.Color(NET_COLOR(k)).multiplyScalar(0.22),roughness:.4,metalness:.15}));
 for(const k in P3)P3[k].forEach(e=>{const g=e.lv==='all'?V3.all:(V3.lv[e.lv]?V3.lv[e.lv].nets:V3.all);const p=e.p;const r=k==='power'?0.016:Math.max(0.02,e.r*1.5);
  for(let i=1;i<p.length;i++){const a=V(p[i-1],c),b=V(p[i],c),dv=b.clone().sub(a),L=dv.length();if(L<1e-4)continue;
   const geo=k==='vent'?new THREE.BoxGeometry(r*2,L,r*1.6):new THREE.CylinderGeometry(r,r,L,k==='power'?6:12);const m=new THREE.Mesh(geo,mat(k));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y,dv.normalize());m.userData={k,d:e.d,lv:e.lv};g.add(m);V3.netMeshes.push(m);
   if(k!=='vent'&&k!=='power'){const s=new THREE.Mesh(new THREE.SphereGeometry(r*1.15,10,8),mat(k));s.position.copy(b);s.userData=m.userData;g.add(s)}}})}
function applyView(){const lvs=lvOrder();lvs.forEach(l=>{const L=V3.lv[l.id];if(!L)return;L.g.position.y=lvOff(l);L.g.visible=LEGLV[l.id]!==false;L.nets.children.forEach(m=>m.visible=LEG3[m.userData.k])});
 V3.all.visible=!(VOPT.explode>0);V3.all.children.forEach(m=>m.visible=LEG3[m.userData.k]);V3.ground.visible=VOPT.ground;V3.roof.visible=VOPT.roof;if(V3.roof.children.length)V3.roof.position.y=lvOff(lvs[lvs.length-1]);placeMarkers()}
function frame3(p,init){const st=V3.st,[x0,y0,x1,y1]=V3.bb,lvs=lvOrder(),t=lvs[lvs.length-1];const H=t.elev+t.h+lvOff(t);st.tg.set(0,H*0.42,0);const span=Math.max(x1-x0,y1-y0);
 const cr=$('#c3d').getBoundingClientRect();
 const asp=cr.width&&cr.height?cr.width/cr.height:1.6,fit=(sz)=>(sz/2)/Math.tan(34*Math.PI/360)/Math.min(1,asp);
 const P={iso:[-0.75,0.95,fit(span)*0.95],top:[0,0.02,fit(span)*1.12],front:[0,1.35,fit(Math.max(x1-x0,H))*1.6],side:[Math.PI/2,1.32,fit(span)*1.0]}[p]||[-0.75,0.95,fit(span)*0.95];
 st.theta=P[0];st.phi=P[1];st.r=Math.max(8,P[2]);if(!init)st.auto=false;if(p==='top')st.tg.set(0,H*0.5,0)}
function pick3(e){if(!V3.netMeshes)return;const cv=$('#c3d'),r=cv.getBoundingClientRect();const m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 const rc=new THREE.Raycaster();rc.setFromCamera(m,V3.cam);const hits=rc.intersectObjects(V3.netMeshes.filter(x=>x.visible&&x.parent.visible&&x.parent.parent&&x.parent.parent.visible!==false),false);
 const tip=V3.tip;if(!hits.length){tip.hidden=true;return}const u=hits[0].object.userData;const N=normById(ST.R.norm);
 const lab=u.k==='power'?'Circuito eléctrico · '+(N.elec.cable||''):u.k==='cold'||u.k==='hot'?`Øi ${u.d} mm · ${N.agua.material}`:u.k==='drain'||u.k==='dvent'?`Ø ${u.d} mm · ${N.desague.material}`:u.k==='vent'?`Ducto Ø ${u.d} mm`:u.k==='fire'?`CPVC Ø ${u.d} mm`:'';
 const lv=u.lv==='all'?'montante en ducto':(ST.P.levels.find(x=>x.id===u.lv)||{}).name||'';
 tip.innerHTML=`<b style="color:var(--${u.k})">${NETS[u.k]}</b><br>${esc(lab)}<br><span class="hint">${esc(lv)}</span>`;tip.style.left=Math.min(r.width-200,e.clientX-r.left+12)+'px';tip.style.top=(e.clientY-r.top+12)+'px';tip.hidden=false}
function renderSide3(phase){const R=ST.R,P=ST.P;const leg=$('#legend3');
 if(!R||R.error){leg.innerHTML='';$('#side3').innerHTML='';return}
 leg.innerHTML=`<div class="lt">Sistemas</div>${Object.keys(NETS).filter(k=>R.p3[k]&&R.p3[k].length).map(k=>`<button class="lg" type="button" data-l3="${k}" aria-pressed="${LEG3[k]}"><span class="sw" style="background:var(--${k})"></span>${NETS[k]}</button>`).join('')}<div class="lt">Niveles</div>${lvOrder().map(l=>`<button class="lg" type="button" data-lv3="${l.id}" aria-pressed="${LEGLV[l.id]!==false}">${esc(l.name)}</button>`).join('')}`;
 if(!phase)phase=V3.phase||'final';V3.phase=phase;const nf=(R.first||[]).length;const multi=P.levels.length>1;
 $('#side3').innerHTML=`<div class="card"><h3>Vista</h3>
  <div class="f"><span class="hint">Muros</span><div class="chips">${[['cut','Cortados a 1.15 m'],['full','Completos'],['none','Ocultos']].map(([k,n])=>`<button class="chip" type="button" data-v3w="${k}" aria-pressed="${VOPT.walls===k}">${n}</button>`).join('')}</div></div>
  ${multi?`<label class="f">Separación entre pisos (vista explotada): <b class="mono">${fmt(VOPT.explode,1)} m</b><input type="range" min="0" max="5" step="0.1" value="${VOPT.explode}" data-v3x></label>`:''}
  <div class="row"><label class="chk"><input type="checkbox" data-v3o="labels"${VOPT.labels?' checked':''}> Nombres</label><label class="chk"><input type="checkbox" data-v3o="plan"${VOPT.plan?' checked':''}> Plano en el piso</label><label class="chk"><input type="checkbox" data-v3o="roof"${VOPT.roof?' checked':''}> Techo</label><label class="chk"><input type="checkbox" data-v3o="ground"${VOPT.ground?' checked':''}> Terreno</label></div>
  <div class="row"><span class="hint">Cámara</span>${[['iso','3D'],['top','Planta'],['front','Frente'],['side','Lateral']].map(([k,n])=>`<button class="btn sm" type="button" data-v3c="${k}">${n}</button>`).join('')}<button class="btn sm" type="button" data-v3png style="margin-left:auto">Imagen PNG</button></div>
  <p class="hint">Haz clic en una tubería para ver su sistema y diámetro. Shift + arrastrar para desplazar.</p></div>
 <div class="card"><h3>Coordinador · interferencias</h3><div class="cl-h"><b class="${phase==='first'&&nf?'bad':'ok'}">${phase==='first'?nf:R.clash.remaining}</b><span class="hint">${phase==='first'?(nf?'cruces en la primera pasada de los agentes':'cruces: los recorridos no chocan'):`pendientes · ${nf} resueltas por re-ruteo${R.clash.steps.length?` y ${R.clash.steps.length} desvíos`:''}`}</span></div>
  <div class="clist">${(R.first||[]).map(c=>`<div class="ci${phase==='final'?' ok':''}"><span class="ic">${phase==='final'?'✓':'●'}</span><div>${NETS[c.a]} ↔ ${NETS[c.b]}<small>${esc(c.where)}${phase==='final'?' · re-ruteado':''}</small></div></div>`).join('')||'<p class="hint">Sin cruces entre sistemas.</p>'}</div></div>
  <div class="card"><h3>Resultado · ${esc(normById(R.norm).nombre)}</h3>${SYS.map(s=>{const ck=R.checks.filter(c=>c.sys===s.key),f=ck.filter(c=>c.st==='fail').length,w=ck.filter(c=>c.st==='warn').length;return `<div class="sumr"><span class="sw" style="background:var(${SYS_COL[s.key]})"></span><div><b>${s.short}</b><small>${esc(R.stats[s.key][0])}</small><small>${esc(R.stats[s.key][1])}</small></div><span class="pillst ${f?'bad':w?'warn':'ok'}">${f?f+' ✕':w?w+' !':'✓ '+ck.length}</span></div>`}).join('')}
  <div class="row"><button class="btn sm" type="button" onclick="showView('verif')">Ver verificaciones</button><button class="btn sm" type="button" onclick="showView('metrados')">Ver metrados</button></div></div>`}
$('#legend3').addEventListener('click',e=>{const b=e.target.closest('[data-l3],[data-lv3]');if(!b)return;if(b.dataset.l3){LEG3[b.dataset.l3]=!LEG3[b.dataset.l3];b.setAttribute('aria-pressed',String(LEG3[b.dataset.l3]))}else{const id=b.dataset.lv3;LEGLV[id]=LEGLV[id]===false;b.setAttribute('aria-pressed',String(LEGLV[id]))}if(V3.lv)applyView()});
$('#side3').addEventListener('click',e=>{const b=e.target.closest('[data-v3w],[data-v3c],[data-v3png]');if(!b||!V3.lv)return;
 if(b.dataset.v3w){VOPT.walls=b.dataset.v3w;Object.values(V3.lv).forEach(L=>buildWalls(L.l));$$('[data-v3w]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v3w===VOPT.walls)))}
 if(b.dataset.v3c)frame3(b.dataset.v3c);
 if(b.dataset.v3png!==undefined)V3.R.domElement.toBlob(bl=>{if(bl)download(((ST.P.nombre||'modelo').toLowerCase().replace(/[^a-z0-9]+/gi,'-'))+'-3d.png',bl,'image/png')},'image/png')});
$('#side3').addEventListener('input',e=>{const t=e.target;if(!V3.lv)return;
 if(t.dataset.v3x!==undefined){VOPT.explode=+t.value;applyView();buildRoof();const lab=t.parentElement.querySelector('b');if(lab)lab.textContent=fmt(VOPT.explode,1)+' m';frame3('iso')}
 if(t.dataset.v3o){VOPT[t.dataset.v3o]=t.checked;if(t.dataset.v3o==='roof')buildRoof();if(t.dataset.v3o==='labels'||t.dataset.v3o==='plan'){Object.values(V3.lv).forEach(L=>{if(!L.planMesh)return;const pt=planTexture(L.l);L.planMesh.material.map.dispose();L.planMesh.material.map=pt.t;L.planMesh.material.needsUpdate=true})}applyView()}});

/* Proyecto de ejemplo: Vivienda Ing. Mutilla (Antofagasta) · trazado desde la Lámina 1
   Alturas del Corte A-A' y B-B': piso 1 = 2.20 m (lavandería 2.00 m), losa 0.15 m, piso 2 en +2.35 con 2.35 m, techo a dos aguas de 0.85 m.
   Superficie construida calculada ≈ 148 m² frente a 149.4 m² del cuadro de superficies. */
const EXAMPLE_PROJECT={id:'ejemplo-mutilla',nombre:'Vivienda Ing. Mutilla · ampliación',ubicacion:'Calle Ingeniero Mutilla, Antofagasta, Chile',normId:'cl-ridaa',example:true,
 params:{presion:18,f_acc:1.2},
 lot:{x0:-0.15,y0:-0.15,x1:4.40,y1:19.85,front:16.85,ext:-0.15},
 roof:{tipo:'dos aguas',h:0.85,eje:'y'},
 ref:{superficie_plano:149.4,lamina:'ViviendaIngMutilla_Antf_V1 · Lámina 1',arquitecto:'Natalio G. Huerta T.'},
 points:{medidor:{lv:'p1',x:0.3,y:17.0},salida:{lv:'p1',x:2.6,y:17.1},tablero:{lv:'p1',x:0.12,y:16.0},ducto:{x:4.05,y:3.75}},
 levels:[
 {id:'p1',name:'Piso 1',elev:0,h:2.2,bg:{src:'builtin:p1',pxPerM:78.75,ox:-0.298,oy:-0.444,op:0.55,show:true},
  rooms:[
   {id:'r1',name:'Lavandería',type:'lavanderia',x0:0,y0:0,x1:4.25,y1:3.67,ventana:true,h:2.0},
   {id:'r2',name:'Pasillo',type:'pasillo',x0:0,y0:3.82,x1:1.55,y1:7.56,ventana:false},
   {id:'r3',name:'Baño 1',type:'bano',x0:1.7,y0:3.82,x1:4.25,y1:5.62,ventana:true},
   {id:'r4',name:'Cocina',type:'cocina',x0:1.55,y0:5.77,x1:4.25,y1:7.56,ventana:false},
   {id:'r5',name:'Comedor',type:'comedor',x0:0,y0:7.56,x1:4.25,y1:12.41,ventana:true},
   {id:'r6',name:'Living',type:'sala',x0:0,y0:12.41,x1:4.25,y1:15.56,ventana:true},
   {id:'r7',name:'Hall de acceso',type:'pasillo',x0:0,y0:15.56,x1:1.85,y1:16.7,ventana:false}],
  openings:[
   {id:'o1',type:'puerta',x0:0.1,y0:3.745,x1:1.0,y1:3.745,h:2.0,sill:0},
   {id:'o2',type:'puerta',x0:1.625,y0:3.85,x1:1.625,y1:4.6,h:2.0,sill:0},
   {id:'o3',type:'ventana',x0:3.55,y0:3.745,x1:4.05,y1:3.745,h:0.5,sill:1.5},
   {id:'o4',type:'puerta',x0:0.35,y0:16.775,x1:1.45,y1:16.775,h:2.2,sill:0},
   {id:'o5',type:'ventana',x0:2.5,y0:15.635,x1:3.6,y1:15.635,h:0.9,sill:0.9}],
  stairs:[{id:'e1',x0:0.03,y0:8.2,x1:0.8,y1:11.3,steps:11,dir:'-y'}],
  fixtures:[
   {id:'f1',type:'wc',x:2.7,y:5.25},{id:'f2',type:'ducha',x:3.8,y:5.15},{id:'f3',type:'lav',x:4.0,y:4.2},
   {id:'f4',type:'lavaplatos',x:3.7,y:6.0},{id:'f5',type:'cocina',x:2.2,y:5.95},
   {id:'f6',type:'lavadora',x:3.55,y:3.3},{id:'f7',type:'lavadero',x:2.85,y:3.35},{id:'f8',type:'terma',x:4.0,y:0.4}]},
 {id:'p2',name:'Piso 2',elev:2.35,h:2.35,bg:{src:'builtin:p2',pxPerM:78.75,ox:-0.298,oy:-0.432,op:0.55,show:true},
  rooms:[
   {id:'s1',name:'Walking closet 1',type:'closet',x0:0,y0:0,x1:4.25,y1:2.0,ventana:true},
   {id:'s2',name:'Hall',type:'pasillo',x0:0,y0:2.1,x1:2.35,y1:3.83,ventana:true},
   {id:'s3',name:'Baño 2',type:'bano',x0:2.45,y0:2.1,x1:4.25,y1:3.73,ventana:false},
   {id:'s4',name:'Habitación 1',type:'dormitorio',x0:0,y0:3.83,x1:4.25,y1:7.07,ventana:true},
   {id:'s5',name:'Circulación',type:'pasillo',x0:0,y0:7.17,x1:4.25,y1:10.53,ventana:true},
   {id:'s6',name:'Circulación 2',type:'pasillo',x0:0,y0:10.53,x1:0.93,y1:13.36,ventana:true},
   {id:'s7',name:'Walking closet 2',type:'closet',x0:1.03,y0:10.62,x1:4.25,y1:13.32,ventana:true},
   {id:'s8',name:'Habitación 2',type:'dormitorio',x0:0,y0:13.42,x1:4.25,y1:15.92,ventana:true},
   {id:'s9',name:'Balcón',type:'balcon',x0:0,y0:16.02,x1:4.25,y1:16.87,ventana:true}],
  openings:[
   {id:'q1',type:'puerta',x0:0.48,y0:2.05,x1:1.23,y1:2.05,h:2.0,sill:0},
   {id:'q2',type:'puerta',x0:2.4,y0:2.25,x1:2.4,y1:2.95,h:2.0,sill:0},
   {id:'q3',type:'ventana',x0:-0.075,y0:2.65,x1:-0.075,y1:3.5,h:1.0,sill:1.0},
   {id:'q4',type:'puerta',x0:3.3,y0:7.12,x1:4.05,y1:7.12,h:2.0,sill:0},
   {id:'q5',type:'ventana',x0:-0.075,y0:7.45,x1:-0.075,y1:8.3,h:1.0,sill:1.0},
   {id:'q6',type:'ventana',x0:2.75,y0:10.575,x1:3.25,y1:10.575,h:1.0,sill:1.0},
   {id:'q7',type:'puerta',x0:0.08,y0:13.39,x1:0.83,y1:13.39,h:2.0,sill:0},
   {id:'q8',type:'puerta',x0:1.05,y0:13.39,x1:1.8,y1:13.39,h:2.0,sill:0},
   {id:'q9',type:'puerta',x0:1.17,y0:15.97,x1:1.97,y1:15.97,h:2.0,sill:0},
   {id:'q10',type:'ventana',x0:2.0,y0:15.97,x1:3.1,y1:15.97,h:1.0,sill:1.0}],
  stairs:[],
  fixtures:[{id:'g1',type:'wc',x:3.8,y:2.45},{id:'g2',type:'ducha',x:3.77,y:3.25},{id:'g3',type:'lav',x:2.83,y:3.55},{id:'g4',type:'extractor',x:3.23,y:3.6}]}]};

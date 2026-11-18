# Trazo MEP

**Diseño y verificación automática de instalaciones para viviendas y edificios** — un producto de **NexusCode Systems**.

Trazo MEP toma las plantas de una vivienda o de un edificio (PDF, DXF, DWG o imagen), y cinco agentes trazan en paralelo las instalaciones de **desagüe, agua fría y caliente, electricidad, ventilación mecánica y protección contra incendio**. Un coordinador detecta y resuelve los cruces entre sistemas y el resultado se revisa en un modelo 3D, con verificaciones de norma, metrados y cuadro de cargas.

> Prototipo. Los cálculos son un predimensionamiento automático y no reemplazan el proyecto firmado por profesionales habilitados. Los valores de las normativas incluidas son referenciales: verifica la versión vigente.

## Funciones

- **Importación de planos por piso**: sube un PDF de varias hojas (por ejemplo el compilado del proyecto), varios archivos a la vez o un archivo de AutoCAD. La app revisa todas las hojas, encuentra cada planta por su título (*PLANTA NIVEL 2*, *PISO 1*, *SUBTERRÁNEO*…) y muestra una lista para elegir qué pisos traer, con vista previa, nombre, número de nivel y escala editables. Marca las plantas repetidas (compilado + hoja suelta) y las secundarias (planos de ubicación, cortes).
- **Lectura de muros**: detecta muros de doble línea o rellenos e ignora muebles, cotas y ejes; cada recinto se mide desde su nombre hasta los muros. Plantas a distintas escalas (1:100, 1:125…) se alinean entre sí por los textos comunes (ejes, letras de corte). Los **pisos tipo** se reconocen y comparten la misma geometría.
- **AutoCAD**: DXF (texto, cualquier versión) y DWG. En DXF/DWG se usan las capas: si existen capas de muros (*MURO*, *WALL*, *TABIQUE*…) solo esas cuentan como muro; mobiliario, cotas, ejes y puertas se ignoran. El lector DWG es [libredwg-web](https://github.com/mlightcad/libredwg-web) (GPL-3.0) y se descarga desde jsDelivr solo cuando se sube un DWG.
- **Edificios**: un ducto vertical por grupo de baños y cocinas (editable, se pueden agregar más), montantes por ducto, equipo de presión (hidropack) y válvulas reductoras cuando la altura lo exige, subtableros por piso con alimentadores, shafts colectivos de extracción, colectores y diámetros mayores cuando la normativa se queda corta. Proyectos de cientos de recintos se calculan en segundos y el 3D muestra cada piso por separado si se quiere.
- Para imágenes o PDF escaneados: subir como fondo, calibrar y usar **Detectar ambientes** (usa IA para leer los nombres).
- **Plano**: sube un PDF o imagen, calibra la escala con una cota conocida y dibuja ambientes, aparatos, puertas, ventanas y escaleras. Los muros se generan solos con su espesor.
- **Agentes**: ruteo real sobre grilla de 10 cm (20–25 cm en edificios grandes) (Dijkstra con penalización de giros y muros), árboles de distribución por sistema y dimensionamiento por unidades de descarga, unidades de gasto (Hunter), Hazen-Williams, caída de tensión y capacidad de conductores.
- **Coordinación 3D**: detección de interferencias entre sistemas y re-ruteo automático.
- **Normativas intercambiables**: Chile (RIDAA / NCh Elec. 4/2003 / OGUC), Perú (RNE IS.010 / EM.010 / A.130) y EE.UU. (IPC / NEC / NFPA 13D). Se pueden duplicar, editar, importar y exportar en JSON, y comparar en el mismo proyecto.
- **Entregables**: tabla de verificaciones, correcciones aplicadas, metrados (CSV), cuadro de cargas (CSV), informe HTML e imagen PNG del modelo 3D.
- **Proyecto de ejemplo**: vivienda Ing. Mutilla (Antofagasta), trazada desde la lámina de arquitectura. Superficie construida calculada ≈ 148 m² frente a 149.4 m² del cuadro de superficies.

## Estructura

```
public/
  index.html          Interfaz
  css/styles.css      Estilos
  js/engine.js        Motor de cálculo, normativas y muros
  js/example.js       Proyecto de ejemplo
  js/editor.js        Núcleo de la app y editor de planos
  js/importer.js      Lectura de planos PDF por hojas y por piso
  js/cad.js           Lectura de DXF y DWG
  js/visor3d.js       Modelo 3D (three.js)
  js/app.js           Agentes, verificaciones, metrados, normativas, proyectos
  assets/planos/      Plantas del proyecto de ejemplo
firebase.json         Configuración de Firebase Hosting
```

Sin dependencias ni compilación: es HTML, CSS y JavaScript. three.js y pdf.js se cargan desde cdnjs cuando se necesitan; el lector DWG desde jsDelivr.

## Probar en local

```bash
cd public
python -m http.server 8080
# abre http://localhost:8080
```

## Firebase (proyecto `agente-arq`)

La app usa tres servicios del plan gratuito Spark:

| Servicio | Para qué |
|---|---|
| **Hosting** | Publica la página. También entrega la configuración en `/__/firebase/init.json`, así que no hay claves en el código. |
| **Authentication** | Inicio de sesión con Google o correo y contraseña. |
| **Firestore** | Proyectos, normativas propias y planos de fondo de cada usuario (`users/{uid}/...`). Las reglas de `firestore.rules` impiden ver datos ajenos. |
| **AI Logic** (opcional) | Lectura de normativas en PDF con Gemini (Gemini Developer API). |

Los planos de fondo se guardan en Firestore partidos en bloques de 800 KB, así no se necesita Cloud Storage (que hoy exige el plan Blaze).

### Configuración en la consola (una sola vez)

1. **Registrar la app web**: Configuración del proyecto → Tus apps → icono `</>` → nombre "Trazo MEP". No hace falta copiar el `firebaseConfig`.
2. **Authentication** → Comenzar → Método de acceso → habilitar **Google** y **Correo electrónico/contraseña**.
3. **Firestore Database** → Crear base de datos → edición Standard → ubicación `southamerica-east1` (São Paulo) → modo producción.
4. **AI Logic** (opcional) → Comenzar → **Gemini Developer API**. El modelo se cambia en `public/js/cloud.js` (`AI_MODEL`).

### Publicar

```bash
firebase use default          # agente-arq
firebase deploy               # publica hosting y reglas de Firestore
```

La app queda en `https://agente-arq.web.app`.

### Probar en local con la configuración real

```bash
firebase serve --only hosting
# abre http://localhost:5000
```

`firebase serve` entrega `/__/firebase/init.json`; con `python -m http.server` la app funciona igual pero sin cuentas ni nube.

### Despliegue automático desde GitHub

`.github/workflows/firebase-hosting-merge.yml` publica en cada push a `main`. Ejecuta `firebase init hosting:github`, elige el repositorio y responde **No** cuando pregunte si sobrescribe el workflow. Ese comando crea el secreto `FIREBASE_SERVICE_ACCOUNT`.

## Datos

- Sin sesión: los proyectos se guardan en el navegador (localStorage).
- Con sesión: se guardan en Firestore y se abren desde cualquier equipo. En **Proyectos**, el botón **Subir a la nube** pasa los proyectos locales a la cuenta.
- **Exportar JSON** sirve como respaldo en ambos casos.

---

© NexusCode Systems · Arequipa, Perú

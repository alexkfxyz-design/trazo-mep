# Trazo MEP

**Diseño y verificación automática de instalaciones para viviendas** — un producto de **NexusCode Systems**.

Trazo MEP toma la planta de una vivienda (PDF o imagen), y cinco agentes trazan en paralelo las instalaciones de **desagüe, agua fría y caliente, electricidad, ventilación mecánica y protección contra incendio**. Un coordinador detecta y resuelve los cruces entre sistemas y el resultado se revisa en un modelo 3D, con verificaciones de norma, metrados y cuadro de cargas.

> Prototipo. Los cálculos son un predimensionamiento automático y no reemplazan el proyecto firmado por profesionales habilitados. Los valores de las normativas incluidas son referenciales: verifica la versión vigente.

## Funciones

- **Plano**: sube un PDF o imagen, calibra la escala con una cota conocida y dibuja ambientes, aparatos, puertas, ventanas y escaleras. Los muros se generan solos con su espesor.
- **Agentes**: ruteo real sobre grilla de 10 cm (Dijkstra con penalización de giros y muros), árboles de distribución por sistema y dimensionamiento por unidades de descarga, unidades de gasto (Hunter), Hazen-Williams, caída de tensión y capacidad de conductores.
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
  js/visor3d.js       Modelo 3D (three.js)
  js/app.js           Agentes, verificaciones, metrados, normativas, proyectos
  assets/planos/      Plantas del proyecto de ejemplo
firebase.json         Configuración de Firebase Hosting
```

Sin dependencias ni compilación: es HTML, CSS y JavaScript. three.js y pdf.js se cargan desde cdnjs cuando se necesitan.

## Probar en local

```bash
cd public
python -m http.server 8080
# abre http://localhost:8080
```

## Publicar en Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # elige tu proyecto y ponle alias "default"
firebase deploy --only hosting
```

### Despliegue automático desde GitHub

El flujo `.github/workflows/firebase-hosting-merge.yml` publica en cada push a `main`. Para activarlo, crea el secreto `FIREBASE_SERVICE_ACCOUNT` en el repositorio (Settings → Secrets and variables → Actions). La forma más simple es ejecutar `firebase init hosting:github`, que crea la cuenta de servicio y el secreto por ti.

## Datos

Los proyectos y normativas propias se guardan en el navegador (localStorage). Usa **Exportar JSON** para respaldarlos o moverlos entre equipos.

---

© NexusCode Systems · Arequipa, Perú

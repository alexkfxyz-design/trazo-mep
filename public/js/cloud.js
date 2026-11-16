/* Trazo MEP · conexión con Firebase
   - Authentication: Google y correo/contraseña
   - Firestore: cada usuario guarda sus proyectos y normativas en users/{uid}/...
   - Planos de fondo: se guardan en Firestore partidos en bloques (no requiere Cloud Storage ni plan Blaze)
   - IA de normativas: Gemini mediante Firebase AI Logic (Gemini Developer API, disponible en el plan Spark)
   La configuración se lee de /__/firebase/init.json, que Firebase Hosting publica solo.
   Para otro hosting, define window.TRAZO_FIREBASE_CONFIG antes de cargar este archivo. */
const V = '13.1.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
// Cambia el modelo aquí si Google lo retira. Ver firebase.google.com/docs/ai-logic/models
const AI_MODEL = 'gemini-3.8-flash';
const CHUNK = 800000;

const done = (api) => { window.TrazoCloud = api; window.dispatchEvent(new Event('trazo-cloud')); };

async function loadConfig() {
  if (window.TRAZO_FIREBASE_CONFIG) return window.TRAZO_FIREBASE_CONFIG;
  try { const r = await fetch('/__/firebase/init.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}

(async () => {
  const cfg = await loadConfig();
  if (!cfg || !cfg.apiKey) { done({ available: false }); return; }
  try {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)]);
    const app = initializeApp(cfg);
    const auth = A.getAuth(app);
    try { auth.languageCode = 'es'; } catch (e) {}
    const db = F.getFirestore(app);
    const uid = () => { const u = auth.currentUser; if (!u) throw new Error('Inicia sesión para usar la nube.'); return u.uid; };
    const col = (name) => F.collection(db, 'users', uid(), name);
    const listFrom = async (name) => {
      const s = await F.getDocs(F.query(col(name), F.orderBy('actualizado', 'desc')));
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    let model = null;
    const getModel = async () => {
      if (model) return model;
      const AI = await import(`${CDN}/firebase-ai.js`);
      const ai = AI.getAI(app, { backend: new AI.GoogleAIBackend() });
      model = AI.getGenerativeModel(ai, { model: AI_MODEL, generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } });
      return model;
    };
    const ERR = {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/user-not-found': 'No existe una cuenta con ese correo.', 'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-email': 'El correo no es válido.',
      'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.', 'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.',
      'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase Authentication.', 'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento.', 'permission-denied': 'Firestore rechazó la operación. Revisa que las reglas estén publicadas.'
    };
    const nice = (e) => { const m = ERR[e && e.code]; const x = new Error(m || (e && e.message) || String(e)); x.code = e && e.code; return x; };
    const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw nice(e); } };

    done({
      available: true,
      projectId: cfg.projectId,
      user: () => auth.currentUser,
      onAuth: (cb) => A.onAuthStateChanged(auth, cb),
      signInGoogle: wrap(() => A.signInWithPopup(auth, new A.GoogleAuthProvider())),
      signInEmail: wrap((e, p) => A.signInWithEmailAndPassword(auth, e, p)),
      signUpEmail: wrap(async (e, p, name) => { const c = await A.createUserWithEmailAndPassword(auth, e, p); if (name) await A.updateProfile(c.user, { displayName: name }); return c; }),
      resetPassword: wrap((e) => A.sendPasswordResetEmail(auth, e)),
      signOut: wrap(() => A.signOut(auth)),
      listProjects: wrap(() => listFrom('proyectos')),
      saveProject: wrap((P) => F.setDoc(F.doc(col('proyectos'), P.id), { nombre: P.nombre || 'Proyecto', ubicacion: P.ubicacion || '', actualizado: Date.now(), json: JSON.stringify(P) })),
      deleteProject: wrap(async (id) => {
        const b = F.writeBatch(db); b.delete(F.doc(col('proyectos'), id));
        const fs = await F.getDocs(F.query(col('fondos'), F.where('proyecto', '==', id)));
        fs.docs.forEach(d => b.delete(d.ref)); await b.commit();
      }),
      listNorms: wrap(async () => (await listFrom('normativas')).map(d => { try { return JSON.parse(d.json); } catch (e) { return null; } }).filter(Boolean)),
      saveNorm: wrap((N) => F.setDoc(F.doc(col('normativas'), N.id), { nombre: N.nombre, actualizado: Date.now(), json: JSON.stringify(N) })),
      deleteNorm: wrap((id) => F.deleteDoc(F.doc(col('normativas'), id))),
      saveBg: wrap(async (proyecto, nivel, dataUrl) => {
        const key = `${proyecto}_${nivel}`.replace(/[^A-Za-z0-9_-]/g, '');
        const old = await F.getDocs(F.query(col('fondos'), F.where('clave', '==', key)));
        const del = F.writeBatch(db); old.docs.forEach(d => del.delete(d.ref)); if (old.size) await del.commit();
        const n = Math.ceil(dataUrl.length / CHUNK);
        for (let i = 0; i < n; i += 20) {
          const b = F.writeBatch(db);
          for (let j = i; j < Math.min(n, i + 20); j++) b.set(F.doc(col('fondos'), `${key}_${j}`), { clave: key, proyecto, nivel, i: j, n, data: dataUrl.slice(j * CHUNK, (j + 1) * CHUNK) });
          await b.commit();
        }
        return key;
      }),
      loadBg: wrap(async (key) => {
        const s = await F.getDocs(F.query(col('fondos'), F.where('clave', '==', key)));
        if (!s.size) throw new Error('Fondo no encontrado');
        return s.docs.map(d => d.data()).sort((a, b) => a.i - b.i).map(d => d.data).join('');
      }),
      aiModel: AI_MODEL,
      aiJSON: wrap(async (prompt, onText) => {
        const m = await getModel();
        const r = await m.generateContentStream(prompt);
        let text = '';
        for await (const ch of r.stream) { try { text += ch.text(); } catch (e) {} if (onText) onText({ text }); }
        const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        return JSON.parse(clean);
      })
    });
  } catch (e) {
    console.error('Trazo MEP · Firebase no disponible:', e);
    done({ available: false, error: String(e && e.message || e) });
  }
})();

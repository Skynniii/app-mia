import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAfQoiYOHUQBDldx2DWAC_aF_Ctc2IgLhc',
  authDomain: 'aplicacion-ff63f.firebaseapp.com',
  projectId: 'aplicacion-ff63f',
  storageBucket: 'aplicacion-ff63f.firebasestorage.app',
  messagingSenderId: '664146917749',
  appId: '1:664146917749:web:f070a8c231d912922d3b3c',
  measurementId: 'G-PT0RJQY907',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// La sesión se guarda en localStorage (en vez de IndexedDB) para que persista
// igual entre navegadores. Mismo login de Google y mismas reglas de Firestore.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase Auth persistence: no se pudo aplicar localStorage.', err);
});

/**
 * Firestore con caché persistente (IndexedDB) y multi-pestaña.
 *
 * Es la base del sistema de sincronización multidispositivo:
 * - Lecturas instantáneas desde la caché local: la app abre con los datos ya
 *   descargados, sin esperar a la red.
 * - Cada listener guarda su punto de reanudación, así al reabrir la app solo
 *   se descargan los documentos que cambiaron (nunca la colección completa).
 * - Las escrituras hechas sin conexión quedan en cola y se suben solas al
 *   recuperar la señal, en orden (la última escritura gana).
 * - Los borrados remotos desaparecen también de la caché local (no quedan
 *   tareas "fantasma" en otros navegadores).
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

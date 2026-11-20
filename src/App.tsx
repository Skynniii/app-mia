import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import type { ViewType } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { DeviceCapabilityProvider } from './context/DeviceCapabilityContext';
import { migrateToSubcollections } from './hooks/useFirestoreCollection';
import { resetCollectionStores } from './hooks/collectionStore';
import { NavegacionBar } from './components/navegacion/NavegacionBar';
import { SyncStatusPill } from './components/ui/SyncStatusPill';
import { LoginScreen } from './components/ui/LoginScreen';
import { initBackButton } from './utils/backButton';

// Code-splitting: each view loads on first visit, reducing the initial bundle.
const TimeTracker = lazy(() => import('./components/timer/TimeTracker').then(m => ({ default: m.TimeTracker })));
const TareasDashboard = lazy(() => import('./components/tareas/TareasDashboard').then(m => ({ default: m.TareasDashboard })));
const Tracker = lazy(() => import('./components/tracker/Tracker').then(m => ({ default: m.Tracker })));
const CalendarView = lazy(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const Sidebar = lazy(() => import('./components/ui/Sidebar').then(m => ({ default: m.Sidebar })));
const SettingsPage = lazy(() => import('./components/ui/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AccountPage = lazy(() => import('./components/ui/AccountPage').then(m => ({ default: m.AccountPage })));

function ViewLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="w-7 h-7 border-2 border-[#7f70ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}


function AppContent() {
  const { user, authLoading } = useAuth();
  const { settings } = useSettings();
  const [view, setView] = useState<ViewType>('cronometro');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const userNavigated = useRef(false);

  // Botón atrás de Android: cierra la pantalla o modal abiertos en lugar de
  // salir de la aplicación directamente.
  useEffect(() => { initBackButton(); }, []);

  // Sincronización: la resuelve Firestore (caché persistente + listeners en
  // tiempo real). Aquí solo se hace la migración one-time del formato antiguo
  // y se cierran las suscripciones al cerrar sesión.
  useEffect(() => {
    if (!user?.uid) {
      resetCollectionStores();
      return;
    }
    const doneKey = `lumina-migrated:${user.uid}`;
    if (localStorage.getItem(doneKey)) return;
    migrateToSubcollections(user.uid)
      .then(() => localStorage.setItem(doneKey, '1'))
      .catch(console.error);
  }, [user?.uid]);

  // Aplica la sección inicial definida en configuración mientras el usuario
  // no haya navegado manualmente. Se reevalúa cuando los ajustes se cargan.
  useEffect(() => {
    if (!userNavigated.current) setView(settings.defaultView);
  }, [settings.defaultView]);

  const handleViewChange = (v: ViewType) => {
    userNavigated.current = true;
    setView(v);
  };

  // Navegación desde componentes profundos (p. ej. el check de una
  // tarea-actividad en curso, que lleva a Timer).
  useEffect(() => {
    const handler = (e: Event) => handleViewChange((e as CustomEvent<ViewType>).detail);
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, []);

  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#f5f3ff]">
        <span className="w-7 h-7 border-2 border-[#7f70ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <main className="w-full h-screen max-h-screen overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full h-full">
          <Suspense fallback={<ViewLoader />}>
            {view === 'cronometro' && <TimeTracker onMenuClick={() => setSidebarOpen(true)} onOpenAccount={() => setShowAccount(true)} />}
            {view === 'habitos' && <TareasDashboard onMenuClick={() => setSidebarOpen(true)} onOpenAccount={() => setShowAccount(true)} onNavigate={handleViewChange} />}
            {view === 'tracker' && <Tracker onMenuClick={() => setSidebarOpen(true)} onOpenAccount={() => setShowAccount(true)} onNavigate={handleViewChange} />}
            {view === 'calendar' && <CalendarView onMenuClick={() => setSidebarOpen(true)} onOpenAccount={() => setShowAccount(true)} onNavigate={handleViewChange} />}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      <SyncStatusPill />

      <NavegacionBar activeView={view} onViewChange={handleViewChange} onAdd={() => window.dispatchEvent(new CustomEvent('app-add'))} />

      <Suspense fallback={null}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeView={view}
          onNavigate={(v) => { handleViewChange(v); setSidebarOpen(false); }}
          onOpenSettings={() => { setSidebarOpen(false); setShowSettings(true); }}
        />
      </Suspense>

      <AnimatePresence>
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsPage onBack={() => setShowSettings(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccount && (
          <Suspense fallback={null}>
            <AccountPage
              onBack={() => setShowAccount(false)}
              onOpenSettings={() => { setShowAccount(false); setShowSettings(true); }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </main>
  );
}

function MotionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="never">
      {children}
    </MotionConfig>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <DeviceCapabilityProvider>
          <MotionWrapper>
            <AppContent />
          </MotionWrapper>
        </DeviceCapabilityProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

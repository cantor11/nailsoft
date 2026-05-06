import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Agenda } from './components/Agenda';
import { Finanzas } from './components/Finanzas';
import { Reportes } from './components/Reportes';
import { Clientes } from './components/Clientes';
import { Materiales } from './components/Materiales';
import { Perfil } from './components/Perfil';
import { UndoToast } from './components/UndoToast';
import { Login } from './components/Login';
import { AuthScreen } from './components/AuthScreen';
import { useStore } from './store/useStore';
import { useAuth } from './hooks/useAuth';
import { signOut } from './firebase/auth';
import { App as CapacitorApp } from '@capacitor/app';
import { LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [activeTab, setActiveTab] = useState('agenda');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const { user, loading } = useAuth();
  const { initializeUserData, clearUserData, setUserId } = useStore();

  const showLogoutConfirmRef = useRef(false);

  useEffect(() => {
    showLogoutConfirmRef.current = showLogoutConfirm;
  }, [showLogoutConfirm]);

  // ─────────────────────────────────────────────
  // Reacciona a cambios en el estado de autenticación
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    if (user) {
      // Primero seteamos el userId en el store ANTES de cualquier cosa
      // Esto garantiza que todas las acciones posteriores tengan userId disponible
      setUserId(user.uid);

      setIsInitializing(true);
      initializeUserData(user.uid)
        .finally(() => {
          setIsInitializing(false);
          setShowWelcome(true);
        });
    } else {
      clearUserData();
      setShowWelcome(false);
    }
  }, [user, loading]);

  // ─────────────────────────────────────────────
  // Botón de retroceso en Android
  // ─────────────────────────────────────────────
  useEffect(() => {
    let sub: any;
    CapacitorApp.addListener('backButton', () => {
      if (!user) {
        const overlays = Array.from(document.querySelectorAll('.fixed.inset-0'));
        if (overlays.length > 0) {
          const closeBtn = overlays[overlays.length - 1].querySelector('button');
          if (closeBtn) closeBtn.click();
          return;
        }
        CapacitorApp.exitApp();
        return;
      }

      const backEvent = new CustomEvent('backbutton_pressed', { cancelable: true });
      window.dispatchEvent(backEvent);
      if (backEvent.defaultPrevented) return;

      if (showLogoutConfirmRef.current) {
        setShowLogoutConfirm(false);
        return;
      }

      const state = useStore.getState();
      if (state.lastDeleted) {
        state.clearLastDeleted();
        return;
      }

      const overlays = Array.from(document.querySelectorAll('.fixed.inset-0')).filter((el) => {
        const zIndex = parseInt(window.getComputedStyle(el).zIndex || '0');
        return (zIndex >= 40 || el.className.includes('bg-black')) &&
          window.getComputedStyle(el).display !== 'none';
      });

      if (overlays.length > 0) {
        const topmost = overlays[overlays.length - 1];
        const buttons = Array.from(topmost.querySelectorAll('button'));
        const closeBtn = buttons.find(b => {
          const t = b.textContent?.toLowerCase() || '';
          return t.includes('cancelar') || t.includes('cerrar') || b.querySelector('.lucide-x');
        });
        if (closeBtn) {
          closeBtn.click();
        } else if (buttons.length > 0) {
          buttons[0].click();
        }
        return;
      }

      setShowLogoutConfirm(true);
    }).then(s => sub = s);

    return () => { if (sub) sub.remove(); };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      setShowLogoutConfirm(false);
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'agenda': return <Agenda />;
      case 'finanzas': return <Finanzas />;
      case 'reportes': return <Reportes />;
      case 'clientes': return <Clientes />;
      case 'materiales': return <Materiales />;
      case 'perfil':
        // Le pasamos la función de logout al módulo de perfil
        return <Perfil onLogout={() => setShowLogoutConfirm(true)} />;
      default: return <Agenda />;
    }
  };

  // Firebase verificando sesión
  if (loading) {
    return (
      <div className="fixed inset-0 bg-brand-pink-light flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-white rounded-[28px] shadow-xl flex items-center justify-center border-4 border-brand-pink">
            <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
          </div>
          <p className="text-xs font-black text-brand-accent/50 uppercase tracking-widest">
            Cargando...
          </p>
        </div>
      </div>
    );
  }

  // Sin sesión
  if (!user) {
    return <AuthScreen onAuthenticated={() => {}} />;
  }

  // Cargando datos de Firestore
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-brand-pink-light flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-white rounded-[28px] shadow-xl flex items-center justify-center border-4 border-brand-pink">
            <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
          </div>
          <p className="text-xs font-black text-brand-accent/50 uppercase tracking-widest">
            Sincronizando datos...
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de bienvenida
  if (showWelcome) {
    return <Login onLogin={() => setShowWelcome(false)} />;
  }

  // App principal
  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
        <UndoToast />
      </Layout>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col items-center"
            >
              <div className="w-16 h-16 bg-brand-pink-light rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-brand-pink/50">
                <LogOut className="w-8 h-8 text-brand-accent" />
              </div>
              <h2 className="text-xl font-black text-brand-accent text-center mb-2 uppercase tracking-tighter">
                ¿Deseas cerrar sesión?
              </h2>
              <p className="text-xs font-bold text-slate-400 text-center mb-8 px-4 leading-relaxed">
                Tus datos están guardados en la nube. Puedes volver a ingresar cuando quieras.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-4 bg-brand-accent text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sí, salir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
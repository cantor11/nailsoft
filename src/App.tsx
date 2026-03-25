/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { useStore } from './store/useStore';
import { NotificationService } from './services/notificationService';
import { App as CapacitorApp } from '@capacitor/app';
import { LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [activeTab, setActiveTab] = useState('agenda');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { checkStock } = useStore();

  const showLogoutConfirmRef = useRef(false);
  const isLoggedInRef = useRef(isLoggedIn);

  useEffect(() => {
    showLogoutConfirmRef.current = showLogoutConfirm;
  }, [showLogoutConfirm]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    NotificationService.requestPermission();
    checkStock();
  }, [checkStock]);

  useEffect(() => {
    let sub: any;
    CapacitorApp.addListener('backButton', () => {
      // 1. Modales de Login (cuando no está logueado)
      if (!isLoggedInRef.current) {
        const loginOverlays = Array.from(document.querySelectorAll('.fixed.inset-0'));
        if (loginOverlays.length > 0) {
          const closeBtn = loginOverlays[loginOverlays.length - 1].querySelector('button');
          if (closeBtn) closeBtn.click();
          return;
        }
        CapacitorApp.exitApp();
        return;
      }

      // Emitir evento cancelable para que sub-vistas puedan consumirlo
      const backEvent = new CustomEvent('backbutton_pressed', { cancelable: true });
      window.dispatchEvent(backEvent);

      // Si alguna sub-vista consumió el evento, no seguir
      if (backEvent.defaultPrevented) return;

      // 2. Si el modal de logout ya está abierto, lo cerramos
      if (showLogoutConfirmRef.current) {
        setShowLogoutConfirm(false);
        return;
      }

      // 3. Comprobar UndoToast
      const state = useStore.getState();
      if (state.lastDeleted) {
        state.clearLastDeleted();
        return;
      }

      // 4. Comprobar si hay modales o vistas abiertas
      const overlays = Array.from(document.querySelectorAll('.fixed.inset-0')).filter((el) => {
        const zIndex = parseInt(window.getComputedStyle(el).zIndex || '0');
        return (zIndex >= 40 || el.className.includes('bg-black')) && window.getComputedStyle(el).display !== 'none';
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

      // 5. Mostrar modal de logout
      setShowLogoutConfirm(true);
    }).then(s => sub = s);

    return () => {
      if (sub) sub.remove();
    };
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'agenda':
        return <Agenda />;
      case 'finanzas':
        return <Finanzas />;
      case 'reportes':
        return <Reportes />;
      case 'clientes':
        return <Clientes />;
      case 'materiales':
        return <Materiales />;
      case 'perfil':
        return <Perfil />;
      default:
        return <Agenda />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

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
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col items-center"
            >
              <div className="w-16 h-16 bg-brand-pink-light rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-brand-pink/50">
                <LogOut className="w-8 h-8 text-brand-accent" />
              </div>

              <h2 className="text-xl font-black text-brand-accent text-center mb-2 uppercase tracking-tighter">
                ¿Deseas cerrar sesión?
              </h2>
              <p className="text-xs font-bold text-slate-400 text-center mb-8 px-4 leading-relaxed">
                Tendrás que volver a ingresar para acceder a tu información.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-4 bg-brand-accent text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-accent/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
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

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, Star, Settings, Fingerprint, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const BIOMETRIC_PREF_KEY = 'biometric_enabled';

const MOTIVATIONAL_PHRASES = [
  "Tus uñas son el reflejo de tu alma.",
  "Unas uñas perfectas, una actitud imparable.",
  "La belleza comienza en tus manos.",
  "Haz brillar tu mundo, una uña a la vez.",
  "Tus manos cuentan tu historia, hazla hermosa.",
  "El esmalte es el accesorio que nunca pasa de moda.",
  "Uñas impecables, confianza absoluta.",
  "Cuida tus manos, son tu mejor carta de presentación.",
  "La perfección está en los detalles.",
  "Tus uñas son joyas, trátalas como tal.",
  "El arte no tiene límites, y tus uñas son el lienzo.",
  "Brilla con luz propia y uñas radiantes.",
  "Tus manos son herramientas de creación, embellécelas.",
  "La elegancia se nota en la punta de los dedos.",
  "Un toque de color puede cambiar tu día.",
  "Sé la mejor versión de ti misma, empezando por tus manos.",
  "Tus uñas son el toque final de tu estilo.",
  "La paciencia es la clave de una manicura perfecta.",
  "Ama tus manos, cuida tu esencia.",
  "Cada uña es una oportunidad para brillar.",
  "El cuidado personal no es un lujo, es una necesidad.",
  "Tus manos hablan por ti, haz que digan cosas hermosas.",
  "La magia está en tus dedos.",
  "Uñas fuertes, mujer poderosa.",
  "El color de tus uñas define tu estado de ánimo.",
  "Haz que cada día cuente, y que tus uñas luzcan increíbles.",
  "La belleza está en la simplicidad de una buena manicura.",
  "Tus manos son el puente hacia el mundo, cuídalas.",
  "Unas uñas cuidadas son el secreto de la elegancia.",
  "Expresa tu creatividad a través de tus manos.",
  "Tus uñas son pequeñas obras de arte.",
  "La confianza se construye detalle a detalle.",
  "Manos hermosas, mente positiva.",
  "El esmalte es la sonrisa de tus manos.",
  "Tus uñas merecen lo mejor.",
  "La delicadeza de tus manos es tu mayor fortaleza.",
  "Brilla hoy, mañana y siempre.",
  "Tus manos son el reflejo de tu cuidado personal.",
  "Unas uñas perfectas son el mejor regalo que te puedes dar.",
  "La sofisticación empieza en tus dedos.",
  "Tus manos son únicas, hazlas lucir espectaculares.",
  "El arte de la manicura es el arte de amarse a uno mismo.",
  "Uñas radiantes para una vida brillante.",
  "Tus manos son el espejo de tu bienestar.",
  "La belleza es una actitud, y tus uñas la refuerzan.",
  "Cada detalle cuenta, especialmente en tus manos.",
  "Tus uñas son el accesorio perfecto para cualquier ocasión.",
  "La armonía comienza en tus manos.",
  "Sé audaz, sé creativa, sé tú misma.",
  "Tus manos son el toque de distinción que necesitas."
];

const DoodleBackground = () => (
  <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="doodles" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          {/* Nail Polish Bottle */}
          <path d="M20 40 h10 v20 h-10 z M22 35 h6 v5 h-6 z" fill="currentColor" />
          {/* Heart */}
          <path d="M50 20 c-5-5-10 0-10 5 s10 10 10 10 s10-5 10-10 s-5-10-10-5" fill="currentColor" />
          {/* Star */}
          <path d="M80 30 l2 5 h5 l-4 3 l2 5 l-5-3 l-5 3 l2-5 l-4-3 h5 z" fill="currentColor" />
          {/* Nail File */}
          <rect x="10" y="70" width="30" height="4" rx="2" fill="currentColor" />
          {/* Sparkle */}
          <circle cx="70" cy="70" r="2" fill="currentColor" />
          <path d="M70 65 v10 M65 70 h10" stroke="currentColor" strokeWidth="1" />
          {/* Brush */}
          <path d="M40 80 l5-10 h5 l-5 10 z" fill="currentColor" />
          <rect x="45" y="65" width="2" height="10" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#doodles)" />
    </svg>
  </div>
);

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { businesses, activeBusinessId } = useStore();
  const [phrase, setPhrase] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);

  const activeBusiness = businesses.find(b => b.id === activeBusinessId) || businesses[0];

  // Check biometric availability and saved preference
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length);
    setPhrase(MOTIVATIONAL_PHRASES[randomIndex]);

    const initBiometric = async () => {
      // Check if biometric hardware is available
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await NativeBiometric.isAvailable();
          setBiometricAvailable(result.isAvailable);
        } catch {
          setBiometricAvailable(false);
        }
      }

      // Load saved preference
      try {
        const { value } = await Preferences.get({ key: BIOMETRIC_PREF_KEY });
        if (value === 'true') {
          setBiometricEnabled(true);
        }
      } catch {
        // Preferences not available (web environment)
      }

      setBiometricChecked(true);
    };

    initBiometric();
  }, []);

  // Auto-trigger biometric verification if enabled
  const attemptBiometricLogin = useCallback(async () => {
    if (!biometricEnabled || !biometricAvailable || !Capacitor.isNativePlatform()) return;

    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Inicia sesión con tu huella',
        title: 'Autenticación',
        subtitle: activeBusiness?.nombre || 'Nail Studio',
        description: 'Coloca tu huella para ingresar',
      });
      // If verification succeeds, log in
      onLogin();
    } catch (err) {
      console.log('Biometric verification cancelled or failed:', err);
      // User cancelled or failed — they can still tap "Ingresar"
    }
  }, [biometricEnabled, biometricAvailable, onLogin, activeBusiness]);

  useEffect(() => {
    if (biometricChecked && biometricEnabled && biometricAvailable) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        attemptBiometricLogin();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [biometricChecked, biometricEnabled, biometricAvailable, attemptBiometricLogin]);

  // Toggle biometric setting
  const toggleBiometric = async () => {
    const newValue = !biometricEnabled;

    if (biometricAvailable && Capacitor.isNativePlatform()) {
      try {
        await NativeBiometric.verifyIdentity({
          reason: newValue
            ? 'Verifica tu identidad para activar el acceso con huella'
            : 'Verifica tu identidad para desactivar el acceso con huella',
          title: newValue ? 'Activar Huella' : 'Desactivar Huella',
          subtitle: activeBusiness?.nombre || 'Nail Studio',
          description: newValue
            ? 'Coloca tu huella para confirmar la activación'
            : 'Coloca tu huella para confirmar la desactivación',
        });
      } catch {
        // Verification failed or was cancelled, don't change state
        return;
      }
    }

    setBiometricEnabled(newValue);
    try {
      await Preferences.set({ key: BIOMETRIC_PREF_KEY, value: String(newValue) });
    } catch {
      // Preferences not available
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-pink-light flex flex-col items-center justify-center p-8 text-center overflow-hidden">
      <DoodleBackground />

      {/* Settings Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center text-brand-accent/50 hover:text-brand-accent shadow-sm border border-brand-pink/50 active:scale-90 transition-all"
      >
        <Settings className="w-5 h-5" />
      </motion.button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 max-w-sm w-full"
      >
        <div className="mb-12 relative">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 5 }}
            className="w-24 h-24 bg-white rounded-[32px] shadow-xl mx-auto flex items-center justify-center border-4 border-brand-pink"
          >
            <Sparkles className="w-12 h-12 text-brand-accent" />
          </motion.div>
          <div className="absolute -top-4 -right-4">
            <Star className="w-8 h-8 text-brand-pink fill-brand-pink" />
          </div>
          <div className="absolute -bottom-4 -left-4">
            <Heart className="w-8 h-8 text-brand-pink fill-brand-pink" />
          </div>
        </div>

        <h1 className="text-4xl font-black text-brand-accent uppercase tracking-tighter mb-4 leading-none">
          {activeBusiness?.nombre.split(' ')[0]}<br />
          <span className="text-lg tracking-[0.3em] font-bold opacity-50">{activeBusiness?.nombre.split(' ').slice(1).join(' ') || 'Studio'}</span>
        </h1>

        <p className="text-xs font-bold text-brand-accent/60 uppercase tracking-widest mb-8">
          {activeBusiness?.descripcion}
        </p>

        <div className="bg-white/40 backdrop-blur-md p-8 rounded-[40px] border-2 border-brand-pink shadow-inner mb-12 min-h-[160px] flex items-center justify-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg font-black text-slate-700 italic leading-relaxed"
          >
            "{phrase}"
          </motion.p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              if (biometricEnabled && biometricAvailable && Capacitor.isNativePlatform()) {
                attemptBiometricLogin();
              } else {
                onLogin();
              }
            }}
            className="w-full py-5 bg-brand-accent text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-brand-accent/30 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            Ingresar
          </button>
        </div>
      </motion.div>

      <div className="absolute bottom-4 text-[10px] font-black text-brand-accent/40 uppercase tracking-widest">
        {activeBusiness?.nombre} ©2026 YOU CAN.
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl border border-brand-pink/30"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-pink rounded-xl flex items-center justify-center">
                    <Settings className="w-4 h-4 text-brand-accent" />
                  </div>
                  <h2 className="text-lg font-black text-brand-accent">Ajustes</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Biometric Toggle */}
              <div className="bg-brand-pink-light rounded-[24px] p-5 border border-brand-pink/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-brand-pink/30">
                    <Fingerprint className="w-6 h-6 text-brand-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Acceso con Huella</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {!Capacitor.isNativePlatform()
                        ? 'Solo disponible en la app'
                        : biometricAvailable
                          ? 'Ingresa rápidamente con biometría'
                          : 'Tu dispositivo no soporta biometría'
                      }
                    </p>
                  </div>

                  {/* Custom Switch */}
                  <button
                    onClick={toggleBiometric}
                    disabled={!biometricAvailable || !Capacitor.isNativePlatform()}
                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${biometricEnabled && biometricAvailable
                      ? 'bg-brand-accent shadow-md shadow-brand-accent/30'
                      : 'bg-slate-200'
                      } ${(!biometricAvailable || !Capacitor.isNativePlatform()) ? 'opacity-40' : 'active:scale-95'}`}
                  >
                    <motion.div
                      animate={{ x: biometricEnabled && biometricAvailable ? 24 : 2 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center"
                    >
                      {biometricEnabled && biometricAvailable && (
                        <ShieldCheck className="w-3 h-3 text-brand-accent" />
                      )}
                    </motion.div>
                  </button>
                </div>
              </div>

              {/* Info Text */}
              <p className="text-[10px] text-slate-400 text-center mt-4 font-medium leading-relaxed">
                Cuando está activado, podrás ingresar usando tu huella dactilar o rostro al abrir la app.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

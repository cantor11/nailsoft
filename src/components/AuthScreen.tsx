import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { signIn, signUp, signInWithGoogle } from '../firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Traduce los errores de Firebase al español
const getErrorMessage = (code: string): string => {
  const errors: Record<string, string> = {
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El formato del correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed': 'Error de conexión. Verifica tu internet.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  };
  return errors[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
};

// Ícono de Google SVG (no está en lucide-react)
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setShowPassword(false);
  };

  const switchMode = () => {
    clearForm();
    setMode(prev => prev === 'login' ? 'register' : 'login');
  };

  const handleEmailAuth = async () => {
    setError(null);

    // Validaciones básicas antes de llamar a Firebase
    if (!email || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setLoadingEmail(true);
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      onAuthenticated();
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    try {
      setLoadingGoogle(true);
      await signInWithGoogle();
      onAuthenticated();
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoadingGoogle(false);
    }
  };

  const isLoading = loadingEmail || loadingGoogle;

  return (
    <div className="fixed inset-0 bg-brand-pink-light flex flex-col items-center justify-center p-6 overflow-hidden">
      
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-accent rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-pink rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-[28px] shadow-xl mx-auto flex items-center justify-center border-4 border-brand-pink mb-4">
            <Sparkles className="w-10 h-10 text-brand-accent" />
          </div>
          <h1 className="text-3xl font-black text-brand-accent uppercase tracking-tighter">
            Nail Studio
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-brand-pink/30">

          {/* Botón de Google */}
          <button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-brand-pink bg-white font-black text-slate-600 text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 mb-6 shadow-sm"
          >
            {loadingGoogle
              ? <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
              : <GoogleIcon />
            }
            Continuar con Google
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-brand-pink" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">o</span>
            <div className="flex-1 h-px bg-brand-pink" />
          </div>

          {/* Formulario */}
          <div className="space-y-4">

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                className="w-full bg-brand-pink-light rounded-2xl py-4 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-brand-accent disabled:opacity-50 placeholder:text-slate-300 placeholder:font-medium"
              />
            </div>

            {/* Contraseña */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                className="w-full bg-brand-pink-light rounded-2xl py-4 pl-11 pr-12 text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-brand-accent disabled:opacity-50 placeholder:text-slate-300 placeholder:font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />
                }
              </button>
            </div>

            {/* Confirmar contraseña — solo en registro */}
            <AnimatePresence>
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                      className="w-full bg-brand-pink-light rounded-2xl py-4 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-brand-accent disabled:opacity-50 placeholder:text-slate-300 placeholder:font-medium"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mensaje de error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-500">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón principal */}
            <button
              onClick={handleEmailAuth}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-brand-accent shadow-lg shadow-brand-accent/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </div>
        </div>

        {/* Switch login/registro */}
        <div className="text-center mt-6">
          <p className="text-xs font-bold text-slate-400">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            {' '}
            <button
              onClick={switchMode}
              disabled={isLoading}
              className="text-brand-accent underline underline-offset-2 font-black"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
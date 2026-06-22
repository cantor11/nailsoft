import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useVoiceAppointment, VoiceAppointmentStatus } from '../hooks/useVoiceAppointment';
import { ExtractedAppointmentData } from '../services/groqService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceSchedulerProps {
  onClose: () => void;
  onExtracted: (data: ExtractedAppointmentData) => void;
}

const STATUS_CONFIG: Record<VoiceAppointmentStatus, { bgColor: string; icon: React.ReactNode; label: string }> = {
  idle: { bgColor: 'bg-brand-accent', icon: <Mic className="w-12 h-12 text-white" />, label: 'Toca para grabar' },
  recording: { bgColor: 'bg-red-500', icon: <MicOff className="w-12 h-12 text-white" />, label: 'Grabando...' },
  uploading: { bgColor: 'bg-amber-500', icon: <Loader2 className="w-10 h-10 text-white animate-spin" />, label: 'Subiendo...' },
  transcribing: { bgColor: 'bg-blue-500', icon: <Loader2 className="w-10 h-10 text-white animate-spin" />, label: 'Transcribiendo...' },
  processing: { bgColor: 'bg-purple-500', icon: <Sparkles className="w-10 h-10 text-white animate-pulse" />, label: 'Procesando...' },
  success: { bgColor: 'bg-emerald-500', icon: <Check className="w-12 h-12 text-white" />, label: '¡Listo!' },
  error: { bgColor: 'bg-red-500', icon: <AlertCircle className="w-12 h-12 text-white" />, label: 'Error' },
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceScheduler: React.FC<VoiceSchedulerProps> = ({
  onClose,
  onExtracted,
}) => {
  const {
    status,
    error,
    recordingDuration,
    isConfigured,
    assemblyAIConfigured,
    groqConfigured,
    extractedData,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  } = useVoiceAppointment();

  const isRecording = status === 'recording';
  const isProcessing = ['uploading', 'transcribing', 'processing'].includes(status);
  const isDone = status === 'success';
  const hasError = status === 'error';

  const handleMainAction = () => {
    if (status === 'idle' || hasError) {
      reset();
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  };

  const handleSuccessConfirm = () => {
    if (extractedData) {
      onExtracted(extractedData);
    }
    onClose();
  };

  if (!isConfigured) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">
              Agendar por Voz
            </h2>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-amber-700 text-sm mb-2">Configuración Requerida</p>
                <div className="space-y-1 text-xs text-amber-600 font-medium">
                  {!assemblyAIConfigured && (
                    <p>• AssemblyAI API Key no configurada</p>
                  )}
{!groqConfigured && (
                    <p>• Groq API Key no configurada</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
          >
            Cerrar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">
            Agendar por Voz
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {(status === 'idle' || hasError) && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-4"
            >
              <p className="text-xs text-slate-500 font-medium text-center mb-6 px-2">
                {hasError
                  ? `Error: ${error}`
                  : 'Dicta los datos. Ejemplo: "Laura Estévez, próximo martes 3pm, uñas acrílicas"'}
              </p>

              <button
                onClick={handleMainAction}
                className={cn(
                  'w-24 h-24 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform',
                  STATUS_CONFIG[hasError ? 'error' : 'idle'].bgColor
                )}
              >
                {STATUS_CONFIG[hasError ? 'error' : 'idle'].icon}
              </button>

              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">
                {hasError ? 'Toca para reintentar' : 'Toca para grabar'}
              </p>
            </motion.div>
          )}

          {isRecording && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-4"
            >
              <div className="w-24 h-24 bg-red-500 rounded-full shadow-xl flex items-center justify-center animate-pulse">
                <MicOff className="w-12 h-12 text-white" />
              </div>

              <p className="text-3xl font-black text-slate-700 mt-6 tabular-nums">
                {formatDuration(recordingDuration)}
              </p>

              <p className="text-xs font-black text-red-500 uppercase tracking-widest mt-2 animate-pulse">
                {STATUS_CONFIG.recording.label}
              </p>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={cancelRecording}
                  className="px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMainAction}
                  className="px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg"
                >
                  Detener
                </button>
              </div>
            </motion.div>
          )}

          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-4"
            >
              <div className="w-20 h-20 bg-brand-pink-light rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
              </div>

              <p className="text-sm font-bold text-slate-600 mt-6">
                {STATUS_CONFIG[status].label}
              </p>

              <div className="w-48 h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-brand-accent rounded-full animate-pulse"
                  style={{ width: status === 'uploading' ? '30%' : status === 'transcribing' ? '60%' : '90%' }}
                />
              </div>
            </motion.div>
          )}

          {isDone && extractedData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 text-center">
                <p className="text-xs font-black text-emerald-600">
                  ✓ ¡Información extraída!
                </p>
              </div>

              <div className="space-y-2 text-sm">
                {extractedData.clientName && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Cliente:</span>
                    <span className="font-bold text-slate-700">{extractedData.clientName}</span>
                  </div>
                )}
                {extractedData.serviceName && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Servicio:</span>
                    <span className="font-bold text-slate-700">{extractedData.serviceName}</span>
                  </div>
                )}
                {extractedData.date && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Fecha:</span>
                    <span className="font-bold text-slate-700">{extractedData.date}</span>
                  </div>
                )}
                {extractedData.time && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Hora:</span>
                    <span className="font-bold text-slate-700">{extractedData.time}</span>
                  </div>
                )}
                {extractedData.workerName && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Trabajador:</span>
                    <span className="font-bold text-slate-700">{extractedData.workerName}</span>
                  </div>
                )}
                {extractedData.locationType && (
                  <div className="flex justify-between bg-brand-pink-light rounded-xl px-4 py-2">
                    <span className="text-slate-400 font-medium">Tipo:</span>
                    <span className="font-bold text-slate-700">{extractedData.locationType}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={reset}
                  className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100"
                >
                  Nuevagrabación
                </button>
                <button
                  onClick={handleSuccessConfirm}
                  className="flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
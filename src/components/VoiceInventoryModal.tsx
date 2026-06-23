import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, Volume2 } from 'lucide-react';
import { useVoiceInventorySearch, VoiceInventorySearchStatus } from '../hooks/useVoiceInventorySearch';
import { Material } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceInventoryModalProps {
  onClose: () => void;
}

export const VoiceInventoryModal: React.FC<VoiceInventoryModalProps> = ({ onClose }) => {
  const {
    status,
    error,
    transcript,
    recordingDuration,
    foundMaterial,
    extractedData,
    startRecording,
    stopRecording,
    reset,
    speakMessage,
  } = useVoiceInventorySearch();

  const isRecording = status === 'recording';
  const isProcessing = ['uploading', 'transcribing', 'processing'].includes(status);
  const isDone = status === 'found' || status === 'not_found';
  const hasError = status === 'error';
  const isIdle = status === 'idle' || hasError;
  const isFound = status === 'found';
  const isNotFound = status === 'not_found';

  const totalServiciosDisponibles = foundMaterial 
    ? (foundMaterial.unidades * foundMaterial.cantidadServicios) - (foundMaterial.serviciosConsumidosAcumulados || 0)
    : 0;
  const isLowStock = foundMaterial 
    ? foundMaterial.tipoAlerta === 'unidades' 
      ? foundMaterial.unidades <= foundMaterial.alertaStock 
      : totalServiciosDisponibles <= foundMaterial.alertaStock
    : false;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMainAction = useCallback(() => {
    if (status === 'idle' || hasError) {
      reset();
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  }, [status, hasError, isRecording, reset, startRecording, stopRecording]);

  const handleNewSearch = useCallback(() => {
    reset();
  }, [reset]);

  const handleSpeakAgain = useCallback(() => {
    if (foundMaterial) {
      speakMessage(`Quedan ${foundMaterial.unidades} unidades de ${foundMaterial.nombre}`);
    } else if (extractedData?.materialName) {
      speakMessage(`El material ${extractedData.materialName} no se encuentra en el inventario`);
    }
  }, [foundMaterial, extractedData, speakMessage]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">
            Buscar Stock
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center py-4">
          {isIdle && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-slate-500 font-medium text-center mb-6 px-2">
                {hasError
                  ? `Error: ${error}`
                  : 'Di el material. Ejemplo: "¿Cuánto esmalte rojo queda?"'}
              </p>

              <button
                onClick={handleMainAction}
                className={cn(
                  'w-24 h-24 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform',
                  hasError ? 'bg-red-500' : 'bg-brand-accent'
                )}
              >
                <Mic className="w-12 h-12 text-white" />
              </button>

              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">
                {hasError ? 'Toca para reintentar' : 'Toca para grabar'}
              </p>
            </div>
          )}

          {isRecording && (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-red-500 rounded-full shadow-xl flex items-center justify-center animate-pulse">
                <Mic className="w-12 h-12 text-white" />
              </div>

              <p className="text-3xl font-black text-slate-700 mt-6 tabular-nums">
                {formatDuration(recordingDuration)}
              </p>

              <p className="text-xs font-black text-red-500 uppercase tracking-widest mt-2 animate-pulse">
                Grabando...
              </p>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleNewSearch}
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
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center py-4">
              <div className="w-20 h-20 bg-brand-pink-light rounded-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
              </div>

              <p className="text-sm font-bold text-slate-600 mt-6">
                {status === 'uploading' ? 'Subiendo...' :
                 status === 'transcribing' ? 'Transcribiendo...' : 'Buscando en inventario...'}
              </p>

              {transcript && (
                <p className="text-xs text-slate-400 mt-2 italic px-4 text-center">
                  "{transcript}"
                </p>
              )}
            </div>
          )}

          {isFound && foundMaterial && (
            <div className="space-y-4 w-full">
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 text-center">
                <p className="text-xs font-black text-emerald-600">
                  ¡Material encontrado!
                </p>
              </div>

              <div className={cn(
                "bg-white p-4 rounded-3xl border flex items-center gap-4",
                isLowStock ? "border-rose-400 shadow-lg shadow-rose-200/50" : "border-brand-pink/50"
              )}>
                <div className="relative">
                  <div className="w-16 h-16 bg-brand-pink-light rounded-2xl flex items-center justify-center text-brand-accent overflow-hidden">
                    {foundMaterial.imagen ? (
                      <img src={foundMaterial.imagen} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  {isLowStock && (
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg animate-bounce">
                      <span className="text-[10px]">⚠️</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{foundMaterial.nombre}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md",
                      isLowStock ? "bg-rose-100 text-rose-600" : "bg-brand-pink/30 text-brand-accent"
                    )}>
                      Stock: {foundMaterial.unidades} und.
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      Rinde: {totalServiciosDisponibles} usos
                    </span>
                  </div>
                </div>
                <span className="text-lg font-black text-brand-accent">
                  ${foundMaterial.precio.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSpeakAgain}
                  className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100 flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  Escuchar
                </button>
                <button
                  onClick={handleNewSearch}
                  className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
                >
                  Nueva búsqueda
                </button>
              </div>
            </div>
          )}

          {isNotFound && (
            <div className="space-y-4 w-full">
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📦</span>
                </div>
                <p className="text-sm font-bold text-slate-600 mb-1">
                  Material no encontrado
                </p>
                <p className="text-xs text-slate-400">
                  "{extractedData?.materialName}" no existe en el inventario
                </p>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSpeakAgain}
                  className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100 flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  Escuchar
                </button>
                <button
                  onClick={handleNewSearch}
                  className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
                >
                  Nueva búsqueda
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
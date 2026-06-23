import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Calendar, FileText, X, ChevronRight, Package } from 'lucide-react';
import { useVoiceAppointment, VoiceAppointmentStatus } from '../hooks/useVoiceAppointment';
import { useVoiceAgendaSearch } from '../hooks/useVoiceAgendaSearch';
import { useVoiceInventorySearch } from '../hooks/useVoiceInventorySearch';
import { VoiceInventorySearch } from './VoiceInventorySearch';
import { ExtractedAppointmentData } from '../services/groqService';
import { Appointment, Client, Material } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AssistantMode = 'select' | 'schedule' | 'search' | 'inventory';

interface VoiceAssistantProps {
  onClose: () => void;
  appointments: Appointment[];
  clients: Client[];
  businessId: string | null;
  onScheduleExtracted: (data: ExtractedAppointmentData) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onClose,
  appointments,
  clients,
  businessId,
  onScheduleExtracted,
}) => {
  const [mode, setMode] = useState<AssistantMode>('select');

  const {
    status: scheduleStatus,
    error: scheduleError,
    recordingDuration: scheduleRecordingDuration,
    extractedData,
    startRecording: startScheduleRecording,
    stopRecording: stopScheduleRecording,
    reset: resetSchedule,
  } = useVoiceAppointment();

  const {
    status: searchStatus,
    error: searchError,
    recordingDuration: searchRecordingDuration,
    appointments: searchAppointments,
    totalCount: searchTotalCount,
    targetDateLabel,
    startRecording: startSearchRecording,
    stopRecording: stopSearchRecording,
    reset: resetSearch,
    speakAgenda,
  } = useVoiceAgendaSearch(appointments, clients, businessId);

  const {
    status: inventoryStatus,
    error: inventoryError,
    recordingDuration: inventoryRecordingDuration,
    transcript: inventoryTranscript,
    foundMaterial,
    extractedData: inventoryExtractedData,
    startRecording: startInventoryRecording,
    stopRecording: stopInventoryRecording,
    reset: resetInventory,
    speakMessage: speakInventoryMessage,
  } = useVoiceInventorySearch();

  const handleModeSelect = (selectedMode: 'schedule' | 'search' | 'inventory') => {
    setMode(selectedMode);
  };

  const handleBack = () => {
    if (mode === 'select') {
      onClose();
    } else {
      if (mode === 'schedule') {
        resetSchedule();
      } else if (mode === 'search') {
        resetSearch();
      } else {
        resetInventory();
      }
      setMode('select');
    }
  };

  const handleScheduleConfirm = () => {
    if (extractedData) {
      onScheduleExtracted(extractedData);
    }
    onClose();
  };

  const handleSearchSpeakAgain = () => {
    speakAgenda();
  };

  const handleSearchReset = () => {
    resetSearch();
  };

  const handleInventoryReset = () => {
    resetInventory();
  };

  const handleInventorySpeakAgain = () => {
    if (foundMaterial) {
      speakInventoryMessage(`Quedan ${foundMaterial.unidades} unidades de ${foundMaterial.nombre}`);
    } else if (inventoryExtractedData?.materialName) {
      speakInventoryMessage(`El material ${inventoryExtractedData.materialName} no se encuentra en el inventario`);
    }
  };

  const isScheduleRecording = scheduleStatus === 'recording';
  const isScheduleProcessing = ['uploading', 'transcribing', 'processing'].includes(scheduleStatus);
  const isScheduleDone = scheduleStatus === 'success';
  const isScheduleError = scheduleStatus === 'error';

  const isSearchRecording = searchStatus === 'recording';
  const isSearchProcessing = ['uploading', 'transcribing', 'processing'].includes(searchStatus);
  const isSearchDone = searchStatus === 'success' || searchStatus === 'no_appointments';
  const isSearchError = searchStatus === 'error';

  const isInventoryRecording = inventoryStatus === 'recording';
  const isInventoryProcessing = ['uploading', 'transcribing', 'processing'].includes(inventoryStatus);
  const isInventoryDone = inventoryStatus === 'found' || inventoryStatus === 'not_found';
  const isInventoryError = inventoryStatus === 'error';

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
            Asistente de Voz
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              <p className="text-xs text-slate-500 font-medium text-center mb-6">
                ¿Qué deseas hacer?
              </p>

              <button
                onClick={() => handleModeSelect('schedule')}
                className="w-full flex items-center justify-between p-4 bg-brand-pink-light rounded-2xl border-2 border-brand-pink/30 hover:border-brand-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-700">Agendar Cita</p>
                    <p className="text-[10px] text-slate-400">Crear nueva cita por voz</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-accent transition-colors" />
              </button>

              <button
                onClick={() => handleModeSelect('search')}
                className="w-full flex items-center justify-between p-4 bg-brand-pink-light rounded-2xl border-2 border-brand-pink/30 hover:border-brand-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-700">Consultar Agenda</p>
                    <p className="text-[10px] text-slate-400">Ver citas de un día</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-accent transition-colors" />
              </button>

              <button
                onClick={() => handleModeSelect('inventory')}
                className="w-full flex items-center justify-between p-4 bg-brand-pink-light rounded-2xl border-2 border-brand-pink/30 hover:border-brand-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-700">Consultar Stock</p>
                    <p className="text-[10px] text-slate-400">Buscar material por voz</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-accent transition-colors" />
              </button>
            </motion.div>
          )}

          {mode === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={handleBack}
                className="text-xs text-slate-400 font-medium mb-4 flex items-center gap-1"
              >
                ← Volver
              </button>

              <ScheduleContent
                status={scheduleStatus}
                error={scheduleError}
                recordingDuration={scheduleRecordingDuration}
                extractedData={extractedData}
                isRecording={isScheduleRecording}
                isProcessing={isScheduleProcessing}
                isDone={isScheduleDone}
                hasError={isScheduleError}
                onMainAction={() => {
                  if (scheduleStatus === 'idle' || isScheduleError) {
                    resetSchedule();
                    startScheduleRecording();
                  } else if (isScheduleRecording) {
                    stopScheduleRecording();
                  }
                }}
                onCancel={resetSchedule}
                onConfirm={handleScheduleConfirm}
                formatDuration={formatDuration}
              />
            </motion.div>
          )}

          {mode === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={handleBack}
                className="text-xs text-slate-400 font-medium mb-4 flex items-center gap-1"
              >
                ← Volver
              </button>

              <SearchContent
                status={searchStatus}
                error={searchError}
                recordingDuration={searchRecordingDuration}
                appointments={searchAppointments}
                totalCount={searchTotalCount}
                targetDateLabel={targetDateLabel}
                isRecording={isSearchRecording}
                isProcessing={isSearchProcessing}
                isDone={isSearchDone}
                hasError={isSearchError}
                onMainAction={() => {
                  if (searchStatus === 'idle' || isSearchError) {
                    resetSearch();
                    startSearchRecording();
                  } else if (isSearchRecording) {
                    stopSearchRecording();
                  }
                }}
                onCancel={resetSearch}
                onSpeakAgain={handleSearchSpeakAgain}
                onNewSearch={handleSearchReset}
                formatDuration={formatDuration}
              />
            </motion.div>
          )}

          {mode === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={handleBack}
                className="text-xs text-slate-400 font-medium mb-4 flex items-center gap-1"
              >
                ← Volver
              </button>

              <VoiceInventorySearch
                status={inventoryStatus}
                error={inventoryError}
                transcript={inventoryTranscript}
                recordingDuration={inventoryRecordingDuration}
                foundMaterial={foundMaterial}
                extractedMaterialName={inventoryExtractedData?.materialName || null}
                isRecording={isInventoryRecording}
                isProcessing={isInventoryProcessing}
                isDone={isInventoryDone}
                hasError={isInventoryError}
                onMainAction={() => {
                  if (inventoryStatus === 'idle' || isInventoryError) {
                    resetInventory();
                    startInventoryRecording();
                  } else if (isInventoryRecording) {
                    stopInventoryRecording();
                  }
                }}
                onCancel={resetInventory}
                onNewSearch={handleInventoryReset}
                onSpeakAgain={handleInventorySpeakAgain}
                formatDuration={formatDuration}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

interface ScheduleContentProps {
  status: VoiceAppointmentStatus;
  error: string | null;
  recordingDuration: number;
  extractedData: ExtractedAppointmentData | null;
  isRecording: boolean;
  isProcessing: boolean;
  isDone: boolean;
  hasError: boolean;
  onMainAction: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  formatDuration: (s: number) => string;
}

const ScheduleContent: React.FC<ScheduleContentProps> = ({
  status,
  error,
  recordingDuration,
  extractedData,
  isRecording,
  isProcessing,
  isDone,
  hasError,
  onMainAction,
  onCancel,
  onConfirm,
  formatDuration,
}) => {
  const isIdle = status === 'idle' || hasError;

  return (
    <div className="flex flex-col items-center py-4">
      {(isIdle) && (
        <div className="flex flex-col items-center">
          <p className="text-xs text-slate-500 font-medium text-center mb-6 px-2">
            {hasError
              ? `Error: ${error}`
              : 'Dicta los datos. Ejemplo: "Laura Estévez, martes 3pm, uñas acrílicas"'}
          </p>

          <button
            onClick={onMainAction}
            className={cn(
              'w-24 h-24 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform',
              hasError ? 'bg-red-500' : 'bg-purple-500'
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
              onClick={onCancel}
              className="px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={onMainAction}
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
             status === 'transcribing' ? 'Transcribiendo...' : 'Procesando...'}
          </p>
        </div>
      )}

      {isDone && extractedData && (
        <div className="space-y-4 w-full">
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
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100"
            >
              Nuevagrabación
            </button>
            <button
              onClick={onConfirm}
              className="flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface SearchContentProps {
  status: VoiceAgendaSearchStatus;
  error: string | null;
  recordingDuration: number;
  appointments: Array<{ hora: string; clientName: string }>;
  totalCount: number;
  targetDateLabel: string;
  isRecording: boolean;
  isProcessing: boolean;
  isDone: boolean;
  hasError: boolean;
  onMainAction: () => void;
  onCancel: () => void;
  onSpeakAgain: () => void;
  onNewSearch: () => void;
  formatDuration: (s: number) => string;
}

type VoiceAgendaSearchStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'processing' | 'success' | 'no_appointments' | 'error';

const SearchContent: React.FC<SearchContentProps> = ({
  status,
  error,
  recordingDuration,
  appointments,
  totalCount,
  targetDateLabel,
  isRecording,
  isProcessing,
  isDone,
  hasError,
  onMainAction,
  onCancel,
  onSpeakAgain,
  onNewSearch,
  formatDuration,
}) => {
  const isIdle = status === 'idle' || hasError;
  const isNoAppointments = status === 'no_appointments';

  return (
    <div className="flex flex-col items-center py-4">
      {isIdle && (
        <div className="flex flex-col items-center">
          <p className="text-xs text-slate-500 font-medium text-center mb-6 px-2">
            {hasError
              ? `Error: ${error}`
              : 'Di el día. Ejemplo: "¿citas de hoy?" o "agenda del 25 de junio"'}
          </p>

          <button
            onClick={onMainAction}
            className={cn(
              'w-24 h-24 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform',
              hasError ? 'bg-red-500' : 'bg-blue-500'
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
              onClick={onCancel}
              className="px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={onMainAction}
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
             status === 'transcribing' ? 'Transcribiendo...' : 'Procesando...'}
          </p>
        </div>
      )}

      {isDone && (
        <div className="space-y-4 w-full">
          <div className={cn(
            "border rounded-3xl p-6 text-center",
            isNoAppointments ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-200"
          )}>
            {!isNoAppointments && (
              <p className="text-4xl font-black text-brand-accent mb-1">
                {totalCount}
              </p>
            )}
            <p className={cn(
              "text-xs font-black",
              isNoAppointments ? "text-slate-600" : "text-emerald-600"
            )}>
              {isNoAppointments
                ? `Sin citas para ${targetDateLabel}`
                : `${totalCount === 1 ? 'cita' : 'citas'} para ${targetDateLabel}`}
            </p>
          </div>

          {!isNoAppointments && appointments.length > 0 && (
            <div className="space-y-2">
              {appointments.map((app, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-brand-pink-light rounded-xl px-4 py-3"
                >
                  <span className="text-xs font-black text-brand-accent w-12">{app.hora}</span>
                  <span className="text-sm font-bold text-slate-700">{app.clientName}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={onSpeakAgain}
              className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100 flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Escuchar
            </button>
            <button
              onClick={onNewSearch}
              className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100"
            >
              Nueva búsqueda
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
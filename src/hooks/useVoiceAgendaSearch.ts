import { useState, useRef, useCallback, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAssemblyAIService } from '../services/assemblyAI';
import { getAgendaVoiceService, ExtractedAgendaData, AgendaExtractionResult } from '../services/agendaVoiceService';
import { getTTSService } from '../services/ttsService';
import { Appointment } from '../types';

export type VoiceAgendaSearchStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'processing'
  | 'success'
  | 'no_appointments'
  | 'error';

export interface VoiceAgendaSearchState {
  status: VoiceAgendaSearchStatus;
  transcript: string;
  extractedData: ExtractedAgendaData | null;
  extractionResult: AgendaExtractionResult | null;
  appointments: Array<{ hora: string; clientName: string }>;
  totalCount: number;
  targetDateLabel: string;
  error: string | null;
  recordingDuration: number;
  isConfigured: boolean;
  assemblyAIConfigured: boolean;
  groqConfigured: boolean;
  ttsAvailable: boolean;
}

export interface UseVoiceAgendaSearchReturn extends VoiceAgendaSearchState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  reset: () => void;
  speakAgenda: () => Promise<void>;
}

const INITIAL_STATE: VoiceAgendaSearchState = {
  status: 'idle',
  transcript: '',
  extractedData: null,
  extractionResult: null,
  appointments: [],
  totalCount: 0,
  targetDateLabel: '',
  error: null,
  recordingDuration: 0,
  isConfigured: false,
  assemblyAIConfigured: false,
  groqConfigured: false,
  ttsAvailable: false,
};

export function useVoiceAgendaSearch(
  appointments: Appointment[],
  clients: { id: string; nombre: string }[],
  businessId: string | null
): UseVoiceAgendaSearchReturn {
  const [state, setState] = useState<VoiceAgendaSearchState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const assemblyAIService = getAssemblyAIService();
  const agendaVoiceService = getAgendaVoiceService();
  const ttsService = getTTSService();

  useEffect(() => {
    const assemblyConfigured = assemblyAIService !== null;
    const groqConfigured = agendaVoiceService.isConfigured();
    const ttsAvailable = ttsService.isAvailable();

    setState(prev => ({
      ...prev,
      assemblyAIConfigured: assemblyConfigured,
      groqConfigured: groqConfigured,
      ttsAvailable: ttsAvailable,
      isConfigured: assemblyConfigured && groqConfigured,
    }));
  }, [assemblyAIService, agendaVoiceService, ttsService]);

  const updateState = useCallback((updates: Partial<VoiceAgendaSearchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const getTargetDateLabel = (targetDate: 'today' | 'tomorrow' | 'specific_date', specificDate?: string): string => {
    const today = new Date();

    if (targetDate === 'today') {
      return format(today, "EEEE d 'de' MMMM", { locale: es });
    }

    if (targetDate === 'tomorrow') {
      return format(addDays(today, 1), "EEEE d 'de' MMMM", { locale: es });
    }

    if (targetDate === 'specific_date' && specificDate) {
      try {
        const date = parseISO(specificDate);
        if (!isNaN(date.getTime())) {
          return format(date, "EEEE d 'de' MMMM", { locale: es });
        }
      } catch {
        return specificDate;
      }
    }

    return 'la fecha especificada';
  };

  const queryAppointments = useCallback((
    targetDate: 'today' | 'tomorrow' | 'specific_date',
    specificDate?: string
  ): Array<{ hora: string; clientName: string }> => {
    const today = new Date();
    let targetDateStr: string;

    if (targetDate === 'today') {
      targetDateStr = format(today, 'yyyy-MM-dd');
    } else if (targetDate === 'tomorrow') {
      targetDateStr = format(addDays(today, 1), 'yyyy-MM-dd');
    } else if (targetDate === 'specific_date' && specificDate) {
      targetDateStr = specificDate;
    } else {
      return [];
    }

    const filteredAppointments = appointments
      .filter(app =>
        app.businessId === businessId &&
        app.fecha === targetDateStr
      )
      .sort((a, b) => a.hora.localeCompare(b.hora));

    return filteredAppointments.map(app => {
      const client = clients.find(c => c.id === app.clientId);
      return {
        hora: app.hora,
        clientName: client?.nombre || 'Cliente sin nombre',
      };
    });
  }, [appointments, clients, businessId]);

  const speakAgenda = useCallback(async (): Promise<void> => {
    if (!ttsService.isAvailable()) {
      console.warn('TTS no disponible');
      return;
    }

    if (state.totalCount === 0) {
      const dayLabel = state.targetDateLabel || 'ese día';
      await ttsService.speak(`No tienes citas programadas para ${dayLabel}`, 0.9);
      return;
    }

    let message = `Para ${state.targetDateLabel} tienes ${state.totalCount} ${state.totalCount === 1 ? 'cita' : 'citas'} programadas: `;

    const appointmentList = state.appointments.map(app => {
      const hour12 = format(new Date(`2000-01-01T${app.hora}`), 'h:mm a');
      return `a las ${hour12} ${app.clientName}`;
    });

    message += appointmentList.join(', ');

    try {
      await ttsService.speak(message, 0.9);
    } catch (err) {
      console.error('Error al reproducir mensaje de voz:', err);
    }
  }, [ttsService, state.totalCount, state.targetDateLabel, state.appointments]);

  const startRecording = useCallback(async () => {
    if (state.status === 'recording') return;

    if (!assemblyAIService) {
      updateState({
        status: 'error',
        error: 'AssemblyAI no está configurado. Agrega VITE_ASSEMBLYAI_API_KEY a tu archivo .env',
      });
      return;
    }

    if (!agendaVoiceService.isConfigured()) {
      updateState({
        status: 'error',
        error: 'Groq API no está configurada. Agrega VITE_GROQ_API_KEY a tu archivo .env',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        updateState({ recordingDuration: elapsed });
      }, 100);

      updateState({
        status: 'recording',
        error: null,
        transcript: '',
        extractedData: null,
        extractionResult: null,
        appointments: [],
        totalCount: 0,
        targetDateLabel: '',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error al acceder al micrófono';
      updateState({ status: 'error', error });
    }
  }, [state.status, updateState, assemblyAIService, agendaVoiceService]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || state.status !== 'recording') return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
        });

        updateState({ status: 'uploading' });

        try {
          const transcription = await assemblyAIService!.transcribeAudioFile(
            audioBlob,
            (status) => {
              if (status.includes('Subiendo')) updateState({ status: 'uploading' });
              else if (status.includes('Transcribiendo')) updateState({ status: 'transcribing' });
              else if (status.includes('Procesando')) updateState({ status: 'processing' });
            }
          );

          updateState({
            status: 'processing',
            transcript: transcription,
          });

          const extractionResult = await agendaVoiceService.extractAgendaQuery(transcription);

          updateState({ extractionResult });

          if (extractionResult.success && extractionResult.data?.targetDate) {
            const { targetDate, specificDate } = extractionResult.data;
            const appointmentsFound = queryAppointments(targetDate, specificDate);
            const dateLabel = getTargetDateLabel(targetDate, specificDate);

            updateState({
              status: appointmentsFound.length === 0 ? 'no_appointments' : 'success',
              extractedData: extractionResult.data,
              appointments: appointmentsFound,
              totalCount: appointmentsFound.length,
              targetDateLabel: dateLabel,
              error: null,
            });

            await speakAgenda();
          } else {
            updateState({
              status: 'error',
              error: extractionResult.error || 'No se pudo identificar el día. Intenta decir "citas de hoy", "agenda del 25 de junio", etc.',
            });

            await ttsService.speak('No entendí. Di "citas de hoy", "la agenda del 25 de junio", o "mañana".', 0.9);
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Error en el proceso de consulta';
          updateState({ status: 'error', error });
        }

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.status, updateState, assemblyAIService, agendaVoiceService, queryAppointments, getTargetDateLabel, ttsService, speakAgenda]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.status === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    audioChunksRef.current = [];

    ttsService.cancel();

    setState(prev => ({
      ...INITIAL_STATE,
      assemblyAIConfigured: prev.assemblyAIConfigured,
      groqConfigured: prev.groqConfigured,
      ttsAvailable: prev.ttsAvailable,
      isConfigured: prev.isConfigured,
    }));
  }, [state.status, ttsService]);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current && state.status === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    audioChunksRef.current = [];

    ttsService.cancel();

    setState(prev => ({
      ...INITIAL_STATE,
      assemblyAIConfigured: prev.assemblyAIConfigured,
      groqConfigured: prev.groqConfigured,
      ttsAvailable: prev.ttsAvailable,
      isConfigured: prev.isConfigured,
    }));
  }, [state.status, ttsService]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
      ttsService.cancel();
    };
  }, [ttsService]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    speakAgenda,
  };
}
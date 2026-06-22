import { useState, useRef, useCallback, useEffect } from 'react';
import { getAssemblyAIService } from '../services/assemblyAI';
import { getGroqService, ExtractionResult, ExtractedAppointmentData } from '../services/groqService';

export type VoiceAppointmentStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'processing'
  | 'success'
  | 'error';

export interface VoiceAppointmentState {
  status: VoiceAppointmentStatus;
  transcript: string;
  extractedData: ExtractedAppointmentData | null;
  extractionResult: ExtractionResult | null;
  error: string | null;
  recordingDuration: number;
  isConfigured: boolean;
  assemblyAIConfigured: boolean;
  groqConfigured: boolean;
}

export interface UseVoiceAppointmentReturn extends VoiceAppointmentState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  reset: () => void;
}

const INITIAL_STATE: VoiceAppointmentState = {
  status: 'idle',
  transcript: '',
  extractedData: null,
  extractionResult: null,
  error: null,
  recordingDuration: 0,
  isConfigured: false,
  assemblyAIConfigured: false,
  groqConfigured: false,
};

export function useVoiceAppointment(): UseVoiceAppointmentReturn {
  const [state, setState] = useState<VoiceAppointmentState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const assemblyAIService = getAssemblyAIService();
  const groqService = getGroqService();

  useEffect(() => {
    const assemblyConfigured = assemblyAIService !== null;
    const groqConfigured = groqService.isConfigured();
    setState(prev => ({
      ...prev,
      assemblyAIConfigured: assemblyConfigured,
      groqConfigured: groqConfigured,
      isConfigured: assemblyConfigured && groqConfigured,
    }));
  }, []);

  const updateState = useCallback((updates: Partial<VoiceAppointmentState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const startRecording = useCallback(async () => {
    if (state.status === 'recording') return;

    if (!assemblyAIService) {
      updateState({
        status: 'error',
        error: 'AssemblyAI no está configurado. Agrega VITE_ASSEMBLYAI_API_KEY a tu archivo .env',
      });
      return;
    }

    if (!groqService.isConfigured()) {
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
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error al acceder al micrófono';
      updateState({ status: 'error', error });
    }
  }, [state.status, updateState, assemblyAIService, groqService]);

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

          const extractionResult = await groqService.extractAppointmentData(transcription);

          if (extractionResult.success && extractionResult.data) {
            updateState({
              status: 'success',
              extractedData: extractionResult.data,
              extractionResult,
              error: null,
            });
          } else {
            updateState({
              status: 'error',
              transcript: transcription,
              extractionResult,
              error: extractionResult.error || 'No se pudo extraer la información de la cita',
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Error en el proceso de transcripción';
          updateState({ status: 'error', error });
        }

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.status, updateState, assemblyAIService, groqService]);

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

    setState(prev => ({
      ...INITIAL_STATE,
      assemblyAIConfigured: prev.assemblyAIConfigured,
      groqConfigured: prev.groqConfigured,
      isConfigured: prev.isConfigured,
    }));
  }, [state.status]);

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

    setState(prev => ({
      ...INITIAL_STATE,
      assemblyAIConfigured: prev.assemblyAIConfigured,
      groqConfigured: prev.groqConfigured,
      isConfigured: prev.isConfigured,
    }));
  }, [state.status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
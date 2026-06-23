import { useState, useRef, useCallback, useEffect } from 'react';
import { getAssemblyAIService } from '../services/assemblyAI';
import { getClientSearchGroqService, ExtractedClientSearchData, ClientSearchResult } from '../services/clientSearchService';
import { getTTSService } from '../services/ttsService';
import { Client } from '../types';

export type VoiceClientSearchStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'processing'
  | 'searching'
  | 'found'
  | 'not_found'
  | 'error';

export interface VoiceClientSearchState {
  status: VoiceClientSearchStatus;
  transcript: string;
  extractedData: ExtractedClientSearchData | null;
  searchResult: ClientSearchResult | null;
  foundClient: Client | null;
  error: string | null;
  recordingDuration: number;
  isConfigured: boolean;
  assemblyAIConfigured: boolean;
  groqConfigured: boolean;
  ttsAvailable: boolean;
}

export interface UseVoiceClientSearchReturn extends VoiceClientSearchState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  reset: () => void;
  speakMessage: (message: string) => Promise<void>;
}

const INITIAL_STATE: VoiceClientSearchState = {
  status: 'idle',
  transcript: '',
  extractedData: null,
  searchResult: null,
  foundClient: null,
  error: null,
  recordingDuration: 0,
  isConfigured: false,
  assemblyAIConfigured: false,
  groqConfigured: false,
  ttsAvailable: false,
};

export function useVoiceClientSearch(clients: Client[]): UseVoiceClientSearchReturn {
  const [state, setState] = useState<VoiceClientSearchState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const assemblyAIService = getAssemblyAIService();
  const groqService = getClientSearchGroqService();
  const ttsService = getTTSService();

  useEffect(() => {
    const assemblyConfigured = assemblyAIService !== null;
    const groqConfigured = groqService.isConfigured();
    const ttsAvailable = ttsService.isAvailable();
    
    setState(prev => ({
      ...prev,
      assemblyAIConfigured: assemblyConfigured,
      groqConfigured: groqConfigured,
      ttsAvailable: ttsAvailable,
      isConfigured: assemblyConfigured && groqConfigured,
    }));
  }, [assemblyAIService, groqService, ttsService]);

  const updateState = useCallback((updates: Partial<VoiceClientSearchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const findClientByName = useCallback((clientName: string): Client | null => {
    const normalizedSearchName = clientName.toLowerCase().trim();
    
    const exactMatch = clients.find(c => 
      c.nombre.toLowerCase().trim() === normalizedSearchName
    );
    
    if (exactMatch) return exactMatch;

    const partialMatch = clients.find(c => 
      c.nombre.toLowerCase().includes(normalizedSearchName) ||
      normalizedSearchName.includes(c.nombre.toLowerCase().trim())
    );
    
    return partialMatch || null;
  }, [clients]);

  const speakMessage = useCallback(async (message: string): Promise<void> => {
    if (!ttsService.isAvailable()) {
      console.warn('TTS no disponible');
      return;
    }

    try {
      await ttsService.speak(message, 0.9);
    } catch (err) {
      console.error('Error al reproducir mensaje de voz:', err);
    }
  }, [ttsService]);

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
        searchResult: null,
        foundClient: null,
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

          const searchResult = await groqService.extractClientName(transcription);

          updateState({ searchResult });

          if (searchResult.success && searchResult.data?.clientName) {
            const clientName = searchResult.data.clientName;
            updateState({ status: 'searching' });

            const matchedClient = findClientByName(clientName);

            if (matchedClient) {
              updateState({
                status: 'found',
                extractedData: searchResult.data,
                foundClient: matchedClient,
                error: null,
              });

              await speakMessage(`Se ha encontrado a la clienta ${matchedClient.nombre}`);
            } else {
              updateState({
                status: 'not_found',
                extractedData: searchResult.data,
                foundClient: null,
                error: null,
              });

              await speakMessage(`La clienta ${clientName} no existe en el sistema`);
            }
          } else {
            updateState({
              status: 'error',
              transcript: transcription,
              searchResult: searchResult,
              error: searchResult.error || 'No se pudo identificar el nombre de la clienta',
            });

            await speakMessage('No entendí el nombre. Por favor, intenta de nuevo.');
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Error en el proceso de búsqueda';
          updateState({ status: 'error', error });
        }

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.status, updateState, assemblyAIService, groqService, findClientByName, speakMessage]);

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
      ttsAvailable: prev.ttsAvailable,
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
    speakMessage,
  };
}
import { useState, useRef, useCallback, useEffect } from 'react';
import { getAssemblyAIService } from '../services/assemblyAI';
import { getInventoryVoiceService, ExtractedInventoryData, InventorySearchResult } from '../services/inventoryVoiceService';
import { getTTSService } from '../services/ttsService';
import { useStore } from '../store/useStore';
import { Material } from '../types';

export type VoiceInventorySearchStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'processing'
  | 'searching'
  | 'found'
  | 'not_found'
  | 'error';

export interface VoiceInventorySearchState {
  status: VoiceInventorySearchStatus;
  transcript: string;
  extractedData: ExtractedInventoryData | null;
  searchResult: InventorySearchResult | null;
  foundMaterial: Material | null;
  error: string | null;
  recordingDuration: number;
  isConfigured: boolean;
  assemblyAIConfigured: boolean;
  groqConfigured: boolean;
  ttsAvailable: boolean;
}

export interface UseVoiceInventorySearchReturn extends VoiceInventorySearchState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  reset: () => void;
  speakMessage: (message: string) => Promise<void>;
}

const INITIAL_STATE: VoiceInventorySearchState = {
  status: 'idle',
  transcript: '',
  extractedData: null,
  searchResult: null,
  foundMaterial: null,
  error: null,
  recordingDuration: 0,
  isConfigured: false,
  assemblyAIConfigured: false,
  groqConfigured: false,
  ttsAvailable: false,
};

export function useVoiceInventorySearch(): UseVoiceInventorySearchReturn {
  const { materials, activeBusinessId } = useStore();
  const [state, setState] = useState<VoiceInventorySearchState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const assemblyAIService = getAssemblyAIService();
  const inventoryService = getInventoryVoiceService();
  const ttsService = getTTSService();

  useEffect(() => {
    const assemblyConfigured = assemblyAIService !== null;
    const groqConfigured = inventoryService.isConfigured();
    const ttsAvailable = ttsService.isAvailable();
    
    setState(prev => ({
      ...prev,
      assemblyAIConfigured: assemblyConfigured,
      groqConfigured: groqConfigured,
      ttsAvailable: ttsAvailable,
      isConfigured: assemblyConfigured && groqConfigured,
    }));
  }, [assemblyAIService, inventoryService, ttsService]);

  const updateState = useCallback((updates: Partial<VoiceInventorySearchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const findMaterialByName = useCallback((materialName: string): Material | null => {
    const normalizedSearchName = materialName.toLowerCase().trim();
    
    const businessMaterials = materials.filter(m => 
      !m.deleted && m.businessId === activeBusinessId
    );
    
    const exactMatch = businessMaterials.find(m => 
      m.nombre.toLowerCase().trim() === normalizedSearchName
    );
    
    if (exactMatch) return exactMatch;

    const partialMatch = businessMaterials.find(m => 
      m.nombre.toLowerCase().includes(normalizedSearchName) ||
      normalizedSearchName.includes(m.nombre.toLowerCase().trim())
    );
    
    if (partialMatch) return partialMatch;

    const wordMatch = businessMaterials.find(m => {
      const materialWords = m.nombre.toLowerCase().split(/\s+/);
      const searchWords = normalizedSearchName.split(/\s+/);
      return searchWords.some(searchWord => 
        materialWords.some(materialWord => 
          materialWord.includes(searchWord) || searchWord.includes(materialWord)
        )
      );
    });

    return wordMatch || null;
  }, [materials, activeBusinessId]);

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

    if (!inventoryService.isConfigured()) {
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
        foundMaterial: null,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error al acceder al micrófono';
      updateState({ status: 'error', error });
    }
  }, [state.status, updateState, assemblyAIService, inventoryService]);

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

          const searchResult = await inventoryService.extractMaterialName(transcription);

          updateState({ searchResult });

          if (searchResult.success && searchResult.data?.materialName) {
            const materialName = searchResult.data.materialName;
            updateState({ status: 'searching' });

            const matchedMaterial = findMaterialByName(materialName);

            if (matchedMaterial) {
              updateState({
                status: 'found',
                extractedData: searchResult.data,
                foundMaterial: matchedMaterial,
                error: null,
              });

              const stockMessage = `Quedan ${matchedMaterial.unidades} unidades de ${matchedMaterial.nombre}`;
              await speakMessage(stockMessage);
            } else {
              updateState({
                status: 'not_found',
                extractedData: searchResult.data,
                foundMaterial: null,
                error: null,
              });

              const notFoundMessage = `El material ${materialName} no se encuentra en el inventario`;
              await speakMessage(notFoundMessage);
            }
          } else {
            updateState({
              status: 'error',
              transcript: transcription,
              searchResult: searchResult,
              error: searchResult.error || 'No se pudo identificar el nombre del material',
            });

            await speakMessage('No entendí el material. Por favor, intenta de nuevo.');
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Error en el proceso de búsqueda';
          updateState({ status: 'error', error });
        }

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.status, updateState, assemblyAIService, inventoryService, findMaterialByName, speakMessage]);

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
import { useState, useCallback } from 'react';
import { analyzeImage, matchColorsWithMaterials, DetectedColor, ColorMatchResult } from '../services/visionService';
import { Material } from '../types';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';

interface UseColorMatcherState {
  // La imagen que subió el usuario en base64
  imagePreview: string | null;
  // Colores detectados por Vision AI
  detectedColors: DetectedColor[];
  // Esmaltes del inventario que coinciden
  matchedMaterials: ColorMatchResult[];
  // Estados de carga y error
  isAnalyzing: boolean;
  error: string | null;
  // Si ya se hizo un análisis
  hasResults: boolean;
}

interface UseColorMatcherReturn extends UseColorMatcherState {
  // Carga una imagen desde un input file
  handleImageUpload: (file: File) => void;
  // Analiza la imagen cargada
  analyzeCurrentImage: (materials: Material[]) => Promise<void>;
  // Limpia todo y vuelve al estado inicial
  reset: () => void;
}

const initialState: UseColorMatcherState = {
  imagePreview: null,
  detectedColors: [],
  matchedMaterials: [],
  isAnalyzing: false,
  error: null,
  hasResults: false
};

export const useColorMatcher = (): UseColorMatcherReturn => {
  const [state, setState] = useState<UseColorMatcherState>(initialState);

  // ─────────────────────────────────────────────
  // Carga una imagen desde el input file
  // La convierte a base64 para mostrar preview
  // y para enviarla a Vision AI
  // ─────────────────────────────────────────────
  const handleImageUpload = useCallback((file: File) => {
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setState(prev => ({
        ...prev,
        error: 'El archivo debe ser una imagen (JPG, PNG, etc.)'
      }));
      return;
    }

    // Validar tamaño máximo de 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setState(prev => ({
        ...prev,
        error: 'La imagen no debe superar los 10MB.'
      }));
      return;
    }

    // Convertir a base64 usando FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setState(prev => ({
        ...prev,
        imagePreview: base64,
        detectedColors: [],
        matchedMaterials: [],
        hasResults: false,
        error: null
      }));
    };
    reader.onerror = () => {
      setState(prev => ({
        ...prev,
        error: 'Error al leer la imagen. Intenta con otra.'
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  // ─────────────────────────────────────────────
  // Analiza la imagen actual con Vision AI
  // y compara con los esmaltes del inventario
  // ─────────────────────────────────────────────
  const analyzeCurrentImage = useCallback(async (materials: Material[]) => {
    if (!state.imagePreview) {
      setState(prev => ({
        ...prev,
        error: 'Primero debes cargar una imagen.'
      }));
      return;
    }

    // Verificar que haya esmaltes con color registrado
    const materialsWithColor = materials.filter(
      m => m.color && m.color.trim() !== '' && !m.deleted
    );

    if (materialsWithColor.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'No hay esmaltes con color registrado en el inventario. Agrega colores a tus esmaltes primero.'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null,
      detectedColors: [],
      matchedMaterials: []
    }));

    try {
      // 1. Enviar imagen a Vision AI
      const detectedColors = await analyzeImage(state.imagePreview);

      if (detectedColors.length === 0) {
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          error: 'No se pudieron detectar colores en la imagen. Intenta con otra foto.',
          hasResults: false
        }));
        return;
      }

      // 2. Comparar colores detectados con esmaltes del inventario
      const matchedMaterials = matchColorsWithMaterials(
        detectedColors,
        materialsWithColor
      );

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        detectedColors,
        matchedMaterials,
        hasResults: true,
        error: null
      }));

      // 🚀 CAMBIO AQUÍ: Guardado automático en el store cuando hay resultados exitosos
      const { addColorAnalysisRecord } = useStore.getState();
      if (matchedMaterials.length > 0) {
        addColorAnalysisRecord({
          fecha: format(new Date(), 'yyyy-MM-dd'),
          hora: format(new Date(), 'HH:mm'),
          suggestedMaterials: matchedMaterials.map(m => ({
            materialId: m.materialId,
            materialName: m.materialName,
            materialColor: m.materialColor,
            similarity: m.similarity
          }))
        });
      }

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error.message || 'Error al analizar la imagen. Verifica tu conexión.',
        hasResults: false
      }));
    }
  }, [state.imagePreview]);

  // ─────────────────────────────────────────────
  // Limpia todo y vuelve al estado inicial
  // ─────────────────────────────────────────────
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    handleImageUpload,
    analyzeCurrentImage,
    reset
  };
};
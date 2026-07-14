import React, { useRef, useState } from 'react'; // 🚀 CAMBIO: Se agregó useState
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, X, RefreshCw, AlertCircle, Image as ImageIcon, Loader2, Package, History } from 'lucide-react';
import { useColorMatcher } from '../hooks/useColorMatcher';
import { Material } from '../types';
import { ImageCropperModal } from './ImageCropperModal'; // 🚀 CAMBIO: Importamos el modal que creamos
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ColorMatcherProps {
  materials: Material[];
  onClose: () => void;
  onOpenHistory: () => void;
}

export const ColorMatcher: React.FC<ColorMatcherProps> = ({ materials, onClose, onOpenHistory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    imagePreview,
    detectedColors,
    matchedMaterials,
    isAnalyzing,
    error,
    hasResults,
    // 🚀 CAMBIO: Necesitaremos setCroppedImage (o la función que exponga tu hook para setear el base64 directo)
    // Si tu hook useColorMatcher no la tiene, puedes pasarle el base64 a una variante o la añadimos aquí.
    handleImageUpload, 
    analyzeCurrentImage,
    reset
  } = useColorMatcher();

  // 🚀 CAMBIO: Nuevos estados locales para controlar el flujo de recorte interactivo
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  // 🚀 CAMBIO: Interceptamos la selección de archivos para abrir el cropper primero
  const processFileForCropping = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFileForCropping(file); // 🚀 CAMBIO
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFileForCropping(file); // 🚀 CAMBIO
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 🚀 CAMBIO: Función que se ejecuta cuando terminas de recortar la uña en el modal
  const handleCropComplete = (croppedBase64: string) => {
    setIsCropperOpen(false);
    
    // Convertimos el base64 recortado a un archivo File para que tu hook 'useColorMatcher' 
    // lo reciba e inicialice su estado interno exactamente igual que antes.
    fetch(croppedBase64)
      .then(res => res.blob())
      .then(blob => {
        const croppedFile = new File([blob], "cropped_nail.jpg", { type: "image/jpeg" });
        handleImageUpload(croppedFile);
      });
  };

  // Etiqueta de similitud
  const getSimilarityLabel = (similarity: number) => {
    if (similarity >= 95) return { label: 'Exacto', color: 'bg-emerald-100 text-emerald-700' };
    if (similarity >= 90) return { label: 'Muy similar', color: 'bg-emerald-100 text-emerald-600' };
    if (similarity >= 85) return { label: 'Similar', color: 'bg-brand-pink text-brand-accent' };
    return { label: 'Aproximado', color: 'bg-slate-100 text-slate-500' };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Handle bar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Color Matcher
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Sube un diseño y encuentra tus esmaltes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenHistory}
              className="p-2 bg-brand-pink-light rounded-xl text-brand-accent active:scale-90 transition-transform"
              title="Ver historial"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-100 rounded-full text-slate-400 active:scale-90 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar space-y-5">

          {/* Zona de carga de imagen */}
          {!imagePreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-brand-pink rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-brand-pink-light transition-colors active:scale-95"
            >
              <div className="w-16 h-16 bg-brand-pink rounded-2xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-brand-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-brand-accent">
                  Sube una foto del diseño
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">
                  JPG, PNG • Máximo 10MB
                </p>
                <p className="text-[10px] font-bold text-slate-300 mt-0.5">
                  Toca para seleccionar o arrastra la imagen
                </p>
              </div>
            </div>
          ) : (
            /* Preview de la imagen recortada */
            <div className="relative rounded-[32px] overflow-hidden border-2 border-brand-pink">
              <img
                src={imagePreview}
                alt="Diseño de uñas"
                className="w-full object-cover max-h-56"
              />
              <button
                onClick={() => {
                  reset();
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="absolute top-3 right-3 p-2 bg-white/90 rounded-xl text-slate-600 shadow-md active:scale-90"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input file oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Botón analizar */}
          {imagePreview && !hasResults && (
            <button
              onClick={() => analyzeCurrentImage(materials)}
              disabled={isAnalyzing}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-brand-accent shadow-lg shadow-brand-accent/30 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analizando colores...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analizar Diseño
                </>
              )}
            </button>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-500">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resultados */}
          <AnimatePresence>
            {hasResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Esmaltes recomendados */}
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                    {matchedMaterials.length > 0
                      ? `${matchedMaterials.length} esmalte${matchedMaterials.length !== 1 ? 's' : ''} encontrado${matchedMaterials.length !== 1 ? 's' : ''} en tu inventario`
                      : 'Sin coincidencias'
                    }
                  </h3>

                  {matchedMaterials.length === 0 ? (
                    <div className="bg-slate-50 rounded-[28px] p-8 text-center border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-black text-slate-500 mb-1">
                        No hay esmaltes disponibles con el color del diseño
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                        Prueba con otro diseño o agrega más esmaltes al inventario con su color registrado.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {matchedMaterials.map((match, index) => {
                        const material = materials.find(m => m.id === match.materialId);
                        const { label, color } = getSimilarityLabel(match.similarity);

                        return (
                          <motion.div
                            key={match.materialId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.06 }}
                            className="bg-white border-2 border-brand-pink/30 rounded-[24px] p-4 flex items-center gap-4 shadow-sm"
                          >
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-pink/20 flex-shrink-0 bg-brand-pink-light flex items-center justify-center">
                              {material?.imagen ? (
                                <img
                                  src={material.imagen}
                                  alt={match.materialName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-7 h-7 text-brand-accent opacity-40" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-800 text-sm truncate">
                                {match.materialName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div
                                  className="w-3.5 h-3.5 rounded-full border border-white shadow-sm flex-shrink-0"
                                  style={{ backgroundColor: match.materialColor }}
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Color del esmalte
                                </span>
                              </div>
                              {material && (
                                <p className="text-[10px] font-bold text-slate-300 mt-0.5 uppercase tracking-wider">
                                  Stock: {material.unidades} und.
                                </p>
                              )}
                            </div>

                            <div className={cn(
                              "px-3 py-2 rounded-xl text-center flex-shrink-0",
                              color
                            )}>
                              <p className="text-sm font-black">{match.similarity}%</p>
                              <p className="text-[8px] font-black uppercase tracking-wider">{label}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={reset}
                  className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-accent bg-brand-pink border-2 border-brand-pink-medium active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Analizar otra imagen
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 🚀 CAMBIO: Modal de Recorte Interactivo inyectado con AnimatePresence al final */}
      <AnimatePresence>
        {isCropperOpen && tempImageSrc && (
          <ImageCropperModal
            imageSrc={tempImageSrc}
            onClose={() => setIsCropperOpen(false)}
            onCropComplete={handleCropComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
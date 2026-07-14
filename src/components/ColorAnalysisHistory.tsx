import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Trash2, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ColorAnalysisHistoryProps {
  onClose: () => void;
}

export const ColorAnalysisHistory: React.FC<ColorAnalysisHistoryProps> = ({ onClose }) => {
  const { colorAnalysisRecords, activeBusinessId, deleteColorAnalysisRecord, materials } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const records = colorAnalysisRecords
    .filter(r => r.businessId === activeBusinessId)
    .sort((a, b) => {
      const dateA = new Date(`${a.fecha}T${a.hora}`);
      const dateB = new Date(`${b.fecha}T${b.hora}`);
      return dateB.getTime() - dateA.getTime();
    });

  const getSimilarityStyle = (similarity: number) => {
    if (similarity >= 95) return 'bg-emerald-100 text-emerald-700';
    if (similarity >= 90) return 'bg-emerald-100 text-emerald-600';
    if (similarity >= 85) return 'bg-brand-pink text-brand-accent';
    return 'bg-slate-100 text-slate-500';
  };

  const getSimilarityLabel = (similarity: number) => {
    if (similarity >= 95) return 'Exacto';
    if (similarity >= 90) return 'Muy similar';
    if (similarity >= 85) return 'Similar';
    return 'Aproximado';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Análisis
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {records.length} {records.length === 1 ? 'análisis' : 'análisis'} registrados
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 rounded-full text-slate-400 active:scale-90 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar space-y-3">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <History className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-bold text-center">
                Aún no hay análisis registrados.
              </p>
              <p className="text-[10px] font-bold text-slate-300 text-center mt-1">
                Los análisis se guardan automáticamente cuando encuentran esmaltes similares.
              </p>
            </div>
          ) : (
            records.map((record) => {
              const isExpanded = expandedId === record.id;
              return (
                <motion.div
                  key={record.id}
                  layout
                  className="bg-white border-2 border-brand-pink/30 rounded-[24px] overflow-hidden shadow-sm"
                >
                  {/* Cabecera del registro */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer active:bg-brand-pink-light transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0"> {/* 🚀 Agregado contenedor flex para alinear la foto */}
                      
                      {/* 📸 FOTO DEL DISEÑO ORIGINAL */}
                      {record.imagePreview && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-brand-pink/40 shadow-sm">
                          <img 
                            src={record.imagePreview} 
                            alt="Diseño de uñas analizado" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="min-w-0"> {/* Contenedor de textos existente */}
                        <p className="text-sm font-black text-slate-800 truncate">
                          {format(parseISO(record.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          {record.hora} • {record.suggestedMaterials.length} esmalte{record.suggestedMaterials.length !== 1 ? 's' : ''} sugerido{record.suggestedMaterials.length !== 1 ? 's' : ''}
                        </p>
                        {/* Miniaturas de colores de esmaltes */}
                        <div className="flex gap-1.5 mt-2">
                          {record.suggestedMaterials.slice(0, 5).map((m, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: m.materialColor }}
                              title={m.materialName}
                            />
                          ))}
                          {record.suggestedMaterials.length > 5 && (
                            <span className="text-[10px] font-bold text-slate-400 self-center">
                              +{record.suggestedMaterials.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteColorAnalysisRecord(record.id);
                        }}
                        className="p-2 text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-brand-accent" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2 border-t border-brand-pink/20 pt-3">
  
                          {/* 📸 VISTA AMPLIADA DEL DISEÑO AL EXPANDIR LA TARJETA */}
                          {record.imagePreview && (
                            <div className="w-full h-32 rounded-2xl overflow-hidden mb-3 border border-brand-pink/30 shadow-inner">
                              <img 
                                src={record.imagePreview} 
                                alt="Diseño ampliado" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            Esmaltes sugeridos
                          </p>
                          {record.suggestedMaterials.map((suggested, i) => {
                            const material = materials.find(m => m.id === suggested.materialId);
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-3 bg-brand-pink-light rounded-2xl p-3"
                              >
                                {/* Imagen o fallback */}
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-brand-pink/30 flex-shrink-0 bg-white flex items-center justify-center">
                                  {material?.imagen ? (
                                    <img
                                      src={material.imagen}
                                      alt={suggested.materialName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package className="w-5 h-5 text-brand-accent opacity-40" />
                                  )}
                                </div>

                                {/* Nombre y color */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-700 truncate">
                                    {suggested.materialName}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div
                                      className="w-3 h-3 rounded-full border border-white shadow-sm"
                                      style={{ backgroundColor: suggested.materialColor }}
                                    />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      Color del esmalte
                                    </span>
                                  </div>
                                </div>

                                {/* Similitud */}
                                <div className={cn(
                                  "px-2 py-1 rounded-xl text-center flex-shrink-0",
                                  getSimilarityStyle(suggested.similarity)
                                )}>
                                  <p className="text-xs font-black">{suggested.similarity}%</p>
                                  <p className="text-[8px] font-bold uppercase">
                                    {getSimilarityLabel(suggested.similarity)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};
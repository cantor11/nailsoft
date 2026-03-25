import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';

export const UndoToast: React.FC = () => {
  const { lastDeleted, undoDelete, clearLastDeleted } = useStore();

  useEffect(() => {
    if (lastDeleted) {
      const timer = setTimeout(() => {
        clearLastDeleted();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastDeleted, clearLastDeleted]);

  return (
    <AnimatePresence>
      {lastDeleted && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-6 right-6 z-[100] bg-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <RotateCcw className="w-4 h-4 text-brand-pink" />
            </div>
            <div>
              <p className="text-xs font-bold">Elemento eliminado</p>
              <p className="text-[10px] opacity-60">Tienes 3 segundos para deshacer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={undoDelete}
              className="px-4 py-2 bg-brand-accent text-white text-[10px] font-bold rounded-xl shadow-lg"
            >
              DESHACER
            </button>
            <button onClick={clearLastDeleted} className="p-2 opacity-40">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

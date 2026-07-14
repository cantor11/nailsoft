import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { motion } from 'framer-motion';
import { X, Crop as CropIcon } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Centra el recuadro de recorte automáticamente cuando la imagen carga
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // No forzamos un aspect ratio fijo para que puedan recortar uñas largas o anchas libremente
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 50 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  };

  // Genera el Base64 de la sección recortada usando un Canvas en memoria
  const handleConfirmCrop = () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    // Exporta a base64 (jpeg para mejor rendimiento de peso)
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(base64Image);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CropIcon className="w-5 h-5 text-brand-accent" />
            <h3 className="text-sm font-black text-brand-accent uppercase tracking-wider">
              Enfocar Diseño
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 rounded-full text-slate-400 active:scale-90 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Zona de Recorte */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center items-center bg-slate-50 min-h-[200px]">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[50vh] rounded-xl overflow-hidden"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop source"
              onLoad={onImageLoad}
              className="max-w-full max-h-[50vh] object-contain"
            />
          </ReactCrop>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-2 flex-shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-1">
            Arrastra el recuadro directamente sobre una uña para aislar su color
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-100 active:scale-95 transition-transform"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmCrop}
              className="flex-[2] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg shadow-brand-accent/20 active:scale-95 transition-transform"
            >
              Analizar este color
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
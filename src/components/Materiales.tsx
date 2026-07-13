import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Plus, Trash2, Edit2, Package, Image as ImageIcon, X,
  Search, Tag, AlertTriangle, ChevronUp, ChevronDown, Mic, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Material, Category } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { VoiceInventoryModal } from './VoiceInventoryModal';
import { ColorMatcher } from './ColorMatcher';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Materiales: React.FC = () => {
  const {
    materials, categories, activeBusinessId,
    addMaterial, updateMaterial, deleteMaterial,
    addCategory, deleteCategory, updateMaterialStock
  } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [isColorMatcherOpen, setIsColorMatcherOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(15);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: 0,
    cantidadServicios: 1,
    unidades: 1,
    alertaStock: 2,
    tipoAlerta: 'unidades' as 'unidades' | 'servicios',
    categoriaId: '',
    imagen: '',
    color: ''
  });

  const takePhoto = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt
        });
        if (image.dataUrl) setForm({ ...form, imagen: image.dataUrl });
      } catch (error) {
        console.error('Error taking photo:', error);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setForm({ ...form, imagen: event.target?.result as string });
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const allFilteredMaterials = materials.filter(m => {
    if (m.businessId !== activeBusinessId || m.deleted) return false;
    const matchesSearch = m.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || m.categoriaId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredMaterials = allFilteredMaterials.slice(0, limit);
  const filteredCategories = categories.filter(c => c.businessId === activeBusinessId);

  const handleSave = () => {
    if (!form.nombre || !form.descripcion) return;

    const isDuplicate = materials.some(m =>
      m.businessId === activeBusinessId &&
      !m.deleted &&
      m.nombre.toLowerCase().trim() === form.nombre.toLowerCase().trim() &&
      m.id !== editingId
    );

    if (isDuplicate) {
      setWarning(`Ya existe un producto con el nombre "${form.nombre}" en este negocio.`);
      setTimeout(() => setWarning(null), 5000);
      return;
    }

    if (editingId) {
      updateMaterial(editingId, form);
    } else {
      addMaterial(form);
    }

    resetForm();
  };

  const resetForm = () => {
    setForm({
      nombre: '', descripcion: '', precio: 0, cantidadServicios: 1,
      unidades: 1, alertaStock: 2, tipoAlerta: 'unidades',
      categoriaId: '', imagen: '', color: ''
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const startEdit = (m: Material) => {
    setForm({
      nombre: m.nombre,
      descripcion: m.descripcion,
      precio: m.precio,
      cantidadServicios: m.cantidadServicios || 1,
      unidades: m.unidades || 0,
      alertaStock: m.alertaStock || 0,
      tipoAlerta: m.tipoAlerta || 'unidades',
      categoriaId: m.categoriaId || '',
      imagen: m.imagen || '',
      color: m.color || ''
    });
    setEditingId(m.id);
    setIsModalOpen(true);
  };

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    const success = addCategory(trimmedName);
    if (!success) {
      setWarning(`La categoría "${trimmedName}" ya existe.`);
      setTimeout(() => setWarning(null), 5000);
      return;
    }
    setNewCategoryName('');
    setWarning(null);
  };

  const confirmDeleteCategory = (cat: Category) => {
    setCategoryToDelete(cat);
    setShowCategoryDeleteConfirm(true);
  };

  const handleDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete.id);
      setShowCategoryDeleteConfirm(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-md mx-auto bg-brand-pink-light">

      {/* ── Header ── */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-accent">Materiales</h1>
        <div className="flex gap-2">
          {/* Botón Color Matcher */}
          <button
            onClick={() => setIsColorMatcherOpen(true)}
            className="p-2 bg-brand-accent text-white rounded-xl shadow-lg active:scale-95 transition-transform"
            title="Buscar esmaltes por color de diseño"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          {/* Botón Voz */}
          <button
            onClick={() => setShowVoiceSearch(true)}
            className="p-2 bg-brand-accent text-white rounded-xl shadow-lg active:scale-95 transition-transform"
            title="Buscar material por voz"
          >
            <Mic className="w-5 h-5" />
          </button>
          {/* Botón Categorías */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="p-2 bg-brand-pink text-brand-accent rounded-xl shadow-sm border border-brand-pink-medium"
          >
            <Tag className="w-5 h-5" />
          </button>
          {/* Botón Agregar */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-brand-accent text-white rounded-xl shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ── Buscador y filtros ── */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setLimit(15); }}
            className="w-full bg-white border-none rounded-2xl py-3 pl-10 pr-4 text-sm shadow-sm focus:ring-2 ring-brand-accent outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => { setSelectedCategory('all'); setLimit(15); }}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all",
              selectedCategory === 'all' ? "bg-brand-accent text-white" : "bg-white text-slate-400 border border-brand-pink"
            )}
          >
            TODOS
          </button>
          {filteredCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setLimit(15); }}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all",
                selectedCategory === cat.id ? "bg-brand-accent text-white" : "bg-white text-slate-400 border border-brand-pink"
              )}
            >
              {cat.nombre.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de materiales ── */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-24 no-scrollbar">
        {filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">No hay productos registrados</p>
          </div>
        ) : (
          filteredMaterials.map((m) => {
            const category = filteredCategories.find(c => c.id === m.categoriaId);
            const totalServiciosDisponibles = (m.unidades * m.cantidadServicios) - (m.serviciosConsumidosAcumulados || 0);
            const isLowStock = m.tipoAlerta === 'unidades'
              ? m.unidades <= m.alertaStock
              : totalServiciosDisponibles <= m.alertaStock;

            return (
              <div key={m.id} className={cn(
                "bg-white p-4 rounded-3xl card-shadow border transition-all duration-500",
                isLowStock ? "border-rose-500 shadow-lg shadow-rose-200/50" : "border-brand-pink/50"
              )}>
                <div className="flex gap-4">
                  {/* Imagen / icono */}
                  <div className="relative">
                    <div className="w-16 h-16 bg-brand-pink-light rounded-2xl flex items-center justify-center text-brand-accent overflow-hidden">
                      {m.imagen
                        ? <img src={m.imagen} className="w-full h-full object-cover" />
                        : <Package className="w-8 h-8 opacity-40" />
                      }
                    </div>
                    {isLowStock && (
                      <div className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg animate-bounce">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        {/* Nombre + círculo de color */}
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800">{m.nombre}</h3>
                          {m.color && (
                            <div
                              className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                              style={{ backgroundColor: m.color }}
                              title={m.color}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {category && (
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                              {category.nombre}
                            </span>
                          )}
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-wider px-1.5 rounded-md",
                            isLowStock ? "bg-rose-100 text-rose-600" : "bg-brand-pink/30 text-brand-accent"
                          )}>
                            Stock: {m.unidades} und.
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 rounded-md">
                            Rinde: {totalServiciosDisponibles} usos
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-brand-accent bg-brand-pink px-2 py-0.5 rounded-full">
                        ${m.precio.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-1 my-2">{m.descripcion}</p>

                    <div className="flex justify-between items-center">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(m)} className="p-2 text-slate-300 hover:text-brand-accent transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMaterial(m.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Control de stock */}
                      <div className="flex items-center gap-2 bg-brand-pink-light rounded-xl px-2 py-1">
                        <button
                          onClick={() => {
                            if (m.unidades === 1 && (m.serviciosConsumidosAcumulados || 0) > 0) {
                              if (confirm('Aún quedan servicios por consumir. ¿Deseas dejar el stock en 0?')) {
                                updateMaterialStock(m.id, -1);
                              }
                            } else {
                              updateMaterialStock(m.id, -1);
                            }
                          }}
                          className="p-1 text-brand-accent active:scale-90 transition-transform"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-black text-brand-accent min-w-[20px] text-center">{m.unidades}</span>
                        <button
                          onClick={() => updateMaterialStock(m.id, 1)}
                          className="p-1 text-brand-accent active:scale-90 transition-transform"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {allFilteredMaterials.length > limit && (
          <div className="pt-2 pb-8">
            <button
              onClick={() => setLimit(prev => prev + 10)}
              className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-accent bg-brand-pink border-2 border-brand-pink-medium shadow-sm active:scale-95 transition-all"
            >
              Mostrar más
            </button>
          </div>
        )}
      </div>

      {/* ── Modal Categorías ── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-brand-accent">Categorías</h2>
              <button onClick={() => { setIsCategoryModalOpen(false); setWarning(null); }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {warning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-tight">{warning}</p>
              </motion.div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                placeholder="Nueva categoría..."
                className="flex-1 bg-brand-pink-light rounded-2xl px-4 py-3 text-sm outline-none border border-brand-pink/20 focus:border-brand-accent transition-colors"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              />
              <button
                onClick={handleAddCategory}
                className="p-3 bg-brand-accent text-white rounded-2xl shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No hay categorías registradas</p>
                </div>
              ) : (
                filteredCategories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 bg-brand-pink-light rounded-xl">
                    <span className="text-sm font-medium text-slate-700">{cat.nombre}</span>
                    <button onClick={() => confirmDeleteCategory(cat)} className="text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Confirmar eliminar categoría ── */}
      <AnimatePresence>
        {showCategoryDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Categoría?</h2>
              <p className="text-xs text-slate-400 mb-8 leading-relaxed">
                ¿Deseas eliminar <span className="font-bold text-slate-600">"{categoryToDelete?.nombre}"</span>?
                Los materiales asociados pasarán a <span className="font-bold text-brand-accent">"Sin categoría"</span>.
              </p>
              <div className="space-y-3">
                <button onClick={handleDeleteCategory} className="w-full py-4 rounded-2xl font-bold text-white bg-red-500 shadow-lg active:scale-95 transition-transform">
                  Sí, eliminar
                </button>
                <button onClick={() => { setShowCategoryDeleteConfirm(false); setCategoryToDelete(null); }} className="w-full py-4 rounded-2xl font-bold text-slate-400 bg-slate-50 active:scale-95 transition-transform">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal crear/editar material ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-accent">{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={resetForm}><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="space-y-4 mb-8">
              <AnimatePresence>
                {warning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-700">{warning}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Imagen */}
              <button
                onClick={takePhoto}
                className="w-full h-32 bg-brand-pink-light rounded-2xl border-2 border-dashed border-brand-pink flex flex-col items-center justify-center text-brand-accent/40 overflow-hidden relative"
              >
                {form.imagen ? (
                  <>
                    <img src={form.imagen} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-[10px] font-bold">CAMBIAR IMAGEN</span>
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <span className="text-[10px] font-bold">CARGAR IMAGEN (OPCIONAL)</span>
                  </>
                )}
              </button>

              {/* Selector de color */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                  Color del Esmalte
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={form.color || '#ffffff'}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-14 h-14 rounded-2xl border-2 border-brand-pink cursor-pointer bg-transparent p-1"
                  />
                  <div className="flex-1">
                    {form.color ? (
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl border-2 border-brand-pink/50 shadow-sm"
                          style={{ backgroundColor: form.color }}
                        />
                        <div>
                          <p className="text-xs font-black text-slate-700 uppercase">{form.color}</p>
                          <p className="text-[10px] text-slate-400">Color seleccionado</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        Selecciona el color del esmalte para compararlo con diseños
                      </p>
                    )}
                  </div>
                  {form.color && (
                    <button onClick={() => setForm({ ...form, color: '' })} className="p-2 bg-slate-100 rounded-xl text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nombre */}
              <input
                placeholder="Nombre del producto *"
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />

              {/* Descripción */}
              <textarea
                placeholder="Descripción *"
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm h-24 resize-none"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />

              {/* Categoría */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Categoría</label>
                <select
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm"
                  value={form.categoriaId}
                  onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {filteredCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                </select>
              </div>

              {/* Precio y rendimiento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Precio Individual</label>
                  <input
                    type="number" min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Precio*"
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm"
                    value={form.precio === 0 ? '' : form.precio}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setForm({ ...form, precio: Math.max(0, Number(e.target.value)) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Rendimiento por Unidad</label>
                  <input
                    type="number" min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Rendimiento*"
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm"
                    value={form.cantidadServicios === 0 ? '' : form.cantidadServicios}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setForm({ ...form, cantidadServicios: Math.max(0, Number(e.target.value)) })}
                  />
                </div>
              </div>

              {/* Stock y alerta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidades en Stock</label>
                  <input
                    type="number" min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Unidades*"
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm"
                    value={form.unidades === 0 ? '' : form.unidades}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setForm({ ...form, unidades: Math.max(0, Number(e.target.value)) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Alerta de Stock</label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="Umbral*"
                      className="flex-1 bg-brand-pink-light rounded-2xl p-4 text-sm"
                      value={form.alertaStock === 0 ? '' : form.alertaStock}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      onChange={(e) => setForm({ ...form, alertaStock: Math.max(0, Number(e.target.value)) })}
                    />
                    <button
                      onClick={() => setForm({ ...form, tipoAlerta: form.tipoAlerta === 'unidades' ? 'servicios' : 'unidades' })}
                      className="px-3 bg-brand-pink text-brand-accent rounded-2xl text-[8px] font-black uppercase"
                    >
                      {form.tipoAlerta === 'unidades' ? 'Und.' : 'Usos'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg"
            >
              {editingId ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Color Matcher Modal ── */}
      <AnimatePresence>
        {isColorMatcherOpen && (
          <ColorMatcher
            materials={allFilteredMaterials}
            onClose={() => setIsColorMatcherOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Voice Search Modal ── */}
      {showVoiceSearch && (
        <VoiceInventoryModal onClose={() => setShowVoiceSearch(false)} />
      )}
    </div>
  );
};
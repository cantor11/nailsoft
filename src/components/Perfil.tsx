import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { User, Briefcase, Scissors, Plus, Trash2, Save, X, Edit2, Download, Upload, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface PerfilProps {
  onLogout: () => void;
}

export const Perfil: React.FC<PerfilProps> = ({ onLogout }) => {
  const { 
    businesses, activeBusinessId, addBusiness, updateBusiness, 
    deleteBusiness, setActiveBusiness, workers, addWorker, 
    updateWorker, deleteWorker, services, addService, 
    updateService, deleteService, materials, exportData, importData
  } = useStore();
  
  const activeBusiness = businesses.find(b => b.id === activeBusinessId) || businesses[0];
  
  const [info, setInfo] = useState(activeBusiness);
  const [newWorker, setNewWorker] = useState({ nombre: '', especialidad: '', telefono: '', correo: '', foto: '' });
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  
  const [newService, setNewService] = useState<{ nombre: string; precio: number; duracion: number; materiales: { materialId: string; consumo: number }[] }>({ 
    nombre: '', 
    precio: 0, 
    duracion: 30, 
    materiales: [] 
  });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  
  const [activeSection, setActiveSection] = useState<'info' | 'workers' | 'services'>('info');
  const [workerLimit, setWorkerLimit] = useState(15);
  const [serviceLimit, setServiceLimit] = useState(15);
  const [isAddingBusiness, setIsAddingBusiness] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [notificationText, setNotificationText] = useState('Negocio guardado');
  const [workerWarning, setWorkerWarning] = useState<string | null>(null);
  const [serviceWarning, setServiceWarning] = useState<string | null>(null);

  const showNotification = (text: string) => {
    setNotificationText(text);
    setShowSavedNotification(true);
    setTimeout(() => setShowSavedNotification(false), 3000);
  };

  useEffect(() => {
    setInfo(activeBusiness);
  }, [activeBusiness]);

  const handleSaveInfo = () => {
    if (!info.nombre.trim()) {
      alert('El nombre del negocio es obligatorio.');
      return;
    }
    updateBusiness(activeBusinessId, info);
    showNotification('Negocio guardado');
  };

  const handleDeleteBusiness = () => {
    deleteBusiness(activeBusinessId);
    setShowDeleteConfirm(false);
  };

  const handleExport = async () => {
    const data = exportData();
    const fileName = `nail-studio-backup-${new Date().toISOString().split('T')[0]}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        // En Android, guardamos en el cache y compartimos para que el usuario elija dónde guardarlo o mandarlo
        const result = await Filesystem.writeFile({
          path: fileName,
          data: data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        await Share.share({
          title: 'Copia de Seguridad Nail Studio',
          url: result.uri,
          dialogTitle: 'Exportar Datos'
        });
      } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error al exportar los datos');
      }
    } else {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importData(content)) {
        alert('Datos importados correctamente');
      } else {
        alert('Error al importar los datos. Verifique el archivo.');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleSaveWorker = () => {
    if (!newWorker.nombre) return;

    // Check for duplicates
    const isDuplicate = workers.some(w => 
      w.businessId === activeBusinessId && 
      w.nombre.toLowerCase().trim() === newWorker.nombre.toLowerCase().trim() && 
      w.id !== editingWorkerId
    );

    if (isDuplicate) {
      setWorkerWarning(`Ya existe un trabajador con el nombre "${newWorker.nombre}" en este negocio.`);
      setTimeout(() => setWorkerWarning(null), 5000);
      return;
    }

    if (editingWorkerId) {
      updateWorker(editingWorkerId, newWorker);
      showNotification('Trabajador actualizado');
    } else {
      addWorker(newWorker);
      showNotification('Trabajador registrado');
    }
    setNewWorker({ nombre: '', especialidad: '', telefono: '', correo: '', foto: '' });
    setEditingWorkerId(null);
  };

  const handleSaveService = () => {
    if (!newService.nombre) return;

    // Check for duplicates
    const isDuplicate = services.some(s => 
      s.businessId === activeBusinessId && 
      s.nombre.toLowerCase().trim() === newService.nombre.toLowerCase().trim() && 
      s.id !== editingServiceId
    );

    if (isDuplicate) {
      setServiceWarning(`Ya existe un servicio con el nombre "${newService.nombre}" en este negocio.`);
      setTimeout(() => setServiceWarning(null), 5000);
      return;
    }

    if (editingServiceId) {
      updateService(editingServiceId, newService);
      showNotification('Servicio actualizado');
    } else {
      addService(newService);
      showNotification('Servicio registrado');
    }
    setNewService({ nombre: '', precio: 0, duracion: 30, materiales: [] });
    setEditingServiceId(null);
  };

  const allFilteredWorkers = workers.filter(w => w.businessId === activeBusinessId);
  const allFilteredServices = services.filter(s => s.businessId === activeBusinessId);
  const filteredMaterials = materials.filter(m => m.businessId === activeBusinessId && !m.deleted);

  const filteredWorkers = allFilteredWorkers.slice(0, workerLimit);
  const filteredServices = allFilteredServices.slice(0, serviceLimit);

  const addMaterialToService = (materialId: string) => {
    if (newService.materiales.some(m => m.materialId === materialId)) return;
    setNewService({
      ...newService,
      materiales: [...newService.materiales, { materialId, consumo: 1 }]
    });
  };

  const removeMaterialFromService = (materialId: string) => {
    setNewService({
      ...newService,
      materiales: newService.materiales.filter(m => m.materialId !== materialId)
    });
  };

  const updateMaterialConsumo = (materialId: string, consumo: number) => {
    setNewService({
      ...newService,
      materiales: newService.materiales.map(m => m.materialId === materialId ? { ...m, consumo } : m)
    });
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-md mx-auto pb-24 overflow-y-auto no-scrollbar bg-brand-pink-light">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-accent flex items-center gap-2">
            Configuración
          </h1>
          <p className="text-xs text-slate-400">
            Gestiona negocio, equipo y servicios
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <select
              value={activeBusinessId}
              onChange={(e) => setActiveBusiness(e.target.value)}
              className="bg-white border border-brand-pink rounded-xl px-3 py-1.5 text-[10px] font-bold text-brand-accent shadow-sm outline-none"
            >
              {businesses.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>

            {/* Botón de cerrar sesión */}
            <button
              onClick={onLogout}
              className="p-2 bg-red-50 text-red-400 rounded-xl border border-red-100 active:scale-95 transition-transform"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddingBusiness(true)}
            className="text-[8px] font-bold text-brand-accent underline uppercase tracking-wider"
          >
            + Nuevo Negocio
          </button>
        </div>
      </header>

      {/* Tabs con mejor visibilidad */}
      <div className="flex p-1 bg-white rounded-2xl mb-8 shadow-sm border border-brand-pink/50">
        {[
          { id: 'info', label: 'Negocio', icon: Briefcase },
          { id: 'workers', label: 'Equipo', icon: User },
          { id: 'services', label: 'Servicios', icon: Scissors },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSection(tab.id as any);
              setWorkerLimit(15);
              setServiceLimit(15);
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-[10px] font-bold transition-all ${
              activeSection === tab.id 
                ? 'bg-brand-accent text-white shadow-md' 
                : 'text-slate-400 hover:bg-brand-pink-light'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showSavedNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl z-[100] font-bold text-sm"
          >
            {notificationText}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeSection === 'info' && (
          <motion.div 
            key="info"
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre del Negocio</label>
                <input 
                  value={info.nombre}
                  onChange={(e) => setInfo({...info, nombre: e.target.value})}
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Descripción</label>
                <textarea 
                  value={info.descripcion}
                  onChange={(e) => setInfo({...info, descripcion: e.target.value})}
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm h-24 resize-none outline-none focus:ring-2 ring-brand-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Teléfono</label>
                  <input 
                    value={info.telefono}
                    onChange={(e) => setInfo({...info, telefono: e.target.value})}
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Correo</label>
                  <input 
                    value={info.correo}
                    onChange={(e) => setInfo({...info, correo: e.target.value})}
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleSaveInfo}
                  className="flex-1 py-4 rounded-2xl font-bold text-white bg-brand-accent flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
                {businesses.length > 1 && (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-4 rounded-2xl bg-red-50 text-red-500 border border-red-100 active:scale-95 transition-transform"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Copia de Seguridad</h3>
              <p className="text-[10px] text-slate-500 font-medium">Exporta tus datos para tener un respaldo o impórtalos desde un archivo anterior.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleExport}
                  className="py-3 rounded-2xl font-bold text-brand-accent bg-brand-pink-light border border-brand-pink/50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Download className="w-4 h-4" /> Exportar
                </button>
                
                <label className="py-3 rounded-2xl font-bold text-brand-accent bg-brand-pink-light border border-brand-pink/50 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer">
                  <Upload className="w-4 h-4" /> Importar
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImport} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'workers' && (
          <motion.div 
            key="workers"
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">{editingWorkerId ? 'Editar Trabajador' : 'Agregar Trabajador'}</h3>
              
              <AnimatePresence>
                {workerWarning && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <p className="text-[10px] font-bold text-amber-700">{workerWarning}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <input 
                placeholder="Nombre completo"
                value={newWorker.nombre}
                onChange={(e) => setNewWorker({...newWorker, nombre: e.target.value})}
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="Teléfono"
                  value={newWorker.telefono}
                  onChange={(e) => setNewWorker({...newWorker, telefono: e.target.value})}
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                />
                <input 
                  placeholder="Correo"
                  value={newWorker.correo}
                  onChange={(e) => setNewWorker({...newWorker, correo: e.target.value})}
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                />
              </div>
              <input 
                placeholder="Especialidad"
                value={newWorker.especialidad}
                onChange={(e) => setNewWorker({...newWorker, especialidad: e.target.value})}
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveWorker}
                  className="flex-1 py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg active:scale-95 transition-transform"
                >
                  {editingWorkerId ? 'Guardar Cambios' : 'Agregar al Equipo'}
                </button>
                {editingWorkerId && (
                  <button 
                    onClick={() => {
                      setEditingWorkerId(null);
                      setNewWorker({ nombre: '', especialidad: '', telefono: '', correo: '', foto: '' });
                    }}
                    className="px-6 py-4 rounded-2xl font-bold text-slate-400 bg-slate-100"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4">
              <h2 className="text-lg font-bold text-brand-accent mb-4 px-2">Trabajadores:</h2>
              <div className="space-y-3">
              {filteredWorkers.length > 0 ? filteredWorkers.map(w => (
                <div key={w.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-brand-pink/30 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-pink rounded-full flex items-center justify-center text-brand-accent">
                      {w.foto ? <img src={w.foto} className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block">{w.nombre}</span>
                      <span className="text-[8px] text-slate-400 uppercase font-bold">{w.especialidad || 'General'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingWorkerId(w.id);
                        setNewWorker({ 
                          nombre: w.nombre,
                          especialidad: w.especialidad || '',
                          telefono: w.telefono || '',
                          correo: w.correo || '',
                          foto: w.foto || ''
                        });
                      }}
                      className="text-slate-300 hover:text-brand-accent p-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteWorker(w.id)} className="text-slate-300 hover:text-red-400 p-2 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-400">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No hay trabajadores registrados</p>
                </div>
              )}

              {allFilteredWorkers.length > workerLimit && (
                <div className="pt-2 pb-4">
                  <button 
                    onClick={() => setWorkerLimit(prev => prev + 10)}
                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-accent bg-brand-pink border-2 border-brand-pink-medium shadow-sm active:scale-95 transition-all"
                  >
                    Mostrar más
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

        {activeSection === 'services' && (
          <motion.div 
            key="services"
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">{editingServiceId ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
              
              <AnimatePresence>
                {serviceWarning && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <p className="text-[10px] font-bold text-amber-700">{serviceWarning}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <input 
                placeholder="Nombre del servicio"
                value={newService.nombre}
                onChange={(e) => setNewService({...newService, nombre: e.target.value})}
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block">Precio ($)</label>
                  <input 
                    type="number" 
                    min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0"
                    value={newService.precio === 0 ? '' : newService.precio}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setNewService({...newService, precio: Math.max(0, Number(e.target.value))})}
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block">Duración (Min)</label>
                  <input 
                    type="number" 
                    min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="30"
                    value={newService.duracion === 0 ? '' : newService.duracion}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setNewService({...newService, duracion: Math.max(0, Number(e.target.value))})}
                    className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Materiales Consumidos</label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {filteredMaterials.map(m => {
                    const isSelected = newService.materiales.some(sm => sm.materialId === m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => addMaterialToService(m.id)}
                        className={cn(
                          "px-3 py-1.5 border rounded-xl text-[10px] font-bold whitespace-nowrap transition-all",
                          isSelected 
                            ? "bg-brand-accent text-white border-brand-accent shadow-md scale-105" 
                            : "bg-brand-pink-light border-brand-pink text-brand-accent"
                        )}
                      >
                        {isSelected ? '✓ ' : '+ '} {m.nombre}
                      </button>
                    );
                  })}
                </div>
                
                <div className="space-y-2">
                  {newService.materiales.map(sm => {
                    const material = materials.find(m => m.id === sm.materialId);
                    return (
                      <div key={sm.materialId} className="flex items-center gap-3 bg-brand-pink-light/50 p-3 rounded-2xl border border-brand-pink/30">
                        <span className="text-xs font-bold text-slate-700 flex-1">{material?.nombre}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-[8px] font-bold text-slate-400 uppercase">Consumo:</label>
                          <input 
                            type="number"
                            min="0"
                            onWheel={(e) => e.currentTarget.blur()}
                            value={sm.consumo === 0 ? '' : sm.consumo}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onChange={(e) => updateMaterialConsumo(sm.materialId, Math.max(0, Number(e.target.value)))}
                            className="w-16 bg-white rounded-lg p-1 text-xs font-bold text-center outline-none border border-brand-pink"
                          />
                        </div>
                        <button 
                          onClick={() => removeMaterialFromService(sm.materialId)}
                          className="text-red-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleSaveService}
                  className="flex-1 py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg active:scale-95 transition-transform"
                >
                  {editingServiceId ? 'Guardar Cambios' : 'Registrar Servicio'}
                </button>
                {editingServiceId && (
                  <button 
                    onClick={() => {
                      setEditingServiceId(null);
                      setNewService({ nombre: '', precio: 0, duracion: 30, materiales: [] });
                    }}
                    className="px-6 py-4 rounded-2xl font-bold text-slate-400 bg-slate-100"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4">
              <h2 className="text-lg font-bold text-brand-accent mb-4 px-2">Servicios:</h2>
              <div className="space-y-3">
              {filteredServices.length > 0 ? filteredServices.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-brand-pink/30 shadow-sm">
                  <div>
                    <p className="font-bold text-slate-700">{s.nombre}</p>
                    <p className="text-[10px] text-brand-accent font-bold">${s.precio.toLocaleString()} • {s.duracion} min</p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingServiceId(s.id);
                        setNewService({ ...s });
                      }}
                      className="text-slate-300 hover:text-brand-accent p-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteService(s.id)} className="text-slate-300 hover:text-red-400 p-2 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-400">
                  <Scissors className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No hay servicios registrados</p>
                </div>
              )}

              {allFilteredServices.length > serviceLimit && (
                <div className="pt-2 pb-4">
                  <button 
                    onClick={() => setServiceLimit(prev => prev + 10)}
                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-accent bg-brand-pink border-2 border-brand-pink-medium shadow-sm active:scale-95 transition-all"
                  >
                    Mostrar más
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Modal para Nuevo Negocio */}
      {isAddingBusiness && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-brand-accent mb-6">Nuevo Negocio</h2>
            <div className="space-y-4 mb-8">
              <input 
                id="new-business-name"
                placeholder="Nombre del negocio"
                className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    addBusiness({ nombre: e.currentTarget.value, descripcion: '', telefono: '', correo: '' });
                    setIsAddingBusiness(false);
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('new-business-name') as HTMLInputElement;
                  if (input && input.value) {
                    addBusiness({ nombre: input.value, descripcion: '', telefono: '', correo: '' });
                    setIsAddingBusiness(false);
                  }
                }}
                className="w-full py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg active:scale-95 transition-transform"
              >
                Crear Negocio
              </button>
            </div>
            <button 
              onClick={() => setIsAddingBusiness(false)}
              className="w-full py-4 rounded-2xl font-bold text-slate-400 bg-slate-50"
            >
              Cancelar
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">¿Estás seguro?</h2>
            <p className="text-xs text-slate-400 mb-8">
              Esta acción eliminará permanentemente el negocio <span className="font-bold text-brand-accent">"{activeBusiness.nombre}"</span> y todos sus datos asociados.
            </p>
            <div className="space-y-3">
              <button 
                onClick={handleDeleteBusiness}
                className="w-full py-4 rounded-2xl font-bold text-white bg-red-500 shadow-lg active:scale-95 transition-transform"
              >
                Sí, eliminar negocio
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-4 rounded-2xl font-bold text-slate-400 bg-slate-50 active:scale-95 transition-transform"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

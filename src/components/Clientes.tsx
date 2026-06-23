import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trash2, User, Phone, MapPin, Search, X, Edit2, Palette, ChevronLeft, Calendar, FileText, Users, AlertTriangle, Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client, AppointmentType } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useVoiceClientSearch } from '../hooks/useVoiceClientSearch';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PASTEL_COLORS = [
  '#FBCFE8', // Pink
  '#E9D5FF', // Purple
  '#BFDBFE', // Blue
  '#BBF7D0', // Green
  '#FEF08A', // Yellow
  '#FFEDD5', // Orange
];

export const Clientes: React.FC = () => {
  const { clients, activeBusinessId, addClient, updateClient, deleteClient, appointments, services } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(15);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const selectedClientRef = useRef(selectedClientForHistory);

  const businessClients = clients.filter(c => c.businessId === activeBusinessId);

  const {
    status: voiceStatus,
    transcript,
    foundClient,
    error: voiceErrorFromHook,
    recordingDuration,
    isConfigured: voiceIsConfigured,
    startRecording,
    stopRecording,
    cancelRecording,
    reset: resetVoice,
    speakMessage,
  } = useVoiceClientSearch(businessClients);

  useEffect(() => {
    if (voiceErrorFromHook) {
      setVoiceError(voiceErrorFromHook);
      setTimeout(() => setVoiceError(null), 5000);
    }
  }, [voiceErrorFromHook]);

  useEffect(() => {
    if (foundClient) {
      setSelectedClientForHistory(foundClient);
      resetVoice();
    }
  }, [foundClient, resetVoice]);

  useEffect(() => {
    selectedClientRef.current = selectedClientForHistory;
  }, [selectedClientForHistory]);

  // Escuchar evento backbutton_pressed para cerrar historial
  useEffect(() => {
    const handleBack = (e: Event) => {
      if (selectedClientRef.current) {
        e.preventDefault();
        setSelectedClientForHistory(null);
      }
    };
    window.addEventListener('backbutton_pressed', handleBack);
    return () => window.removeEventListener('backbutton_pressed', handleBack);
  }, []);

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    tipoFrecuente: 'Salón' as AppointmentType,
    color: PASTEL_COLORS[0]
  });
  const [warning, setWarning] = useState<string | null>(null);

  const allFilteredClients = clients.filter(c => 
    c.businessId === activeBusinessId && (
      c.nombre.toLowerCase().includes(search.toLowerCase()) || 
      c.telefono?.includes(search)
    )
  );

  const filteredClients = allFilteredClients.slice(0, limit);

  const clientAppointments = selectedClientForHistory 
    ? appointments.filter(a => a.clientId === selectedClientForHistory.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
    : [];

  const totalCitas = clientAppointments.filter(a => a.completada).length;
  const totalGastado = clientAppointments.filter(a => a.completada).reduce((sum, a) => sum + a.precioFinal, 0);
  const totalPropinas = clientAppointments.filter(a => a.completada).reduce((sum, a) => sum + (a.propina || 0), 0);

  if (selectedClientForHistory) {
    return (
      <div className="flex flex-col h-screen bg-brand-pink-light">
        <div className="p-6 pb-0">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => setSelectedClientForHistory(null)}
              className="p-3 bg-white rounded-2xl shadow-md text-brand-accent active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-black text-brand-accent uppercase tracking-tighter">Historial</h1>
          </div>

          {/* Resumen del Cliente */}
          <div className="bg-white p-8 rounded-[40px] border-2 border-brand-pink shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/20 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-brand-accent mb-2">{selectedClientForHistory.nombre}</h2>
              <p className="text-xs font-bold text-slate-500 mb-6 flex items-center gap-2">
                <Phone className="w-3 h-3" /> {selectedClientForHistory.telefono}
              </p>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-brand-pink-light p-3 rounded-2xl shadow-sm border border-brand-pink/50 flex flex-col justify-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Citas</p>
                  <p className="text-sm font-black text-brand-accent">{totalCitas}</p>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-brand-pink/50 flex flex-col justify-center overflow-hidden">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Gastado</p>
                  <p className="text-sm font-black text-brand-accent truncate">
                    ${totalGastado.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center overflow-hidden">
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Propinas</p>
                <p className="text-sm font-black text-emerald-600 truncate">
                  ${totalPropinas.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Citas */}
        <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Citas Realizadas</h3>
          <div className="space-y-4">
            {clientAppointments.length === 0 ? (
              <div className="bg-white p-10 rounded-[40px] text-center border-2 border-dashed border-brand-pink">
                <Calendar className="w-12 h-12 text-brand-pink mx-auto mb-4 opacity-50" />
                <p className="text-sm font-bold text-slate-400">No hay citas registradas</p>
              </div>
            ) : (
              clientAppointments.map(app => (
                <div key={app.id} className="bg-white p-6 rounded-[32px] shadow-md border-2 border-brand-pink/30 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{app.fecha}</p>
                      <p className="text-sm font-black text-brand-accent">{app.hora}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                      app.completada ? "bg-emerald-100 text-emerald-600" : "bg-brand-pink text-brand-accent"
                    )}>
                      {app.completada ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {app.serviciosIds.map(sId => {
                      const s = services.find(srv => srv.id === sId);
                      return (
                        <div key={sId} className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600">{app.serviciosNombres?.[sId] || s?.nombre}</span>
                          <span className="text-xs font-black text-brand-accent">${(app.serviciosPrecios?.[sId] ?? s?.precio ?? 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                    {app.tipo === 'Domicilio' && (
                      <div className="flex justify-between items-center text-slate-400 italic">
                        <span className="text-xs font-bold">Domicilio</span>
                        <span className="text-xs font-black">${app.tarifaDomicilio?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-brand-pink/30 flex flex-col gap-1">
                    {app.propina && app.propina > 0 && (
                      <div className="flex justify-between items-center text-emerald-500">
                        <span className="text-[10px] font-black uppercase tracking-widest">Propina</span>
                        <span className="text-xs font-black">+${app.propina.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                      <span className="text-lg font-black text-brand-accent">${app.precioFinal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!form.nombre) return;
    
    // Check for duplicates
    const isDuplicate = clients.some(c => 
      c.businessId === activeBusinessId && 
      c.nombre.toLowerCase().trim() === form.nombre.toLowerCase().trim() && 
      c.id !== editingId
    );

    if (isDuplicate) {
      setWarning(`Ya existe un cliente con el nombre "${form.nombre}" en este negocio.`);
      setTimeout(() => setWarning(null), 5000);
      return;
    }

    if (editingId) {
      updateClient(editingId, form);
    } else {
      addClient(form);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setForm({ nombre: '', telefono: '', direccion: '', tipoFrecuente: 'Salón', color: PASTEL_COLORS[0] });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const startEdit = (c: Client) => {
    setForm({ 
      nombre: c.nombre, 
      telefono: c.telefono || '', 
      direccion: c.direccion || '', 
      tipoFrecuente: c.tipoFrecuente,
      color: c.color || PASTEL_COLORS[0]
    });
    setEditingId(c.id);
    setIsModalOpen(true);
  };

  const handlePhoneChange = (val: string) => {
    const onlyNums = val.replace(/[^0-9]/g, '');
    setForm({...form, telefono: onlyNums});
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-md mx-auto bg-brand-pink-light">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-accent flex items-center gap-2">Clientes</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-brand-accent text-white rounded-xl shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar cliente..." 
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(15);
          }}
          className="w-full bg-white border-none rounded-2xl py-3 pl-10 pr-12 text-sm shadow-sm focus:ring-2 ring-brand-accent outline-none"
        />
        {voiceIsConfigured ? (
          <button
            onClick={voiceStatus === 'recording' ? stopRecording : startRecording}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
              voiceStatus === 'recording' 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-brand-pink-light text-brand-accent hover:bg-brand-pink active:scale-90"
            )}
            title={voiceStatus === 'recording' ? 'Detener grabación' : 'Buscar por voz'}
          >
            {voiceStatus === 'recording' ? (
              <div className="relative">
                <MicOff className="w-4 h-4" />
                {recordingDuration > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-300" title="Comando de voz no disponible">
            <MicOff className="w-4 h-4" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {voiceError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{voiceError}</p>
          </motion.div>
        )}

        {voiceStatus !== 'idle' && voiceStatus !== 'error' && voiceStatus !== 'found' && voiceStatus !== 'not_found' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-brand-pink-light border-2 border-brand-pink rounded-2xl"
          >
            <div className="flex items-center gap-3">
              {voiceStatus === 'recording' && (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-brand-accent">Grabando... {recordingDuration}s</span>
                </>
              )}
              {voiceStatus === 'uploading' && (
                <>
                  <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-brand-accent">Subiendo audio...</span>
                </>
              )}
              {voiceStatus === 'transcribing' && (
                <>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-brand-accent">Transcribiendo...</span>
                </>
              )}
              {voiceStatus === 'processing' && (
                <>
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-brand-accent">Procesando con IA...</span>
                </>
              )}
              {voiceStatus === 'searching' && (
                <>
                  <Volume2 className="w-4 h-4 text-brand-accent animate-pulse" />
                  <span className="text-sm font-bold text-brand-accent">Buscando clienta...</span>
                </>
              )}
            </div>
            {transcript && (
              <p className="mt-2 text-xs text-slate-500 italic">"¿{transcript}?"</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-4 pb-24 no-scrollbar">
        <AnimatePresence>
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No hay clientes registrados</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <motion.div 
                key={client.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => setSelectedClientForHistory(client)}
                className="bg-white p-4 rounded-3xl card-shadow border border-brand-pink/50 flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-brand-accent shadow-inner"
                    style={{ backgroundColor: client.color || '#FBCFE8' }}
                  >
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{client.nombre}</h3>
                    <div className="flex flex-col gap-0.5">
                      {client.telefono && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Phone className="w-3 h-3" /> {client.telefono}
                        </div>
                      )}
                      {client.direccion && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <MapPin className="w-3 h-3" /> {client.direccion}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(client);
                    }} 
                    className="p-2 text-slate-300 hover:text-brand-accent transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClient(client.id);
                    }}
                    className="p-2 text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))
          )}

          {allFilteredClients.length > limit && (
            <div className="pt-2 pb-8">
              <button 
                onClick={() => setLimit(prev => prev + 10)}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-accent bg-brand-pink border-2 border-brand-pink-medium shadow-sm active:scale-95 transition-all"
              >
                Mostrar más
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-accent">{editingId ? 'Editar Cliente' : 'Nueva Clienta'}</h2>
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

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre *</label>
                <input 
                  placeholder="Nombre completo" 
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
                  value={form.nombre}
                  onChange={(e) => setForm({...form, nombre: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Teléfono (Solo números)</label>
                <input 
                  placeholder="Ej: 3001234567" 
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
                  value={form.telefono}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dirección</label>
                <input 
                  placeholder="Dirección opcional" 
                  className="w-full bg-brand-pink-light rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-brand-accent"
                  value={form.direccion}
                  onChange={(e) => setForm({...form, direccion: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Color del Icono
                </label>
                <div className="flex gap-3">
                  {PASTEL_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm({...form, color})}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        form.color === color ? "border-brand-accent scale-110 shadow-md" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg active:scale-95 transition-transform"
            >
              {editingId ? 'Guardar Cambios' : 'Registrar Clienta'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

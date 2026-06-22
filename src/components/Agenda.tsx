import React, { useState, useRef } from 'react';
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Calendar, Clock, MapPin, User, CheckCircle2, Circle, ChevronLeft, ChevronRight, Trash2, Edit, FileText, X, RotateCcw, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AppointmentType, Service, Appointment, PaymentMethod } from '../types';
import { toPng } from 'html-to-image';
import { Invoice } from './Invoice';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const Agenda: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [filter, setFilter] = useState<'pending' | 'finished' | 'all'>('all');
  const [limit, setLimit] = useState(15);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [captureApp, setCaptureApp] = useState<Appointment | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const { 
    appointments, clients, services, workers, activeBusinessId, businesses,
    toggleAppointmentStatus, addAppointment, updateAppointment, deleteAppointment, undoDelete 
  } = useStore();

  const activeBusiness = businesses.find(b => b.id === activeBusinessId);

  // Formulario de nueva cita
  const [newApp, setNewApp] = useState({
    clientId: '',
    workerId: '',
    hora: '10:00',
    serviciosIds: [] as string[],
    tipo: 'Salón' as AppointmentType,
    direccion: '',
    tarifaDomicilio: 0,
    serviciosPrecios: {} as Record<string, number>,
    serviciosMultiplicadores: {} as Record<string, number>,
    descuentoValor: 0,
    descuentoTipo: 'fixed' as 'fixed' | 'percent',
    notas: ''
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentApp, setPaymentApp] = useState<Appointment | null>(null);
  const [paymentData, setPaymentData] = useState({
    abonoEfectivo: 0,
    abonoTransferencia: 0,
    metodoPago: 'Efectivo' as PaymentMethod | 'Mixto',
    propina: 0
  });

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsApp, setDetailsApp] = useState<Appointment | null>(null);

  const weekDays = Array.from({ length: 7 }).map((_, i) => 
    addDays(currentWeekStart, i)
  );

  const dailyAppointments = appointments
    .filter(app => app.businessId === activeBusinessId && app.fecha === format(selectedDate, 'yyyy-MM-dd'))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const allFilteredAppointments = appointments
    .filter(app => {
      if (app.businessId !== activeBusinessId) return false;
      if (filter === 'pending') return !app.completada;
      if (filter === 'finished') return app.completada;
      return app.fecha === format(selectedDate, 'yyyy-MM-dd');
    })
    .sort((a, b) => {
      if (filter === 'all') {
        return a.hora.localeCompare(b.hora);
      }
      
      const dateA = new Date(`${a.fecha}T${a.hora}`);
      const dateB = new Date(`${b.fecha}T${b.hora}`);
      
      if (filter === 'pending') {
        // Pendientes: más prontas a lejanas
        return dateA.getTime() - dateB.getTime();
      } else {
        // Finalizadas: más recientes a antiguas
        return dateB.getTime() - dateA.getTime();
      }
    });

  const filteredAppointments = allFilteredAppointments.slice(0, limit);

  const totalDailyRevenue = dailyAppointments.reduce((sum, app) => sum + app.precioFinal, 0);

  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentWeekStart(today);
    setSelectedDate(today);
    setFilter('all');
  };

  const handleDelete = (id: string) => {
    deleteAppointment(id);
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 5000);
  };

  const handleDownloadInvoice = async (app: Appointment) => {
    setCaptureApp(app);
    
    // Esperar a que el DOM se actualice con la nueva cita para capturar
    setTimeout(async () => {
      const element = document.getElementById('invoice-capture');
      if (!element) {
        setCaptureApp(null);
        return;
      }

      try {
        const dataUrl = await toPng(element, { 
          quality: 1, 
          backgroundColor: '#fff',
          pixelRatio: 3 // Mayor calidad para evitar borrosidad
        });
        
        if (Capacitor.isNativePlatform()) {
          const fileName = `factura-${app.id}.png`;
          const base64Data = dataUrl.split(',')[1];
          
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Factura Nail Studio',
            text: `Factura de cita - ${app.fecha} ${app.hora}`,
            url: savedFile.uri,
            dialogTitle: 'Compartir Factura'
          });
        } else {
          if (navigator.share) {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `factura-${app.id}.png`, { type: 'image/png' });
            await navigator.share({
              files: [file],
              title: 'Factura',
              text: `Factura de cita - ${app.fecha} ${app.hora}`,
            });
          } else {
            const link = document.createElement('a');
            link.download = `factura-${app.id}.png`;
            link.href = dataUrl;
            link.click();
          }
        }
      } catch (err) {
        console.error('Error generating invoice:', err);
      } finally {
        setCaptureApp(null);
      }
    }, 300);
  };

  const filteredClients = clients.filter(c => c.businessId === activeBusinessId);
  const filteredServices = services.filter(s => s.businessId === activeBusinessId);
  const filteredWorkers = workers.filter(w => w.businessId === activeBusinessId);

  const selectedServices = newApp.serviciosIds.map(id => filteredServices.find(s => s.id === id)).filter(Boolean) as Service[];
  
  const estimatedValue = selectedServices.reduce((sum, s) => {
    const m = newApp.serviciosMultiplicadores?.[s.id] ?? 1;
    return sum + s.precio * m;
  }, 0);
  const currentTotalServices = selectedServices.reduce((sum, s) => {
    const m = newApp.serviciosMultiplicadores?.[s.id] ?? 1;
    return sum + (newApp.serviciosPrecios[s.id] ?? s.precio) * m;
  }, 0);
  
  const discountAmount = newApp.descuentoTipo === 'percent' 
    ? (currentTotalServices * (newApp.descuentoValor / 100)) 
    : newApp.descuentoValor;
    
  const finalTotal = Math.max(0, currentTotalServices - discountAmount) + (newApp.tipo === 'Domicilio' ? newApp.tarifaDomicilio : 0);
  const difference = finalTotal - (estimatedValue + (newApp.tipo === 'Domicilio' ? newApp.tarifaDomicilio : 0));

  const getRecalculatedEditTotals = (app: Appointment, newFields: Partial<Appointment>): Appointment => {
    const merged = { ...app, ...newFields };
    const currentTotalServices = merged.serviciosIds.reduce((sum, sId) => {
      const price = merged.serviciosPrecios?.[sId] ?? filteredServices.find(s => s.id === sId)?.precio ?? 0;
      const mult = merged.serviciosMultiplicadores?.[sId] ?? 1;
      return sum + price * mult;
    }, 0);
    const discountAmount = merged.descuentoTipo === 'percent'
      ? (currentTotalServices * ((merged.descuentoValor || 0) / 100))
      : (merged.descuentoValor || 0);
    const newFinal = Math.max(0, currentTotalServices - discountAmount) + (merged.tipo === 'Domicilio' ? (merged.tarifaDomicilio || 0) : 0);
    const newOriginal = merged.serviciosIds.reduce((sum, sId) => {
      const basePrice = filteredServices.find(s => s.id === sId)?.precio ?? 0;
      const mult = merged.serviciosMultiplicadores?.[sId] ?? 1;
      return sum + basePrice * mult;
    }, 0);
    return {
      ...merged,
      precioFinal: newFinal,
      precioOriginal: newOriginal
    };
  };

  const handleAddAppointment = () => {
    if (!newApp.clientId || newApp.serviciosIds.length === 0) return;
    
    addAppointment({
      ...newApp,
      fecha: format(selectedDate, 'yyyy-MM-dd'),
      precioOriginal: estimatedValue,
      precioFinal: finalTotal,
    });
    
    setIsModalOpen(false);
    setNewApp({ 
      clientId: '', 
      workerId: '', 
      hora: '10:00', 
      serviciosIds: [], 
      tipo: 'Salón', 
      direccion: '',
      tarifaDomicilio: 0, 
      serviciosPrecios: {}, 
      serviciosMultiplicadores: {},
      descuentoValor: 0,
      descuentoTipo: 'fixed',
      notas: '' 
    });
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-brand-pink-light">
      {/* Header con Selector de Días */}
      <div className="p-6 bg-white rounded-b-[40px] shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-brand-accent flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Agenda
          </h1>
          <div className="flex gap-2">
            <button onClick={handlePrevWeek} className="p-2 bg-brand-pink rounded-xl text-brand-accent"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleToday} className="px-3 py-1 bg-brand-pink rounded-xl text-brand-accent text-[10px] font-bold">HOY</button>
            <button onClick={handleNextWeek} className="p-2 bg-brand-pink rounded-xl text-brand-accent"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="flex justify-between gap-2 overflow-x-auto pb-2 no-scrollbar">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toString()}
                onClick={() => {
                  setSelectedDate(day);
                  setFilter('all');
                }}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[65px] py-3 rounded-2xl transition-all duration-300",
                  isSelected 
                    ? "bg-brand-accent text-white shadow-lg scale-105" 
                    : "bg-brand-pink text-brand-accent hover:bg-brand-pink-medium"
                )}
              >
                <span className="text-[9px] uppercase font-black tracking-tighter opacity-80">
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span className="text-lg font-black leading-none my-0.5">
                  {format(day, 'd')}
                </span>
                <span className="text-[9px] uppercase font-black tracking-tighter opacity-80">
                  {format(day, 'MMM', { locale: es })}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mt-4">
          {(['all', 'pending', 'finished'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setLimit(15);
              }}
              className={cn(
                "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filter === f ? "bg-brand-accent text-white shadow-md" : "bg-brand-pink-light text-slate-400"
              )}
            >
              {f === 'all' ? 'Hoy' : f === 'pending' ? 'Pendientes' : 'Finalizadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen del día / Filtro */}
      <div className="px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {filter === 'all' ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: es }) : filter === 'pending' ? 'Citas Pendientes' : 'Citas Finalizadas'}
          </h2>
          <p className="text-xs font-bold text-slate-600">
            {allFilteredAppointments.length} {allFilteredAppointments.length === 1 ? 'cita' : 'citas'}
          </p>
        </div>
        {filter === 'all' && (
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total día</p>
            <p className="text-lg font-black text-brand-accent">
              ${totalDailyRevenue.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Lista de Citas */}
      <div className="flex-1 px-6 pb-24 overflow-y-auto space-y-4 no-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredAppointments.length > 0 ? (
            filteredAppointments.map((app) => {
              const client = filteredClients.find(c => c.id === app.clientId);
              const worker = filteredWorkers.find(w => w.id === app.workerId);
              const appServices = app.serviciosIds.map(id => filteredServices.find(s => s.id === id)?.nombre).join(', ');

              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-5 rounded-[32px] bg-white card-shadow border border-brand-pink/50 relative overflow-hidden",
                    app.completada && "opacity-80"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-brand-pink flex items-center justify-center text-brand-accent shadow-inner">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 leading-tight">{client?.nombre || 'Cliente'}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                          <Clock className="w-3 h-3" />
                          {app.hora} • {app.tipo}
                          {filter !== 'all' && ` • ${format(parseISO(app.fecha), 'd MMM', { locale: es })}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-brand-accent font-black text-xl leading-none">${app.precioFinal.toLocaleString()}</span>
                      {app.precioFinal !== app.precioOriginal && (
                        <p className="text-[9px] font-bold text-slate-300 line-through mt-0.5">${app.precioOriginal.toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {app.serviciosIds.map(id => {
                      const s = filteredServices.find(srv => srv.id === id);
                      return (
                        <span key={id} className="px-2 py-1 bg-brand-pink-light rounded-lg text-[9px] font-black text-brand-accent uppercase tracking-tighter border border-brand-pink/30">
                          {app.serviciosNombres?.[id] || s?.nombre || 'Servicio'}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-brand-pink/30">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          if (app.completada) {
                            setDetailsApp(app);
                            setIsDetailsModalOpen(true);
                          } else {
                            setEditingApp({
                              ...app,
                              serviciosMultiplicadores: app.serviciosMultiplicadores || {}
                            });
                            setIsEditModalOpen(true);
                          }
                        }}
                        className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-pink hover:text-brand-accent transition-colors"
                      >
                        {app.completada ? <Search className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDelete(app.id)}
                        className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDownloadInvoice(app)}
                        className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-pink hover:text-brand-accent transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (app.completada) {
                          toggleAppointmentStatus(app.id);
                        } else {
                          setPaymentApp(app);
                          setPaymentData({
                            abonoEfectivo: app.precioFinal,
                            abonoTransferencia: 0,
                            metodoPago: 'Efectivo',
                            propina: 0
                          });
                          setIsPaymentModalOpen(true);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                        app.completada 
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
                          : "bg-brand-accent text-white shadow-lg shadow-brand-accent/30 active:scale-95"
                      )}
                    >
                      {app.completada ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Pagado
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4" />
                          Pagar
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Calendar className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">
                {filter === 'pending' ? 'No hay citas pendientes' : filter === 'finished' ? 'No hay citas finalizadas' : 'No hay citas para este día'}
              </p>
            </div>
          )}

          {allFilteredAppointments.length > limit && (
            <div className="pt-4 pb-8">
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

      {/* Botón Flotante */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-brand-accent text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform z-10"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Undo Toast removed - handled globally */}

      {/* Modal de Pago */}
      {isPaymentModalOpen && paymentApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
          >
            <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter mb-6 text-center">Confirmar Pago</h2>
            
            <div className="space-y-6 mb-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                <p className="text-4xl font-black text-brand-accent">${paymentApp.precioFinal.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Efectivo</label>
                  <input 
                    type="number" 
                    min="0"
                    disabled={paymentData.metodoPago === 'Transferencia'}
                    onWheel={(e) => e.currentTarget.blur()}
                    value={paymentData.abonoEfectivo === 0 ? '' : paymentData.abonoEfectivo}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setPaymentData({...paymentData, abonoEfectivo: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))})}
                    className={cn(
                      "w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700",
                      paymentData.metodoPago === 'Transferencia' && "opacity-50 cursor-not-allowed"
                    )} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Transferencia</label>
                  <input 
                    type="number" 
                    min="0"
                    disabled={paymentData.metodoPago === 'Efectivo'}
                    onWheel={(e) => e.currentTarget.blur()}
                    value={paymentData.abonoTransferencia === 0 ? '' : paymentData.abonoTransferencia}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setPaymentData({...paymentData, abonoTransferencia: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))})}
                    className={cn(
                      "w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700",
                      paymentData.metodoPago === 'Efectivo' && "opacity-50 cursor-not-allowed"
                    )} 
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Propina (Opcional)</label>
                  <input 
                    type="number" 
                    min="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Monto de propina"
                    value={paymentData.propina === 0 ? '' : paymentData.propina}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                    onChange={(e) => setPaymentData({...paymentData, propina: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))})}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Devuelta</span>
                <span className={cn(
                  "text-lg font-black",
                  (paymentData.abonoEfectivo + paymentData.abonoTransferencia - paymentApp.precioFinal) >= 0 ? "text-emerald-500" : "text-red-400"
                )}>
                  ${Math.max(0, paymentData.abonoEfectivo + paymentData.abonoTransferencia - paymentApp.precioFinal).toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Método de Pago</label>
                <div className="flex gap-2">
                  {['Efectivo', 'Transferencia', 'Mixto'].map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        const method = m as PaymentMethod | 'Mixto';
                        let newEfectivo = paymentData.abonoEfectivo;
                        let newTransferencia = paymentData.abonoTransferencia;
                        
                        if (method === 'Efectivo') {
                          newEfectivo = paymentApp.precioFinal;
                          newTransferencia = 0;
                        } else if (method === 'Transferencia') {
                          newEfectivo = 0;
                          newTransferencia = paymentApp.precioFinal;
                        }
                        
                        setPaymentData({
                          ...paymentData, 
                          metodoPago: method,
                          abonoEfectivo: newEfectivo,
                          abonoTransferencia: newTransferencia
                        });
                      }}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all",
                        paymentData.metodoPago === m 
                          ? "bg-brand-accent border-brand-accent text-white shadow-md" 
                          : "bg-white border-brand-pink text-brand-accent"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                disabled={(paymentData.abonoEfectivo + paymentData.abonoTransferencia) < paymentApp.precioFinal}
                onClick={() => {
                  toggleAppointmentStatus(paymentApp.id, {
                    ...paymentData,
                    devuelta: Math.max(0, paymentData.abonoEfectivo + paymentData.abonoTransferencia - paymentApp.precioFinal)
                  });
                  setIsPaymentModalOpen(false);
                }}
                className="flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg disabled:opacity-50"
              >
                Confirmar Pago
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Detalles (Citas Pagadas) */}
      {isDetailsModalOpen && detailsApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">Detalles de Cita</h2>
              <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 mb-8">
              <div className="bg-brand-pink-light p-6 rounded-[32px] border-2 border-brand-pink">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                    <p className="text-lg font-black text-brand-accent">{filteredClients.find(c => c.id === detailsApp.clientId)?.nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</p>
                    <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest">Pagado</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</p>
                    <p className="text-sm font-bold text-slate-700">{detailsApp.fecha} - {detailsApp.hora}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</p>
                    <p className="text-sm font-bold text-slate-700">{detailsApp.tipo}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trabajador</p>
                  <p className="text-sm font-bold text-slate-700">{detailsApp.workerNombre || 'General'}</p>
                </div>

                {detailsApp.direccion && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección</p>
                    <p className="text-sm font-bold text-slate-700">{detailsApp.direccion}</p>
                  </div>
                )}

                {detailsApp.notas && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas</p>
                    <p className="text-sm font-bold text-slate-600 italic">"{detailsApp.notas}"</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicios Realizados</h3>
                {detailsApp.serviciosIds.map(id => {
                  const s = filteredServices.find(srv => srv.id === id);
                  return (
                    <div key={id} className="flex justify-between items-center py-2 border-b border-brand-pink/30">
                      <span className="text-sm font-bold text-slate-700">{detailsApp.serviciosNombres?.[id] || s?.nombre}</span>
                      <span className="text-sm font-black text-brand-accent">${(detailsApp.serviciosPrecios?.[id] ?? s?.precio ?? 0).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 p-6 rounded-[32px] space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pago</span>
                  <span className="text-sm font-black text-brand-accent uppercase">{detailsApp.metodoPago}</span>
                </div>
                <div className="space-y-2 text-xs font-bold text-slate-500">
                  {detailsApp.abonoEfectivo !== undefined && detailsApp.abonoEfectivo > 0 && <div className="flex justify-between"><span>Efectivo:</span><span>${detailsApp.abonoEfectivo.toLocaleString()}</span></div>}
                  {detailsApp.abonoTransferencia !== undefined && detailsApp.abonoTransferencia > 0 && <div className="flex justify-between"><span>Transferencia:</span><span>${detailsApp.abonoTransferencia.toLocaleString()}</span></div>}
                  {detailsApp.devuelta !== undefined && <div className="flex justify-between text-emerald-500"><span>Devuelta:</span><span>${detailsApp.devuelta.toLocaleString()}</span></div>}
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pagado</span>
                  <span className="text-2xl font-black text-brand-accent">${detailsApp.precioFinal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsDetailsModalOpen(false)}
              className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg"
            >
              Cerrar
            </button>
          </motion.div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-accent">Nueva Cita</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Cliente</label>
                  <select 
                    value={newApp.clientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      const client = filteredClients.find(c => c.id === clientId);
                      setNewApp({
                        ...newApp, 
                        clientId,
                        direccion: client?.direccion || ''
                      });
                    }}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm focus:ring-2 ring-brand-accent"
                  >
                    <option value="">Seleccionar...</option>
                    {filteredClients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Trabajador</label>
                  <select 
                    value={newApp.workerId}
                    onChange={(e) => setNewApp({...newApp, workerId: e.target.value})}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm focus:ring-2 ring-brand-accent"
                  >
                    <option value="">Cualquiera</option>
                    {filteredWorkers.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Servicios</label>
                <div className="flex flex-wrap gap-2">
                  {filteredServices.map(s => {
                    const isSelected = newApp.serviciosIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          const ids = isSelected 
                            ? newApp.serviciosIds.filter(id => id !== s.id)
                            : [...newApp.serviciosIds, s.id];
                          const newMults = { ...newApp.serviciosMultiplicadores };
                          if (!isSelected) {
                            newMults[s.id] = 1;
                          } else {
                            delete newMults[s.id];
                          }
                          setNewApp({
                            ...newApp, 
                            serviciosIds: ids,
                            serviciosMultiplicadores: newMults
                          });
                        }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-bold transition-all",
                          isSelected ? "bg-brand-accent text-white" : "bg-brand-pink text-brand-accent"
                        )}
                      >
                        {s.nombre} (${s.precio})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Hora</label>
                  <input 
                    type="time" 
                    value={newApp.hora}
                    onChange={(e) => setNewApp({...newApp, hora: e.target.value})}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tipo</label>
                  <select 
                    value={newApp.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as AppointmentType;
                      let extra = {};
                      if (tipo === 'Domicilio' && !newApp.direccion && newApp.clientId) {
                        const client = filteredClients.find(c => c.id === newApp.clientId);
                        if (client?.direccion) {
                          extra = { direccion: client.direccion };
                        }
                      }
                      setNewApp({
                        ...newApp,
                        tipo,
                        ...extra
                      });
                    }}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm"
                  >
                    <option value="Salón">Salón</option>
                    <option value="Domicilio">Domicilio</option>
                  </select>
                </div>
              </div>

              {newApp.tipo === 'Domicilio' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Tarifa Domicilio</label>
                    <input 
                      type="number" 
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      value={newApp.tarifaDomicilio === 0 ? '' : newApp.tarifaDomicilio}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                        setNewApp({...newApp, tarifaDomicilio: val});
                      }}
                      className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Dirección</label>
                    <input 
                      type="text" 
                      value={newApp.direccion}
                      onChange={(e) => setNewApp({...newApp, direccion: e.target.value})}
                      className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                      placeholder="Calle 123..."
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Notas (Opcional)</label>
                <textarea 
                  value={newApp.notas}
                  onChange={(e) => setNewApp({...newApp, notas: e.target.value})}
                  className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700 min-h-[80px]"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="bg-brand-pink-light p-6 rounded-[32px] border-2 border-brand-pink space-y-4 shadow-inner">
                <h3 className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] border-b border-brand-pink/50 pb-3">Ajuste de Precios</h3>
                
                <div className="space-y-3">
                  {selectedServices.map(s => {
                    const currentMult = newApp.serviciosMultiplicadores?.[s.id] ?? 1;
                    return (
                      <div key={s.id} className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{s.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400">x</span>
                          <input 
                            type="number"
                            min="1"
                            step="1"
                            onWheel={(e) => e.currentTarget.blur()}
                            value={currentMult}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setNewApp({
                                ...newApp,
                                serviciosMultiplicadores: {
                                  ...newApp.serviciosMultiplicadores,
                                  [s.id]: val
                                }
                              });
                            }}
                            className="w-12 bg-white border-2 border-brand-pink rounded-xl px-1 py-2 text-xs font-black text-brand-accent text-center shadow-sm"
                          />
                          <span className="text-[10px] font-black text-slate-400">$</span>
                          <input 
                            type="number"
                            min="0"
                            onWheel={(e) => e.currentTarget.blur()}
                            value={newApp.serviciosPrecios[s.id] ?? s.precio}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                              setNewApp({
                                ...newApp, 
                                serviciosPrecios: { ...newApp.serviciosPrecios, [s.id]: val }
                              });
                            }}
                            className="w-24 bg-white border-2 border-brand-pink rounded-xl px-3 py-2 text-xs font-black text-brand-accent text-right shadow-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t-2 border-brand-pink space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descuento</label>
                      <button 
                        onClick={() => setNewApp({...newApp, descuentoTipo: newApp.descuentoTipo === 'fixed' ? 'percent' : 'fixed'})}
                        className="px-2 py-1 bg-brand-pink text-brand-accent rounded-lg text-[8px] font-black uppercase"
                      >
                        {newApp.descuentoTipo === 'fixed' ? '$' : '%'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        onWheel={(e) => e.currentTarget.blur()}
                        value={newApp.descuentoValor || ''}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onChange={(e) => setNewApp({...newApp, descuentoValor: Math.max(0, Number(e.target.value))})}
                        className="w-24 bg-white border-2 border-brand-pink rounded-xl px-3 py-2 text-xs font-black text-brand-accent text-right shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Final</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-brand-accent">${finalTotal.toLocaleString()}</span>
                      {difference !== 0 && (
                        <p className={cn("text-[8px] font-black uppercase", difference > 0 ? "text-emerald-500" : "text-red-400")}>
                          {difference > 0 ? `+${difference.toLocaleString()}` : `${difference.toLocaleString()}`} vs estimado
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-400 bg-slate-100"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddAppointment}
                className="flex-[2] py-4 rounded-2xl font-bold text-white bg-brand-accent shadow-lg shadow-brand-accent/30"
              >
                Guardar Cita
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Modal para Editar Cita */}
      {isEditModalOpen && editingApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">Editar Cita</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Hora</label>
                  <input 
                    type="time" 
                    value={editingApp.hora}
                    onChange={(e) => setEditingApp({...editingApp, hora: e.target.value})}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Tipo</label>
                  <select 
                    value={editingApp.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as AppointmentType;
                      let extra: Partial<Appointment> = { tipo };
                      if (tipo === 'Domicilio' && !editingApp.direccion && editingApp.clientId) {
                        const client = filteredClients.find(c => c.id === editingApp.clientId);
                        if (client?.direccion) {
                          extra.direccion = client.direccion;
                        }
                      }
                      setEditingApp(getRecalculatedEditTotals(editingApp, extra));
                    }}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                  >
                    <option value="Salón">Salón</option>
                    <option value="Domicilio">Domicilio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Servicios</label>
                <div className="flex flex-wrap gap-2">
                  {filteredServices.map(s => {
                    const isSelected = editingApp.serviciosIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          const ids = isSelected 
                            ? editingApp.serviciosIds.filter(id => id !== s.id)
                            : [...editingApp.serviciosIds, s.id];
                          
                          const newPrecios = { ...editingApp.serviciosPrecios };
                          const newMults = { ...editingApp.serviciosMultiplicadores };
                          if (!isSelected) {
                            newPrecios[s.id] = s.precio;
                            newMults[s.id] = 1;
                          } else {
                            delete newPrecios[s.id];
                            delete newMults[s.id];
                          }

                          setEditingApp(getRecalculatedEditTotals(editingApp, {
                            serviciosIds: ids,
                            serviciosPrecios: newPrecios,
                            serviciosMultiplicadores: newMults
                          }));
                        }}
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                          isSelected 
                            ? "bg-brand-accent border-brand-accent text-white shadow-md" 
                            : "bg-white border-brand-pink text-brand-accent hover:bg-brand-pink-light"
                        )}
                      >
                        {s.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingApp.tipo === 'Domicilio' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Tarifa Domicilio</label>
                    <input 
                      type="number" 
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      value={editingApp.tarifaDomicilio || ''}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                        setEditingApp(getRecalculatedEditTotals(editingApp, { tarifaDomicilio: val }));
                      }}
                      className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Dirección</label>
                    <input 
                      type="text" 
                      value={editingApp.direccion || ''}
                      onChange={(e) => setEditingApp({...editingApp, direccion: e.target.value})}
                      className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700" 
                      placeholder="Calle 123..."
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Notas (Opcional)</label>
                <textarea 
                  value={editingApp.notas || ''}
                  onChange={(e) => setEditingApp({...editingApp, notas: e.target.value})}
                  className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700 min-h-[80px]"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="bg-brand-pink-light p-6 rounded-[32px] border-2 border-brand-pink space-y-4 shadow-inner">
                <h3 className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] border-b border-brand-pink/50 pb-3">Ajuste de Precios</h3>
                <div className="space-y-3">
                  {editingApp.serviciosIds.map(id => {
                    const s = filteredServices.find(srv => srv.id === id);
                    if (!s) return null;
                    const currentMult = editingApp.serviciosMultiplicadores?.[id] ?? 1;
                    return (
                      <div key={id} className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{s.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400">x</span>
                          <input 
                            type="number"
                            min="1"
                            step="1"
                            onWheel={(e) => e.currentTarget.blur()}
                            value={currentMult}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              const newMults = { ...editingApp.serviciosMultiplicadores, [id]: val };
                              setEditingApp(getRecalculatedEditTotals(editingApp, { serviciosMultiplicadores: newMults }));
                            }}
                            className="w-12 bg-white border-2 border-brand-pink rounded-xl px-1 py-2 text-xs font-black text-brand-accent text-center shadow-sm"
                          />
                          <span className="text-[10px] font-black text-slate-400">$</span>
                          <input 
                            type="number"
                            min="0"
                            onWheel={(e) => e.currentTarget.blur()}
                            value={editingApp.serviciosPrecios?.[id] ?? s.precio}
                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                              const newPrecios = { ...editingApp.serviciosPrecios, [id]: val };
                              setEditingApp(getRecalculatedEditTotals(editingApp, { serviciosPrecios: newPrecios }));
                            }}
                            className="w-24 bg-white border-2 border-brand-pink rounded-xl px-3 py-2 text-xs font-black text-brand-accent text-right shadow-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t-2 border-brand-pink space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descuento</label>
                      <button 
                        onClick={() => {
                          const newTipo = editingApp.descuentoTipo === 'fixed' ? 'percent' : 'fixed';
                          setEditingApp(getRecalculatedEditTotals(editingApp, { descuentoTipo: newTipo }));
                        }}
                        className="px-2 py-1 bg-brand-pink text-brand-accent rounded-lg text-[8px] font-black uppercase"
                      >
                        {editingApp.descuentoTipo === 'fixed' ? '$' : '%'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        onWheel={(e) => e.currentTarget.blur()}
                        value={editingApp.descuentoValor || ''}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setEditingApp(getRecalculatedEditTotals(editingApp, { descuentoValor: val }));
                        }}
                        className="w-24 bg-white border-2 border-brand-pink rounded-xl px-3 py-2 text-xs font-black text-brand-accent text-right shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Final</span>
                    <span className="text-2xl font-black text-brand-accent">${editingApp.precioFinal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  if (editingApp) {
                    updateAppointment(editingApp.id, editingApp);
                    setIsEditModalOpen(false);
                  }
                }}
                className="flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-brand-accent shadow-lg shadow-brand-accent/30 active:scale-95 transition-transform"
              >
                Actualizar Cita
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Hidden Invoice for capture */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none opacity-0">
        {captureApp && activeBusiness && (
          <Invoice 
            key={`capture-${captureApp.id}-${captureApp.completada}-${Date.now()}`}
            id="invoice-capture"
            appointment={captureApp} 
            business={activeBusiness} 
            services={filteredServices} 
            worker={workers.find(w => w.id === captureApp.workerId)}
            clientName={clients.find(c => c.id === captureApp.clientId)?.nombre}
          />
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Calendar, ChevronDown, Plus, Minus, DollarSign, Tag, Info, Trash2, Edit, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, isSameDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { ExtraRecord } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Finanzas: React.FC = () => {
  const { finances, extraRecords, activeBusinessId, workers, services, addExtraRecord, updateExtraRecord, deleteExtraRecord } = useStore();
  const [filter, setFilter] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [extraType, setExtraType] = useState<'ingreso' | 'egreso'>('ingreso');

  const [extraForm, setExtraForm] = useState({
    titulo: '',
    descripcion: '',
    categoria: '',
    precio: 0,
    costoInversion: 0,
    fecha: format(new Date(), 'yyyy-MM-dd')
  });

  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(3);

  const filteredFinances = finances.filter(f => {
    if (f.businessId !== activeBusinessId) return false;
    
    const dateStr = f.fecha;
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    
    let timeMatch = true;
    if (filter === 'day') timeMatch = dateStr === nowStr;
    else if (filter === 'week') {
      const date = new Date(f.fecha + 'T00:00:00');
      const now = new Date();
      timeMatch = isWithinInterval(date, { 
        start: startOfWeek(now, { weekStartsOn: 1 }), 
        end: endOfWeek(now, { weekStartsOn: 1 }) 
      });
    }
    else if (filter === 'month') {
      const date = new Date(f.fecha + 'T00:00:00');
      const now = new Date();
      timeMatch = isWithinInterval(date, { 
        start: startOfMonth(now), 
        end: endOfMonth(now) 
      });
    }

    const workerMatch = workerFilter === 'all' || f.workerId === workerFilter;
    const serviceMatch = serviceFilter === 'all' || f.serviciosIds?.includes(serviceFilter);

    return timeMatch && workerMatch && serviceMatch;
  });

  const filteredExtra = extraRecords.filter(r => {
    if (r.businessId !== activeBusinessId) return false;
    
    // Si hay filtro de trabajador o servicio, no mostramos extras (son generales)
    if (workerFilter !== 'all' || serviceFilter !== 'all') return false;
    
    const dateStr = r.fecha;
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    
    let timeMatch = true;
    if (filter === 'day') timeMatch = dateStr === nowStr;
    else if (filter === 'week') {
      const date = new Date(r.fecha + 'T00:00:00');
      const now = new Date();
      timeMatch = isWithinInterval(date, { 
        start: startOfWeek(now, { weekStartsOn: 1 }), 
        end: endOfWeek(now, { weekStartsOn: 1 }) 
      });
    }
    else if (filter === 'month') {
      const date = new Date(r.fecha + 'T00:00:00');
      const now = new Date();
      timeMatch = isWithinInterval(date, { 
        start: startOfMonth(now), 
        end: endOfMonth(now) 
      });
    }

    return timeMatch;
  });

  const totalIngresosCitas = filteredFinances.reduce((sum, f) => sum + f.ingreso, 0);
  const totalPropinas = filteredFinances.reduce((sum, f) => sum + (f.propina || 0), 0);
  const totalInversionMat = filteredFinances.reduce((sum, f) => sum + f.costoMateriales, 0);

  const totalIngresosExtra = filteredExtra.reduce((sum, r) => r.tipo === 'ingreso' ? sum + r.precio : sum, 0);
  const totalEgresosExtra = filteredExtra.reduce((sum, r) => r.tipo === 'egreso' ? sum + r.precio : sum, 0);
  const totalInversionExtra = filteredExtra.reduce((sum, r) => r.tipo === 'ingreso' ? sum + (r.costoInversion || 0) : sum, 0);

  const totalIngresos = totalIngresosCitas + totalIngresosExtra;
  const totalEgresos = totalInversionMat + totalEgresosExtra + totalInversionExtra;
  const gananciaNeta = totalIngresos - totalEgresos;

  // Estimación de tiempo
  const totalMinutos = filteredFinances.reduce((sum, f) => {
    if (!f.serviciosIds) return sum;
    const recordTime = f.serviciosIds.reduce((sSum, sId) => {
      const service = services.find(s => s.id === sId);
      return sSum + (service?.duracion || 0);
    }, 0);
    return sum + recordTime;
  }, 0);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins}m`;
  };

  const efectivo = filteredFinances.reduce((sum, f) => {
    if (f.metodoPago === 'Efectivo') return sum + f.ingreso;
    if (f.metodoPago === 'Mixto') return sum + (f.abonoEfectivo || 0);
    return sum;
  }, 0);
  const transferencia = filteredFinances.reduce((sum, f) => {
    if (f.metodoPago === 'Transferencia') return sum + f.ingreso;
    if (f.metodoPago === 'Mixto') return sum + (f.abonoTransferencia || 0);
    return sum;
  }, 0);

  const efectivoPct = totalIngresos > 0 ? Math.round((efectivo / totalIngresos) * 100) : 0;
  const transferenciaPct = totalIngresos > 0 ? Math.round((transferencia / totalIngresos) * 100) : 0;

  const allMovements = useMemo(() => {
    const movements = [
      ...filteredFinances.map(f => ({
        id: f.id,
        tipo: 'cita' as const,
        titulo: `Cita: ${f.serviciosIds.map(id => services.find(s => s.id === id)?.nombre).join(', ')}`,
        categoria: 'Servicio',
        monto: f.ingreso,
        fecha: f.fecha,
        workerId: f.workerId,
        metodoPago: f.metodoPago
      })),
      ...filteredExtra.map(r => ({
        id: r.id,
        tipo: r.tipo === 'ingreso' ? 'ingreso_extra' as const : 'egreso_extra' as const,
        titulo: r.titulo,
        categoria: r.categoria,
        monto: r.precio,
        fecha: r.fecha,
        workerId: null,
        metodoPago: null
      }))
    ];

    return movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [filteredFinances, filteredExtra, services]);

  const visibleMovements = allMovements.slice(0, visibleCount);

  const filterLabels = {
    day: 'Hoy',
    week: 'Esta Semana',
    month: 'Este Mes',
    all: 'Todo el Tiempo'
  };

  const businessWorkers = workers.filter(w => w.businessId === activeBusinessId);
  const businessServices = services.filter(s => s.businessId === activeBusinessId);

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto pb-24 overflow-y-auto no-scrollbar h-full bg-brand-pink-light">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-accent flex items-center gap-2">Finanzas</h1>
        
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-brand-pink text-xs font-bold text-slate-600 shadow-sm"
          >
            <Calendar className="w-4 h-4 text-brand-accent" />
            {filterLabels[filter]}
            <ChevronDown className={cn("w-4 h-4 transition-transform", isFilterOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-brand-pink z-50 overflow-hidden"
              >
                {(['day', 'week', 'month', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 text-xs font-bold transition-colors",
                      filter === f ? "bg-brand-pink text-brand-accent" : "text-slate-500 hover:bg-brand-pink-light"
                    )}
                  >
                    {filterLabels[f]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Filtros Adicionales */}
      <div className="grid grid-cols-2 gap-3">
        <select 
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          className="bg-white border border-brand-pink rounded-xl px-3 py-2 text-[10px] font-bold text-slate-500 outline-none"
        >
          <option value="all">Todos los Trabajadores</option>
          {businessWorkers.map(w => (
            <option key={w.id} value={w.id}>{w.nombre}</option>
          ))}
        </select>
        <select 
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-white border border-brand-pink rounded-xl px-3 py-2 text-[10px] font-bold text-slate-500 outline-none"
        >
          <option value="all">Todos los Servicios</option>
          {businessServices.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {/* Resumen Principal */}
      <div className="bg-brand-accent p-6 rounded-[32px] text-white shadow-xl shadow-brand-accent/20">
        <div className="flex justify-between items-start mb-1">
          <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Ganancia Neta</p>
          <div className="bg-white/20 px-2 py-1 rounded-lg flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span className="text-[10px] font-bold">{formatTime(totalMinutos)}</span>
          </div>
        </div>
        <h2 className="text-4xl font-black mb-6">${gananciaNeta.toLocaleString()}</h2>
        
        <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
          <div>
            <p className="text-[10px] font-bold opacity-70 uppercase">Ingresos Totales</p>
            <p className="font-bold">${totalIngresos.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold opacity-70 uppercase">Egresos/Inversión</p>
            <p className="font-bold">${totalEgresos.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Métodos de Pago y Propinas */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Detalle Financiero</h3>
          <div className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
            Propinas: ${totalPropinas.toLocaleString()}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-3xl card-shadow border border-brand-pink/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-600">Efectivo</span>
            </div>
            <p className="text-lg font-bold text-slate-800">${efectivo.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-emerald-500">{efectivoPct}% del total</p>
          </div>

          <div className="bg-white p-4 rounded-3xl card-shadow border border-brand-pink/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-600">Transferencia</span>
            </div>
            <p className="text-lg font-bold text-slate-800">${transferencia.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-blue-500">{transferenciaPct}% del total</p>
          </div>
        </div>
      </div>
      {/* Listado de Movimientos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Últimos Movimientos</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => { setExtraType('ingreso'); setIsExtraModalOpen(true); }}
              className="p-2 bg-emerald-50 text-emerald-500 rounded-xl active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setExtraType('egreso'); setIsExtraModalOpen(true); }}
              className="p-2 bg-rose-50 text-rose-500 rounded-xl active:scale-95 transition-transform"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleMovements.length === 0 ? (
            <div className="bg-white/50 border border-dashed border-brand-pink rounded-3xl p-8 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">No hay movimientos registrados</p>
            </div>
          ) : (
            <>
              {visibleMovements.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-3xl card-shadow border border-brand-pink/50 flex justify-between items-center">
                  <div className="flex gap-3 items-center">
                    <div className={cn(
                      "p-2 rounded-xl",
                      (record.tipo === 'cita' || record.tipo === 'ingreso_extra') ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
                    )}>
                      {(record.tipo === 'cita' || record.tipo === 'ingreso_extra') ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase leading-none mb-1 line-clamp-1">{record.titulo}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.categoria}</p>
                        <span className="text-[8px] text-slate-300">•</span>
                        <p className="text-[8px] font-bold text-slate-300 uppercase">{format(parseISO(record.fecha), 'dd MMM', { locale: es })}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className={cn(
                        "text-sm font-black",
                        (record.tipo === 'cita' || record.tipo === 'ingreso_extra') ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {(record.tipo === 'cita' || record.tipo === 'ingreso_extra') ? '+' : '-'}${record.monto.toLocaleString()}
                      </p>
                    </div>
                    
                    {record.tipo !== 'cita' && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            const original = extraRecords.find(r => r.id === record.id);
                            if (original) {
                              setExtraType(original.tipo);
                              setExtraForm({
                                titulo: original.titulo,
                                descripcion: original.descripcion || '',
                                categoria: original.categoria,
                                precio: original.precio,
                                costoInversion: original.costoInversion || 0,
                                fecha: original.fecha
                              });
                              setEditingExtraId(original.id);
                              setIsExtraModalOpen(true);
                            }
                          }}
                          className="p-1 text-slate-300 hover:text-brand-accent transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => deleteExtraRecord(record.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {visibleCount < allMovements.length && (
                <button 
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  className="w-full py-3 bg-white border border-brand-pink rounded-2xl text-[10px] font-black text-brand-accent uppercase tracking-widest active:scale-95 transition-transform"
                >
                  Mostrar más
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Extra Record */}
      <AnimatePresence>
        {isExtraModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-60 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-brand-accent uppercase tracking-tighter">
                  {editingExtraId ? 'Editar' : 'Nuevo'} {extraType === 'ingreso' ? 'Ingreso' : 'Egreso'} Extra
                </h2>
                <button onClick={() => { setIsExtraModalOpen(false); setEditingExtraId(null); setExtraForm({ titulo: '', descripcion: '', categoria: '', precio: 0, costoInversion: 0, fecha: format(new Date(), 'yyyy-MM-dd') }); }} className="p-2 bg-brand-pink-light rounded-full">
                  <X className="w-4 h-4 text-brand-accent" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Título*</label>
                  <input 
                    type="text"
                    placeholder={extraType === 'ingreso' ? "Ej: Venta de Combo" : "Ej: Compra de Combo"}
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                    value={extraForm.titulo}
                    onChange={(e) => setExtraForm({...extraForm, titulo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Categoría*</label>
                  <input 
                    type="text"
                    placeholder="Ej: Ventas, Alquiler, Equipos"
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                    value={extraForm.categoria}
                    onChange={(e) => setExtraForm({...extraForm, categoria: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Descripción</label>
                  <textarea 
                    placeholder="Detalles adicionales..."
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700 h-24 resize-none"
                    value={extraForm.descripcion}
                    onChange={(e) => setExtraForm({...extraForm, descripcion: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Fecha*</label>
                  <input 
                    type="date"
                    className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                    value={extraForm.fecha}
                    onChange={(e) => setExtraForm({...extraForm, fecha: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">
                      {extraType === 'ingreso' ? 'Precio Venta*' : 'Monto Egreso*'}
                    </label>
                    <input 
                      type="number"
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                      value={extraForm.precio === 0 ? '' : extraForm.precio}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                      onChange={(e) => setExtraForm({...extraForm, precio: Math.max(0, Number(e.target.value))})}
                    />
                  </div>
                  {extraType === 'ingreso' && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Costo Inversión</label>
                      <input 
                        type="number"
                        min="0"
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full bg-brand-pink-light border-none rounded-2xl p-4 text-sm font-bold text-slate-700"
                        value={extraForm.costoInversion === 0 ? '' : extraForm.costoInversion}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onChange={(e) => setExtraForm({...extraForm, costoInversion: Math.max(0, Number(e.target.value))})}
                      />
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => {
                    if (!extraForm.titulo || !extraForm.categoria || !extraForm.precio) return;
                    if (editingExtraId) {
                      updateExtraRecord(editingExtraId, extraForm);
                    } else {
                      addExtraRecord({
                        ...extraForm,
                        tipo: extraType
                      });
                    }
                    setIsExtraModalOpen(false);
                    setEditingExtraId(null);
                    setExtraForm({ titulo: '', descripcion: '', categoria: '', precio: 0, costoInversion: 0, fecha: format(new Date(), 'yyyy-MM-dd') });
                  }}
                  className="w-full bg-brand-accent text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform uppercase tracking-widest text-xs mt-4"
                >
                  {editingExtraId ? 'Actualizar' : 'Guardar'} Registro
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, TrendingUp, PieChart as PieIcon, Filter, Package } from 'lucide-react';

// Safe date parsing utility to prevent crashes with malformed data
function safeParse(dateStr: string): Date {
  try {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch {
    return new Date(0);
  }
}

// Error boundary to prevent white screens
class ReportesErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 space-y-4 max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-brand-accent">Reportes</h1>
          <div className="bg-red-50 border border-red-200 p-6 rounded-[32px] text-center">
            <p className="text-sm font-bold text-red-600 mb-2">Error al cargar reportes</p>
            <p className="text-xs text-red-400">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-2xl text-sm font-bold"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ReportesContent: React.FC = () => {
  const { finances, extraRecords, appointments, services, materials, activeBusinessId } = useStore();
  const defaultRange = {
    start: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  };

  const [dateRange, setDateRange] = useState(defaultRange);

  const resetFilter = () => {
    setDateRange(defaultRange);
  };

  const filteredFinances = useMemo(() => {
    return finances.filter(f => {
      try {
        return f.businessId === activeBusinessId &&
          isWithinInterval(safeParse(f.fecha), { 
            start: safeParse(dateRange.start), 
            end: safeParse(dateRange.end) 
          });
      } catch {
        return false;
      }
    });
  }, [finances, dateRange, activeBusinessId]);

  const filteredExtra = useMemo(() => {
    return extraRecords.filter(r => {
      try {
        return r.businessId === activeBusinessId &&
          isWithinInterval(safeParse(r.fecha), { 
            start: safeParse(dateRange.start), 
            end: safeParse(dateRange.end) 
          });
      } catch {
        return false;
      }
    });
  }, [extraRecords, dateRange, activeBusinessId]);

  // 1. Tendencia de Ingresos Mensuales
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; ingresos: number; gastos: number }> = {};
    
    filteredFinances.forEach(f => {
      const monthKey = format(safeParse(f.fecha), 'MMM yy', { locale: es });
      if (!data[monthKey]) {
        data[monthKey] = { month: monthKey, ingresos: 0, gastos: 0 };
      }
      data[monthKey].ingresos += f.ingreso;
      data[monthKey].gastos += f.costoMateriales;
    });

    filteredExtra.forEach(r => {
      const monthKey = format(safeParse(r.fecha), 'MMM yy', { locale: es });
      if (!data[monthKey]) {
        data[monthKey] = { month: monthKey, ingresos: 0, gastos: 0 };
      }
      if (r.tipo === 'ingreso') {
        data[monthKey].ingresos += r.precio;
        if (r.costoInversion) {
          data[monthKey].gastos += r.costoInversion;
        }
      } else {
        data[monthKey].gastos += r.precio;
      }
    });

    return Object.values(data);
  }, [filteredFinances, filteredExtra]);

  // 2. Servicios más demandados (Top 5)
  const topServices = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(app => {
      if (app.businessId === activeBusinessId && app.completada) {
        app.serviciosIds.forEach(id => {
          const serviceName = services.find(s => s.id === id)?.nombre || 'Otro';
          counts[serviceName] = (counts[serviceName] || 0) + 1;
        });
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [appointments, services, activeBusinessId]);

  // 3. Desglose de gastos por material
  const materialExpenses = useMemo(() => {
    const expenses: Record<string, number> = {};
    
    filteredFinances.forEach(f => {
      if (!f.serviciosIds) return;
      
      f.serviciosIds.forEach(serviceId => {
        const service = services.find(s => s.id === serviceId);
        if (service && service.businessId === activeBusinessId) {
          (service.materiales || []).forEach(sm => {
            const material = materials.find(m => m.id === sm.materialId);
            if (material && material.businessId === activeBusinessId && material.cantidadServicios > 0) {
              const costContribution = (material.precio / material.cantidadServicios) * sm.consumo;
              expenses[material.nombre] = (expenses[material.nombre] || 0) + costContribution;
            }
          });
        }
      });
    });

    return Object.entries(expenses)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredFinances, materials, services, activeBusinessId]);

  const COLORS = ['#ec407a', '#f06292', '#f8bbd0', '#fce4ec', '#f48fb1'];

  return (
    <div className="p-6 space-y-8 max-w-md mx-auto pb-24 overflow-y-auto h-full no-scrollbar">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-accent flex items-center gap-2">Reportes</h1>
        <button 
          onClick={resetFilter}
          className="p-2 bg-white rounded-xl border border-brand-pink shadow-sm active:scale-95 transition-transform"
        >
          <Filter className="w-4 h-4 text-brand-accent" />
        </button>
      </header>

      {/* Filtro de Fechas */}
      <div className="bg-white p-4 rounded-3xl card-shadow border border-brand-pink/50 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Calendar className="w-3 h-3" />
          Rango de Fechas
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="bg-brand-pink-light border-none rounded-xl p-2 text-xs font-medium focus:ring-1 ring-brand-accent"
          />
          <input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="bg-brand-pink-light border-none rounded-xl p-2 text-xs font-medium focus:ring-1 ring-brand-accent"
          />
        </div>
      </div>

      {/* Gráfico 1: Tendencia Mensual */}
      <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50">
        <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-accent" />
          Ingresos vs Gastos
        </h3>
        <div className="h-64 w-full flex items-center justify-center">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce4ec" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="ingresos" fill="#ec407a" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gastos" fill="#f8bbd0" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400">No hay datos para mostrar</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico 2: Top Servicios */}
      <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50">
        <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-brand-accent" />
          Servicios más Demandados
        </h3>
        <div className="h-64 w-full flex items-center justify-center">
          {topServices.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topServices}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topServices.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <PieIcon className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400">No hay datos para mostrar</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico 3: Gastos por Material */}
      <div className="bg-white p-6 rounded-[32px] card-shadow border border-brand-pink/50">
        <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-accent" />
          Inversión por Material
        </h3>
        <div className="space-y-4">
          {materialExpenses.length > 0 ? (
            materialExpenses.map((item, index) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                  <span>{item.name}</span>
                  <span>${item.value.toFixed(0)}</span>
                </div>
                <div className="w-full bg-brand-pink-light h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand-accent h-full rounded-full" 
                    style={{ width: `${(item.value / (materialExpenses[0]?.value || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center space-y-2 py-10">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400">No hay datos para mostrar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Reportes: React.FC = () => (
  <ReportesErrorBoundary>
    <ReportesContent />
  </ReportesErrorBoundary>
);

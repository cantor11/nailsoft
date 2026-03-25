import React from 'react';
import { Appointment, Service, Worker, BusinessInfo } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceProps {
  appointment: Appointment;
  business: BusinessInfo;
  services: Service[];
  worker?: Worker;
  clientName?: string;
  id?: string;
}

export const Invoice: React.FC<InvoiceProps> = ({ appointment, business, services, worker, clientName, id }) => {
  return (
    <div id={id || `invoice-${appointment.id}`} className="bg-white p-10 w-[600px] border-8 border-brand-pink text-slate-800 font-sans">
      <header className="text-center border-b-2 border-brand-pink pb-6 mb-6">
        <h1 className="text-3xl font-black text-brand-accent uppercase tracking-tighter">{business.nombre}</h1>
        <p className="text-sm text-slate-400 font-bold mt-1">{business.descripcion}</p>
        <div className="flex justify-center gap-4 mt-4 text-[10px] font-bold text-slate-500 uppercase">
          <span>{business.telefono}</span>
          <span>•</span>
          <span>{business.correo}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-[10px] font-black text-brand-accent uppercase mb-2 tracking-widest">Cliente</h2>
          <p className="text-sm font-bold">{clientName || appointment.clientNombre || 'Cliente General'}</p>
        </div>
        <div className="text-right">
          <h2 className="text-[10px] font-black text-brand-accent uppercase mb-2 tracking-widest">Fecha y Hora</h2>
          <p className="text-sm font-bold">{format(new Date(appointment.fecha), "EEEE, d 'de' MMMM", { locale: es })}</p>
          <p className="text-sm font-bold text-slate-500">{appointment.hora}</p>
        </div>
      </div>

      <div className="mb-10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-pink text-[10px] font-black text-slate-400 uppercase text-left">
              <th className="py-2">Servicio</th>
              <th className="py-2 text-right">Precio</th>
            </tr>
          </thead>
          <tbody>
            {appointment.serviciosIds.map(id => {
              const service = services.find(s => s.id === id);
              const price = appointment.serviciosPrecios?.[id] ?? service?.precio ?? 0;
              return (
                <tr key={id} className="border-b border-brand-pink/30">
                  <td className="py-4 text-sm font-bold text-slate-700">{appointment.serviciosNombres?.[id] || service?.nombre || 'Servicio'}</td>
                  <td className="py-4 text-sm font-bold text-slate-700 text-right">${price.toLocaleString()}</td>
                </tr>
              );
            })}
            {appointment.descuentoValor !== undefined && appointment.descuentoValor > 0 && (
              <tr className="border-b border-brand-pink/30 text-emerald-600">
                <td className="py-4 text-sm font-bold italic">Descuento ({appointment.descuentoTipo === 'percent' ? `${appointment.descuentoValor}%` : `$${appointment.descuentoValor}`})</td>
                <td className="py-4 text-sm font-bold text-right">
                  {(() => {
                    const currentTotalServices = appointment.serviciosIds.reduce((sum, id) => {
                      const service = services.find(s => s.id === id);
                      return sum + (appointment.serviciosPrecios?.[id] ?? service?.precio ?? 0);
                    }, 0);
                    const discountAmount = appointment.descuentoTipo === 'percent' 
                      ? (currentTotalServices * (appointment.descuentoValor / 100)) 
                      : appointment.descuentoValor;
                    return `-$${discountAmount.toLocaleString()}`;
                  })()}
                </td>
              </tr>
            )}
            {appointment.tipo === 'Domicilio' && appointment.tarifaDomicilio > 0 && (
              <tr className="border-b border-brand-pink/30">
                <td className="py-4 text-sm font-bold text-slate-700 italic">Tarifa Domicilio</td>
                <td className="py-4 text-sm font-bold text-slate-700 text-right">${appointment.tarifaDomicilio?.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex justify-between items-end border-t-4 border-brand-pink pt-6">
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Estado</p>
            <p className="text-lg font-black text-brand-accent uppercase">{appointment.completada ? 'PAGADO' : 'PENDIENTE'}</p>
          </div>
          {appointment.completada && (
            <div className="text-[10px] font-bold text-slate-500 space-y-1">
              {appointment.abonoEfectivo !== undefined && appointment.abonoEfectivo > 0 && (
                <p>EFECTIVO: ${appointment.abonoEfectivo.toLocaleString()}</p>
              )}
              {appointment.abonoTransferencia !== undefined && appointment.abonoTransferencia > 0 && (
                <p>TRANSFERENCIA: ${appointment.abonoTransferencia.toLocaleString()}</p>
              )}
              {appointment.propina !== undefined && appointment.propina > 0 && (
                <p className="text-emerald-600">PROPINA: ${appointment.propina.toLocaleString()}</p>
              )}
              {appointment.devuelta !== undefined && appointment.devuelta > 0 && (
                <p className="text-brand-accent">DEVUELTA: ${appointment.devuelta.toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Total Final</p>
          <p className="text-4xl font-black text-brand-accent">${appointment.precioFinal.toLocaleString()}</p>
        </div>
      </footer>
      
      <div className="mt-10 text-center">
        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">Gracias por confiar en {business.nombre}</p>
      </div>
    </div>
  );
};

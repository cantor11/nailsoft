/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentMethod = 'Efectivo' | 'Transferencia';
export type AppointmentType = 'Domicilio' | 'Salón';
export type UnitType = 'Unidades' | 'Gramos';

export interface Category {
  id: string;
  nombre: string;
  businessId: string;
}

export interface Material {
  id: string;
  nombre: string;
  descripcion: string;
  imagen?: string;
  precio: number;
  cantidadServicios: number; // Cuántos "usos" o "servicios" rinde el producto completo
  unidades: number; // Cantidad de envases/unidades físicas
  alertaStock: number; // Umbral para marcar como escaso
  tipoAlerta: 'unidades' | 'servicios'; // Si la alerta es por envases o por usos totales
  serviciosConsumidosAcumulados: number; // Para rastrear cuándo descontar una unidad física
  categoriaId?: string;
  businessId: string;
  deleted?: boolean;
}

export interface ExtraRecord {
  id: string;
  tipo: 'ingreso' | 'egreso';
  titulo: string;
  descripcion: string;
  categoria: string;
  precio: number;
  costoInversion?: number; // Opcional para ingresos
  fecha: string;
  businessId: string;
}

export interface ServiceMaterial {
  materialId: string;
  consumo: number; // Cuántos "usos" o "unidades de rendimiento" consume este servicio específico
}

export interface Service {
  id: string;
  nombre: string;
  precio: number;
  duracion: number;
  materiales: ServiceMaterial[];
  businessId: string;
}

export interface Client {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
  tipoFrecuente: AppointmentType;
  totalCitas: number;
  totalGastado: number;
  color?: string;
  businessId: string;
}

export interface Worker {
  id: string;
  nombre: string;
  especialidad?: string;
  telefono?: string;
  correo?: string;
  foto?: string;
  businessId: string;
}

export interface BusinessInfo {
  id: string;
  nombre: string;
  descripcion: string;
  telefono: string;
  correo: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  workerId?: string;
  fecha: string;
  hora: string;
  serviciosIds: string[];
  tipo: AppointmentType;
  direccion?: string;
  tarifaDomicilio?: number;
  precioOriginal: number; // Suma de precios de servicios
  precioFinal: number; // Precio editado por el usuario
  propina?: number;
  serviciosPrecios?: Record<string, number>; // Precios individuales editados
  serviciosMultiplicadores?: Record<string, number>; // Multiplicadores individuales por servicio
  descuentoValor?: number;
  descuentoTipo?: 'percent' | 'fixed';
  notas?: string;
  completada: boolean;
  metodoPago?: PaymentMethod | 'Mixto';
  abonoEfectivo?: number;
  abonoTransferencia?: number;
  devuelta?: number;
  serviciosNombres?: Record<string, string>;
  workerNombre?: string;
  clientNombre?: string;
  businessId: string;
}

export interface Reminder {
  id: string;
  texto: string;
  fecha: string;
  hora: string;
  completado: boolean;
  businessId: string;
}

export interface FinanceRecord {
  id: string;
  appointmentId?: string;
  fecha: string;
  ingreso: number;
  propina?: number;
  costoMateriales: number;
  metodoPago: PaymentMethod | 'Mixto';
  abonoEfectivo?: number;
  abonoTransferencia?: number;
  workerId?: string;
  serviciosIds?: string[];
  businessId: string;
}

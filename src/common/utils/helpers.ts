import { v4 as uuidv4 } from 'uuid';

/**
 * Gera uma chave de idempotência única
 */
export function generateIdempotencyKey(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const uuid = uuidv4().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}_${timestamp}_${uuid}` : `${timestamp}_${uuid}`;
}

/**
 * Formata telefone para padrão brasileiro (5511999999999)
 */
export function formatPhone(phone: string): string {
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, '');
  
  // Se não tem o código do país, adiciona 55
  if (digits.length === 11) {
    return `55${digits}`;
  }
  
  // Se tem o 55, retorna como está
  if (digits.startsWith('55') && digits.length === 13) {
    return digits;
  }
  
  return digits;
}

/**
 * Valida CPF
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Formata valor monetário em BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data para exibição
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formata data e hora para exibição
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calcula diferença em horas entre duas datas
 */
export function hoursDifference(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diff / (1000 * 60 * 60));
}

/**
 * Verifica se a data está dentro do horário comercial
 */
export function isBusinessHours(
  date: Date,
  startHour: string,
  endHour: string,
  businessDays: number[],
): boolean {
  const dayOfWeek = date.getDay();
  if (!businessDays.includes(dayOfWeek)) return false;
  
  const [startH, startM] = startHour.split(':').map(Number);
  const [endH, endM] = endHour.split(':').map(Number);
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const currentMinutes = hours * 60 + minutes;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Gera lista de horários disponíveis para um dia
 */
export function generateTimeSlots(
  startHour: string,
  endHour: string,
  durationMinutes: number,
): string[] {
  const slots: string[] = [];
  const [startH, startM] = startHour.split(':').map(Number);
  const [endH, endM] = endHour.split(':').map(Number);
  
  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  while (currentMinutes + durationMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }
  
  return slots;
}

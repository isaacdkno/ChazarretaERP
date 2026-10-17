import { supabase } from '../supabase';
import { PaymentReceipt } from '../types';

// Función genérica para reintentar operaciones de Supabase con backoff exponencial
async function withRetry<T>(
  operation: () => PromiseLike<any>,
  retries = 3,
  delay = 1000
): Promise<{ data: T | null; error: any }> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await operation();
      if (!result.error) return { data: result.data, error: null };
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
  }
  return { data: null, error: lastError };
}

export const getCustomers = async () => {
  return await withRetry<any[]>(() => supabase.from('customers').select('*'));
};

export const getOrders = async () => {
  return await withRetry<any[]>(() => 
    supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
  );
};

export const getCreditNotes = async () => {
  return await withRetry<any[]>(() => 
    supabase.from('credit_notes').select('*, credit_note_items(*)').order('created_at', { ascending: false })
  );
};

export const getGateEntries = async () => {
  return await withRetry<any[]>(() => 
    supabase.from('gate_entries').select('*').order('created_at', { ascending: false })
  );
};

export const mapPaymentReceipt = (r: any): PaymentReceipt => ({
  id: r.id,
  customerId: r.customer_id ?? r.customerId ?? '',
  customerName: r.customer_name ?? r.customerName ?? 'Sin Nombre',
  amount: Number(r.amount || 0),
  cashAmount: Number(r.cash_amount ?? r.cashAmount ?? 0),
  transferAmount: Number(r.transfer_amount ?? r.transferAmount ?? 0),
  ivaBoletasAmount: Number(r.iva_boletas_amount ?? r.ivaBoletasAmount ?? 0),
  paymentMode: (r.payment_mode ?? r.paymentMode ?? 'FIFO') as 'FIFO' | 'MANUAL',
  orderIds: typeof r.order_ids === 'string'
    ? JSON.parse(r.order_ids)
    : (r.order_ids ?? r.orderIds ?? []),
  collectedBy: r.collected_by ?? r.collectedBy ?? 'N/A',
  details: typeof r.details === 'string'
    ? JSON.parse(r.details)
    : (r.details || []),
  createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString()
});

export const getPaymentReceipts = async (customerId?: string) => {
  const result = await withRetry<any[]>(() => {
    let query = supabase
      .from('payment_receipts')
      .select('*')
      .order('created_at', { ascending: false });
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    return query;
  });

  return {
    data: result.data ? result.data.map(mapPaymentReceipt) : null,
    error: result.error
  };
};


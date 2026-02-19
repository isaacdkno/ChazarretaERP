
import React, { useState } from 'react';
import { 
  BadgeDollarSign, 
  Wallet, 
  History, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Banknote, 
  ArrowRightLeft,
  Calculator
} from 'lucide-react';
import { Order, OrderStatus, Customer } from '../types';
import { supabase } from '../supabase';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const CollectionView: React.FC<Props> = ({ orders, updateOrder, customers, setCustomers }) => {
  const [paymentMode, setPaymentMode] = useState<'FIFO' | 'MANUAL'>('FIFO');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const totalCollected = cashAmount + transferAmount;

  const pendingCollection = orders.filter(o => 
    o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL
  );

  const toggleBlock = async (customer: Customer) => {
    const nextState = !customer.isBlocked;
    const { error } = await supabase.from('customers').update({ is_blocked: nextState }).eq('id', customer.id);
    if (!error) {
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, isBlocked: nextState } : c));
    }
  };

  const handlePayment = async () => {
    if (!selectedCustomerId || totalCollected <= 0) return;
    
    setProcessing(true);
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    const newBalance = Math.max(0, customer.balance - totalCollected);

    try {
      // 1. Actualizar balance en Supabase
      const { error } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', selectedCustomerId);

      if (error) throw error;

      // 2. Registrar movimiento (opcional si hay tabla account_movements)
      await supabase.from('account_movements').insert([{
        customer_id: selectedCustomerId,
        type: 'CREDIT',
        amount: totalCollected,
        description: `Cobro Multimodal: Cash $${cashAmount} + Transf $${transferAmount}`
      }]);

      // 3. Actualizar localmente
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomerId ? { ...c, balance: newBalance } : c
      ));

      setCashAmount(0);
      setTransferAmount(0);
      alert(`Pago de $${totalCollected.toLocaleString()} registrado correctamente en Supabase.`);
    } catch (err) {
      console.error(err);
      alert("Error al procesar el cobro.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Oficina de Cobranzas</h1>
          <p className="text-slate-500 font-medium">Gestión de créditos y conciliación real con Supabase.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
              <Wallet size={20} className="text-blue-500" /> Registrar Cobro
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Cliente / Cuenta</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Seleccionar Distribuidor...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} (Saldo: ${c.balance.toLocaleString()})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                    <Banknote size={14} /> Cobro en Efectivo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-emerald-100 rounded-xl outline-none font-black text-slate-800"
                      value={cashAmount || ''}
                      onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                    <ArrowRightLeft size={14} /> Cobro por Transferencia
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-blue-100 rounded-xl outline-none font-black text-slate-800"
                      value={transferAmount || ''}
                      onChange={e => setTransferAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Total a Imputar</span>
                <span className="text-4xl font-black tracking-tighter">${totalCollected.toLocaleString()}</span>
              </div>

              <button 
                onClick={handlePayment}
                disabled={!selectedCustomerId || totalCollected <= 0 || processing}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
              >
                {processing ? "Procesando..." : <CheckCircle2 size={20} />} Confirmar Imputación
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <History className="text-slate-400" size={20} /> Comandas Pendientes de Cobro
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {pendingCollection.map(order => (
                <div key={order.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all gap-4">
                  <div>
                    <p className="font-black text-slate-800 uppercase text-lg tracking-tight leading-none mb-1">{order.customerName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#ORD-{order.id.toString().substr(0,6).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">${order.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionView;

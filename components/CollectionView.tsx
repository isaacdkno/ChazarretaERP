
import React, { useState } from 'react';
import { BadgeDollarSign, Wallet, History, Lock, Unlock, CheckCircle2 } from 'lucide-react';
import { Order, OrderStatus, Customer } from '../types';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const CollectionView: React.FC<Props> = ({ orders, updateOrder, customers, setCustomers }) => {
  const [paymentMode, setPaymentMode] = useState<'FIFO' | 'MANUAL'>('FIFO');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);

  const pendingCollection = orders.filter(o => 
    o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL
  );

  const toggleBlock = (customer: Customer) => {
    setCustomers(prev => prev.map(c => 
      c.id === customer.id ? { ...c, isBlocked: !c.isBlocked } : c
    ));
  };

  const handlePayment = () => {
    if (!selectedCustomerId || amount <= 0) return;
    
    // Simulate payment logic
    setCustomers(prev => prev.map(c => 
      c.id === selectedCustomerId ? { ...c, balance: Math.max(0, c.balance - amount) } : c
    ));

    // If FIFO, we'd loop through orders and update status. 
    // For simulation, just clear inputs
    setAmount(0);
    alert('Pago registrado correctamente');
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Oficina de Cobranzas</h1>
          <p className="text-slate-500">Gestión de créditos, bloqueos y conciliación de pagos.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setPaymentMode('FIFO')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${paymentMode === 'FIFO' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            Modo Automático (FIFO)
          </button>
          <button 
            onClick={() => setPaymentMode('MANUAL')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${paymentMode === 'MANUAL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            Modo Manual
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment Entry */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-blue-500" /> Registrar Cobro
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cliente</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} (${c.balance.toLocaleString()})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto a Imputar</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number"
                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <button 
                onClick={handlePayment}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
              >
                Confirmar Imputación
              </button>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Lock size={18} className="text-red-400" /> Control de Riesgo
            </h2>
            <div className="space-y-3">
              {customers.map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold">{customer.name}</p>
                    <p className={`text-[10px] uppercase font-bold ${customer.isBlocked ? 'text-red-400' : 'text-emerald-400'}`}>
                      {customer.isBlocked ? 'Bloqueado' : 'Habilitado'}
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleBlock(customer)}
                    className={`p-2 rounded-lg transition-colors ${customer.isBlocked ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                  >
                    {customer.isBlocked ? <Unlock size={18} /> : <Lock size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Debtors / Orders List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Comandas Pendientes de Cobro</h2>
              <History size={18} className="text-slate-300" />
            </div>
            <div className="divide-y divide-slate-100">
              {pendingCollection.map(order => (
                <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${order.status === OrderStatus.DISPATCHED ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <p className="font-bold text-slate-800">{order.customerName}</p>
                      <p className="text-xs text-slate-400">#ORD-{order.id.substr(0,6).toUpperCase()} • Entregado el {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">${order.totalAmount.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Sin Saldar</p>
                  </div>
                </div>
              ))}
              {pendingCollection.length === 0 && (
                <div className="p-20 text-center text-slate-400">
                  <CheckCircle2 className="mx-auto mb-2 opacity-20" size={48} />
                  <p>No hay deudas pendientes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionView;


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

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const CollectionView: React.FC<Props> = ({ orders, updateOrder, customers, setCustomers }) => {
  const [paymentMode, setPaymentMode] = useState<'FIFO' | 'MANUAL'>('FIFO');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Nuevos estados para cobro multimodal
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);

  const totalCollected = cashAmount + transferAmount;

  const pendingCollection = orders.filter(o => 
    o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL
  );

  const toggleBlock = (customer: Customer) => {
    setCustomers(prev => prev.map(c => 
      c.id === customer.id ? { ...c, isBlocked: !c.isBlocked } : c
    ));
  };

  const handlePayment = () => {
    if (!selectedCustomerId || totalCollected <= 0) return;
    
    // Simulación de lógica de pago restando el total percibido del balance
    setCustomers(prev => prev.map(c => 
      c.id === selectedCustomerId ? { ...c, balance: Math.max(0, c.balance - totalCollected) } : c
    ));

    // Reset de campos
    setCashAmount(0);
    setTransferAmount(0);
    alert(`Pago de $${totalCollected.toLocaleString()} registrado correctamente (${cashAmount > 0 ? 'Efectivo' : ''} ${transferAmount > 0 ? '+ Transferencia' : ''})`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Oficina de Cobranzas</h1>
          <p className="text-slate-500 font-medium">Gestión de créditos, bloqueos y conciliación multimodal.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setPaymentMode('FIFO')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentMode === 'FIFO' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Automático (FIFO)
          </button>
          <button 
            onClick={() => setPaymentMode('MANUAL')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentMode === 'MANUAL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Modo Manual
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Registro de Cobro Multimodal */}
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
                {/* Campo Efectivo */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                    <Banknote size={14} /> Cobro en Efectivo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black">$</span>
                    <input 
                      type="number"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 font-black text-slate-800"
                      placeholder="0.00"
                      value={cashAmount || ''}
                      onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Campo Transferencia */}
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                    <ArrowRightLeft size={14} /> Cobro por Transferencia
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black">$</span>
                    <input 
                      type="number"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-blue-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-black text-slate-800"
                      placeholder="0.00"
                      value={transferAmount || ''}
                      onChange={e => setTransferAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Resumen de Imputación */}
              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calculator size={14} /> Total a Imputar
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-black tracking-tighter">${totalCollected.toLocaleString()}</span>
                  <div className="text-right text-[10px] font-bold text-slate-500 uppercase leading-tight">
                    <p>{cashAmount > 0 && `Cash: $${cashAmount.toLocaleString()}`}</p>
                    <p>{transferAmount > 0 && `Transf: $${transferAmount.toLocaleString()}`}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handlePayment}
                disabled={!selectedCustomerId || totalCollected <= 0}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
              >
                <CheckCircle2 size={20} /> Confirmar Imputación
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
              <Lock size={18} className="text-red-500" /> Control de Riesgo
            </h2>
            <div className="space-y-3">
              {customers.map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all">
                  <div>
                    <p className="font-black text-slate-800 uppercase text-xs">{customer.name}</p>
                    <p className={`text-[9px] uppercase font-black tracking-widest mt-1 ${customer.isBlocked ? 'text-red-500' : 'text-emerald-500'}`}>
                      {customer.isBlocked ? 'Cuenta Bloqueada' : 'Línea de Crédito Habilitada'}
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleBlock(customer)}
                    className={`p-3 rounded-xl transition-all shadow-sm ${customer.isBlocked ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                  >
                    {customer.isBlocked ? <Unlock size={18} /> : <Lock size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Listado de Comandas y Deudas */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <History className="text-slate-400" size={20} /> Comandas Pendientes de Cobro
              </h2>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
                {pendingCollection.length} Pedidos por cobrar
              </span>
            </div>
            
            <div className="divide-y divide-slate-100">
              {pendingCollection.map(order => (
                <div key={order.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all group gap-4">
                  <div className="flex items-center gap-5">
                    <div className={`w-3 h-3 rounded-full ${order.status === OrderStatus.DISPATCHED ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                    <div>
                      <p className="font-black text-slate-800 uppercase text-lg tracking-tight leading-none mb-1">{order.customerName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="font-mono">#ORD-{order.id.substr(0,6).toUpperCase()}</span> 
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        Entregado el {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 pl-8 md:pl-0 border-l border-slate-100 md:border-none">
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${order.totalAmount.toLocaleString()}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                        order.status === OrderStatus.DISPATCHED ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {order.status === OrderStatus.DISPATCHED ? 'Deuda Total' : 'Saldo Parcial'}
                      </span>
                    </div>
                    <button className="p-3 bg-white border border-slate-200 text-slate-300 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                      <ArrowRightLeft size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {pendingCollection.length === 0 && (
                <div className="p-32 text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200 border border-slate-100">
                    <CheckCircle2 size={48} />
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">No existen deudas pendientes de cobro.</p>
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

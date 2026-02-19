
import React, { useState } from 'react';
import { Truck, RotateCcw, ClipboardCheck, ArrowRight } from 'lucide-react';
import { GateEntry } from '../types';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS } from '../constants';

interface Props {
  gateEntries: GateEntry[];
  setGateEntries: React.Dispatch<React.SetStateAction<GateEntry[]>>;
}

const GateView: React.FC<Props> = ({ gateEntries, setGateEntries }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    productId: '',
    quantity: 1,
    reason: 'Vencimiento'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = MOCK_CUSTOMERS.find(c => c.id === formData.customerId);
    const product = MOCK_PRODUCTS.find(p => p.id === formData.productId);
    
    if (!customer || !product) return;

    const newEntry: GateEntry = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      customerName: customer.name,
      productName: product.name,
      quantity: formData.quantity,
      reason: formData.reason,
      status: 'PENDING'
    };

    setGateEntries(prev => [newEntry, ...prev]);
    // Reset quantity after registration
    setFormData(prev => ({ ...prev, quantity: 1 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
          <Truck size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Portería: Registro de Entradas</h1>
          <p className="text-slate-500">Registrar mercadería que ingresa (devoluciones, canjes, etc.)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente / Distribuidor</label>
              <select 
                required
                value={formData.customerId}
                onChange={e => setFormData({...formData, customerId: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar...</option>
                {MOCK_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producto</label>
              <select 
                required
                value={formData.productId}
                onChange={e => setFormData({...formData, productId: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar...</option>
                {MOCK_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                <select 
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Vencimiento">Vencimiento</option>
                  <option value="Rotura">Rotura</option>
                  <option value="Error de Pedido">Error de Pedido</option>
                  <option value="Canje">Canje</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 mt-4">
              <ClipboardCheck size={20} />
              Registrar Entrada
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Entradas Pendientes de Procesar</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {gateEntries.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <RotateCcw className="mx-auto mb-2 opacity-20" size={48} />
                  <p>No hay ingresos registrados hoy.</p>
                </div>
              ) : (
                gateEntries.map(entry => (
                  <div key={entry.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800">{entry.productName}</p>
                      <p className="text-xs text-slate-500">{entry.customerName} • {entry.reason}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{entry.quantity} u.</p>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600">Pendiente</span>
                      </div>
                      <ArrowRight className="text-slate-300" size={20} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateView;

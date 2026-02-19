
import React from 'react';
import { Warehouse, Package, TrendingUp } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
}

const FactoryView: React.FC<Props> = ({ orders }) => {
  const validatedOrders = orders.filter(o => o.status === OrderStatus.VALIDATED);

  // Consolidate totals to produce
  const productionNeeds = validatedOrders.reduce((acc: {[id: string]: number}, order) => {
    order.items.forEach(item => {
      const total = item.quantity + (item.bonusQuantity || 0);
      acc[item.productId] = (acc[item.productId] || 0) + total;
    });
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Consolidado de Producción</h1>
          <p className="text-slate-500">Total a producir basado en pedidos validados.</p>
        </div>
        <button className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2">
          <TrendingUp size={18} /> Cargar Parte Diario
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-sm font-medium">Pedidos en Cola</p>
          <h3 className="text-3xl font-black text-slate-800">{validatedOrders.length}</h3>
        </div>
        {/* Simplified consolidated view */}
        {Object.entries(productionNeeds).map(([prodId, qty]) => (
          <div key={prodId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Producto {prodId}</p>
              <h3 className="text-2xl font-black text-slate-800">{qty} <span className="text-sm font-normal text-slate-400">uni</span></h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4">Detalle por Comanda (Preparación)</h2>
        <div className="space-y-3">
          {validatedOrders.map(order => (
            <div key={order.id} className="p-4 border border-slate-100 rounded-xl hover:border-blue-200 transition-colors flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{order.customerName}</p>
                <p className="text-xs text-slate-400">Preparar {order.items.reduce((a,b) => a + b.quantity + b.bonusQuantity, 0)} unidades totales</p>
              </div>
              <button className="text-blue-600 text-sm font-bold px-4 py-2 bg-blue-50 rounded-lg">Ver Detalle</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FactoryView;

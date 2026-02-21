
import React, { useState } from 'react';
import { Warehouse, Package, TrendingUp, Clock, X } from 'lucide-react';
import { Order, OrderStatus, Product } from '../types';

interface Props {
  orders: Order[];
  products: Product[];
}

const FactoryView: React.FC<Props> = ({ orders, products }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // We show both pending and validated orders so production can see what's coming
  const activeOrders = orders.filter(o => 
    o.status === OrderStatus.PENDING || o.status === OrderStatus.VALIDATED
  );

  const validatedOrders = orders.filter(o => o.status === OrderStatus.VALIDATED);
  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING);

  // Consolidate totals to produce
  const productionNeeds = activeOrders.reduce((acc: {[id: string]: number}, order) => {
    order.items.forEach(item => {
      const total = item.quantity + (item.bonusQuantity || 0);
      acc[item.productId] = (acc[item.productId] || 0) + total;
    });
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Consolidado de Producción</h1>
          <p className="text-slate-500 font-medium">Listado de productos a elaborar según pedidos activos.</p>
        </div>
        <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl shadow-slate-200">
          <TrendingUp size={18} /> Cargar Parte Diario
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">En Espera</p>
              <h3 className="text-3xl font-black text-slate-900">{pendingOrders.length}</h3>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Pedidos pendientes de validar</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Warehouse size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Validados</p>
              <h3 className="text-3xl font-black text-slate-900">{validatedOrders.length}</h3>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Listos para preparar carga</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Items</p>
              <h3 className="text-3xl font-black text-slate-900">
                {(Object.values(productionNeeds) as number[]).reduce((acc: number, val: number) => acc + val, 0)}
              </h3>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Unidades totales a fabricar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(productionNeeds).length === 0 ? (
          <div className="col-span-full bg-white p-20 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
            <Package size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No hay productos requeridos en este momento.</p>
          </div>
        ) : Object.entries(productionNeeds).map(([prodId, qty]) => {
          const product = products.find(p => p.id === prodId);
          return (
            <div key={prodId} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-500 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-2xl flex items-center justify-center transition-all">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{product?.brand || 'Marca'}</p>
                  <h3 className="font-black text-slate-800 uppercase text-sm leading-tight">{product?.name || `ID: ${prodId}`}</h3>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{qty}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidades</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Detalle por Comanda (Preparación)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {activeOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
              Sin comandas activas
            </div>
          ) : activeOrders.map(order => (
            <div key={order.id} className="px-8 py-6 hover:bg-slate-50 transition-colors flex justify-between items-center group">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-black text-slate-900 uppercase text-sm">{order.customerName}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${order.status === OrderStatus.VALIDATED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {order.status === OrderStatus.VALIDATED ? 'Validado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Preparar {order.items.reduce((acc: number, item) => acc + item.quantity + item.bonusQuantity, 0)} unidades totales
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(order)}
                className="text-blue-600 text-[10px] font-black uppercase tracking-widest px-6 py-2 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
              >
                Ver Detalle
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-1">Detalle de Preparación</h2>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cliente: {selectedOrder.customerName}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100/50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cant.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bonif.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map(item => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <tr key={item.id} className="bg-white/50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 uppercase text-xs">{p?.name || 'Producto'}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{p?.brand}</p>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-700 text-sm">{item.quantity}</td>
                          <td className="px-6 py-4 text-center font-black text-emerald-500 text-sm">{item.bonusQuantity > 0 ? `+${item.bonusQuantity}` : '-'}</td>
                          <td className="px-6 py-4 text-center font-black text-slate-900 text-sm">{item.quantity + item.bonusQuantity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="px-8 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-600 transition-all shadow-lg"
                >
                  Cerrar Detalle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryView;

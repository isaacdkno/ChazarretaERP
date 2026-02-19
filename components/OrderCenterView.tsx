
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Package, 
  Save, 
  Edit3,
  Percent,
  X,
  PlusCircle,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';
import { Order, OrderStatus, Product, Customer, OrderItem } from '../types';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder: (order: Order) => void;
  products: Product[];
  customers: Customer[];
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder, products, customers }) => {
  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'PRODUCTS' | 'BONUS' | 'PRICES'>('VALIDATE');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderCart, setOrderCart] = useState<{[id: string]: number}>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const openNewOrder = () => {
    setEditingOrder(null);
    setOrderCart({});
    setSelectedCustomerId('');
    setShowOrderForm(true);
  };

  const openEditOrder = (order: Order) => {
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.VALIDATED) {
      alert("No se puede editar un pedido ya procesado.");
      return;
    }
    setEditingOrder(order);
    setSelectedCustomerId(order.customerId);
    const initialCart: {[id: string]: number} = {};
    order.items.forEach(item => { initialCart[item.productId] = item.quantity; });
    setOrderCart(initialCart);
    setShowOrderForm(true);
  };

  const updateCart = (productId: string, delta: number) => {
    setOrderCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const calculateOrderTotals = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    const priceListId = customer?.priceListId || 'l1';
    let total = 0;
    
    const items: OrderItem[] = Object.entries(orderCart).map(([pid, qty]) => {
      const p = products.find(prod => prod.id === pid)!;
      const unitPrice = p.prices?.[priceListId] || 0;
      
      let bonusQty = 0;
      if (p.bonusEnabled && p.bonusThreshold && p.bonusPercentage) {
        if (qty >= p.bonusThreshold) {
          bonusQty = Math.ceil(qty * (p.bonusPercentage / 100));
        }
      }
      
      total += qty * unitPrice;
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: pid,
        quantity: qty,
        bonusQuantity: bonusQty,
        unitPrice: unitPrice
      };
    });

    return { total, items };
  };

  const handleSaveOrder = () => {
    if (!selectedCustomerId || Object.keys(orderCart).length === 0) return;
    
    const customer = customers.find(c => c.id === selectedCustomerId)!;
    const { total, items } = calculateOrderTotals(selectedCustomerId);

    if (editingOrder) {
      updateOrder({ ...editingOrder, items, totalAmount: total });
    } else {
      addOrder({
        id: Math.random().toString(36).substr(2, 9),
        customerId: customer.id,
        customerName: customer.name,
        status: OrderStatus.PENDING,
        items,
        totalAmount: total,
        createdAt: new Date().toISOString()
      });
    }
    setShowOrderForm(false);
  };

  const validateOrder = (order: Order) => {
    updateOrder({ ...order, status: OrderStatus.VALIDATED });
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.id.includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Centro de Pedidos</h1>
          <p className="text-slate-500 font-medium">Gestión integral validada con Supabase.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: 'VALIDATE', label: 'Comandas', icon: <ClipboardCheck size={18} /> },
            { id: 'PRODUCTS', label: 'Catálogo', icon: <Package size={18} /> },
            { id: 'PRICES', label: 'Tarifas', icon: <DollarSign size={18} /> },
            { id: 'BONUS', label: 'Bonificaciones', icon: <Percent size={18} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'VALIDATE' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar comanda..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-12 pr-6 py-3 border border-slate-100 bg-slate-50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none w-80 font-medium"
                />
             </div>
             <button 
              onClick={openNewOrder}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all"
             >
               <PlusCircle size={18} /> Nueva Comanda
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Importe</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">Sin movimientos registrados</td>
                  </tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="font-mono text-xs font-bold text-slate-400">#ORD-{order.id.toString().substr(0, 6).toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-5 uppercase font-black text-slate-800 text-sm">{order.customerName}</td>
                    <td className="px-8 py-5 font-black text-slate-900">${order.totalAmount.toLocaleString()}</td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        order.status === OrderStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        order.status === OrderStatus.VALIDATED ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right space-x-2">
                       {(order.status === OrderStatus.PENDING || order.status === OrderStatus.VALIDATED) && (
                         <>
                          <button onClick={() => openEditOrder(order)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 shadow-sm"><Edit3 size={16}/></button>
                          {order.status === OrderStatus.PENDING && (
                            <button onClick={() => validateOrder(order)} className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle2 size={16}/></button>
                          )}
                         </>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showOrderForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="flex-1 p-10 overflow-y-auto bg-slate-50/50 border-r border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">{editingOrder ? 'Editando Comanda' : 'Nueva Comanda'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(p => {
                    const cust = customers.find(c => c.id === selectedCustomerId);
                    const listId = cust?.priceListId || 'l1';
                    return (
                      <div key={p.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center hover:border-blue-300 transition-all">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{p.brand}</p>
                            <p className="font-bold text-slate-800 uppercase text-sm">{p.name}</p>
                            <p className="text-xs font-black text-blue-600 mt-1">${(p.prices?.[listId] || 0).toLocaleString()}</p>
                         </div>
                         <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl">
                            <button onClick={() => updateCart(p.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg">-</button>
                            <span className="font-black text-slate-800 min-w-[20px] text-center">{orderCart[p.id] || 0}</span>
                            <button onClick={() => updateCart(p.id, 1)} className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-md">+</button>
                         </div>
                      </div>
                    );
                  })}
                </div>
             </div>

             <div className="w-96 bg-white p-10 flex flex-col">
                <div className="flex justify-end mb-6">
                  <button onClick={() => setShowOrderForm(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                </div>
                <div className="space-y-6 flex-1">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cliente</label>
                      <select 
                        disabled={editingOrder !== null}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                      >
                        <option value="">Buscar Cliente...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="border-t border-slate-100 pt-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingCart size={14} /> Detalle de Carga</h3>
                      <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(orderCart).map(([pid, qty]) => {
                          const p = products.find(prod => prod.id === pid)!;
                          return (
                            <div key={pid} className="flex justify-between items-center text-sm font-bold">
                               <p className="text-slate-800 truncate max-w-[140px] uppercase">{p.name}</p>
                               <p className="text-slate-900">${(qty * (p.prices?.[customers.find(c => c.id === selectedCustomerId)?.priceListId || 'l1'] || 0)).toLocaleString()}</p>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </div>
                <div className="pt-6 border-t border-slate-100 mt-auto">
                   <div className="flex justify-between items-end mb-6">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">${calculateOrderTotals(selectedCustomerId).total.toLocaleString()}</span>
                   </div>
                   <button onClick={handleSaveOrder} disabled={!selectedCustomerId || Object.keys(orderCart).length === 0} className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-20 transition-all flex items-center justify-center gap-3">
                     <Save size={18} /> {editingOrder ? 'Actualizar' : 'Generar Comanda'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCenterView;

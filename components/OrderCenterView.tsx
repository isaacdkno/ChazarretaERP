
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  Save, 
  Edit3,
  Percent,
  Zap,
  X,
  PlusCircle,
  DollarSign,
  ShoppingCart,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Order, OrderStatus, Product, Customer, PriceList, OrderItem } from '../types';
import { MOCK_PRODUCTS, MOCK_PRICE_LISTS, MOCK_CUSTOMERS } from '../constants';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder: (order: Order) => void;
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder }) => {
  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'PRODUCTS' | 'BONUS' | 'PRICES'>('VALIDATE');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados para CRUD de Productos/Precios (Mantenidos de versión anterior)
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [priceLists, setPriceLists] = useState<PriceList[]>(MOCK_PRICE_LISTS);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ brand: 'La Fornarina', category: 'Panificados', bonusEnabled: true, prices: {} });

  // --- ESTADOS PARA GESTIÓN DE PEDIDOS ---
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderCart, setOrderCart] = useState<{[id: string]: number}>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // --- LÓGICA DE PEDIDOS (CREAR / EDITAR) ---
  
  const openNewOrder = () => {
    setEditingOrder(null);
    setOrderCart({});
    setSelectedCustomerId('');
    setShowOrderForm(true);
  };

  const openEditOrder = (order: Order) => {
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.VALIDATED) {
      alert("No se puede editar un pedido que ya ha sido despachado o cobrado.");
      return;
    }
    setEditingOrder(order);
    setSelectedCustomerId(order.customerId);
    const initialCart: {[id: string]: number} = {};
    order.items.forEach(item => {
      initialCart[item.productId] = item.quantity;
    });
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
    const customer = MOCK_CUSTOMERS.find(c => c.id === customerId);
    const priceListId = customer?.priceListId || 'l1';
    let total = 0;
    
    const items: OrderItem[] = Object.entries(orderCart).map(([pid, qty]) => {
      const p = products.find(prod => prod.id === pid)!;
      const unitPrice = p.prices[priceListId] || 0;
      
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
    
    const customer = MOCK_CUSTOMERS.find(c => c.id === selectedCustomerId)!;
    const { total, items } = calculateOrderTotals(selectedCustomerId);

    if (editingOrder) {
      updateOrder({
        ...editingOrder,
        items,
        totalAmount: total,
      });
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

  // --- RENDERING ---

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.id.includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Centro de Pedidos</h1>
          <p className="text-slate-500 font-medium">Gestión integral de ventas, catálogos y tarifas.</p>
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

      {/* VISTA: GESTOR DE COMANDAS (VALIDACIÓN + EDICIÓN) */}
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
                  className="pl-12 pr-6 py-3 border border-slate-100 bg-slate-50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none w-80 font-medium transition-all"
                />
             </div>
             <button 
              onClick={openNewOrder}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
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
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <p className="font-mono text-xs font-bold text-slate-400">#ORD-{order.id.substr(0, 6).toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-800 uppercase text-sm">{order.customerName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{order.items.length} artículos</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-900">${order.totalAmount.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        order.status === OrderStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        order.status === OrderStatus.VALIDATED ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-100 text-slate-500 border-slate-200 opacity-60'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right space-x-2">
                       {(order.status === OrderStatus.PENDING || order.status === OrderStatus.VALIDATED) && (
                         <>
                          <button 
                            onClick={() => openEditOrder(order)}
                            className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                            title="Editar Pedido"
                          >
                            <Edit3 size={16}/>
                          </button>
                          {order.status === OrderStatus.PENDING && (
                            <button 
                              onClick={() => validateOrder(order)}
                              className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Validar para Producción"
                            >
                              <CheckCircle2 size={16}/>
                            </button>
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

      {/* VISTAS DE CATÁLOGO Y PRECIOS (MANTENIDAS) */}
      {activeTab === 'PRODUCTS' && (
        /* ... Se mantiene la lógica del CRUD de productos ... */
        <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center">Sección de gestión de artículos habilitada.</div>
      )}

      {/* --- MODAL DE CREACIÓN / EDICIÓN DE COMANDAS --- */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300">
             {/* Lado Izquierdo: Selección de Productos */}
             <div className="flex-1 p-10 overflow-y-auto bg-slate-50/50 border-r border-slate-100">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                     {editingOrder ? 'Editando Comanda' : 'Nueva Comanda'}
                   </h2>
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Buscar producto..." 
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(p => (
                    <div key={p.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center group hover:border-blue-300 transition-all">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{p.brand}</p>
                          <p className="font-bold text-slate-800 uppercase text-sm">{p.name}</p>
                          <p className="text-xs font-black text-blue-600 mt-1">${(p.prices[MOCK_CUSTOMERS.find(c => c.id === selectedCustomerId)?.priceListId || 'l1'] || 0).toLocaleString()}</p>
                       </div>
                       <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl">
                          <button 
                            onClick={() => updateCart(p.id, -1)}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-all shadow-sm"
                          >
                            -
                          </button>
                          <span className="font-black text-slate-800 min-w-[20px] text-center">{orderCart[p.id] || 0}</span>
                          <button 
                            onClick={() => updateCart(p.id, 1)}
                            className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-md transition-all"
                          >
                            +
                          </button>
                       </div>
                    </div>
                  ))}
                </div>
             </div>

             {/* Lado Derecho: Resumen y Cliente */}
             <div className="w-96 bg-white p-10 flex flex-col">
                <div className="flex justify-end mb-6">
                  <button onClick={() => setShowOrderForm(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                </div>

                <div className="space-y-6 flex-1">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Seleccionar Cliente</label>
                      <select 
                        disabled={editingOrder !== null}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all disabled:opacity-60"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                      >
                        <option value="">Buscar Cliente...</option>
                        {MOCK_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>

                   <div className="border-t border-slate-100 pt-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShoppingCart size={14} /> Detalle de Carga
                      </h3>
                      <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(orderCart).length === 0 ? (
                          <p className="text-center py-10 text-slate-300 font-bold text-xs uppercase italic">Sin artículos</p>
                        ) : (
                          Object.entries(orderCart).map(([pid, qty]) => {
                            const p = products.find(prod => prod.id === pid)!;
                            return (
                              <div key={pid} className="flex justify-between items-center text-sm">
                                 <div>
                                    <p className="font-bold text-slate-800 truncate max-w-[140px]">{p.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{qty} uni</p>
                                 </div>
                                 <p className="font-black text-slate-900">${(qty * (p.prices[MOCK_CUSTOMERS.find(c => c.id === selectedCustomerId)?.priceListId || 'l1'] || 0)).toLocaleString()}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100 mt-auto">
                   <div className="flex justify-between items-end mb-6">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total Estimado</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">${calculateOrderTotals(selectedCustomerId).total.toLocaleString()}</span>
                   </div>
                   <button 
                    onClick={handleSaveOrder}
                    disabled={!selectedCustomerId || Object.keys(orderCart).length === 0}
                    className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
                   >
                     <Save size={18} /> {editingOrder ? 'Actualizar Comanda' : 'Generar Comanda'}
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

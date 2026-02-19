
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Settings2, 
  Trash2, 
  Check, 
  Search, 
  Package, 
  Save, 
  Edit3,
  UserPlus,
  ShoppingCart,
  Percent,
  Layers,
  Info,
  History
} from 'lucide-react';
import { Order, OrderStatus, OrderItem, Product, Customer, BonusConfig, PriceList } from '../types';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder?: (order: Order) => void;
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder }) => {
  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'CREATE' | 'CATALOG' | 'PRICES'>('VALIDATE');
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkPriceChange, setBulkPriceChange] = useState<string>('');

  const [bonusConfig, setBonusConfig] = useState<BonusConfig>({
    threshold: 20,
    percentage: 10
  });

  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [newOrderCustomer, setNewOrderCustomer] = useState<string>('');
  const [cart, setCart] = useState<{ [id: string]: number }>({});

  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.VALIDATED);

  const applyBulkPriceIncrease = () => {
    const percentage = parseFloat(bulkPriceChange);
    if (isNaN(percentage)) return;

    const factor = 1 + (percentage / 100);
    const updatedProducts = products.map(p => {
      const newPrices = { ...p.prices };
      Object.keys(newPrices).forEach(listId => {
        newPrices[listId] = Math.round(newPrices[listId] * factor);
      });
      return { ...p, prices: newPrices };
    });
    setProducts(updatedProducts);
    setBulkPriceChange('');
    alert(`Precios aumentados un ${percentage}% globalmente.`);
  };

  const updateItemQty = (order: Order, itemId: string, newQty: number) => {
    const updatedItems = order.items.map(item => {
      if (item.id === itemId) {
        const prod = products.find(p => p.id === item.productId);
        const bonusQty = (prod?.bonusEnabled && newQty >= bonusConfig.threshold) 
          ? Math.floor(newQty * (bonusConfig.percentage / 100)) 
          : 0;
        return { ...item, quantity: Math.max(0, newQty), bonusQuantity: bonusQty };
      }
      return item;
    });
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    updateOrder({ ...order, items: updatedItems, totalAmount: newTotal });
  };

  const handleCreateManualOrder = () => {
    if (!newOrderCustomer) return;
    const customer = MOCK_CUSTOMERS.find(c => c.id === newOrderCustomer);
    if (!customer) return;

    const items: OrderItem[] = Object.entries(cart).map(([prodId, qty]) => {
      const p = products.find(prod => prod.id === prodId)!;
      const bonusQty = (p.bonusEnabled && qty >= bonusConfig.threshold) 
        ? Math.floor(qty * (bonusConfig.percentage / 100)) 
        : 0;
      const price = p.prices[customer.priceListId] || p.prices['l1'];

      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: prodId,
        quantity: qty,
        bonusQuantity: bonusQty,
        unitPrice: price
      };
    }).filter(i => i.quantity > 0);

    const total = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      customerName: customer.name,
      status: OrderStatus.VALIDATED,
      items,
      totalAmount: total,
      createdAt: new Date().toISOString()
    };

    if (addOrder) addOrder(newOrder);
    setCart({});
    setNewOrderCustomer('');
    setActiveTab('VALIDATE');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Centro de Pedidos</h1>
          <p className="text-slate-500">Gestión operativa y actualización de precios.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: 'VALIDATE', label: 'Validar', icon: <ClipboardCheck size={18} /> },
            { id: 'CREATE', label: 'Cargar', icon: <Plus size={18} /> },
            { id: 'CATALOG', label: 'Bonificaciones', icon: <Percent size={18} /> },
            { id: 'PRICES', label: 'Precios', icon: <Layers size={18} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* --- PESTAÑA: PRECIOS Y EDICIÓN MASIVA --- */}
      {activeTab === 'PRICES' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-2xl">
                  <TrendingUpIcon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Aumento Masivo de Precios</h3>
                  <p className="text-slate-400 text-sm">Afecta a todas las listas y productos seleccionados.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-32">
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center"
                    value={bulkPriceChange}
                    onChange={e => setBulkPriceChange(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                </div>
                <button 
                  onClick={applyBulkPriceIncrease}
                  className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                >
                  Aplicar Aumento
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
              <h3 className="font-bold text-slate-800">Matriz de Precios</h3>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filtrar por nombre..." 
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Producto</th>
                    {MOCK_PRICE_LISTS.map(list => (
                      <th key={list.id} className="px-6 py-4">{list.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{product.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{product.brand}</p>
                      </td>
                      {MOCK_PRICE_LISTS.map(list => (
                        <td key={list.id} className="px-6 py-4">
                          <input 
                            type="number" 
                            className="w-24 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none font-mono font-bold text-sm text-slate-600"
                            value={product.prices[list.id]}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setProducts(products.map(p => p.id === product.id ? {...p, prices: {...p.prices, [list.id]: val}} : p));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- PESTAÑA: VALIDAR (COMANDAS PENDIENTES) --- */}
      {activeTab === 'VALIDATE' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          {pendingOrders.map(order => (
            <div key={order.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50/30 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-black bg-slate-200 text-slate-600 px-2 py-1 rounded-lg uppercase">#ORD-{order.id.substr(0,8)}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${order.status === OrderStatus.PENDING ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                      {order.status === OrderStatus.PENDING ? 'PENDIENTE' : 'VALIDADO'}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{order.customerName}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateOrder({...order, status: OrderStatus.CANCELLED})} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                    <Trash2 size={20} />
                  </button>
                  {order.status === OrderStatus.PENDING && (
                    <button onClick={() => updateOrder({...order, status: OrderStatus.VALIDATED})} className="px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-bold shadow-xl shadow-blue-100 transition-all flex items-center gap-2">
                      <Check size={20} /> Validar Carga
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="pb-4">Producto</th>
                      <th className="pb-4">Cantidad</th>
                      <th className="pb-4">Bonif. Actual</th>
                      <th className="pb-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {order.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-4 text-slate-800 font-bold">{products.find(p=>p.id===item.productId)?.name || 'Producto'}</td>
                        <td className="py-4">
                          <input 
                            type="number" 
                            className="w-20 px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-center focus:ring-2 focus:ring-blue-500"
                            value={item.quantity}
                            onChange={(e) => updateItemQty(order, item.id, parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-4">
                          {item.bonusQuantity > 0 ? (
                            <span className="text-emerald-600 font-black text-[10px] bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">+{item.bonusQuantity} SIN CARGO</span>
                          ) : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-4 text-right font-mono font-bold text-slate-900">${(item.quantity * item.unitPrice).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {pendingOrders.length === 0 && (
             <div className="p-32 text-center text-slate-300">
                <ClipboardCheck size={80} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-sm">No hay comandas activas</p>
             </div>
          )}
        </div>
      )}

      {/* --- PESTAÑA: BONIFICACIONES (CONFIG) --- */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
                <Percent size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Reglas de Bonificación Automática</h3>
                <p className="text-xs text-slate-500">Define cuándo y cuánto se bonifica por cantidad.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Umbral Mínimo (unidades)</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  value={bonusConfig.threshold}
                  onChange={e => setBonusConfig({...bonusConfig, threshold: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Porcentaje (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    value={bonusConfig.percentage}
                    onChange={e => setBonusConfig({...bonusConfig, percentage: parseInt(e.target.value) || 0})}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                </div>
              </div>
              <div className="flex gap-2 p-3 bg-blue-50 rounded-xl text-blue-700 text-xs items-center">
                <Info size={16} className="shrink-0" />
                <span>Ej: {bonusConfig.threshold}u = {Math.floor(bonusConfig.threshold * (bonusConfig.percentage / 100))}u SC.</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
             <h3 className="font-bold text-slate-800 mb-4">Activar Bonificaciones por Producto</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(p => (
                  <label key={p.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 cursor-pointer">
                    <span className="font-bold text-slate-700">{p.name}</span>
                    <input 
                      type="checkbox" 
                      checked={p.bonusEnabled}
                      onChange={() => setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusEnabled: !prod.bonusEnabled} : prod))}
                      className="w-6 h-6 rounded-lg text-blue-600"
                    />
                  </label>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* --- PESTAÑA: CARGA MANUAL (CREATE) --- */}
      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in zoom-in-95 duration-200">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Destino del Pedido</label>
              <select 
                className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-700"
                value={newOrderCustomer}
                onChange={e => setNewOrderCustomer(e.target.value)}
              >
                <option value="">Seleccionar Cliente...</option>
                {MOCK_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Detalle de Mercadería</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                      <p className="text-[10px] font-bold text-blue-500">${p.prices['l1'].toLocaleString()} /u</p>
                    </div>
                    <input 
                      type="number"
                      min="0"
                      className="w-16 p-2 border border-slate-200 rounded-xl text-center font-bold"
                      value={cart[p.id] || ''}
                      onChange={e => setCart({...cart, [p.id]: parseInt(e.target.value) || 0})}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl sticky top-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                <ShoppingCart className="text-blue-500" /> Resumen
              </h2>
              <div className="space-y-4 mb-10 min-h-[100px]">
                {Object.entries(cart).filter(([_,q]) => q > 0).map(([id, q]) => {
                  const p = products.find(prod => prod.id === id)!;
                  return (
                    <div key={id} className="flex justify-between items-center border-b border-white/10 pb-4">
                      <span className="text-xs font-bold">{p.name} (x{q})</span>
                      <span className="font-mono text-blue-400">${(q * p.prices['l1']).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
              <button 
                onClick={handleCreateManualOrder}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 rounded-[24px] font-black uppercase tracking-widest transition-all"
                disabled={!newOrderCustomer || Object.values(cart).every(v=>v===0)}
              >
                Cargar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper icon
const TrendingUpIcon = ({size}: {size: number}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

export default OrderCenterView;

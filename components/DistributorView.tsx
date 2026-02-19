
import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Search, Trash2, CheckCircle2, Percent, Zap } from 'lucide-react';
import { Product, Customer, Order, OrderStatus, OrderItem } from '../types';

interface Props {
  addOrder: (o: Order) => void;
  customers: Customer[];
  products: Product[];
}

const DistributorView: React.FC<Props> = ({ addOrder, customers, products }) => {
  const [cart, setCart] = useState<{[id: string]: number}>({});
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState(false);

  // Valores Globales por Defecto
  const DEFAULT_BONUS_THRESHOLD = 20;
  const DEFAULT_BONUS_PERCENTAGE = 10;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const calculateTotals = () => {
    const customer = customers[0];
    const priceListId = customer?.priceListId || 'l1';
    let subtotal = 0;
    let bonusCount = 0;
    
    const items: OrderItem[] = Object.keys(cart).map((id) => {
      const qty = cart[id];
      const product = products.find(p => p.id === id)!;
      
      // LÓGICA DE HERENCIA: Producto > Global
      const threshold = product.bonusThreshold || DEFAULT_BONUS_THRESHOLD;
      const percentage = product.bonusPercentage || DEFAULT_BONUS_PERCENTAGE;
      
      let bonusQty = 0;
      if (product.bonusEnabled && qty >= threshold) {
        bonusQty = Math.floor(qty * (percentage / 100));
      }
      
      const unitPrice = product.prices[priceListId] || 0;
      subtotal += qty * unitPrice;
      bonusCount += bonusQty;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: id,
        quantity: qty,
        bonusQuantity: bonusQty,
        unitPrice: unitPrice
      };
    });
    return { subtotal, bonusCount, items };
  };

  const { subtotal, bonusCount, items } = calculateTotals();

  const handleSendOrder = () => {
    const customer = customers[0];
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      customerName: customer.name,
      status: OrderStatus.PENDING,
      items,
      totalAmount: subtotal,
      createdAt: new Date().toISOString()
    };
    addOrder(newOrder);
    setCart({});
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Product Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Catálogo Chazarreta</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar productos..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-12 pr-6 py-3 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 outline-none w-full md:w-80 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const customer = customers[0];
            const priceListId = customer?.priceListId || 'l1';
            const unitPrice = product.prices[priceListId] || 0;
            const threshold = product.bonusThreshold || DEFAULT_BONUS_THRESHOLD;
            const percentage = product.bonusPercentage || DEFAULT_BONUS_PERCENTAGE;
            
            return (
              <div key={product.id} className="bg-white border border-slate-200 p-6 rounded-[2rem] flex flex-col justify-between hover:shadow-xl hover:border-blue-200 transition-all group">
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${product.brand === 'La Fornarina' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                      {product.brand}
                    </span>
                    {product.bonusEnabled && (
                      <div className="flex items-center gap-1 text-emerald-600">
                         <Zap size={14} className="fill-emerald-600" />
                         <span className="text-[10px] font-black uppercase tracking-tighter">Oferta Activa</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase leading-tight mb-2">{product.name}</h3>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">${unitPrice.toLocaleString()}</p>
                  
                  {product.bonusEnabled && (
                    <div className="mt-3 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                      <Percent size={14} />
                      <p className="text-[10px] font-black uppercase tracking-widest">{percentage}% Bonif. ({threshold}u+)</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl">
                  <button 
                    onClick={() => updateCart(product.id, -1)}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="text-xl font-black text-slate-800">{cart[product.id] || 0}</span>
                  <button 
                    onClick={() => updateCart(product.id, 1)}
                    className="w-10 h-10 flex items-center justify-center bg-blue-600 rounded-xl text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart Summary */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl p-8 sticky top-8 border border-white/10">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shadow-inner">
              <ShoppingCart size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-tight uppercase">Tu Comanda</h2>
          </div>

          <div className="space-y-6 mb-10 max-h-[40vh] overflow-auto pr-2 custom-scrollbar">
            {items.length === 0 ? (
              <div className="text-center py-12">
                 <BoxIcon size={48} className="mx-auto mb-4 opacity-10" />
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carrito vacío</p>
              </div>
            ) : items.map(item => {
              const p = products.find(prod => prod.id === item.productId)!;
              return (
                <div key={item.id} className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <p className="font-bold text-slate-100 text-sm">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{item.quantity} uni x ${item.unitPrice.toLocaleString()}</p>
                    {item.bonusQuantity > 0 && (
                      <p className="text-emerald-400 font-black text-[10px] uppercase mt-1 tracking-tighter flex items-center gap-1">
                        <Zap size={10} className="fill-emerald-400" /> + {item.bonusQuantity} Sin Cargo
                      </p>
                    )}
                  </div>
                  <p className="font-black text-white font-mono">${(item.quantity * item.unitPrice).toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex justify-between text-slate-400 text-sm font-bold uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="font-mono text-slate-100">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-400 text-sm font-black uppercase tracking-widest">
              <span>Bonificaciones</span>
              <span>{bonusCount} u.</span>
            </div>
            <div className="pt-6 border-t border-white/10">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Total a Pagar</span>
                <span className="text-4xl font-black text-white tracking-tighter font-mono">${subtotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button 
            disabled={items.length === 0}
            onClick={handleSendOrder}
            className="w-full py-5 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95 flex items-center justify-center gap-3"
          >
            {success ? <CheckCircle2 size={24} /> : 'Confirmar Pedido'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BoxIcon = ({size, className}: {size: number, className?: string}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
);

export default DistributorView;


import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Search, Trash2, CheckCircle2, Zap, Package, Box } from 'lucide-react';
import { Product, Customer, Order, OrderStatus, OrderItem, UserRole } from '../types';

interface Props {
  addOrder: (o: Order) => void;
  customers: Customer[];
  products: Product[];
  currentUser: {name: string, role: UserRole, email?: string};
}

const DistributorView: React.FC<Props> = ({ addOrder, customers, products, currentUser }) => {
  const [cart, setCart] = useState<{[id: string]: number}>({});
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [success, setSuccess] = useState(false);

  // SAFE DEFAULTS INTERNOS
  const FALLBACK_THRESHOLD = 20;
  const FALLBACK_PERCENTAGE = 10;

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

  const setQuantity = (id: string, qty: number) => {
    setCart(prev => {
      const next = Math.max(0, qty);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const calculateTotals = () => {
    // Intentamos buscar un cliente que coincida con el nombre del usuario
    // Si no existe, usamos el primero de la lista como fallback
    const customer = customers.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase()) || customers[0];
    const priceListId = customer?.priceListId || 'l1';
    let subtotal = 0;
    let bonusCount = 0;
    
    const items: OrderItem[] = Object.keys(cart).map((id) => {
      const qty = cart[id];
      const product = products.find(p => p.id === id)!;
      
      let bonusQty = 0;
      if (product.bonusEnabled) {
        const threshold = product.bonusThreshold || FALLBACK_THRESHOLD;
        const percentage = product.bonusPercentage || FALLBACK_PERCENTAGE;
        
        if (qty >= threshold) {
          bonusQty = Math.ceil(qty * (percentage / 100));
        }
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
    return { subtotal, bonusCount, items, customer };
  };

  const { subtotal, bonusCount, items, customer } = calculateTotals();

  const handleSendOrder = () => {
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer?.id || 'unknown',
      customerName: currentUser.name, // Usamos el nombre del usuario logueado
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* Product Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col space-y-4">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Carga de Pedido</h1>
          <p className="text-slate-500 font-medium">Hola <span className="text-blue-600 font-bold">{currentUser.name}</span>, busque productos para agregar a su comanda.</p>
          
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Escriba el nombre del producto..." 
                value={search}
                onFocus={() => setShowDropdown(true)}
                onChange={e => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                className="pl-12 pr-6 py-4 border-2 border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-full font-bold transition-all text-lg shadow-sm"
              />
            </div>

            {showDropdown && search.length > 0 && (
              <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => {
                    const priceListId = customer?.priceListId || 'l1';
                    const unitPrice = product.prices[priceListId] || 0;
                    
                    return (
                      <button
                        key={product.id}
                        onClick={() => {
                          updateCart(product.id, 1);
                          setSearch('');
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${product.brand === 'La Fornarina' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                              {product.brand}
                            </span>
                            {product.bonusEnabled && (
                              <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-0.5">
                                <Zap size={10} className="fill-emerald-600" /> Oferta
                              </span>
                            )}
                          </div>
                          <p className="font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase">{product.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 text-lg">${unitPrice.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Click para agregar</p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-6 py-8 text-center">
                    <Package size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron productos</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h4 className="font-black text-blue-900 uppercase text-xs tracking-widest mb-1">Bonificaciones Activas</h4>
            <p className="text-blue-700 text-sm font-medium">Recuerde que los productos marcados con <span className="font-bold">Oferta</span> generan unidades sin cargo automáticamente al superar el umbral de 20 unidades.</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl p-8 sticky top-8 border border-white/10">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shadow-inner">
              <ShoppingCart size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-tight uppercase">Tu Comanda</h2>
          </div>

          <div className="space-y-6 mb-10 max-h-[50vh] overflow-auto pr-2 custom-scrollbar">
            {items.length === 0 ? (
              <div className="text-center py-12">
                 <Box size={48} className="mx-auto mb-4 opacity-10" />
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carrito vacío</p>
              </div>
            ) : items.map(item => {
              const p = products.find(prod => prod.id === item.productId)!;
              return (
                <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-slate-100 text-sm uppercase leading-tight">{p.name}</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">${item.unitPrice.toLocaleString()} / uni</p>
                    </div>
                    <button 
                      onClick={() => setQuantity(item.productId, 0)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-white/5">
                      <button 
                        onClick={() => updateCart(item.productId, -1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-slate-400 transition-all"
                      >
                        <Minus size={14} />
                      </button>
                      <input 
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => setQuantity(item.productId, parseInt(e.target.value) || 0)}
                        className="w-12 bg-transparent text-center font-black text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button 
                        onClick={() => updateCart(item.productId, 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-slate-400 transition-all"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white font-mono text-lg">${(item.quantity * item.unitPrice).toLocaleString()}</p>
                      {item.bonusQuantity > 0 && (
                        <p className="text-emerald-400 font-black text-[10px] uppercase tracking-tighter flex items-center justify-end gap-1">
                          <Zap size={10} className="fill-emerald-400" /> + {item.bonusQuantity} Bonif.
                        </p>
                      )}
                    </div>
                  </div>
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

export default DistributorView;

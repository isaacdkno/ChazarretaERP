
import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Search, Trash2, CheckCircle2 } from 'lucide-react';
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

  // Constants for bonus logic (could be fetched from a config table)
  const BONUS_THRESHOLD = 20;
  const BONUS_PERCENTAGE = 0.10; // 10% configurable

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

  // Fixed calculateTotals to handle prices per customer's price list
  const calculateTotals = () => {
    const customer = customers[0]; // Simulation: user is first customer
    const priceListId = customer?.priceListId || 'l1';
    let subtotal = 0;
    let bonusCount = 0;
    const items: OrderItem[] = Object.keys(cart).map((id) => {
      const qty = cart[id];
      const product = products.find(p => p.id === id)!;
      let bonusQty = 0;
      if (product.bonusEnabled && qty >= BONUS_THRESHOLD) {
        bonusQty = Math.floor(qty * BONUS_PERCENTAGE);
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
    const customer = customers[0]; // Simulation: user is first customer
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
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Productos</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o marca..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const customer = customers[0];
            const priceListId = customer?.priceListId || 'l1';
            const unitPrice = product.prices[priceListId] || 0;
            
            return (
              <div key={product.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all">
                <div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-1 inline-block ${product.brand === 'La Fornarina' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {product.brand}
                  </span>
                  <h3 className="font-bold text-slate-800">{product.name}</h3>
                  <p className="text-sm text-slate-500">${unitPrice.toLocaleString()} / uni</p>
                  {product.bonusEnabled && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">Bonif. 10% activa (+20u)</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-xl">
                  <button 
                    onClick={() => updateCart(product.id, -1)}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-bold text-slate-700">{cart[product.id] || 0}</span>
                  <button 
                    onClick={() => updateCart(product.id, 1)}
                    className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-lg text-white hover:bg-blue-700 shadow-sm"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sticky top-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <ShoppingCart size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Resumen del Pedido</h2>
          </div>

          <div className="space-y-4 mb-8 max-h-[40vh] overflow-auto pr-2">
            {items.length === 0 ? (
              <p className="text-slate-400 italic text-center py-8">Tu carrito está vacío</p>
            ) : items.map(item => {
              const p = products.find(prod => prod.id === item.productId)!;
              return (
                <div key={item.id} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-slate-500">{item.quantity} x ${item.unitPrice.toLocaleString()}</p>
                    {item.bonusQuantity > 0 && (
                      <p className="text-emerald-600 font-medium text-xs">+ {item.bonusQuantity} unidades sin cargo</p>
                    )}
                  </div>
                  <p className="font-bold text-slate-800">${(item.quantity * item.unitPrice).toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Bonificaciones</span>
              <span>{bonusCount} unidades SC</span>
            </div>
            <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-100">
              <span>Total Final</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
          </div>

          <button 
            disabled={items.length === 0}
            onClick={handleSendOrder}
            className="w-full mt-8 py-4 bg-blue-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
          >
            Confirmar y Enviar Pedido
          </button>

          {success && (
            <div className="mt-4 p-3 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center gap-2 animate-bounce">
              <CheckCircle2 size={18} />
              <span>Pedido enviado con éxito</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributorView;


import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Zap, 
  Package, 
  Box,
  History,
  Printer,
  FileText,
  X,
  LayoutDashboard,
  ClipboardList,
  Truck,
  BadgeDollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { Product, Customer, Order, OrderStatus, OrderItem, UserRole, PaymentReceipt, GateEntry } from '../types';
import { supabase } from '../supabase';

interface Props {
  addOrder: (o: Order) => void;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  gateEntries: GateEntry[];
  currentUser: {name: string, role: UserRole, email?: string};
}

const DistributorView: React.FC<Props> = ({ addOrder, customers, products, orders, gateEntries, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDER' | 'HISTORY' | 'ORDER_HISTORY' | 'GATE_HISTORY'>('DASHBOARD');
  const [cart, setCart] = useState<{[id: string]: number}>({});
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState(false);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);

  const myCustomer = customers.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
  const myOrders = orders.filter(o => o.customerId === myCustomer?.id);
  const myGateEntries = gateEntries.filter(e => e.customerId === myCustomer?.id);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchReceipts();
    }
  }, [activeTab]);

  const fetchReceipts = async () => {
    const customer = customers.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
    if (!customer) return;

    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('customerId', customer.id)
      .order('createdAt', { ascending: false });
    
    if (!error && data) {
      setReceipts(data);
    }
  };

  const printThermalTicket = (receipt: PaymentReceipt) => {
    // Reusing the same print logic from CollectionView
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;

    const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              padding: 5mm; 
              font-size: 12px;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 5px 0; }
            .flex { display: flex; justify-content: space-between; }
            .title { font-size: 16px; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="center bold title">CHAZARRETA ERP</div>
          <div class="center">COMPROBANTE DE PAGO</div>
          <div class="line"></div>
          <div class="flex"><span>FECHA:</span> <span>${new Date(receipt.createdAt).toLocaleString()}</span></div>
          <div class="flex"><span>RECIBO:</span> <span>#${receipt.id.toString().substr(0,8).toUpperCase()}</span></div>
          <div class="line"></div>
          <div class="bold">CLIENTE:</div>
          <div>${receipt.customerName}</div>
          <div class="line"></div>
          <div class="bold">DETALLE DE PAGO:</div>
          <div class="flex"><span>EFECTIVO:</span> <span>$${receipt.cashAmount.toLocaleString()}</span></div>
          <div class="flex"><span>TRANSF:</span> <span>$${receipt.transferAmount.toLocaleString()}</span></div>
          <div class="line"></div>
          <div class="flex bold" style="font-size: 14px;">
            <span>TOTAL COBRADO:</span> 
            <span>$${receipt.amount.toLocaleString()}</span>
          </div>
          <div class="line"></div>
          <div class="bold">COMANDAS AFECTADAS:</div>
          ${(receipt.orderIds || []).map(id => `<div>- #ORD-${id.substr(0,6).toUpperCase()}</div>`).join('')}
          <div class="line"></div>
          <div class="center" style="margin-top: 20px;">
            GRACIAS POR SU PAGO<br>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

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
    const customer = customers.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
    
    // Si no existe el cliente, usamos 'unknown' como ID para evitar contaminar otros clientes
    const priceListId = customer?.priceListId || 'l1';
    let subtotal = 0;
    let bonusCount = 0;
    
    const items: OrderItem[] = Object.keys(cart).map((id) => {
      const qty = cart[id];
      const product = products.find(p => p.id === id);
      
      if (!product) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          productId: id,
          quantity: qty,
          bonusQuantity: 0,
          unitPrice: 0
        };
      }
      
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
      paidAmount: 0,
      createdAt: new Date().toISOString()
    };
    addOrder(newOrder);
    setCart({});
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Módulo Distribuidor</h1>
          <p className="text-slate-500 font-medium">Hola <span className="text-blue-600 font-bold">{currentUser.name}</span>, gestione sus pedidos y pagos.</p>
        </div>
        
        {!myCustomer && (
          <div className="bg-amber-50 border border-amber-200 px-6 py-3 rounded-2xl flex items-center gap-3 text-amber-700 animate-pulse">
            <AlertCircle size={20} />
            <p className="text-xs font-bold uppercase tracking-tight">Atención: No se encontró una cuenta vinculada a su nombre de usuario.</p>
          </div>
        )}
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={18} /> Resumen
          </button>
          <button 
            onClick={() => setActiveTab('ORDER')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'ORDER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ShoppingCart size={18} /> Nuevo Pedido
          </button>
          <button 
            onClick={() => setActiveTab('ORDER_HISTORY')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'ORDER_HISTORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ClipboardList size={18} /> Mis Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BadgeDollarSign size={18} /> Mis Pagos
          </button>
          <button 
            onClick={() => setActiveTab('GATE_HISTORY')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'GATE_HISTORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Truck size={18} /> Mis Cambios
          </button>
        </div>
      </header>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <BadgeDollarSign size={28} />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Actual</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
                ${myCustomer?.balance?.toLocaleString() || '0'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Cuenta Corriente</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <ClipboardList size={28} />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Pedidos Pendientes</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
                {myOrders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.VALIDATED).length}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">En proceso de preparación</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Truck size={28} />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Cambios Realizados</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
                {myGateEntries.length}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Historial de portería</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">Últimos Pedidos</h2>
                <button onClick={() => setActiveTab('ORDER_HISTORY')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Ver Todo</button>
              </div>
              <div className="divide-y divide-slate-100">
                {myOrders.slice(0, 5).map(order => (
                  <div key={order.id} className="px-8 py-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase">#ORD-{order.id.substr(0, 6).toUpperCase()}</p>
                        <p className="font-bold text-slate-800 text-xs">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">${order.totalAmount.toLocaleString()}</p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        order.status === OrderStatus.PAID_FULL ? 'bg-emerald-100 text-emerald-600' :
                        order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
                {myOrders.length === 0 && (
                  <div className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Sin pedidos recientes</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">Últimos Cambios / Devoluciones</h2>
                <button onClick={() => setActiveTab('GATE_HISTORY')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Ver Todo</button>
              </div>
              <div className="divide-y divide-slate-100">
                {myGateEntries.slice(0, 5).map(entry => (
                  <div key={entry.id} className="px-8 py-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <RotateCcw size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase">#GATE-{entry.id.substr(0, 6).toUpperCase()}</p>
                        <p className="font-bold text-slate-800 text-xs">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">{entry.items.reduce((acc, i) => acc + i.quantity, 0)} u.</p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        entry.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {entry.status === 'CONVERTED' ? 'Validado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
                {myGateEntries.length === 0 && (
                  <div className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Sin cambios registrados</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ORDER' && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Product Selection List */}
          <div className="flex-1 space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o marca..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-12 pr-6 py-4 border-2 border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-full font-bold transition-all text-lg shadow-sm"
                />
              </div>
            </div>

            {/* Compact Product List */}
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="col-span-6">Producto</div>
                <div className="col-span-3 text-right">Precio Unit.</div>
                <div className="col-span-3 text-right">Acción</div>
              </div>
              
              <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => {
                    const priceListId = customer?.priceListId || 'l1';
                    const unitPrice = product.prices[priceListId] || 0;
                    const inCart = cart[product.id] || 0;
                    
                    return (
                      <div key={product.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                        <div className="col-span-1 md:col-span-6 flex flex-col">
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
                          <p className="font-black text-slate-800 uppercase text-sm md:text-base">{product.name}</p>
                        </div>
                        
                        <div className="col-span-1 md:col-span-3 text-left md:text-right">
                          <p className="font-black text-slate-900 text-lg md:text-xl tracking-tighter">${unitPrice.toLocaleString()}</p>
                        </div>
                        
                        <div className="col-span-1 md:col-span-3 flex justify-end">
                          {inCart > 0 ? (
                            <div className="flex items-center bg-blue-50 rounded-xl p-1 border border-blue-100">
                              <button 
                                onClick={() => updateCart(product.id, -1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded-lg text-blue-600 transition-all"
                              >
                                <Minus size={14} />
                              </button>
                              <input 
                                type="number"
                                value={inCart}
                                onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 0)}
                                className="w-10 text-center font-black text-blue-700 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button 
                                onClick={() => updateCart(product.id, 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded-lg text-blue-600 transition-all"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => updateCart(product.id, 1)}
                              className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                            >
                              <Plus size={14} /> Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-6 py-12 text-center">
                    <Package size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron productos</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl p-8 sticky top-8 border border-white/10 ring-4 ring-blue-500/20">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shadow-inner">
                    <ShoppingCart size={24} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight uppercase">Tu Comanda</h2>
                </div>
                {items.length > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse">
                    {items.length} ITEMS
                  </span>
                )}
              </div>

              <div className="mb-10 max-h-[60vh] overflow-auto pr-2 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-center py-20">
                     <Box size={64} className="mx-auto mb-4 opacity-5" />
                     <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Empiece a buscar productos para cargar su pedido</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="grid grid-cols-12 gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/10 mb-2">
                      <div className="col-span-6">Producto</div>
                      <div className="col-span-3 text-center">Cant.</div>
                      <div className="col-span-3 text-right">Total</div>
                    </div>
                    <div className="space-y-1">
                      {items.map(item => {
                        const p = products.find(prod => prod.id === item.productId)!;
                        return (
                          <div key={item.id} className="grid grid-cols-12 gap-2 px-2 py-3 items-center border-b border-white/5 last:border-0 group hover:bg-white/5 rounded-xl transition-all">
                            <div className="col-span-6">
                              <p className="font-bold text-slate-100 text-[11px] uppercase leading-tight truncate">{p.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[9px] text-slate-500 font-black tracking-tighter">${item.unitPrice.toLocaleString()}</span>
                                {item.bonusQuantity > 0 && (
                                  <span className="text-emerald-400 font-black text-[9px] flex items-center gap-0.5">
                                    <Zap size={8} className="fill-emerald-400" /> +{item.bonusQuantity}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="col-span-3 flex flex-col items-center">
                              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-white/5 scale-90">
                                <button 
                                  onClick={() => updateCart(item.productId, -1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-slate-400 transition-all"
                                >
                                  <Minus size={12} />
                                </button>
                                <input 
                                  type="number" 
                                  value={item.quantity}
                                  onChange={(e) => setQuantity(item.productId, parseInt(e.target.value) || 0)}
                                  className="w-8 bg-transparent text-center font-black text-white outline-none text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button 
                                  onClick={() => updateCart(item.productId, 1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-slate-400 transition-all"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>

                            <div className="col-span-3 text-right flex flex-col items-end">
                              <p className="font-black text-white font-mono text-[11px] tracking-tighter">${(item.quantity * item.unitPrice).toLocaleString()}</p>
                              <button 
                                onClick={() => setQuantity(item.productId, 0)}
                                className="text-slate-600 hover:text-red-400 transition-colors mt-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
      )}

      {activeTab === 'ORDER_HISTORY' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <ClipboardList className="text-blue-500" size={20} /> Historial de Comandas
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {myOrders.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  No se registran pedidos en su cuenta
                </div>
              ) : myOrders.map(order => (
                <div key={order.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Comanda #ORD-{order.id.substr(0, 8).toUpperCase()}</p>
                      <p className="font-black text-slate-800 uppercase text-sm">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${order.totalAmount.toLocaleString()}</p>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          order.status === OrderStatus.PAID_FULL ? 'bg-emerald-100 text-emerald-600' :
                          order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'GATE_HISTORY' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <Truck className="text-amber-500" size={20} /> Historial de Portería (Cambios)
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {myGateEntries.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  No se registran ingresos de portería
                </div>
              ) : myGateEntries.map(entry => (
                <div key={entry.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                      <RotateCcw size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Ingreso #GATE-{entry.id.substr(0, 8).toUpperCase()}</p>
                      <p className="font-black text-slate-800 uppercase text-sm">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">{entry.items.reduce((acc, i) => acc + i.quantity, 0)} u.</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{entry.items.length} productos registrados</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${
                      entry.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {entry.status === 'CONVERTED' ? 'VALIDADO' : 'PENDIENTE'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <FileText className="text-blue-500" size={20} /> Historial de Pagos Realizados
              </h2>
              <button onClick={fetchReceipts} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Actualizar</button>
            </div>
            <div className="divide-y divide-slate-100">
              {receipts.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  No se registran pagos en su cuenta
                </div>
              ) : receipts.map(receipt => (
                <div key={receipt.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Comprobante #{receipt.id.toString().substr(0,8).toUpperCase()}</p>
                      <p className="font-black text-slate-800 uppercase text-sm">{new Date(receipt.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${receipt.amount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Monto Total</p>
                    </div>
                    <button 
                      onClick={() => printThermalTicket(receipt)}
                      className="p-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg"
                      title="Imprimir Ticket"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorView;

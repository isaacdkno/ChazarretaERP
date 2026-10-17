import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Plus, Minus, Search, Trash2, CheckCircle2, Zap, Package, Box,
  History, Printer, FileText, X, LayoutDashboard, ClipboardList, Truck,
  BadgeDollarSign, ArrowUpRight, ArrowDownLeft, RotateCcw, AlertCircle, Lock,
  User, ChevronRight, LogOut
} from 'lucide-react';
import { Product, Customer, Order, OrderStatus, OrderItem, UserRole, PaymentReceipt, GateEntry, OrderStatusLabels, CurrentUser } from '../types';
import { getPaymentReceipts } from '../services/supabaseService';
import { printHTML } from '../utils/print';

interface Props {
  addOrder: (o: Order) => Promise<void>;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  gateEntries: GateEntry[];
  currentUser: CurrentUser;
}

const DistributorView: React.FC<Props> = ({ addOrder, customers, products, orders, gateEntries, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDER' | 'HISTORY' | 'PROFILE'>('DASHBOARD');
  const [historyTab, setHistoryTab] = useState<'ORDERS' | 'PAYMENTS' | 'GATES'>('ORDERS');
  const [cart, setCart] = useState<{[id: string]: number}>({});
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState(false);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const myCustomer = customers.find(c => 
    (currentUser.customerId && c.id === currentUser.customerId) ||
    c.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
  );

  const myOrders = orders.filter(o => o.customerId === myCustomer?.id || o.customerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase());
  const myGateEntries = gateEntries.filter(e => e.customerId === myCustomer?.id);

  useEffect(() => {
    if (activeTab === 'HISTORY' && historyTab === 'PAYMENTS') {
      fetchReceipts();
    }
  }, [activeTab, historyTab, myCustomer?.id]);

  const fetchReceipts = async () => {
    if (!myCustomer) return;
    const { data, error } = await getPaymentReceipts(myCustomer.id);
    if (!error && data) {
      setReceipts(data);
    }
  };

  const printThermalTicket = (receipt: PaymentReceipt) => {
    const receiptDate = new Date(receipt.createdAt);
    const dateStr = isNaN(receiptDate.getTime()) ? 'N/A' : receiptDate.toLocaleString();

    const html = `
      <style>
        #print-container .thermal-ticket-wrapper { 
          font-family: 'Courier New', Courier, monospace; 
          width: 80mm; 
          padding: 5mm; 
          font-size: 12px;
          line-height: 1.2;
          color: #000;
          background: white;
          margin: 0;
        }
        #print-container .center { text-align: center; }
        #print-container .bold { font-weight: bold; }
        #print-container .line { border-bottom: 1px dashed #000; margin: 5px 0; }
        #print-container .flex { display: flex; justify-content: space-between; }
        #print-container .title { font-size: 16px; margin-bottom: 5px; }
      </style>
      <div class="center bold title">CHAZARRETA ERP</div>
      <div class="center">COMPROBANTE DE PAGO</div>
      <div class="line"></div>
      <div class="flex"><span>FECHA:</span> <span>${dateStr}</span></div>
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
    `;

    printHTML(html);
  };

  const FALLBACK_THRESHOLD = 20;
  const FALLBACK_PERCENTAGE = 10;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const updateCart = (id: string, delta: number) => {
    setCreditError(null);
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const setQuantity = (id: string, qty: number) => {
    setCreditError(null);
    setCart(prev => {
      const next = Math.max(0, qty);
      return { ...prev, [id]: next };
    });
  };

  const calculateTotals = () => {
    const priceListId = myCustomer?.priceListId || 'list_general';
    let subtotal = 0;
    let bonusCount = 0;
    let totalUnits = 0;
    
    const items: OrderItem[] = Object.keys(cart).map((id) => {
      const qty = cart[id];
      totalUnits += qty;
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
    }).filter(item => item.quantity > 0);
    
    return { subtotal, bonusCount, totalUnits, items };
  };

  const { subtotal, bonusCount, totalUnits, items } = calculateTotals();

  const handleSendOrder = async () => {
    if (items.length === 0) return;

    if (myCustomer?.creditLimit) {
      if ((myCustomer.balance || 0) + subtotal > myCustomer.creditLimit) {
        setCreditError("Límite de crédito excedido. Comunicarse con Administracion");
        return;
      }
    }
    
    setCreditError(null);

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: myCustomer?.id || 'unknown',
      customerName: currentUser.name,
      status: OrderStatus.PENDING,
      items: items,
      totalAmount: subtotal,
      paidAmount: 0,
      createdAt: new Date().toISOString()
    };
    
    try {
      await addOrder(newOrder);
      setCart({});
      setShowCartModal(false);
      setSuccess(true);
      setActiveTab('DASHBOARD');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to send order:", error);
      alert("Error al enviar el pedido. Por favor, intente nuevamente.");
    }
  };

  // Mobile-first layout classes
  const containerClass = "pb-24 min-h-screen bg-slate-50"; // padding bottom for nav bar
  const headerClass = "bg-white px-6 py-5 sticky top-0 z-10 shadow-sm border-b border-slate-100";
  const cardClass = "bg-white p-5 rounded-3xl border border-slate-100 shadow-sm";

  return (
    <div className={containerClass}>
      {/* Top Header */}
      <header className={headerClass}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {activeTab === 'DASHBOARD' && 'Inicio'}
              {activeTab === 'ORDER' && 'Nuevo Pedido'}
              {activeTab === 'HISTORY' && 'Historial'}
              {activeTab === 'PROFILE' && 'Mi Cuenta'}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {currentUser.name}
            </p>
          </div>
          {myCustomer?.isBlocked && (
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center animate-pulse">
              <Lock size={18} />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 space-y-4">
        {success && (
          <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-4">
            <CheckCircle2 size={24} />
            <div>
              <p className="font-black uppercase text-sm">¡Pedido Enviado!</p>
              <p className="text-xs font-medium opacity-90">Su pedido ya está en preparación.</p>
            </div>
          </div>
        )}

        {!myCustomer && activeTab !== 'PROFILE' && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-700">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-xs font-bold uppercase tracking-tight">Atención: No se encontró una cuenta vinculada a su nombre de usuario. Contacte al administrador.</p>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 animate-in fade-in">
            {myCustomer?.isBlocked && (
              <div className="bg-red-600 rounded-3xl p-5 text-white shadow-xl shadow-red-900/20">
                <div className="flex items-center gap-3 mb-2">
                  <Lock size={20} />
                  <h3 className="font-black uppercase tracking-tight text-sm">Cuenta Suspendida</h3>
                </div>
                <p className="text-xs font-medium text-white/90">Comuníquese con cobranzas para regularizar su situación y volver a operar.</p>
              </div>
            )}

            {/* Balance Card - Big and bold */}
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <BadgeDollarSign size={80} />
              </div>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Actual</p>
              <h3 className="text-4xl font-black tracking-tighter mb-4">
                ${myCustomer?.balance?.toLocaleString() || '0'}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => {setActiveTab('HISTORY'); setHistoryTab('PAYMENTS');}} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors backdrop-blur-sm">
                  Ver Pagos
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className={cardClass} onClick={() => {setActiveTab('HISTORY'); setHistoryTab('ORDERS');}}>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                  <ClipboardList size={20} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">
                  {myOrders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.VALIDATED).length}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Pedidos<br/>Pendientes</p>
              </div>
              <div className={cardClass} onClick={() => {setActiveTab('HISTORY'); setHistoryTab('GATES');}}>
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
                  <RotateCcw size={20} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">
                  {myGateEntries.length}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Cambios<br/>Realizados</p>
              </div>
            </div>

            {/* Recent Orders List */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Últimos Pedidos</h3>
                <button onClick={() => {setActiveTab('HISTORY'); setHistoryTab('ORDERS');}} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ver Todos</button>
              </div>
              <div className="space-y-3">
                {myOrders.slice(0, 3).map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase mb-0.5">#ORD-{order.id.substr(0, 6).toUpperCase()}</p>
                      <p className="font-bold text-slate-800 text-xs">
                        {isNaN(new Date(order.createdAt).getTime()) ? 'N/A' : new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm mb-1">${order.totalAmount.toLocaleString()}</p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        order.status === OrderStatus.PAID_FULL ? 'bg-emerald-100 text-emerald-600' :
                        order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {OrderStatusLabels[order.status]}
                      </span>
                    </div>
                  </div>
                ))}
                {myOrders.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">Sin pedidos recientes</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDER TAB */}
        {activeTab === 'ORDER' && (
          myCustomer?.isBlocked ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-2">Cuenta Bloqueada</h2>
              <p className="text-slate-500 font-medium text-sm px-4 mb-8">
                Comuníquese con cobranzas para regularizar su situación y habilitar la carga de pedidos.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in pb-20">
              {/* Search Bar sticky under header */}
              <div className="sticky top-[72px] z-10 bg-slate-50 pb-2 pt-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar producto..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm shadow-sm"
                  />
                </div>
              </div>

              {/* Product List - Mobile Cards */}
              <div className="space-y-3">
                {filteredProducts.map(product => {
                  const priceListId = myCustomer?.priceListId || 'list_general';
                  const unitPrice = product.prices[priceListId] || 0;
                  const inCart = cart[product.id] || 0;
                  
                  return (
                    <div key={product.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${product.brand === 'La Fornarina' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                              {product.brand}
                            </span>
                            {product.bonusEnabled && (
                              <span className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-0.5">
                                <Zap size={10} className="fill-emerald-600" /> Bonif.
                              </span>
                            )}
                          </div>
                          <p className="font-black text-slate-800 uppercase text-base leading-tight pr-4">{product.name}</p>
                        </div>
                        <p className="font-black text-slate-900 text-xl tracking-tighter">${unitPrice.toLocaleString()}</p>
                      </div>
                      
                      <div className="flex justify-end items-center mt-2">
                        {inCart > 0 ? (
                          <div className="flex items-center bg-blue-50 rounded-2xl p-1 border border-blue-100 h-14">
                            <button 
                              onClick={() => updateCart(product.id, -1)}
                              className="w-14 h-full flex items-center justify-center text-blue-600 active:bg-blue-200 rounded-xl transition-colors"
                            >
                              <Minus size={24} />
                            </button>
                            <input 
                              type="number"
                              value={inCart || ''}
                              onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center font-black text-blue-700 bg-transparent outline-none text-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button 
                              onClick={() => updateCart(product.id, 1)}
                              className="w-14 h-full flex items-center justify-center text-blue-600 active:bg-blue-200 rounded-xl transition-colors"
                            >
                              <Plus size={24} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => updateCart(product.id, 1)}
                            className="px-8 py-4 bg-blue-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition-all flex items-center gap-2 shadow-md"
                          >
                            <Plus size={20} /> Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Package size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-widest">No hay productos</p>
                  </div>
                )}
              </div>

              {/* Floating Cart Summary Bar */}
              {items.length > 0 && (
                <div className="fixed bottom-[80px] left-4 right-4 z-20 animate-in slide-in-from-bottom-4">
                  <button 
                    onClick={() => setShowCartModal(true)}
                    className="w-full bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-900/30 flex items-center justify-between active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">
                        {totalUnits}
                      </div>
                      <span className="font-black uppercase tracking-widest text-xs">Ver Pedido</span>
                    </div>
                    <span className="font-black text-lg tracking-tighter">${subtotal.toLocaleString()}</span>
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {/* HISTORY TAB */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Sub-tabs */}
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setHistoryTab('ORDERS')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${historyTab === 'ORDERS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
              >
                Pedidos
              </button>
              <button 
                onClick={() => setHistoryTab('PAYMENTS')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${historyTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
              >
                Pagos
              </button>
              <button 
                onClick={() => setHistoryTab('GATES')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${historyTab === 'GATES' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
              >
                Cambios
              </button>
            </div>

            {/* Orders History */}
            {historyTab === 'ORDERS' && (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-0.5">#ORD-{order.id.substr(0, 6).toUpperCase()}</p>
                        <p className="font-bold text-slate-800 text-xs">
                          {isNaN(new Date(order.createdAt).getTime()) ? 'N/A' : new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${
                        order.status === OrderStatus.PAID_FULL ? 'bg-emerald-100 text-emerald-600' :
                        order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {OrderStatusLabels[order.status]}
                      </span>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{order.items.reduce((a, b) => a + b.quantity, 0)} unidades</p>
                      <p className="font-black text-slate-900 text-lg tracking-tighter">${order.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {myOrders.length === 0 && <p className="text-center py-8 text-slate-400 text-xs font-bold uppercase">Sin pedidos</p>}
              </div>
            )}

            {/* Payments History */}
            {historyTab === 'PAYMENTS' && (
              <div className="space-y-3">
                {receipts.map(receipt => (
                  <div key={receipt.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-0.5">#REC-{receipt.id.toString().substr(0, 6).toUpperCase()}</p>
                        <p className="font-bold text-slate-800 text-xs">
                          {isNaN(new Date(receipt.createdAt).getTime()) ? 'N/A' : new Date(receipt.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => printThermalTicket(receipt)}
                        className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center active:bg-slate-200"
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        <p>EFE: ${receipt.cashAmount.toLocaleString()}</p>
                        <p>TRA: ${receipt.transferAmount.toLocaleString()}</p>
                      </div>
                      <p className="font-black text-emerald-600 text-lg tracking-tighter">${receipt.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {receipts.length === 0 && <p className="text-center py-8 text-slate-400 text-xs font-bold uppercase">Sin pagos</p>}
              </div>
            )}

            {/* Gates History */}
            {historyTab === 'GATES' && (
              <div className="space-y-3">
                {myGateEntries.map(entry => (
                  <div key={entry.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-0.5">#GATE-{entry.id.substr(0, 6).toUpperCase()}</p>
                        <p className="font-bold text-slate-800 text-xs">
                          {isNaN(new Date(entry.createdAt).getTime()) ? 'N/A' : new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${
                        entry.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-600' : 
                        entry.status === 'VALIDATED' ? 'bg-blue-100 text-blue-600' : 
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {entry.status === 'CONVERTED' ? 'ENTREGADO' : entry.status === 'VALIDATED' ? 'VALIDADO' : 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-50">
                      <p className="font-black text-slate-900 text-sm">{entry.items.reduce((acc, i) => acc + i.quantity, 0)} unidades devueltas</p>
                    </div>
                  </div>
                ))}
                {myGateEntries.length === 0 && <p className="text-center py-8 text-slate-400 text-xs font-bold uppercase">Sin cambios</p>}
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{currentUser.name}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{currentUser.role}</p>
              
              <div className="bg-slate-50 p-4 rounded-2xl text-left space-y-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                  <p className="font-bold text-slate-800 text-sm">{currentUser.email || 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista de Precios</p>
                  <p className="font-bold text-slate-800 text-sm">{myCustomer?.priceListId === 'list_general' ? 'General' : myCustomer?.priceListId || 'General'}</p>
                </div>
              </div>
            </div>

            <button onClick={() => window.location.reload()} className="w-full bg-red-50 text-red-600 p-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:bg-red-100 transition-colors">
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-30">
        <div className="flex justify-around items-center h-16 px-2">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'DASHBOARD' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutDashboard size={20} className={activeTab === 'DASHBOARD' ? 'fill-blue-100' : ''} />
            <span className="text-[9px] font-black uppercase tracking-widest">Inicio</span>
          </button>
          <button 
            onClick={() => setActiveTab('ORDER')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'ORDER' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className="relative">
              <ShoppingCart size={20} className={activeTab === 'ORDER' ? 'fill-blue-100' : ''} />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Pedido</span>
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'HISTORY' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History size={20} className={activeTab === 'HISTORY' ? 'fill-blue-100' : ''} />
            <span className="text-[9px] font-black uppercase tracking-widest">Historial</span>
          </button>
          <button 
            onClick={() => setActiveTab('PROFILE')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <User size={20} className={activeTab === 'PROFILE' ? 'fill-blue-100' : ''} />
            <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Full Screen Cart Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-900">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Resumen del Pedido</h2>
            <button onClick={() => { setShowCartModal(false); setCreditError(null); }} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white active:bg-white/20">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.map(item => {
              const p = products.find(prod => prod.id === item.productId)!;
              return (
                <div key={item.productId} className="bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white text-sm uppercase leading-tight">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-black tracking-widest mt-1">
                      {item.quantity} x ${item.unitPrice.toLocaleString()}
                    </p>
                    {item.bonusQuantity > 0 && (
                      <p className="text-emerald-400 text-[10px] font-black mt-0.5 flex items-center gap-1">
                        <Zap size={10} className="fill-emerald-400" /> +{item.bonusQuantity} bonificados
                      </p>
                    )}
                  </div>
                  <p className="font-black text-white text-lg tracking-tighter">${(item.quantity * item.unitPrice).toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 p-6 border-t border-white/10 pb-safe">
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-slate-400 text-xs font-bold uppercase tracking-widest">
                <span>Total Unidades</span>
                <span className="text-white">{totalUnits} u.</span>
              </div>
              <div className="flex justify-between text-emerald-400 text-xs font-black uppercase tracking-widest">
                <span>Bonificaciones</span>
                <span>{bonusCount} u.</span>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-white/10 mt-2">
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Total a Pagar</span>
                <span className="text-4xl font-black text-white tracking-tighter">${subtotal.toLocaleString()}</span>
              </div>
            </div>
            
            {creditError && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-red-400 text-xs font-bold leading-relaxed">{creditError}</p>
              </div>
            )}

            <button 
              onClick={handleSendOrder}
              className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:bg-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              Confirmar y Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorView;

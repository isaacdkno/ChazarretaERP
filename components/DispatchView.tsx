
import React, { useState, useRef, useEffect } from 'react';
import { Truck, CheckCircle, Signature, RotateCcw } from 'lucide-react';
import { Order, OrderStatus, Product, GateEntry, Customer, UserRole, CurrentUser } from '../types';
import { printHTML } from '../utils/print';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => Promise<void> | void;
  products: Product[];
  gateEntries: GateEntry[];
  updateGateEntry: (entry: GateEntry) => Promise<void>;
  customers: Customer[];
  currentUser: CurrentUser;
}

const DispatchView: React.FC<Props> = ({ orders, updateOrder, products, gateEntries, updateGateEntry, customers, currentUser }) => {
  const canViewCreditLimit = [UserRole.ADMIN, UserRole.MANAGER, UserRole.COLLECTION].includes(currentUser.role);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dispatchTab, setDispatchTab] = useState<'PENDING' | 'DISPATCHED'>('PENDING');
  const [selectedGateEntry, setSelectedGateEntry] = useState<GateEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'DISTRIBUTOR' | 'SUCURSAL' | 'OTHER'>('ALL');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (selectedOrder || selectedGateEntry) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#0f172a';
        }
      }
    }
  }, [selectedOrder, selectedGateEntry]);

  const filterOrders = (ordersToFilter: Order[]) => {
    return ordersToFilter.filter(o => {
      const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           o.id.includes(searchTerm.toLowerCase());
      
      // Basic heuristic for customer type based on name or price list if available
      // Since we don't have explicit customer type in Order, we'll assume 'Distribuidor' if name contains it
      // or 'Sucursal' if name contains it. Otherwise 'OTHER'.
      // A better approach would be to join with Customer table, but for now we use name.
      
      let type = 'OTHER';
      if (o.customerName.toLowerCase().includes('dist')) type = 'DISTRIBUTOR';
      else if (o.customerName.toLowerCase().includes('sucursal') || o.customerName.toLowerCase().includes('local')) type = 'SUCURSAL';
      
      const matchesType = customerTypeFilter === 'ALL' || type === customerTypeFilter;

      return matchesSearch && matchesType;
    });
  };

  const pendingOrders = filterOrders(orders.filter(o => o.status === OrderStatus.VALIDATED));
  const dispatchedOrders = filterOrders(orders.filter(o => o.status === OrderStatus.DISPATCHED));
  const readyGateEntries = gateEntries.filter(ge => ge.status === 'VALIDATED' && ge.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
  const dispatchedGateEntries = gateEntries.filter(ge => ge.status === 'CONVERTED' && ge.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  const generateThermalTicket = (order: Order, signatureUrl: string) => {
    const itemsHtml = order.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const subtotal = item.quantity * item.unitPrice;
      return `
        <tr>
          <td colspan="4" class="product-name">${product?.name || 'Producto Desconocido'}</td>
        </tr>
        <tr>
          <td>${item.quantity}u.</td>
          <td>@ $${item.unitPrice.toLocaleString()}</td>
          ${item.bonusQuantity > 0 ? `<td>+${item.bonusQuantity}u. Bon.</td>` : '<td></td>'}
          <td class="text-right">$${subtotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const rDate = new Date(order.createdAt);
    const rDateStr = isNaN(rDate.getTime()) ? 'Fecha N/A' : rDate.toLocaleString();
    
    let dDateStr = '';
    if (order.deliveryDate) {
      const dDate = new Date(order.deliveryDate);
      dDateStr = isNaN(dDate.getTime()) ? 'Fecha N/A' : dDate.toLocaleDateString();
    }

    const htmlContent = `
      <style>
        #print-container .thermal-ticket-wrapper {
          font-family: Arial, sans-serif !important;
          width: 80mm;
          font-size: 16px !important;
          font-weight: 700 !important;
          color: #000 !important;
          background: white;
          margin: 0;
          padding: 2mm;
        }
        #print-container .header { text-align: center; margin-bottom: 10px; }
        #print-container .header h1 { font-size: 20px !important; margin: 0; }
        #print-container .info { margin-bottom: 10px; font-size: 14px !important; }
        #print-container .info p { margin: 4px 0; }
        #print-container .items-table { width: 100%; border-collapse: collapse; font-size: 14px !important; }
        #print-container .items-table th, #print-container .items-table td { padding: 4px 0; }
        #print-container .items-table .product-name { font-weight: bold; padding-top: 8px; font-size: 16px !important; }
        #print-container .line { border-top: 1px dashed #000; margin: 8px 0; }
        #print-container .totals { margin-top: 10px; font-size: 16px !important; }
        #print-container .totals p { margin: 6px 0; display: flex; justify-content: space-between; font-weight: bold; }
        #print-container .signature { margin-top: 20px; font-size: 14px !important; }
        #print-container .signature p { margin-bottom: 10px; font-weight: bold; }
        #print-container .signature img { max-width: 100%; border: 1px solid #000; }
        #print-container .text-right { text-align: right; }
      </style>
      <div class="header">
        <h1>CHAZARRETA</h1>
        <p>Remito de Entrega</p>
      </div>
      <div class="line"></div>
      <div class="info">
        <p><strong>Cliente:</strong> ${order.customerName}</p>
        <p><strong>Comanda:</strong> #ORD-${String(order.id).substr(0, 6).toUpperCase()}</p>
        <p><strong>Fecha Emisión:</strong> ${rDateStr}</p>
        ${order.deliveryDate ? `<p><strong>Para el Día:</strong> ${dDateStr}</p>` : ''}
      </div>
      <div class="line"></div>
      <table class="items-table">
        ${itemsHtml}
      </table>
      <div class="line"></div>
      <div class="totals">
        <p><span>TOTAL PEDIDO:</span> <span>$${order.totalAmount.toLocaleString()}</span></p>
      </div>
      <div class="line"></div>
      <div class="signature">
        <p>Firma de Recepción:</p>
        <img src="${signatureUrl}" alt="Firma" />
      </div>
    `;

    printHTML(htmlContent);
  };

  const reprintReceipt = (order: Order) => {
    if (!order.signatureUrl) {
      alert('No se encontró firma para esta comanda. No se puede reimprimir.');
      return;
    }
    generateThermalTicket(order, order.signatureUrl);
  };

  const getCanvasPosition = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPosition(e, canvas);
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    if ('touches' in e) e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPosition(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const getCompressedSignature = (): string => {
    const srcCanvas = canvasRef.current;
    if (!srcCanvas) return '';
    const offscreen = document.createElement('canvas');
    offscreen.width = srcCanvas.width;
    offscreen.height = srcCanvas.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return srcCanvas.toDataURL('image/png');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.drawImage(srcCanvas, 0, 0);
    return offscreen.toDataURL('image/jpeg', 0.6);
  };

  const confirmDelivery = async () => {
    if (!selectedOrder && !selectedGateEntry) return;

    try {
      const signatureUrl = getCompressedSignature();
      
      // Capture current selection
      const orderToUpdate = selectedOrder;
      const gateToUpdate = selectedGateEntry;

      if (orderToUpdate) {
        // Trigger print BEFORE closing modal for better reliability
        generateThermalTicket(orderToUpdate, signatureUrl);
      }

      // Immediate UI feedback: close modal
      setSelectedOrder(null);
      setSelectedGateEntry(null);

      if (orderToUpdate) {
        // Background update
        updateOrder({ 
          ...orderToUpdate, 
          status: OrderStatus.DISPATCHED,
          signatureUrl
        }).catch(err => {
          console.error("Background update failed:", err);
        });
      } else if (gateToUpdate) {
        // Handle gate entry (changes)
        updateGateEntry({ ...gateToUpdate, status: 'CONVERTED' }).catch(err => {
          console.error("Background gate update failed:", err);
        });
      }
    } catch (error) {
      console.error("Error in confirmDelivery:", error);
      alert("Error al procesar la entrega.");
    }
  };

  const getCustomerColor = (name: string) => {
    const colors = [
      { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', hover: 'hover:border-blue-400', icon: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700' },
      { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', hover: 'hover:border-indigo-400', icon: 'bg-indigo-100', badge: 'bg-indigo-100 text-indigo-700' },
      { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100', hover: 'hover:border-violet-400', icon: 'bg-violet-100', badge: 'bg-violet-100 text-violet-700' },
      { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', hover: 'hover:border-purple-400', icon: 'bg-purple-100', badge: 'bg-purple-100 text-purple-700' },
      { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-100', hover: 'hover:border-fuchsia-400', icon: 'bg-fuchsia-100', badge: 'bg-fuchsia-100 text-fuchsia-700' },
      { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', hover: 'hover:border-rose-400', icon: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700' },
      { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', hover: 'hover:border-orange-400', icon: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700' },
      { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', hover: 'hover:border-amber-400', icon: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' },
      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', hover: 'hover:border-emerald-400', icon: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
      { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100', hover: 'hover:border-teal-400', icon: 'bg-teal-100', badge: 'bg-teal-100 text-teal-700' },
      { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', hover: 'hover:border-cyan-400', icon: 'bg-cyan-100', badge: 'bg-cyan-100 text-cyan-700' },
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Despacho de Entregas</h1>
        <p className="text-slate-500 text-sm">Confirma la carga y gestiona los remitos de entrega.</p>
      </header>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button 
            onClick={() => setDispatchTab('PENDING')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dispatchTab === 'PENDING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            Pendientes
          </button>
          <button 
            onClick={() => setDispatchTab('DISPATCHED')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dispatchTab === 'DISPATCHED' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            Despachados
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
           <div className="relative">
             <input 
               type="text" 
               placeholder="Buscar cliente o pedido..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
             />
             <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             </div>
           </div>
           
           <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'DISTRIBUTOR', label: 'Distribuidores' },
                { id: 'SUCURSAL', label: 'Sucursales' },
                { id: 'OTHER', label: 'Otros' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCustomerTypeFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${customerTypeFilter === f.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {f.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      {!selectedOrder && !selectedGateEntry ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dispatchTab === 'PENDING' && pendingOrders.map(order => {
            const color = getCustomerColor(order.customerName);
            return (
              <div 
                key={order.id} 
                className={`group bg-white p-4 rounded-2xl border ${color.border} shadow-sm ${color.hover} transition-all cursor-pointer flex flex-col justify-between h-full`}
                onClick={() => setSelectedOrder(order)}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-9 h-9 ${color.icon} ${color.text} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <Truck size={18} />
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${color.badge} rounded-full tracking-tighter`}>Listo Carga</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 mb-1">#ORD-{String(order.id).substr(0, 6).toUpperCase()}</p>
                  <h3 className="font-black text-slate-800 text-sm uppercase leading-tight mb-1 group-hover:text-blue-600 transition-colors">{order.customerName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.items.length} productos</p>
                  {order.deliveryDate && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-tight">Para: {(() => {
                        const d = new Date(order.deliveryDate);
                        return isNaN(d.getTime()) ? 'Fecha N/A' : d.toLocaleDateString();
                      })()}</span>
                    </div>
                  )}
                </div>
                <button className={`mt-4 w-full py-2 ${color.bg} ${color.text} rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all`}>
                  Abrir Firma
                </button>
              </div>
            );
          })}
          {dispatchTab === 'DISPATCHED' && dispatchedOrders.map(order => {
            const color = getCustomerColor(order.customerName);
            return (
              <div 
                key={order.id} 
                className={`group bg-white p-4 rounded-2xl border ${color.border} shadow-sm ${color.hover} transition-all cursor-pointer flex flex-col justify-between h-full`}
                onClick={() => reprintReceipt(order)}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-9 h-9 ${color.icon} ${color.text} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <CheckCircle size={18} />
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full tracking-tighter`}>Entregado</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 mb-1">#ORD-{String(order.id).substr(0, 6).toUpperCase()}</p>
                  <h3 className="font-black text-slate-800 text-sm uppercase leading-tight mb-1 group-hover:text-blue-600 transition-colors">{order.customerName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emitido: {(() => {
                    const d = new Date(order.createdAt);
                    return isNaN(d.getTime()) ? 'Fecha N/A' : d.toLocaleDateString();
                  })()}</p>
                  {order.deliveryDate && (
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Para: {(() => {
                      const d = new Date(order.deliveryDate);
                      return isNaN(d.getTime()) ? 'Fecha N/A' : d.toLocaleDateString();
                    })()}</p>
                  )}
                </div>
                <button className={`mt-4 w-full py-2 ${color.bg} ${color.text} rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all`}>
                  Reimprimir Remito
                </button>
              </div>
            );
          })}
          {dispatchTab === 'PENDING' && readyGateEntries.map(entry => {
            const color = getCustomerColor(entry.customerName);
            return (
              <div 
                key={entry.id} 
                className={`group bg-white p-4 rounded-2xl border border-amber-200 shadow-sm hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between h-full`}
                onClick={() => setSelectedGateEntry(entry)}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <RotateCcw size={18} />
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full tracking-tighter">Cambio</span>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase leading-tight mb-1 group-hover:text-amber-600 transition-colors">{entry.customerName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.items.length} productos cambio</p>
                </div>
                <button className={`mt-4 w-full py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all`}>
                  Abrir Firma
                </button>
              </div>
            );
          })}
          {dispatchTab === 'DISPATCHED' && dispatchedGateEntries.map(entry => {
            const color = getCustomerColor(entry.customerName);
            return (
              <div 
                key={entry.id} 
                className={`group bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between h-full`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <RotateCcw size={18} />
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full tracking-tighter">Cambio Entregado</span>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase leading-tight mb-1 group-hover:text-emerald-600 transition-colors">{entry.customerName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.items.length} productos cambio</p>
                </div>
              </div>
            );
          })}
          {(dispatchTab === 'PENDING' && pendingOrders.length === 0 && readyGateEntries.length === 0) && (
            <div className="col-span-full p-20 text-center text-slate-400">
              <CheckCircle className="mx-auto mb-4 opacity-20" size={64} />
              <p>No hay pedidos ni cambios pendientes de despacho.</p>
            </div>
          )}
          {(dispatchTab === 'DISPATCHED' && dispatchedOrders.length === 0 && dispatchedGateEntries.length === 0) && (
            <div className="col-span-full p-20 text-center text-slate-400">
              <Truck className="mx-auto mb-4 opacity-20" size={64} />
              <p>No hay pedidos ni cambios despachados recientemente.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-lg">Confirmar Entrega: {selectedOrder?.customerName || selectedGateEntry?.customerName}</h2>
            <button onClick={() => { setSelectedOrder(null); setSelectedGateEntry(null); }} className="text-slate-400 hover:text-slate-600"><RotateCcw size={20}/></button>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle de Carga {selectedGateEntry ? '(CAMBIO)' : ''}</p>
                {selectedOrder && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight border border-blue-200">
                    Comanda #ORD-{String(selectedOrder.id).substr(0, 6).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="p-8">
                <div className="space-y-4">
                  {selectedOrder ? selectedOrder.items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const totalQty = item.quantity + item.bonusQuantity;
                    return (
                      <div key={item.id} className="flex items-center justify-between group p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-all border border-slate-200 shadow-sm">
                            <Truck size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase leading-tight">{product?.name || `Prod #${item.productId}`}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{product?.brand || 'Genérico'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8">
                          <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Base</p>
                            <p className="text-sm font-black text-slate-700">{item.quantity} u.</p>
                          </div>
                          
                          {item.bonusQuantity > 0 && (
                            <div className="text-center">
                              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Bonif.</p>
                              <p className="text-sm font-black text-emerald-600">+{item.bonusQuantity}</p>
                            </div>
                          )}

                          <div className="text-right min-w-[60px]">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total</p>
                            <p className="text-lg font-black text-slate-900 tracking-tighter">{totalQty} <span className="text-[10px] text-slate-400">u.</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  }) : selectedGateEntry?.items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <div key={item.id} className="flex items-center justify-between group p-4 bg-amber-50/30 rounded-2xl border border-amber-100 hover:border-amber-300 transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-amber-500 border border-amber-200 shadow-sm">
                            <RotateCcw size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase leading-tight">{product?.name || item.productName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.reason || 'Cambio'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Total Cambio</p>
                          <p className="text-lg font-black text-slate-900 tracking-tighter">{item.quantity} <span className="text-[10px] text-slate-400">u.</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedOrder && (
                  <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Importe Total</p>
                      <p className="text-4xl font-black text-slate-900 tracking-tighter font-mono">${selectedOrder.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Items Totales</p>
                      <p className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedOrder.items.reduce((acc, i) => acc + i.quantity, 0)} u.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Signature size={18} className="text-blue-500" /> Firma del Cliente / Chofer
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden canvas-container">
                <canvas 
                  ref={canvasRef}
                  width={600}
                  height={250}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[250px] touch-none"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={clearCanvas} className="text-xs font-bold text-red-500 hover:underline">Borrar Firma</button>
              </div>
            </div>

            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmDelivery();
              }}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 relative z-50"
            >
              <CheckCircle size={24} /> Confirmar Carga y Generar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchView;


import React, { useState, useEffect } from 'react';
import { 
  BadgeDollarSign, 
  Wallet, 
  History, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Banknote, 
  ArrowRightLeft,
  Calculator,
  Printer,
  CheckSquare,
  Square,
  FileText
} from 'lucide-react';
import { Order, OrderStatus, Customer, PaymentReceipt } from '../types';
import { supabase } from '../supabase';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const CollectionView: React.FC<Props> = ({ orders, updateOrder, customers, setCustomers }) => {
  const [paymentMode, setPaymentMode] = useState<'FIFO' | 'MANUAL'>('FIFO');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);

  const totalCollected = cashAmount + transferAmount;

  const getCustomerPendingOrders = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return [];
    return orders.filter(o => 
      o.customerId === customerId && 
      o.customerName.toLowerCase() === customer.name.toLowerCase() &&
      (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL || o.status === OrderStatus.VALIDATED)
    );
  };

  const customerOrders = getCustomerPendingOrders(selectedCustomerId).sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const currentCustomerBalance = Math.max(
    customers.find(c => c.id === selectedCustomerId)?.balance || 0,
    customerOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0)
  );

  // Reset selection when customer changes
  useEffect(() => {
    setSelectedOrderIds([]);
    setLastReceipt(null);
  }, [selectedCustomerId]);

  const toggleOrderSelection = (orderId: string) => {
    if (paymentMode === 'FIFO') return;
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handlePayment = async () => {
    if (!selectedCustomerId || totalCollected <= 0) return;
    
    setProcessing(true);
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    let ordersToPay: string[] = [];
    let remainingAmount = totalCollected;

    if (paymentMode === 'FIFO') {
      // FIFO Logic: Apply to oldest orders first
      for (const order of customerOrders) {
        if (remainingAmount <= 0) break;
        ordersToPay.push(order.id);
        remainingAmount -= order.totalAmount;
      }
    } else {
      // Manual Logic: Only selected orders
      ordersToPay = selectedOrderIds;
    }

    try {
      // 1. Update Orders Status with Partial Payment Logic
      let currentPaymentPool = totalCollected;
      const receiptDetails: { orderId: string, amountApplied: number, remainingBefore: number, remainingAfter: number }[] = [];
      
      // We sort orders by date to ensure consistent application in FIFO
      const sortedOrdersToProcess = customerOrders.filter(o => ordersToPay.includes(o.id));

      for (const order of sortedOrdersToProcess) {
        if (currentPaymentPool <= 0) break;

        const remainingOnOrder = order.totalAmount - order.paidAmount;
        let nextStatus: OrderStatus = order.status;
        let newPaidAmount = order.paidAmount;
        let applied = 0;

        if (currentPaymentPool >= remainingOnOrder) {
          // Covers the whole remaining amount
          nextStatus = OrderStatus.PAID_FULL;
          applied = remainingOnOrder;
          newPaidAmount = order.totalAmount;
          currentPaymentPool -= remainingOnOrder;
        } else {
          // Partial payment
          nextStatus = OrderStatus.PAID_PARTIAL;
          applied = currentPaymentPool;
          newPaidAmount += currentPaymentPool;
          currentPaymentPool = 0; // Pool exhausted
        }

        receiptDetails.push({
          orderId: order.id,
          amountApplied: applied,
          remainingBefore: remainingOnOrder,
          remainingAfter: order.totalAmount - newPaidAmount
        });

        updateOrder({ ...order, status: nextStatus, paidAmount: newPaidAmount });
      }

      // 2. Update balance
      const newBalance = Math.max(0, customer.balance - totalCollected);
      
      const { error: balanceError } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', selectedCustomerId);
      if (balanceError) throw balanceError;

      // 3. Create Receipt
      const receipt: Omit<PaymentReceipt, 'id'> = {
        customerId: selectedCustomerId,
        customerName: customer.name,
        amount: totalCollected,
        cashAmount,
        transferAmount,
        paymentMode,
        orderIds: ordersToPay,
        details: receiptDetails,
        createdAt: new Date().toISOString()
      };

      const { data: receiptData, error: receiptError } = await supabase
        .from('payment_receipts')
        .insert([receipt])
        .select()
        .single();
      
      if (receiptError) {
        console.warn("Table payment_receipts might not exist, falling back to local state only.");
      }

      // 4. Update local customers
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomerId ? { ...c, balance: newBalance } : c
      ));

      const finalReceipt = receiptData || { ...receipt, id: 'TEMP-' + Math.random() };
      setLastReceipt(finalReceipt);
      
      setCashAmount(0);
      setTransferAmount(0);
      setSelectedOrderIds([]);
      
    } catch (err) {
      console.error(err);
      alert("Error al procesar el cobro. Verifique la conexión.");
    } finally {
      setProcessing(false);
    }
  };

  const printThermalTicket = (receipt: PaymentReceipt) => {
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
          ${(receipt.details || []).map(detail => {
            const order = orders.find(o => o.id === detail.orderId);
            return `
              <div style="margin-bottom: 8px;">
                <div class="flex bold">
                  <span>#ORD-${detail.orderId.substr(0,6).toUpperCase()}</span>
                  <span>$${detail.amountApplied.toLocaleString()}</span>
                </div>
                <div class="flex" style="font-size: 10px; color: #444;">
                  <span>Total Comanda:</span>
                  <span>$${order?.totalAmount.toLocaleString() || '0'}</span>
                </div>
                <div class="flex" style="font-size: 10px; color: #444;">
                  <span>Saldo Restante:</span>
                  <span>$${detail.remainingAfter.toLocaleString()}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${(!receipt.details && receipt.orderIds) ? receipt.orderIds.map(id => {
            const order = orders.find(o => o.id === id);
            return `
              <div class="flex">
                <span>#ORD-${id.substr(0,6).toUpperCase()}</span>
                <span>$${order?.totalAmount.toLocaleString() || '0'}</span>
              </div>
            `;
          }).join('') : ''}
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Oficina de Cobranzas</h1>
          <p className="text-slate-500 font-medium">Gestión de créditos y conciliación real con Supabase.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setPaymentMode('FIFO')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMode === 'FIFO' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Método FIFO
          </button>
          <button 
            onClick={() => setPaymentMode('MANUAL')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMode === 'MANUAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Selección Manual
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
              <Wallet size={20} className="text-blue-500" /> Registrar Cobro
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Cliente / Cuenta</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Seleccionar Distribuidor...</option>
                  {customers.map(c => {
                    const pendingOrders = getCustomerPendingOrders(c.id);
                    const pendingTotal = pendingOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0);
                    const displayBalance = Math.max(c.balance, pendingTotal);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} (Saldo: ${displayBalance.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedCustomerId && (
                <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Estado de Cuenta</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black tracking-tighter">
                        ${currentCustomerBalance.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Saldo Total Pendiente</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-300 tracking-tight">
                        {customerOrders.length}
                      </p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Comandas</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                    <Banknote size={14} /> Cobro en Efectivo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-emerald-100 rounded-xl outline-none font-black text-slate-800"
                      value={cashAmount || ''}
                      onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                    <ArrowRightLeft size={14} /> Cobro por Transferencia
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-blue-100 rounded-xl outline-none font-black text-slate-800"
                      value={transferAmount || ''}
                      onChange={e => setTransferAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Total a Imputar</span>
                <span className="text-4xl font-black tracking-tighter">${totalCollected.toLocaleString()}</span>
              </div>

              <button 
                onClick={handlePayment}
                disabled={!selectedCustomerId || totalCollected <= 0 || processing || (paymentMode === 'MANUAL' && selectedOrderIds.length === 0)}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
              >
                {processing ? "Procesando..." : <CheckCircle2 size={20} />} Confirmar Imputación
              </button>
            </div>
          </div>

          {lastReceipt && (
            <div className="bg-emerald-600 p-6 rounded-[2.5rem] text-white animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cobro Exitoso</p>
                <CheckCircle2 size={20} />
              </div>
              <p className="text-xs font-bold mb-6">Se ha generado el comprobante #${lastReceipt.id.toString().substr(0,8).toUpperCase()}</p>
              <button 
                onClick={() => printThermalTicket(lastReceipt)}
                className="w-full py-4 bg-white text-emerald-600 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all"
              >
                <Printer size={16} /> Imprimir Ticket 80mm
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <History className="text-slate-400" size={20} /> 
                {paymentMode === 'FIFO' ? 'Comandas Pendientes (Orden FIFO)' : 'Seleccionar Comandas a Cobrar'}
              </h2>
              {paymentMode === 'MANUAL' && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Seleccionado</p>
                    <div className="flex items-center gap-2 justify-end">
                      <p className="text-lg font-black text-blue-600 tracking-tighter leading-none">
                        ${orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0).toLocaleString()}
                      </p>
                      {totalCollected > 0 && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) > totalCollected 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) > totalCollected 
                            ? `Exceso: $${(orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) - totalCollected).toLocaleString()}`
                            : `Restante: $${(totalCollected - orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0)).toLocaleString()}`
                          }
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
                    {selectedOrderIds.length} Seleccionadas
                  </span>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {!selectedCustomerId ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  Seleccione un cliente para ver sus deudas
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  El cliente no tiene deudas pendientes
                </div>
              ) : customerOrders.map((order, index) => (
                <div 
                  key={order.id} 
                  onClick={() => toggleOrderSelection(order.id)}
                  className={`px-8 py-6 flex flex-col md:flex-row md:items-center justify-between transition-all gap-4 cursor-pointer ${
                    paymentMode === 'MANUAL' 
                      ? (selectedOrderIds.includes(order.id) ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'hover:bg-slate-50/50')
                      : (index === 0 ? 'bg-amber-50/30 border-l-4 border-amber-500' : 'hover:bg-slate-50/50')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {paymentMode === 'MANUAL' && (
                      selectedOrderIds.includes(order.id) ? <CheckSquare className="text-blue-600" size={20} /> : <Square className="text-slate-300" size={20} />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-slate-800 uppercase text-lg tracking-tight leading-none">{order.customerName}</p>
                        {paymentMode === 'FIFO' && index === 0 && (
                          <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase">Próxima a Cobrar</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#ORD-{order.id.toString().substr(0,6).toUpperCase()}</p>
                        <p className="text-[10px] text-slate-300 font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${(order.totalAmount - order.paidAmount).toLocaleString()}</p>
                      <div className="flex gap-2 text-[9px] font-bold uppercase text-slate-400">
                        <span>Total: ${order.totalAmount.toLocaleString()}</span>
                        {order.paidAmount > 0 && (
                          <span className="text-blue-500">Pagado: ${order.paidAmount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Saldo Pendiente</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionView;

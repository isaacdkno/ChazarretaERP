
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { printHTML } from '../utils/print';
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
  FileText,
  LayoutDashboard,
  Users,
  TrendingDown,
  AlertTriangle,
  Clock,
  Download,
  RefreshCw,
  AlertCircle,
  Search,
  Percent,
  Trash2,
  Receipt,
  User,
  CreditCard
} from 'lucide-react';
import { Order, OrderStatus, Customer, PaymentReceipt, UserRole, CreditNote, Product, CashSession, CurrentUser } from '../types';
import { supabase } from '../supabase';
import {
  printCashClosingThermal,
  exportCreditNotePDF,
  printCreditNoteThermal as printCNThermal,
  printPaymentReceiptThermal,
  exportPaymentReceiptPDF
} from '../utils/documentPrinter';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => Promise<void>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  currentUser: CurrentUser;
  creditNotes: CreditNote[];
  products: Product[];
}

const CollectionView: React.FC<Props> = ({ orders, updateOrder, customers, setCustomers, currentUser, creditNotes, products }) => {
  const [activeTab, setActiveTab] = useState<'COLLECTION' | 'ACCOUNTS' | 'HISTORY' | 'CREDIT_NOTES' | 'CIERRE_CAJA'>('COLLECTION');
  const [paymentMode, setPaymentMode] = useState<'FIFO' | 'MANUAL'>('FIFO');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [ivaBoletasAmount, setIvaBoletasAmount] = useState<number>(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Filtros de Historial
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState<'ALL' | 'FIFO' | 'MANUAL'>('ALL');
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [showOpenSessionForm, setShowOpenSessionForm] = useState(false);
  const [openSessionError, setOpenSessionError] = useState<string | null>(null);
  const [initialCashInput, setInitialCashInput] = useState<number | ''>('');
  const [closingCashInput, setClosingCashInput] = useState<number | ''>('');
  const [closingNotes, setClosingNotes] = useState('');
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<CashSession[]>([]);
  const [viewingSessionHistory, setViewingSessionHistory] = useState(false);
  const [printAfterClosing, setPrintAfterClosing] = useState(true);

  // Blocker for navigation when session is open and has payments
  const hasOpenSessionWithPayments = !!currentSession && receipts.some(r => new Date(r.createdAt) >= new Date(currentSession.openedAt));

  // Also handle beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasOpenSessionWithPayments) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasOpenSessionWithPayments]);

  useEffect(() => {
    fetchCurrentSession();
    fetchGlobalReceipts();
  }, []);

  useEffect(() => {
    if (activeTab === 'HISTORY' || activeTab === 'CIERRE_CAJA' || activeTab === 'COLLECTION') {
      fetchGlobalReceipts();
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    // Check for auto-close or reminders on mount
    if (currentSession) {
      const now = new Date();
      const sessionDate = new Date(currentSession.openedAt);
      
      // If session is from a previous day and it's past 01:00 AM, suggest closing
      if (now.toDateString() !== sessionDate.toDateString() && now.getHours() >= 1) {
        console.log("Auto-close check: Session is from a previous day.");
        // We don't close automatically to avoid data loss, but we can show a strong reminder
      }
    }
  }, [currentSession]);

  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const s = data[0];
        setCurrentSession({
          id: s.id,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          openedBy: s.opened_by,
          closedBy: s.closed_by,
          initialCash: Number(s.initial_cash),
          finalCashReported: s.final_cash_reported ? Number(s.final_cash_reported) : undefined,
          expectedCash: s.expected_cash ? Number(s.expected_cash) : undefined,
          totalCashPayments: s.total_cash_payments ? Number(s.total_cash_payments) : 0,
          totalTransferPayments: s.total_transfer_payments ? Number(s.total_transfer_payments) : 0,
          totalIvaBoletasPayments: s.total_iva_boletas_payments ? Number(s.total_iva_boletas_payments) : undefined,
          notes: s.notes
        });
      } else {
        setCurrentSession(null);
      }

      // Fetch history too
      const { data: historyData } = await supabase
        .from('cash_sessions')
        .select('*')
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false })
        .limit(10);
      
      if (historyData) {
        setSessionHistory(historyData.map((s: any) => ({
          id: s.id,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          openedBy: s.opened_by,
          closedBy: s.closed_by,
          initialCash: Number(s.initial_cash),
          finalCashReported: s.final_cash_reported ? Number(s.final_cash_reported) : 0,
          expectedCash: s.expected_cash ? Number(s.expected_cash) : 0,
          totalCashPayments: s.total_cash_payments ? Number(s.total_cash_payments) : 0,
          totalTransferPayments: s.total_transfer_payments ? Number(s.total_transfer_payments) : 0,
          totalIvaBoletasPayments: s.total_iva_boletas_payments ? Number(s.total_iva_boletas_payments) : undefined,
          notes: s.notes
        })));
      }
    } catch (err) {
      console.error("Error fetching session:", err);
    }
  };

  const handleOpenSession = async () => {
    console.log("Attempting to open session...", { initialCashInput, currentUser });
    setOpenSessionError(null);
    if (!currentUser) {
      setOpenSessionError("Error: No se ha detectado un usuario activo.");
      return;
    }
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('cash_sessions')
        .insert([{
          opened_by: currentUser.name,
          initial_cash: initialCashInput || 0
        }]);
      
      if (error) {
        console.error("Supabase error opening session:", error);
        setOpenSessionError("Error de base de datos al abrir caja: " + error.message);
        return;
      }
      
      // Fetch the newly created session
      await fetchCurrentSession();
      setShowOpenSessionForm(false);
      setInitialCashInput('');
      
    } catch (err: any) {
      console.error("Catch error opening session:", err);
      setOpenSessionError("Error inesperado al abrir caja: " + (err.message || "Error desconocido"));
    } finally {
      setProcessing(false);
    }
  };

  const printClosingTicket = (session: CashSession, sessionReceipts: PaymentReceipt[]) => {
    printCashClosingThermal(session, sessionReceipts);
  };

  const handleCloseSession = async () => {
    if (!currentSession) return;
    
    try {
      setProcessing(true);
      
      // Calculate totals from receipts since openedAt
      const sessionReceipts = receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt));
      const totalCash = sessionReceipts.reduce((acc, r) => acc + (r.cashAmount || 0), 0);
      const totalTransfer = sessionReceipts.reduce((acc, r) => acc + (r.transferAmount || 0), 0);
      const totalIvaBoletas = sessionReceipts.reduce((acc, r) => acc + (r.ivaBoletasAmount || 0), 0);
      const expectedCash = currentSession.initialCash + totalCash + totalIvaBoletas;

      const closedAtIso = new Date().toISOString();
      const notes = closingNotes + (totalIvaBoletas > 0 ? ` | IVA Boletas: $${totalIvaBoletas}` : '');

      const { error } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: closedAtIso,
          closed_by: currentUser.name,
          final_cash_reported: closingCashInput || 0,
          expected_cash: expectedCash,
          total_cash_payments: totalCash,
          total_transfer_payments: totalTransfer,
          notes: notes
        })
        .eq('id', currentSession.id);
      
      if (error) throw error;
      
      const updatedSession: CashSession = {
        ...currentSession,
        closedAt: closedAtIso,
        closedBy: currentUser.name,
        finalCashReported: Number(closingCashInput || 0),
        expectedCash: expectedCash,
        totalCashPayments: totalCash,
        totalTransferPayments: totalTransfer,
        notes: notes
      };

      if (printAfterClosing) {
        printClosingTicket(updatedSession, sessionReceipts);
        alert("Caja cerrada con éxito.");
      } else {
        alert("Caja cerrada con éxito.");
      }

      setCurrentSession(null);
      setShowClosingForm(false);
      setClosingCashInput('');
      setClosingNotes('');
    } catch (err: any) {
      alert("Error al cerrar caja: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const fetchGlobalReceipts = async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      console.log("Fetching global receipts...");
      const { data, error } = await supabase
        .from('payment_receipts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching receipts:", error);
        setHistoryError(`Error: ${error.message}`);
        return;
      }

      console.log("Receipts data received:", data);
      
      // Verificar si existe la tabla de auditoría
      const { error: auditError } = await supabase.from('audit_logs').select('id').limit(1);
      if (auditError && auditError.code === '42P01') {
        alert("⚠️ ERROR DE BASE DE DATOS: La tabla 'audit_logs' no existe. Por favor, copie y ejecute el script SQL en el Editor de Supabase.");
      }

      if (data) {
        const formattedReceipts: PaymentReceipt[] = data.map(r => ({
          id: r.id,
          customerId: r.customer_id,
          customerName: r.customer_name,
          amount: Number(r.amount),
          cashAmount: Number(r.cash_amount),
          transferAmount: Number(r.transfer_amount),
          ivaBoletasAmount: Number(r.iva_boletas_amount || 0),
          paymentMode: r.payment_mode as 'FIFO' | 'MANUAL',
          orderIds: typeof r.order_ids === 'string' ? JSON.parse(r.order_ids) : (r.order_ids || []),
          collectedBy: r.collected_by || 'N/A',
          details: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || []),
          createdAt: r.created_at || new Date().toISOString()
        }));
        setReceipts(formattedReceipts);
      }
    } catch (err: any) {
      console.error("Unexpected error fetching receipts:", err);
      setHistoryError(`Error inesperado: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleBlockCustomer = async (customerId: string, currentStatus: boolean) => {
    setBlockingId(customerId);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_blocked: !currentStatus })
        .eq('id', customerId);
      
      if (error) throw error;
      
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, isBlocked: !currentStatus } : c
      ));
    } catch (err: any) {
      console.error("Error toggling block status:", err);
      alert("Error al cambiar el estado de bloqueo: " + err.message);
    } finally {
      setBlockingId(null);
    }
  };

  const handleUpdateCustomerCreditLimit = async (customerId: string, creditLimit: number | null) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ credit_limit: creditLimit })
        .eq('id', customerId);
      
      if (error) throw error;
      
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, creditLimit: creditLimit || undefined } : c
      ));
    } catch (err) {
      console.error("Error updating credit limit:", err);
      alert("Error al actualizar el límite de crédito.");
    }
  };

  const amountToImpute = cashAmount + transferAmount;
  const totalReceived = cashAmount + transferAmount + ivaBoletasAmount;

  const filteredReceipts = receipts.filter(r => {
    const matchesCustomer = r.customerName.toLowerCase().includes(filterCustomer.toLowerCase()) || 
                           r.id.toLowerCase().includes(filterCustomer.toLowerCase());
    const matchesMode = filterPaymentMode === 'ALL' || r.paymentMode === filterPaymentMode;
    
    const receiptDate = new Date(r.createdAt);
    const matchesStart = !filterStartDate || (isNaN(receiptDate.getTime()) ? true : receiptDate >= new Date(filterStartDate + 'T00:00:00'));
    const matchesEnd = !filterEndDate || (isNaN(receiptDate.getTime()) ? true : receiptDate <= new Date(filterEndDate + 'T23:59:59'));
    
    return matchesCustomer && matchesMode && matchesStart && matchesEnd;
  });

  const getCustomerPendingOrders = (customerId: string) => {
    return orders.filter(o => 
      o.customerId === customerId && 
      (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL)
    );
  };

  const getCustomerCreditNotes = (customerId: string) => {
    const pendingOrderIds = orders
      .filter(o => o.customerId === customerId && (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL))
      .map(o => o.id);
    return creditNotes.filter(cn => cn.customerId === customerId && pendingOrderIds.includes(cn.orderId));
  };

  const customerOrders = getCustomerPendingOrders(selectedCustomerId).sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const customerCreditNotes = getCustomerCreditNotes(selectedCustomerId).sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const calculatedBalance = Math.max(0, 
    customerOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) - 
    customerCreditNotes.reduce((sum, cn) => sum + cn.totalAmount, 0)
  );

  const currentCustomerBalance = customers.find(c => c.id === selectedCustomerId)?.balance || 0;
  const balanceDiscrepancy = Math.abs(currentCustomerBalance - calculatedBalance) > 1;

  const fixCustomerBalance = async (customerId: string, balance: number) => {
    if (!customerId) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ balance: balance })
        .eq('id', customerId);
      
      if (error) throw error;
      
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, balance: balance } : c
      ));
      alert("Saldo sincronizado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al sincronizar el saldo.");
    } finally {
      setProcessing(false);
    }
  };

  const generateCreditNotePDF = (cn: CreditNote) => {
    exportCreditNotePDF(cn, orders, products);
  };

  const printCreditNoteThermal = (cn: CreditNote) => {
    printCNThermal(cn, orders, products);
  };

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

  // Simulación en vivo de imputación de cobro (FIFO o Manual)
  const liveOrderSimulations = (() => {
    const sim: Record<string, { applied: number; remainingAfter: number; status: 'FULL' | 'PARTIAL' | 'NONE' }> = {};
    let pool = amountToImpute;
    const targetList = paymentMode === 'FIFO'
      ? customerOrders
      : customerOrders.filter(o => selectedOrderIds.includes(o.id));

    for (const ord of targetList) {
      const rem = ord.totalAmount - ord.paidAmount;
      if (pool <= 0 || rem <= 0) {
        sim[ord.id] = { applied: 0, remainingAfter: rem, status: 'NONE' };
      } else if (pool >= rem) {
        sim[ord.id] = { applied: rem, remainingAfter: 0, status: 'FULL' };
        pool -= rem;
      } else {
        sim[ord.id] = { applied: pool, remainingAfter: rem - pool, status: 'PARTIAL' };
        pool = 0;
      }
    }
    return sim;
  })();

  const handlePayment = async () => {
    if (!selectedCustomerId || totalReceived <= 0) return;
    
    setProcessing(true);
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    let ordersToPay: string[] = [];
    let remainingAmount = amountToImpute;

    if (paymentMode === 'FIFO') {
      // FIFO Logic: Apply to oldest orders first
      for (const order of customerOrders) {
        if (remainingAmount <= 0) break;
        ordersToPay.push(order.id);
        remainingAmount -= (order.totalAmount - order.paidAmount);
      }
    } else {
      // Manual Logic: Only selected orders
      ordersToPay = selectedOrderIds;
    }

    try {
      // 1. Update Orders Status with Partial Payment Logic
      let currentPaymentPool = amountToImpute;
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

        await updateOrder({ ...order, status: nextStatus, paidAmount: newPaidAmount });
      }

      // 2. Update balance (only amountToImpute)
      const newBalance = Math.max(0, customer.balance - amountToImpute);
      
      const { error: balanceError } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', selectedCustomerId);
      if (balanceError) throw balanceError;

      // 3. Create Receipt
      const receiptDataToInsert = {
        customer_id: selectedCustomerId,
        customer_name: customer.name,
        amount: totalReceived,
        cash_amount: cashAmount,
        transfer_amount: transferAmount,
        iva_boletas_amount: ivaBoletasAmount,
        payment_mode: paymentMode,
        order_ids: ordersToPay,
        collected_by: currentUser.name,
        details: receiptDetails,
        created_at: new Date().toISOString()
      };

      const { data: receiptData, error: receiptError } = await supabase
        .from('payment_receipts')
        .insert([receiptDataToInsert])
        .select()
        .single();
      
      if (receiptError) {
        console.error("Error saving receipt to database:", receiptError);
        alert(`Aviso: El cobro se procesó pero no se pudo guardar el comprobante en el historial. (${receiptError.message})`);
      }

      // 4. Update local customers
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomerId ? { ...c, balance: newBalance } : c
      ));

      const finalReceipt: PaymentReceipt = receiptData ? {
        id: receiptData.id,
        customerId: receiptData.customer_id,
        customerName: receiptData.customer_name,
        amount: receiptData.amount,
        cashAmount: receiptData.cash_amount,
        transferAmount: receiptData.transfer_amount,
        ivaBoletasAmount: receiptData.iva_boletas_amount || 0,
        paymentMode: receiptData.payment_mode,
        orderIds: receiptData.order_ids,
        collectedBy: receiptData.collected_by,
        details: receiptData.details,
        createdAt: receiptData.created_at
      } : {
        id: 'TEMP-' + Math.random(),
        customerId: selectedCustomerId,
        customerName: customer.name,
        amount: totalReceived,
        cashAmount,
        transferAmount,
        ivaBoletasAmount,
        paymentMode,
        orderIds: ordersToPay,
        collectedBy: currentUser.name,
        details: receiptDetails,
        createdAt: new Date().toISOString()
      };
      
      setLastReceipt(finalReceipt);
      
      // Automatic print after payment
      printThermalTicket(finalReceipt);
      
      // Update local receipts state to show immediately in history
      setReceipts(prev => [finalReceipt, ...prev]);
      
      fetchGlobalReceipts(); // Refresh history from server as well
      
      setCashAmount(0);
      setTransferAmount(0);
      setIvaBoletasAmount(0);
      setSelectedOrderIds([]);
      
    } catch (err) {
      console.error(err);
      alert("Error al procesar el cobro. Verifique la conexión.");
    } finally {
      setProcessing(false);
    }
  };



  const handleVoidPayment = async (receipt: PaymentReceipt) => {
    console.log("VOID PROCESS START - Receipt:", receipt);
    try {
      setProcessing(true);
      
      const details = typeof receipt.details === 'string' ? JSON.parse(receipt.details) : (receipt.details || []);
      const orderIds = typeof receipt.orderIds === 'string' ? JSON.parse(receipt.orderIds) : (receipt.orderIds || []);

      console.log("Voiding - Details:", details, "OrderIds:", orderIds);

      // 1. Revert Orders
      if (details.length > 0) {
        for (const detail of details) {
          const order = orders.find(o => String(o.id) === String(detail.orderId));
          if (order) {
            const newPaidAmount = Math.max(0, order.paidAmount - detail.amountApplied);
            let nextStatus = order.status;
            
            if (newPaidAmount === 0) {
              nextStatus = OrderStatus.DISPATCHED;
            } else if (newPaidAmount < order.totalAmount) {
              nextStatus = OrderStatus.PAID_PARTIAL;
            }
            
            console.log(`Updating order ${order.id}: ${order.paidAmount} -> ${newPaidAmount}`);
            await updateOrder({ ...order, status: nextStatus, paidAmount: newPaidAmount });
          }
        }
      } else if (orderIds.length > 0) {
        for (const orderId of orderIds) {
          const order = orders.find(o => String(o.id) === String(orderId));
          if (order) {
            await updateOrder({ ...order, status: OrderStatus.DISPATCHED, paidAmount: 0 });
          }
        }
      }

      // 2. Revert Customer Balance
      const customer = customers.find(c => c.id === receipt.customerId);
      if (customer) {
        const amountToRevert = Number(receipt.amount) - (Number(receipt.ivaBoletasAmount) || 0);
        const newBalance = Number(customer.balance) + amountToRevert;
        
        const { error: balanceError } = await supabase
          .from('customers')
          .update({ balance: newBalance })
          .eq('id', receipt.customerId);
        
        if (balanceError) throw balanceError;

        setCustomers(prev => prev.map(c => 
          c.id === receipt.customerId ? { ...c, balance: newBalance } : c
        ));
      }

      // 3. Delete Receipt
      const { error: deleteError } = await supabase
        .from('payment_receipts')
        .delete()
        .eq('id', receipt.id);
      
      if (deleteError) throw deleteError;

      // 4. Audit Log
      await supabase.from('audit_logs').insert([{
        user_id: currentUser.name,
        action: 'VOID_PAYMENT',
        target_id: receipt.id,
        old_value: JSON.stringify(receipt),
        new_value: null
      }]);

      setReceipts(prev => prev.filter(r => r.id !== receipt.id));
      alert("✅ Cobro anulado correctamente.");
    } catch (err: any) {
      console.error("VOID ERROR:", err);
      alert("❌ Error al anular: " + (err.message || err));
    } finally {
      setProcessing(false);
      setVoidConfirmId(null);
    }
  };

  const printThermalTicket = (receipt: PaymentReceipt) => {
    printPaymentReceiptThermal(receipt, orders);
  };

  const exportReceiptToPDF = (receipt: PaymentReceipt) => {
    exportPaymentReceiptPDF(receipt);
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
            onClick={() => setActiveTab('COLLECTION')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'COLLECTION' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Wallet size={16} /> Cobranza
          </button>
          <button 
            onClick={() => setActiveTab('ACCOUNTS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ACCOUNTS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Users size={16} /> Estado de Cuentas
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <History size={16} /> Historial de Pagos
          </button>
          <button 
            onClick={() => setActiveTab('CREDIT_NOTES')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CREDIT_NOTES' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText size={16} /> Notas de Crédito
          </button>
          <button 
            onClick={() => setActiveTab('CIERRE_CAJA')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CIERRE_CAJA' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Calculator size={16} /> Cierre de Caja
          </button>
        </div>
      </header>

      {activeTab === 'COLLECTION' ? (
        !currentSession ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-12 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">La Caja está Cerrada</h2>
            <p className="text-slate-500 font-medium max-w-md mx-auto mb-8">
              Para comenzar a registrar cobros y gestionar las cuentas, debes abrir una nueva sesión de caja.
            </p>
            
            {!showOpenSessionForm ? (
              <button 
                onClick={() => setShowOpenSessionForm(true)}
                className="px-10 py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center gap-3 mx-auto"
              >
                <Unlock size={18} /> Abrir Nueva Caja
              </button>
            ) : (
              <div className="max-w-sm mx-auto bg-slate-50 p-8 rounded-3xl border border-slate-100 animate-in zoom-in-95">
                {openSessionError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium text-left">
                    {openSessionError}
                  </div>
                )}
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-left">Efectivo Inicial (Fondo de Caja)</label>
                <div className="relative mb-6">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                  <input 
                    type="number"
                    value={initialCashInput}
                    onChange={e => setInitialCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-10 py-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowOpenSessionForm(false)}
                    className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleOpenSession}
                    disabled={processing}
                    className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-lg"
                  >
                    {processing ? 'Abriendo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end mb-4">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setPaymentMode('FIFO')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${paymentMode === 'FIFO' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Método FIFO
              </button>
              <button 
                onClick={() => setPaymentMode('MANUAL')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${paymentMode === 'MANUAL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Selección Manual
              </button>
            </div>
          </div>
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
                    const cNotes = getCustomerCreditNotes(c.id);
                    const cNotesTotal = cNotes.reduce((sum, cn) => sum + cn.totalAmount, 0);
                    const calculatedBal = Math.max(0, pendingTotal - cNotesTotal);
                    const displayBalance = Math.abs(c.balance - calculatedBal) > 1 ? calculatedBal : c.balance;
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado de Cuenta</p>
                    {balanceDiscrepancy && (
                      <button 
                        onClick={() => fixCustomerBalance(selectedCustomerId, calculatedBalance)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                        title="Sincronizar saldo con deudas actuales"
                      >
                        <RefreshCw size={8} className={processing ? "animate-spin" : ""} /> Sincronizar
                      </button>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black tracking-tighter">
                        ${(balanceDiscrepancy ? calculatedBalance : currentCustomerBalance).toLocaleString()}
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                      <Banknote size={14} /> Cobro en Efectivo
                    </label>
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetDebt = paymentMode === 'MANUAL' && selectedOrderIds.length > 0
                            ? customerOrders.filter(o => selectedOrderIds.includes(o.id)).reduce((s, o) => s + (o.totalAmount - o.paidAmount), 0)
                            : Math.max(0, customers.find(c => c.id === selectedCustomerId)?.balance || 0);
                          setCashAmount(Math.max(0, targetDebt - transferAmount));
                        }}
                        className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        {paymentMode === 'MANUAL' && selectedOrderIds.length > 0 ? 'Saldar Sel.' : 'Saldar Todo'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-emerald-100 rounded-xl outline-none font-black text-slate-800"
                      value={cashAmount || ''}
                      onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      <ArrowRightLeft size={14} /> Cobro por Transferencia
                    </label>
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetDebt = paymentMode === 'MANUAL' && selectedOrderIds.length > 0
                            ? customerOrders.filter(o => selectedOrderIds.includes(o.id)).reduce((s, o) => s + (o.totalAmount - o.paidAmount), 0)
                            : Math.max(0, customers.find(c => c.id === selectedCustomerId)?.balance || 0);
                          setTransferAmount(Math.max(0, targetDebt - cashAmount));
                        }}
                        className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
                      >
                        {paymentMode === 'MANUAL' && selectedOrderIds.length > 0 ? 'Saldar Sel.' : 'Saldar Todo'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-blue-100 rounded-xl outline-none font-black text-slate-800"
                      value={transferAmount || ''}
                      onChange={e => setTransferAmount(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </div>

                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                  <label className="flex items-center gap-2 text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">
                    <Percent size={14} /> IvaBoletas
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 font-black">$</span>
                    <input 
                      type="number"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-purple-100 rounded-xl outline-none font-black text-slate-800"
                      value={ivaBoletasAmount || ''}
                      onChange={e => setIvaBoletasAmount(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A Imputar (Deuda)</span>
                  <span className="text-2xl font-black tracking-tighter">${amountToImpute.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Total Recibido</span>
                  <span className="text-4xl font-black tracking-tighter">${totalReceived.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handlePayment}
                disabled={!selectedCustomerId || totalReceived <= 0 || processing || (paymentMode === 'MANUAL' && selectedOrderIds.length === 0)}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
              >
                {processing ? "Procesando..." : <CheckCircle2 size={20} />} Confirmar Cobro
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
                      {amountToImpute > 0 && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) > amountToImpute 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) > amountToImpute 
                            ? `Exceso: $${(orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0) - amountToImpute).toLocaleString()}`
                            : `Restante: $${(amountToImpute - orders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0)).toLocaleString()}`
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
              ) : (customerOrders.length === 0 && customerCreditNotes.length === 0) ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                  El cliente no tiene deudas ni créditos pendientes
                </div>
              ) : (
                <>
                  {/* List Credit Notes First as they are credits */}
                  {customerCreditNotes.map((cn) => (
                    <div 
                      key={cn.id} 
                      className="px-8 py-4 flex flex-col md:flex-row md:items-center justify-between transition-all gap-4 bg-amber-50/50 border-l-4 border-amber-400"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-slate-800 uppercase text-sm tracking-tight leading-none">Nota de Crédito</p>
                            <span className="text-[8px] font-black bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full uppercase">Crédito a Favor</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#NC-{cn.id.toString().substr(0,6).toUpperCase()}</p>
                            <p className="text-[10px] text-slate-300 font-bold uppercase">{new Date(cn.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xl font-black text-amber-600 tracking-tighter">-${cn.totalAmount.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Monto Acreditado</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              printCreditNoteThermal(cn);
                            }}
                            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all shadow-sm"
                            title="Imprimir Ticket Térmico"
                          >
                            <Printer size={18} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateCreditNotePDF(cn);
                            }}
                            className="p-3 bg-white border border-amber-200 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                            title="Descargar Comprobante PDF"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* List Orders */}
                  {customerOrders.map((order, index) => {
                    const sim = liveOrderSimulations[order.id];
                    return (
                      <div 
                        key={order.id} 
                        onClick={() => toggleOrderSelection(order.id)}
                        className={`px-8 py-6 flex flex-col md:flex-row md:items-center justify-between transition-all gap-4 cursor-pointer ${
                          sim?.status === 'FULL'
                            ? 'bg-emerald-50/40 border-l-4 border-emerald-500'
                            : sim?.status === 'PARTIAL'
                              ? 'bg-amber-50/40 border-l-4 border-amber-500'
                              : paymentMode === 'MANUAL' 
                                ? (selectedOrderIds.includes(order.id) ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'hover:bg-slate-50/50')
                                : (index === 0 ? 'bg-blue-50/30 border-l-4 border-blue-500' : 'hover:bg-slate-50/50')
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {paymentMode === 'MANUAL' && (
                            selectedOrderIds.includes(order.id) ? <CheckSquare className="text-blue-600" size={20} /> : <Square className="text-slate-300" size={20} />
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-black text-slate-800 uppercase text-lg tracking-tight leading-none">{order.customerName}</p>
                              {paymentMode === 'FIFO' && index === 0 && !sim && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase">Próxima a Cobrar</span>
                              )}
                              {sim?.status === 'FULL' && (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  ✓ SE SALDA COMPLETA (-${sim.applied.toLocaleString()})
                                </span>
                              )}
                              {sim?.status === 'PARTIAL' && (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  ◐ PAGO PARCIAL: -${sim.applied.toLocaleString()} (Restan ${sim.remainingAfter.toLocaleString()})
                                </span>
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
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
) : activeTab === 'ACCOUNTS' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatsCard 
              title="Deuda Total" 
              value={`$${customers.reduce((acc, c) => acc + c.balance, 0).toLocaleString()}`} 
              subtitle="Cuentas por cobrar" 
              icon={<TrendingDown size={24}/>} 
              color="red" 
            />
            <StatsCard 
              title="Clientes con Deuda" 
              value={customers.filter(c => c.balance > 0).length.toString()} 
              subtitle={`De un total de ${customers.length}`} 
              icon={<Users size={24}/>} 
              color="amber" 
            />
            <StatsCard 
              title="Cobrado hoy" 
              value={`$${receipts.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).reduce((acc, r) => acc + r.amount, 0).toLocaleString()}`} 
              subtitle="Ingresos del día" 
              icon={<BadgeDollarSign size={24}/>} 
              color="emerald" 
            />
            <StatsCard 
              title="Promedio Deuda" 
              value={`$${Math.round(customers.reduce((acc, c) => acc + c.balance, 0) / (customers.filter(c => c.balance > 0).length || 1)).toLocaleString()}`} 
              subtitle="Por distribuidor" 
              icon={<Calculator size={24}/>} 
              color="blue" 
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <LayoutDashboard className="text-blue-500" size={20} /> Estado General de Cuentas
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuidor</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Pendiente</th>
                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.COLLECTION) && (
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Límite Crédito</th>
                    )}

                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Comandas</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">N. Crédito</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Último Pago</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map(customer => {
                    const lastPayment = receipts.find(r => r.customerId === customer.id);
                    const pendingOrders = orders.filter(o => o.customerId === customer.id && (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL));
                    const pendingOrderIds = pendingOrders.map(o => o.id);
                    const rowCreditNotes = creditNotes.filter(cn => cn.customerId === customer.id && pendingOrderIds.includes(cn.orderId));
                    
                    const rowPendingTotal = pendingOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0);
                    const rowCreditNotesTotal = rowCreditNotes.reduce((sum, cn) => sum + cn.totalAmount, 0);
                    const rowCalculatedBalance = Math.max(0, rowPendingTotal - rowCreditNotesTotal);
                    const rowDiscrepancy = Math.abs(customer.balance - rowCalculatedBalance) > 1;

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-800 uppercase text-sm">{customer.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {customer.id.substr(0, 8)}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-lg font-black text-slate-900 tracking-tighter">
                              ${(rowDiscrepancy ? rowCalculatedBalance : customer.balance).toLocaleString()}
                            </p>
                            {rowDiscrepancy && (
                              <button 
                                onClick={() => fixCustomerBalance(customer.id, rowCalculatedBalance)}
                                className="mt-1 flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-200 hover:bg-amber-200 transition-all"
                                title="El saldo guardado no coincide con la suma de deudas. Pulse para corregir."
                              >
                                <RefreshCw size={8} className={processing ? "animate-spin" : ""} /> Sincronizar
                              </button>
                            )}
                          </div>
                        </td>
                        {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.COLLECTION) && (
                          <td className="px-8 py-6 text-right">
                            <input 
                              type="number"
                              value={customer.creditLimit || ''}
                              onChange={(e) => handleUpdateCustomerCreditLimit(customer.id, e.target.value ? Number(e.target.value) : null)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-sm font-black text-amber-600 text-right outline-none focus:ring-2 focus:ring-amber-500/20"
                              placeholder="Sin límite"
                            />
                          </td>
                        )}

                        <td className="px-8 py-6 text-center">
                          <span className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-full">{pendingOrders.length}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          {rowCreditNotes.length > 0 ? (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase">
                              {rowCreditNotes.length} NC
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          {lastPayment ? (
                            <div>
                              <p className="font-bold text-slate-700 text-xs">${lastPayment.amount.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(lastPayment.createdAt).toLocaleDateString()}</p>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-300 font-black uppercase">Sin registros</p>
                          )}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {customer.isBlocked ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-red-700 shadow-sm">
                                <Lock size={10} /> BLOQUEADO
                              </span>
                            ) : (() => {
                              const daysSinceLastPayment = lastPayment 
                                ? (new Date().getTime() - new Date(lastPayment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                                : 999;
                              
                              if (customer.balance <= 0 || daysSinceLastPayment <= 7) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                                    <CheckCircle2 size={10} /> Al día
                                  </span>
                                );
                              } else if (daysSinceLastPayment <= 10) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200">
                                    <Clock size={10} /> Con Deuda
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-200">
                                    <AlertTriangle size={10} /> Crítico
                                  </span>
                                );
                              }
                            })()}

                            <button
                              onClick={() => toggleBlockCustomer(customer.id, customer.isBlocked)}
                              disabled={blockingId === customer.id}
                              className={`p-2 rounded-xl transition-all ${
                                customer.isBlocked 
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              } ${blockingId === customer.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={customer.isBlocked ? "Desbloquear Cliente" : "Bloquear Cliente"}
                            >
                              {blockingId === customer.id ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : customer.isBlocked ? (
                                <Unlock size={16} />
                              ) : (
                                <Lock size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'CREDIT_NOTES' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
              <FileText className="text-amber-500" size={20} /> Historial de Notas de Crédito
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comanda Ref.</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado Ref.</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Importe</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No hay notas de crédito registradas</td>
                  </tr>
                ) : creditNotes.map(cn => (
                  <tr key={cn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                      <p className="font-mono text-xs font-bold text-slate-400">#NC-{cn.id.toString().substr(0, 6).toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">{new Date(cn.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800 uppercase text-sm">{cn.customerName}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-mono text-xs font-bold text-blue-500">#ORD-{cn.orderId.toString().substr(0, 6).toUpperCase()}</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {(() => {
                        const refOrder = orders.find(o => o.id === cn.orderId);
                        if (!refOrder) return <span className="text-[9px] text-slate-300">Desconocido</span>;
                        const isPaid = refOrder.status === OrderStatus.PAID_FULL;
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${
                            isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {isPaid ? 'Imputada' : 'Pendiente'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-lg font-black text-amber-600 tracking-tighter">-${cn.totalAmount.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-500 italic">{cn.reason || 'Sin motivo especificado'}</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => printCreditNoteThermal(cn)}
                          className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm border border-slate-100"
                          title="Imprimir Ticket Térmico"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => generateCreditNotePDF(cn)}
                          className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm border border-amber-100"
                          title="Descargar PDF"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'HISTORY' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <History className="text-blue-500" size={20} /> Historial de Pagos y Comprobantes
              </h2>
              <button 
                onClick={fetchGlobalReceipts}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
              >
                <RefreshCw className={loadingHistory ? 'animate-spin' : ''} size={14} /> Actualizar
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Buscar Distribuidor / ID</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Nombre o ID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    value={filterCustomer}
                    onChange={e => setFilterCustomer(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Desde</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Hasta</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Método de Pago</label>
                <select 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
                  value={filterPaymentMode}
                  onChange={e => setFilterPaymentMode(e.target.value as any)}
                >
                  <option value="ALL">Todos los métodos</option>
                  <option value="FIFO">FIFO (Automático)</option>
                  <option value="MANUAL">Manual (Selección)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loadingHistory ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <RefreshCw className="animate-spin" size={32} />
                  <p className="font-black uppercase tracking-widest text-xs">Cargando historial...</p>
                </div>
              ) : historyError ? (
                <div className="py-20 flex flex-col items-center justify-center text-red-400 gap-4">
                  <AlertCircle size={32} />
                  <p className="font-black uppercase tracking-widest text-xs">{historyError}</p>
                  <button 
                    onClick={fetchGlobalReceipts}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuidor</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Método</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                            <Search size={32} />
                          </div>
                          <p className="font-black uppercase tracking-widest text-slate-300 text-[10px]">No se encontraron cobros con los filtros aplicados</p>
                          {(filterCustomer || filterStartDate || filterEndDate || filterPaymentMode !== 'ALL') && (
                            <button 
                              onClick={() => {
                                setFilterCustomer('');
                                setFilterStartDate('');
                                setFilterEndDate('');
                                setFilterPaymentMode('ALL');
                              }}
                              className="mt-4 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline"
                            >
                              Limpiar Filtros
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : filteredReceipts.map(receipt => (
                      <tr key={receipt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-bold text-slate-700 text-xs">
                            {isNaN(new Date(receipt.createdAt).getTime()) ? 'Fecha N/A' : new Date(receipt.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            {isNaN(new Date(receipt.createdAt).getTime()) ? '' : new Date(receipt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' hs'}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-800 uppercase text-sm">{receipt.customerName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">REC-#{receipt.id.toString().substr(0, 8).toUpperCase()}</p>
                            <span className="text-[10px] text-slate-300">•</span>
                            <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Por: {receipt.collectedBy}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <p className="text-lg font-black text-emerald-600 tracking-tighter">${receipt.amount.toLocaleString()}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            {receipt.cashAmount > 0 && (
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase w-fit">Efectivo: ${receipt.cashAmount.toLocaleString()}</span>
                            )}
                            {receipt.transferAmount > 0 && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase w-fit">Transf: ${receipt.transferAmount.toLocaleString()}</span>
                            )}
                            {receipt.ivaBoletasAmount && receipt.ivaBoletasAmount > 0 && (
                              <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md uppercase w-fit">IVA: ${receipt.ivaBoletasAmount.toLocaleString()}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => printThermalTicket(receipt)}
                              className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="Reimprimir Ticket Térmico"
                            >
                              <Printer size={18} />
                            </button>
                            <button 
                              onClick={() => exportReceiptToPDF(receipt)}
                              className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Descargar PDF"
                            >
                              <Download size={18} />
                            </button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.COLLECTION || 
                              currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || currentUser.role === 'COLLECTION') && (
                              <div className="relative">
                                {voidConfirmId === receipt.id ? (
                                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 animate-in zoom-in-95">
                                    <p className="text-[10px] font-black uppercase text-slate-800 mb-3 text-center">¿Confirmar Anulación?</p>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => handleVoidPayment(receipt)}
                                        className="flex-1 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-700 transition-all"
                                      >
                                        SÍ, ANULAR
                                      </button>
                                      <button 
                                        onClick={() => setVoidConfirmId(null)}
                                        className="flex-1 py-2 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setVoidConfirmId(receipt.id);
                                    }}
                                    disabled={processing}
                                    className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                    title="Anular Cobro"
                                  >
                                    <Trash2 size={18} />
                                    <span className="text-[9px] font-black uppercase">Anular</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {receipts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-black uppercase tracking-widest">
                          No hay registros de pagos realizados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'CIERRE_CAJA' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          {!currentSession ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-12 text-center">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={40} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">La Caja está Cerrada</h2>
              <p className="text-slate-500 font-medium max-w-md mx-auto mb-8">
                Para comenzar a registrar cobros y ver las estadísticas del día, debes abrir una nueva sesión de caja.
              </p>
              
              {!showOpenSessionForm ? (
                <div className="flex justify-center gap-4 mb-8">
                  <button 
                    onClick={() => setShowOpenSessionForm(true)}
                    className="px-10 py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center gap-3"
                  >
                    <Unlock size={18} /> Abrir Nueva Caja
                  </button>
                  <button 
                    onClick={() => setViewingSessionHistory(!viewingSessionHistory)}
                    className={`px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-3 shadow-lg ${viewingSessionHistory ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <History size={18} /> {viewingSessionHistory ? 'Ocultar Historial' : 'Ver Historial de Cierres'}
                  </button>
                </div>
              ) : (
                <div className="max-w-sm mx-auto bg-slate-50 p-8 rounded-3xl border border-slate-100 animate-in zoom-in-95">
                  {openSessionError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium text-left">
                      {openSessionError}
                    </div>
                  )}
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-left">Efectivo Inicial (Fondo de Caja)</label>
                  <div className="relative mb-6">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                    <input 
                      type="number"
                      value={initialCashInput}
                      onChange={e => setInitialCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-10 py-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowOpenSessionForm(false)}
                      className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleOpenSession}
                      disabled={processing}
                      className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-lg"
                    >
                      {processing ? 'Abriendo...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}

              {viewingSessionHistory && !showOpenSessionForm && (
                <div className="mt-12 text-left animate-in fade-in slide-in-from-top-4">
                  <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Últimos 10 Cierres de Caja</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Cierre</th>
                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Abierta Por</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Esperado</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Real</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Diferencia</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionHistory.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold uppercase text-[10px]">No hay cierres registrados</td>
                            </tr>
                          ) : sessionHistory.map(session => {
                            const diff = (session.finalCashReported || 0) - (session.expectedCash || 0);
                            return (
                              <tr key={session.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                                <td className="px-4 py-4">
                                  <p className="font-bold text-slate-700 text-xs">{format(new Date(session.closedAt!), 'dd/MM/yyyy')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(session.closedAt!), 'HH:mm')} hs</p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="font-black text-slate-800 uppercase text-[10px]">{session.openedBy}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className="font-bold text-slate-600 text-xs">${session.expectedCash?.toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className="font-bold text-slate-900 text-xs">${session.finalCashReported?.toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className={`font-black text-xs ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                  </p>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <button 
                                    onClick={() => {
                                      const sessionReceipts = receipts.filter(r => new Date(r.createdAt) >= new Date(session.openedAt) && new Date(r.createdAt) <= new Date(session.closedAt!));
                                      printClosingTicket(session, sessionReceipts);
                                    }}
                                    className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    title="Reimprimir Cierre"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Alerta de sesión de días anteriores */}
              {new Date(currentSession.openedAt).toDateString() !== new Date().toDateString() && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-900 uppercase text-xs">Sesión de un día anterior detectada</h4>
                      <p className="text-amber-700 text-[10px] font-medium">La caja quedó abierta desde el {format(new Date(currentSession.openedAt), 'dd/MM/yyyy')}. Se recomienda cerrarla para iniciar el reporte de hoy.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowClosingForm(true)}
                    className="px-4 py-2 bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-amber-700 transition-all shadow-md"
                  >
                    Cerrar y Balancear
                  </button>
                </div>
              )}

              {/* Alerta de sesión prolongada (> 24h) */}
              {new Date().getTime() - new Date(currentSession.openedAt).getTime() > 24 * 60 * 60 * 1000 && new Date(currentSession.openedAt).toDateString() === new Date().toDateString() && (
                <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-red-800 font-black uppercase text-xs tracking-widest">Atención: Caja Abierta por más de 24hs</h4>
                    <p className="text-red-600 text-sm font-medium">Se recomienda realizar el cierre manual para mantener la integridad de los saldos.</p>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-black text-slate-800 uppercase tracking-tight text-2xl">Caja en Curso</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div> Abierta
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Desde: {format(new Date(currentSession.openedAt), 'dd/MM/yyyy HH:mm')} hs
                      </span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Por: {currentSession.openedBy}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setViewingSessionHistory(!viewingSessionHistory)}
                      className={`px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${viewingSessionHistory ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <History size={16} /> {viewingSessionHistory ? 'Ver Caja Actual' : 'Ver Historial'}
                    </button>
                    {!viewingSessionHistory && (
                      <>
                        <button 
                          onClick={() => {
                            const sessionReceipts = receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt));
                            const totalCash = sessionReceipts.reduce((acc, r) => acc + (r.cashAmount || 0), 0);
                            const totalTransfer = sessionReceipts.reduce((acc, r) => acc + (r.transferAmount || 0), 0);
                            const totalIvaBoletas = sessionReceipts.reduce((acc, r) => acc + (r.ivaBoletasAmount || 0), 0);
                            const totalAmount = sessionReceipts.reduce((acc, r) => acc + r.amount, 0);
                            
                            const html = `
                              <div style="font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; border: 1px solid #ccc;">
                                <h2 style="text-align: center; margin-bottom: 5px;">REPORTE PARCIAL</h2>
                                <p style="text-align: center; margin-top: 0; font-size: 12px;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                                <hr style="border-top: 1px dashed #000; margin: 15px 0;" />
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                  <span>FONDO INICIAL:</span>
                                  <strong>$${currentSession.initialCash.toLocaleString()}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                  <span>EFECTIVO:</span>
                                  <strong>$${totalCash.toLocaleString()}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                  <span>TRANSFERENCIAS:</span>
                                  <strong>$${totalTransfer.toLocaleString()}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                  <span>IVA BOLETAS:</span>
                                  <strong>$${totalIvaBoletas.toLocaleString()}</strong>
                                </div>
                                <hr style="border-top: 1px dashed #000; margin: 15px 0;" />
                                <div style="display: flex; justify-content: space-between; font-size: 18px;">
                                  <span>TOTAL:</span>
                                  <strong>$${totalAmount.toLocaleString()}</strong>
                                </div>
                                <hr style="border-top: 1px dashed #000; margin: 15px 0;" />
                                <p style="text-align: center; font-size: 10px;">Abierta por: ${currentSession.openedBy}</p>
                              </div>
                            `;
                            printHTML(html);
                          }}
                          className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all shadow-sm flex items-center gap-2"
                          title="Imprimir Reporte Parcial"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => setShowClosingForm(true)}
                          className="px-8 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-red-700 transition-all shadow-xl flex items-center gap-3"
                        >
                          <Lock size={18} /> Cerrar Caja
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {viewingSessionHistory ? (
                  <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Últimos 10 Cierres</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Cierre</th>
                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Abierta Por</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Esperado</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Real</th>
                            <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Diferencia</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionHistory.map(session => {
                            const diff = (session.finalCashReported || 0) - (session.expectedCash || 0);
                            return (
                              <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-4">
                                  <p className="font-bold text-slate-700 text-xs">{format(new Date(session.closedAt!), 'dd/MM/yyyy')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(session.closedAt!), 'HH:mm')} hs</p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="font-black text-slate-800 uppercase text-[10px]">{session.openedBy}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className="font-bold text-slate-600 text-xs">${session.expectedCash?.toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className="font-bold text-slate-900 text-xs">${session.finalCashReported?.toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <p className={`font-black text-xs ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                  </p>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <button 
                                    onClick={() => {
                                      const sessionReceipts = receipts.filter(r => new Date(r.createdAt) >= new Date(session.openedAt) && new Date(r.createdAt) <= new Date(session.closedAt!));
                                      printClosingTicket(session, sessionReceipts);
                                    }}
                                    className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                    title="Reimprimir Cierre"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                      <Banknote className="text-slate-400" size={20} />
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fondo Inicial</h3>
                    </div>
                    <p className="text-3xl font-black text-slate-700 tracking-tighter">
                      ${currentSession.initialCash.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                      <Banknote className="text-emerald-600" size={20} />
                      <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Efectivo Cobrado</h3>
                    </div>
                    <p className="text-3xl font-black text-emerald-700 tracking-tighter">
                      ${receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).reduce((acc, r) => acc + (r.cashAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                      <ArrowRightLeft className="text-blue-600" size={20} />
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Transferencias</h3>
                    </div>
                    <p className="text-3xl font-black text-blue-700 tracking-tighter">
                      ${receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).reduce((acc, r) => acc + (r.transferAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-100 p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                      <Percent className="text-purple-600" size={20} />
                      <h3 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Iva Boletas</h3>
                    </div>
                    <p className="text-3xl font-black text-purple-700 tracking-tighter">
                      ${receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).reduce((acc, r) => acc + (r.ivaBoletasAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Calculator className="text-blue-400" size={20} />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efectivo Esperado</h3>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tighter">
                      ${(currentSession.initialCash + receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).reduce((acc, r) => acc + (r.cashAmount || 0) + (r.ivaBoletasAmount || 0), 0)).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Closing Form Overlay */}
                {showClosingForm && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6">
                    <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col md:flex-row max-h-[90vh]">
                      
                      {/* Left Side: Receipts List */}
                      <div className="flex-1 p-6 md:p-8 bg-slate-50 border-r border-slate-100 overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <Receipt size={18} className="text-blue-500" />
                            Comprobantes de la Sesión
                          </h3>
                          <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            {receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).length}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          {receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 border-dashed">
                              <Receipt size={32} className="text-slate-300 mx-auto mb-3" />
                              <p className="text-xs font-bold text-slate-500">No hay comprobantes en esta sesión</p>
                            </div>
                          ) : (
                            receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).map(receipt => (
                              <div key={receipt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                                      #{receipt.id.split('-')[0]}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                      <Clock size={10} />
                                      {new Date(receipt.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <span className="text-sm font-black text-emerald-600">${receipt.amount.toLocaleString()}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                    <User size={12} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 truncate">{receipt.customerName}</span>
                                </div>
                                
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                                  <div className="flex gap-2">
                                    {receipt.cashAmount > 0 && (
                                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Banknote size={10} /> EFE: ${receipt.cashAmount.toLocaleString()}
                                      </span>
                                    )}
                                    {receipt.transferAmount > 0 && (
                                      <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <CreditCard size={10} /> TRF: ${receipt.transferAmount.toLocaleString()}
                                      </span>
                                    )}
                                    {receipt.ivaBoletasAmount > 0 && (
                                      <span className="text-[9px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Receipt size={10} /> IVA: ${receipt.ivaBoletasAmount.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                    <User size={10} /> {receipt.collectedBy}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Right Side: Closing Form */}
                      <div className="w-full md:w-[400px] flex flex-col shrink-0 bg-white">
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6">Cierre de Caja</h2>
                          
                          <div className="space-y-6">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Efectivo Real en Caja</label>
                              <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                <input 
                                  type="number"
                                  value={closingCashInput}
                                  onChange={e => setClosingCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-10 py-4 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10"
                                  placeholder="0.00"
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2 font-bold">
                                Efectivo esperado: ${(currentSession.initialCash + receipts.filter(r => new Date(r.createdAt) >= new Date(currentSession.openedAt)).reduce((acc, r) => acc + (r.cashAmount || 0), 0)).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <input 
                                type="checkbox"
                                id="printAfterClosing"
                                checked={printAfterClosing}
                                onChange={e => setPrintAfterClosing(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="printAfterClosing" className="text-xs font-black text-slate-700 uppercase cursor-pointer select-none">
                                Imprimir ticket al cerrar caja
                              </label>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Notas / Observaciones</label>
                              <textarea 
                                value={closingNotes}
                                onChange={e => setClosingNotes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px]"
                                placeholder="Ej: Faltante de $10, billete falso, etc..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100">
                          <button 
                            onClick={() => setShowClosingForm(false)}
                            className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleCloseSession}
                            disabled={processing}
                            className="flex-1 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-700 transition-all shadow-xl"
                          >
                            {processing ? 'Cerrando...' : 'Confirmar Cierre'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null}
</div>
  );
};

const StatsCard: React.FC<{title: string, value: string, subtitle: string, icon: React.ReactNode, color: string}> = ({ title, value, subtitle, icon, color }) => {
  const colors: {[key: string]: string} = { 
    blue: 'text-blue-600 bg-blue-50 border-blue-100', 
    purple: 'text-purple-600 bg-purple-50 border-purple-100', 
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100', 
    red: 'text-red-600 bg-red-50 border-red-100', 
    amber: 'text-amber-600 bg-amber-50 border-amber-100' 
  };
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:scale-[1.02]">
      <div className={`w-12 h-12 ${colors[color]} rounded-2xl flex items-center justify-center mb-4 border`}>{icon}</div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">{value}</h3>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{subtitle}</p>
    </div>
  );
};

export default CollectionView;

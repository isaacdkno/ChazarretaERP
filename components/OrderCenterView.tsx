
import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Package, 
  Save, 
  Edit3,
  Percent,
  X,
  PlusCircle,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  Zap,
  Minus,
  Plus,
  Truck,
  Tag,
  History as HistoryIcon,
  Download,
  Calendar,
  ArrowLeft,
  UserCircle,
  AlertCircle,
  FileEdit,
  FileText,
  Printer,
  Trash2,
  Edit2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderStatus, Product, Customer, OrderItem, GateEntry, PriceList, PriceHistory, OrderStatusLabels, OrderStatusColors, UserRole, CreditNote, CreditNoteItem, CurrentUser } from '../types';
import { supabase } from '../supabase';
import {
  exportPriceListPDF,
  exportCreditNotePDF,
  printCreditNoteThermal as printCNThermal
} from '../utils/documentPrinter';
import ProductManagement from './ProductManagement';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder: (order: Order) => Promise<void>;
  products: Product[];
  customers: Customer[];
  priceLists: PriceList[];
  onRefresh: () => void;
  gateEntries: GateEntry[];
  updateGateEntry: (entry: GateEntry) => Promise<void>;
  currentUser: CurrentUser;
  addCreditNote: (cn: CreditNote) => void;
  creditNotes: CreditNote[];
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder, products, customers, priceLists, onRefresh, gateEntries, updateGateEntry, currentUser, addCreditNote, creditNotes }) => {
  const [isCorrectionMode, setIsCorrectionMode] = useState<string | null>(null);
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [creditNoteCart, setCreditNoteCart] = useState<{[productId: string]: number}>({});
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCuit, setNewCustomerCuit] = useState('');
  const [newCustomerPriceList, setNewCustomerPriceList] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<Customer | null>(null);

  const fetchPriceHistory = async (listId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('price_list_id', listId)
        .order('effective_date', { ascending: false });
      
      if (error) throw error;
      const mappedData = (data || []).map((item: any) => ({
        id: item.id,
        priceListId: item.price_list_id,
        productId: item.product_id,
        price: item.price,
        effectiveDate: item.effective_date
      }));
      setPriceHistory(mappedData);
      setViewingHistory(listId);
    } catch (error) {
      console.error("Error fetching price history:", error);
      alert("Error al cargar el historial de precios.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePriceList = async () => {
    const name = editPriceList.name?.trim();
    if (!name) {
      alert("El nombre de la lista es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const listData = {
        name,
        description: editPriceList.description || ''
      };

      if (isEditingPriceList) {
        const { error } = await supabase.from('price_lists').update(listData).eq('id', isEditingPriceList);
        if (error) throw error;
      } else {
        const newListId = 'list-' + Math.random().toString(36).substr(2, 5);
        const { error } = await supabase.from('price_lists').insert([{
          ...listData,
          id: newListId
        }]);
        if (error) throw error;

        const initialPrices = products.map(p => ({
          product_id: p.id,
          price_list_id: newListId,
          price: 0
        }));
        await supabase.from('product_prices').insert(initialPrices);
      }

      onRefresh();
      setShowPriceListForm(false);
      setIsEditingPriceList(null);
      setEditPriceList({});
    } catch (error) {
      console.error(error);
      alert("Error al guardar la lista de precios");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (list: PriceList) => {
    exportPriceListPDF(list, products);
  };

  const generateCreditNotePDF = (cn: CreditNote) => {
    exportCreditNotePDF(cn, orders, products);
  };

  const printCreditNoteThermal = (cn: CreditNote) => {
    printCNThermal(cn, orders, products);
  };

  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'PRODUCTS' | 'BONUS' | 'PRICES' | 'GATE_VALIDATE' | 'CREDIT_NOTES'>('VALIDATE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VALIDATED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showPriceListForm, setShowPriceListForm] = useState(false);
  const [editPriceList, setEditPriceList] = useState<Partial<PriceList>>({});
  const [isEditingPriceList, setIsEditingPriceList] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  
  const canEditCreditLimit = [UserRole.ADMIN, UserRole.MANAGER, UserRole.COLLECTION].includes(currentUser.role);
  const canViewCreditLimit = currentUser.role !== UserRole.GATE;
  
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderCart, setOrderCart] = useState<{[id: string]: number}>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const openNewOrder = () => {
    setEditingOrder(null);
    setIsCorrectionMode(null);
    setOrderCart({});
    setSelectedCustomerId('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setShowOrderForm(true);
  };

  const openEditOrder = (order: Order) => {
    try {
      console.log("DEBUG: openEditOrder called for", order.id, order.status);
      if (order.status === OrderStatus.DISPATCHED) {
        console.log("DEBUG: Order is DISPATCHED. Showing confirm dialog.");
        if (window.confirm(`La comanda #ORD-${order.id.toString().substr(0, 6).toUpperCase()} ya fue despachada. ¿Desea generar una corrección? Esto anulará la actual y creará una nueva.`)) {
          console.log("DEBUG: User confirmed correction.");
          setEditingOrder(null);
          setIsCorrectionMode(order.id);
          setSelectedCustomerId(order.customerId);
          setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          const initialCart: {[id: string]: number} = {};
          if (order.items) {
            order.items.forEach(item => { initialCart[item.productId] = item.quantity; });
          }
          setOrderCart(initialCart);
          setShowOrderForm(true);
        } else {
          console.log("DEBUG: User cancelled correction.");
        }
        return;
      }

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.VALIDATED) {
        alert("No se puede editar un pedido ya procesado.");
        return;
      }
      setEditingOrder(order);
      setIsCorrectionMode(null);
      setSelectedCustomerId(order.customerId);
      setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      const initialCart: {[id: string]: number} = {};
      if (order.items) {
        order.items.forEach(item => { initialCart[item.productId] = item.quantity; });
      }
      setOrderCart(initialCart);
      setShowOrderForm(true);
    } catch (e) {
      console.error("CRITICAL ERROR in openEditOrder:", e);
      alert("Error crítico al intentar editar: " + String(e));
    }
  };


  const updateCart = (productId: string, delta: number) => {
    setOrderCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const setQuantity = (productId: string, qty: number) => {
    setOrderCart(prev => {
      const next = Math.max(0, qty);
      return { ...prev, [productId]: next };
    });
  };

  const handleUpdateCustomerPriceList = async (customerId: string, priceListId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ price_list_id: priceListId })
        .eq('id', customerId);
      
      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error("Error updating customer price list:", error);
      alert("Error al actualizar la lista de precios del cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();
    if (!name || !phone) {
      alert("El nombre y el teléfono son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const customerData = {
        name,
        phone,
        address: newCustomerAddress.trim(),
        cuit: newCustomerCuit.trim(),
        price_list_id: newCustomerPriceList || null
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        const newCustomerId = 'c-' + Math.random().toString(36).substr(2, 5);
        const { error } = await supabase.from('customers').insert([{
          ...customerData,
          id: newCustomerId,
          balance: 0
        }]);
        if (error) throw error;
      }

      onRefresh();
      setShowNewCustomerForm(false);
      setEditingCustomer(null);
      setNewCustomerName('');
      setNewCustomerAddress('');
      setNewCustomerPhone('');
      setNewCustomerCuit('');
      setNewCustomerPriceList('');
    } catch (error: any) {
      console.error("Error saving customer:", error);
      alert(`Error al guardar el cliente: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (customer) {
      setConfirmDeleteCustomer(customer);
    }
  };

  const calculateOrderTotals = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    const priceListId = customer?.priceListId || 'l1';
    let total = 0;
    
    const items: OrderItem[] = Object.entries(orderCart).map(([pid, qty]) => {
      const p = products.find(prod => prod.id === pid);
      if (!p) return null;
      
      const unitPrice = p.prices?.[priceListId] || 0;
      const numQty = Number(qty);
      
      let bonusQty = 0;
      if (p.bonusEnabled && p.bonusThreshold && p.bonusPercentage) {
        if (numQty >= p.bonusThreshold) {
          bonusQty = Math.ceil(numQty * (p.bonusPercentage / 100));
        }
      }
      
      total += numQty * unitPrice;
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: pid,
        quantity: numQty,
        bonusQuantity: bonusQty,
        unitPrice: unitPrice
      };
    }).filter((item): item is OrderItem => item !== null);

    return { total, items };
  };

  useEffect(() => {
    setCreditError(null);
  }, [selectedCustomerId, orderCart]);

  const handleSaveOrder = async () => {
    setCreditError(null);
    if (!selectedCustomerId || Object.keys(orderCart).length === 0) {
      alert("Falta cliente o productos en el carrito");
      return;
    }
    
    const customer = customers.find(c => c.id === selectedCustomerId)!;
    
    if (customer.isBlocked) {
      const errorMsg = "Este cliente está bloqueado. Por favor, comuníquese con la oficina de cobranzas para regularizar su situación.";
      setCreditError(errorMsg);
      alert(errorMsg);
      return;
    }

    const { total, items } = calculateOrderTotals(selectedCustomerId);

    if (!editingOrder && customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit > 0) {
      if (customer.balance + total > customer.creditLimit) {
        const errorMsg = "Límite de crédito excedido. Comunicarse con Administracion";
        setCreditError(errorMsg);
        alert(errorMsg);
        return;
      }
    }
    
    setLoading(true);
    try {

      if (isCorrectionMode) {
        const oldOrder = orders.find(o => o.id === isCorrectionMode);
        if (oldOrder) {
          // 1. Anular la vieja
          await handleCancelOrder(oldOrder, true);
          
          // 2. Crear la nueva como DISPATCHED
          await addOrder({
            id: Math.random().toString(36).substr(2, 9),
            customerId: customer.id,
            customerName: customer.name,
            status: OrderStatus.DISPATCHED,
            items,
            totalAmount: total,
            paidAmount: 0,
            createdAt: new Date().toISOString(),
            isCorrection: true,
            replacedOrderId: oldOrder.id,
            deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined
          });
        }
      } else if (editingOrder) {
        await updateOrder({ 
          ...editingOrder, 
          items, 
          totalAmount: total,
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined
        });
      } else {
        await addOrder({
          id: Math.random().toString(36).substr(2, 9),
          customerId: customer.id,
          customerName: customer.name,
          status: OrderStatus.PENDING,
          items,
          totalAmount: total,
          paidAmount: 0,
          createdAt: new Date().toISOString(),
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined
        });
      }
      setShowOrderForm(false);
      setIsCorrectionMode(null);
    } catch (error) {
      console.error("Error in handleSaveOrder:", error);
      alert("Error crítico al guardar: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCreditNote = async () => {
    if (!viewingOrder) return;
    
    const items: CreditNoteItem[] = (Object.entries(creditNoteCart) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const orderItem = viewingOrder.items.find(i => i.productId === pid);
        return {
          id: Math.random().toString(36).substr(2, 9),
          productId: pid,
          quantity: qty,
          unitPrice: orderItem?.unitPrice || 0,
          total: qty * (orderItem?.unitPrice || 0)
        };
      });

    if (items.length === 0) {
      alert("Debe seleccionar al menos un producto para devolver.");
      return;
    }

    const totalAmount = items.reduce((acc, item) => acc + item.total, 0);

    const newCN: CreditNote = {
      id: '', // Will be set by server
      orderId: viewingOrder.id,
      customerId: viewingOrder.customerId,
      customerName: viewingOrder.customerName,
      items,
      totalAmount,
      reason: creditNoteReason,
      createdAt: new Date().toISOString()
    };

    try {
      setLoading(true);
      await addCreditNote(newCN);
      setShowCreditNoteForm(false);
      setViewingOrder(null);
      setCreditNoteCart({});
      setCreditNoteReason('');
      alert("Nota de Crédito generada con éxito.");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const validateOrder = async (order: Order) => {
    setLoading(true);
    try {
      await updateOrder({ ...order, status: OrderStatus.VALIDATED });
    } catch (error) {
      console.error("Error in validateOrder:", error);
      alert("Error al validar la comanda.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (order: Order, silent = false) => {
    try {
      console.log("DEBUG: handleCancelOrder called for", order.id);
      // Force a simple confirm dialog
      const confirmed = window.confirm(
        `CONFIRMACIÓN DE ANULACIÓN:\n\n` +
        `¿Está seguro que desea anular la comanda #ORD-${order.id.toString().substr(0, 6).toUpperCase()}?\n` +
        `Esta acción es irreversible.`
      );

      if (silent || confirmed) {
        setLoading(true);
        try {
          await updateOrder({ ...order, status: OrderStatus.CANCELLED });
        } catch (error) {
          console.error("Error cancelling:", error);
          alert("No se pudo anular: " + (error instanceof Error ? error.message : String(error)));
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      console.error("CRITICAL ERROR in handleCancelOrder:", e);
      alert("Error crítico al intentar anular: " + String(e));
    }
  };


  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         o.id.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {loading && (
        <div className="fixed top-10 right-10 bg-blue-600 text-white px-6 py-3 rounded-2xl z-[100] shadow-2xl animate-pulse font-black uppercase tracking-widest text-xs">
          Procesando...
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Centro de Pedidos</h1>
          <p className="text-slate-500 font-medium">Gestión integral validada con Supabase.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: 'VALIDATE', label: 'Comandas', icon: <ClipboardCheck size={18} />, count: orders.filter(o => o.status === OrderStatus.PENDING).length },
            { id: 'GATE_VALIDATE', label: 'Cambios (Portería)', icon: <Truck size={18} />, count: gateEntries.filter(ge => ge.status === 'PENDING').length },
            { id: 'CREDIT_NOTES', label: 'Notas de Crédito', icon: <FileText size={18} />, count: creditNotes.length },
            { id: 'CUSTOMERS', label: 'Clientes', icon: <UserCircle size={18} />, count: 0 },
            { id: 'PRODUCTS', label: 'Productos y Precios', icon: <Package size={18} />, count: 0 },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.icon} {tab.label}
              {tab.count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'VALIDATE' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm gap-6">
             <div className="flex items-center gap-4">
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     type="text" 
                     placeholder="Buscar comanda..." 
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="pl-12 pr-6 py-3 border border-slate-100 bg-slate-50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none w-64 font-medium transition-all"
                   />
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[ 
                    { id: 'ALL', label: 'Todos' },
                    { id: 'PENDING', label: 'Pendientes' },
                    { id: 'VALIDATED', label: 'Validados' },
                    { id: 'DISPATCHED', label: 'Entregados' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id as any)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
             </div>

             <button 
              onClick={openNewOrder}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all w-full md:w-auto justify-center"
             >
               <PlusCircle size={18} /> Nueva Comanda
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
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
                  <tr 
                    key={order.id} 
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <p className="font-mono text-xs font-bold text-slate-400">#ORD-{order.id.toString().substr(0, 6).toUpperCase()}</p>
                      <div className="text-[10px] font-bold text-slate-300 mt-1">
                        <p>Emisión: {(() => {
                          const d = new Date(order.createdAt);
                          return isNaN(d.getTime()) ? 'Fecha N/A' : d.toLocaleDateString();
                        })()}</p>
                        {order.deliveryDate && (
                          <p className="text-blue-400">Para: {(() => {
                            const d = new Date(order.deliveryDate);
                            return isNaN(d.getTime()) ? 'Fecha N/A' : d.toLocaleDateString();
                          })()}</p>
                        )}
                      </div>
                      {order.isCorrection && (
                        <div className="mt-2 flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-tighter">
                            Reimpresa y Corregida
                          </span>
                          <span className="text-[8px] font-bold text-slate-400">
                            Reemplaza a #ORD-{order.replacedOrderId?.substr(0, 6).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 uppercase font-black text-slate-800 text-sm">{order.customerName}</td>
                    <td className="px-8 py-5 font-black text-slate-900">${order.totalAmount.toLocaleString()}</td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${OrderStatusColors[order.status] || 'bg-slate-100 text-slate-500 border-slate-200'}
                      `}>
                        {OrderStatusLabels[order.status]}
                      </span>
                      {order.status === OrderStatus.CANCELLED && (
                        <span className="block text-[9px] text-red-400 font-bold mt-1">Anulada</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex gap-2 justify-end relative z-50">
                        {/* BOTÓN EDITAR (Solo para pendientes o validados) */}
                        {(order.status === OrderStatus.PENDING || order.status === OrderStatus.VALIDATED) && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditOrder(order);
                            }} 
                            className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 shadow-sm transition-all cursor-pointer"
                            title="Editar Comanda"
                          >
                            <Edit3 size={16} className="pointer-events-none" />
                          </button>
                        )}

                        {/* BOTÓN VALIDAR */}
                        {order.status === OrderStatus.PENDING && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              validateOrder(order);
                            }} 
                            className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-emerald-600 shadow-sm transition-all cursor-pointer"
                            title="Validar Comanda"
                          >
                            <CheckCircle2 size={16} className="pointer-events-none" />
                          </button>
                        )}

                        {/* BOTÓN LUPA (Ver Detalle) */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingOrder(order);
                          }} 
                          className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 shadow-sm transition-all cursor-pointer"
                          title="Ver Detalle"
                        >
                          <Search size={16} className="pointer-events-none" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Gestión de Clientes</h2>
              <button 
                onClick={() => {
                  setEditingCustomer(null);
                  setNewCustomerName('');
                  setNewCustomerPriceList('');
                  setShowNewCustomerForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-100 transition-all"
              >
                <Plus size={14} /> Nuevo Cliente
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {customers.map(customer => (
                <div key={customer.id} className="p-8 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <p className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{customer.name}</p>
                    {/* Credit limit hidden as requested */}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista de Precios:</label>
                    <select
                      value={customer.priceListId || ''}
                      onChange={(e) => handleUpdateCustomerPriceList(customer.id, e.target.value)}
                      disabled={loading}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Seleccionar Lista...</option>
                      {priceLists.map(list => (
                        <option key={list.id} value={list.id}>{list.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        console.log("Editing customer:", customer);
                        setEditingCustomer(customer);
                        setNewCustomerName(customer.name);
                        setNewCustomerPriceList(customer.priceListId || '');
                        setNewCustomerAddress(customer.address || '');
                        setNewCustomerPhone(customer.phone || '');
                        setNewCustomerCuit(customer.cuit || '');
                        setShowNewCustomerForm(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar Cliente"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar Cliente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showNewCustomerForm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                  <button onClick={() => setShowNewCustomerForm(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Cliente</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      placeholder="Ej: Panadería La Nueva"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Dirección</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                      value={newCustomerAddress}
                      onChange={e => setNewCustomerAddress(e.target.value)}
                      placeholder="Ej: Calle 123"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Teléfono</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                      value={newCustomerPhone}
                      onChange={e => setNewCustomerPhone(e.target.value)}
                      placeholder="Ej: 11 1234 5678"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">CUIT</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                      value={newCustomerCuit}
                      onChange={e => setNewCustomerCuit(e.target.value)}
                      placeholder="Ej: 20-12345678-9"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Lista de Precios Inicial</label>
                    <select
                      value={newCustomerPriceList}
                      onChange={(e) => setNewCustomerPriceList(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Seleccionar Lista...</option>
                      {priceLists.map(list => (
                        <option key={list.id} value={list.id}>{list.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Credit limit hidden as requested */}
                </div>
                <div className="p-8 bg-slate-50 flex gap-3">
                  <button 
                    onClick={() => setShowNewCustomerForm(false)}
                    className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveCustomer}
                    disabled={loading}
                    className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    {loading ? 'Guardando...' : <Save size={16} />} Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'GATE_VALIDATE' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Validación de Cambios / Devoluciones</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {gateEntries.filter(e => e.status === 'PENDING').length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No hay ingresos de portería pendientes</div>
              ) : gateEntries.filter(e => e.status === 'PENDING').map(entry => (
                <div key={entry.id} className="p-8 hover:bg-slate-50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{entry.customerName}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrado: {new Date(entry.createdAt).toLocaleString()}</p>
                      <div className="mt-4 space-y-2">
                        {entry.items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs">{item.quantity}</span>
                            <span className="uppercase">{item.productName}</span>
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md uppercase">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        updateGateEntry({ ...entry, status: 'VALIDATED' });
                      }}
                      className="px-8 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Validar Cambio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showOrderForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="flex-1 p-10 overflow-y-auto bg-slate-50/50 border-r border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6">{editingOrder ? 'Editando Comanda' : 'Nueva Comanda'}</h2>
                
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar producto por nombre o marca..." 
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all"
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-3 text-right">Precio Unit.</div>
                    <div className="col-span-3 text-right">Acción</div>
                  </div>
                  
                  <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {products.filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.brand.toLowerCase().includes(productSearchQuery.toLowerCase())).length > 0 ? (
                      products.filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.brand.toLowerCase().includes(productSearchQuery.toLowerCase())).map(p => {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        const listId = cust?.priceListId || 'l1';
                        const unitPrice = p.prices?.[listId] || 0;
                        const inCart = orderCart[p.id] || 0;
                        
                        return (
                          <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                            <div className="col-span-1 md:col-span-6 flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.brand === 'La Fornarina' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {p.brand}
                                </span>
                                {p.bonusEnabled && (
                                  <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-0.5">
                                    <Zap size={10} className="fill-emerald-600" /> Con Bonificación
                                  </span>
                                )}
                              </div>
                              <p className="font-black text-slate-800 uppercase text-sm md:text-base">{p.name}</p>
                            </div>
                            
                            <div className="col-span-1 md:col-span-3 text-left md:text-right">
                              <p className="font-black text-slate-900 text-lg md:text-xl tracking-tighter">${unitPrice.toLocaleString()}</p>
                            </div>
                            
                            <div className="col-span-1 md:col-span-3 flex justify-end">
                              {p.id in orderCart ? (
                                <div className="flex items-center bg-blue-50 rounded-xl p-1 border border-blue-100">
                                  <button 
                                    onClick={() => {
                                      if (inCart <= 1) {
                                        setOrderCart(prev => {
                                          const { [p.id]: _, ...rest } = prev;
                                          return rest;
                                        });
                                      } else {
                                        updateCart(p.id, -1);
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded-lg text-blue-600 transition-all"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input 
                                    type="number"
                                    value={inCart || ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '') {
                                        setQuantity(p.id, 0);
                                      } else {
                                        setQuantity(p.id, parseInt(val) || 0);
                                      }
                                    }}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-10 text-center font-black text-blue-700 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button 
                                    onClick={() => updateCart(p.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded-lg text-blue-600 transition-all"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => updateCart(p.id, 1)}
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

             <div className="w-96 bg-white p-10 flex flex-col">
                <div className="flex justify-end mb-6">
                  <button onClick={() => setShowOrderForm(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4">
                  <div className="space-y-6">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cliente</label>
                        <select 
                          disabled={editingOrder !== null}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 mb-4"
                          value={selectedCustomerId}
                          onChange={e => setSelectedCustomerId(e.target.value)}
                        >
                          <option value="">Buscar Cliente...</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isBlocked ? ' (BLOQUEADO)' : ''}
                            </option>
                          ))}
                        </select>
                        
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Fecha de Entrega</label>
                        <input 
                          type="date"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10"
                          value={deliveryDate}
                          onChange={e => setDeliveryDate(e.target.value)}
                        />

                        {selectedCustomerId && customers.find(c => c.id === selectedCustomerId)?.isBlocked && (
                          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} />
                            <p className="text-xs font-black uppercase tracking-tight">
                              Cliente bloqueado: Comuníquese con cobranzas.
                            </p>
                          </div>
                        )}
                     </div>
                     <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingCart size={14} /> Detalle de Carga</h3>
                        <div className="space-y-4">
                          {Object.entries(orderCart).map(([pid, qty]) => {
                            const p = products.find(prod => prod.id === pid)!;
                            return (
                              <div key={pid} className="flex justify-between items-center text-sm font-bold">
                                 <p className="text-slate-800 truncate max-w-[140px] uppercase">
                                   <span className="text-blue-600 mr-2">{qty}x</span>
                                   {p.name}
                                 </p>
                                 <p className="text-slate-900">${(Number(qty) * (p.prices?.[customers.find(c => c.id === selectedCustomerId)?.priceListId || 'l1'] || 0)).toLocaleString()}</p>
                              </div>
                            );
                          })}
                        </div>
                     </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                   <div className="flex justify-between items-end mb-6">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">${calculateOrderTotals(selectedCustomerId).total.toLocaleString()}</span>
                   </div>
                   {creditError && (
                     <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in slide-in-from-top-2">
                       <AlertCircle size={20} className="shrink-0 mt-0.5" />
                       <p className="text-xs font-black uppercase tracking-tight leading-relaxed">
                         {creditError}
                       </p>
                     </div>
                   )}
                   <button 
                     type="button"
                     onClick={() => {
                       console.log("Save button clicked");
                       handleSaveOrder();
                     }} 
                     disabled={!selectedCustomerId || Object.keys(orderCart).length === 0 || customers.find(c => c.id === selectedCustomerId)?.isBlocked} 
                     className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-20 transition-all flex items-center justify-center gap-3 cursor-pointer relative z-10"
                   >
                     <Save size={18} /> {editingOrder ? 'Actualizar' : 'Generar Comanda'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
      {viewingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Comanda Detallada</h2>
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      viewingOrder.status === OrderStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      viewingOrder.status === OrderStatus.VALIDATED ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {OrderStatusLabels[viewingOrder.status]}
                    </span>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                    ID: #ORD-{String(viewingOrder.id).toUpperCase()} • Emisión: {new Date(viewingOrder.createdAt).toLocaleString()}
                    {viewingOrder.deliveryDate && ` • Para: ${new Date(viewingOrder.deliveryDate).toLocaleDateString()}`}
                  </p>
                </div>
                <button onClick={() => setViewingOrder(null)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={24}/></button>
              </div>

              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 mb-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                    <DollarSign size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / Distribuidor</p>
                    <p className="text-xl font-black text-slate-800 uppercase tracking-tight">{viewingOrder.customerName}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-2 text-center">Cant.</div>
                    <div className="col-span-2 text-center">Bonif.</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>
                  <div className="max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {viewingOrder.items.map(item => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white rounded-2xl border border-slate-100 items-center">
                          <div className="col-span-6">
                            <p className="font-bold text-slate-800 uppercase text-xs">{p?.name || 'Producto Desconocido'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">${item.unitPrice.toLocaleString()} x unidad</p>
                          </div>
                          <div className="col-span-2 text-center font-black text-slate-700">{item.quantity}</div>
                          <div className="col-span-2 text-center font-black text-emerald-500">{item.bonusQuantity > 0 ? `+${item.bonusQuantity}` : '-'}</div>
                          <div className="col-span-2 text-right font-black text-slate-900">${(item.quantity * item.unitPrice).toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de la Operación</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">${viewingOrder.totalAmount.toLocaleString()}</p>
                </div>
                <div className="flex gap-4">
                  {[OrderStatus.DISPATCHED, OrderStatus.PAID_PARTIAL, OrderStatus.PAID_FULL].includes(viewingOrder.status) && (
                    <button 
                      onClick={() => {
                        const initialCart: {[id: string]: number} = {};
                        viewingOrder.items.forEach(i => initialCart[i.productId] = 0);
                        setCreditNoteCart(initialCart);
                        setShowCreditNoteForm(true);
                      }}
                      className="px-10 py-5 bg-amber-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-amber-100 hover:bg-amber-700 transition-all flex items-center gap-3"
                    >
                      <FileEdit size={20} /> Generar Nota de Crédito
                    </button>
                  )}
                  {viewingOrder.status === OrderStatus.PENDING && (
                    <button 
                      onClick={() => {
                        validateOrder(viewingOrder);
                        setViewingOrder(null);
                      }}
                      className="px-10 py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-3"
                    >
                      <CheckCircle2 size={20} /> Validar Ahora
                    </button>
                  )}
                  <button 
                    onClick={() => setViewingOrder(null)}
                    className="px-10 py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-800 transition-all"
                  >
                    Cerrar Vista
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'PRODUCTS' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <ProductManagement products={products} priceLists={priceLists} onRefresh={onRefresh} />
        </div>
      )}

      {activeTab === 'CREDIT_NOTES' && (
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
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No hay notas de crédito registradas</td>
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
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
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
      )}

      {/* MODAL NOTA DE CRÉDITO */}
      <AnimatePresence>
        {showCreditNoteForm && viewingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Nota de Crédito</h2>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Vinculada a Comanda #ORD-{viewingOrder.id.toString().substr(0, 6).toUpperCase()}</p>
                  </div>
                  <button onClick={() => setShowCreditNoteForm(false)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={24}/></button>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar productos a devolver</h3>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {viewingOrder.items.map(item => {
                        const p = products.find(prod => prod.id === item.productId);
                        const currentQty = creditNoteCart[item.productId] || 0;
                        return (
                          <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100">
                            <div>
                              <p className="font-bold text-slate-800 uppercase text-xs">{p?.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">Máximo: {item.quantity} unidades</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-100">
                              <button 
                                onClick={() => setCreditNoteCart(prev => ({ ...prev, [item.productId]: Math.max(0, currentQty - 1) }))}
                                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                              >
                                <Minus size={14} />
                              </button>
                              <input 
                                type="number"
                                value={currentQty || ''}
                                onChange={(e) => {
                                  const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                  setCreditNoteCart(prev => ({ ...prev, [item.productId]: val }));
                                }}
                                className="w-10 text-center font-black text-slate-800 bg-transparent outline-none"
                              />
                              <button 
                                onClick={() => setCreditNoteCart(prev => ({ ...prev, [item.productId]: Math.min(item.quantity, currentQty + 1) }))}
                                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Motivo de la Devolución</label>
                    <textarea 
                      value={creditNoteReason}
                      onChange={e => setCreditNoteReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px]"
                      placeholder="Ej: Producto en mal estado, error en carga, etc..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Acreditar</p>
                      <p className="text-3xl font-black text-amber-600 tracking-tighter">
                        ${(Object.entries(creditNoteCart) as [string, number][]).reduce((acc, [pid, qty]) => {
                          const item = viewingOrder.items.find(i => i.productId === pid);
                          return acc + (qty * (item?.unitPrice || 0));
                        }, 0).toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={handleSaveCreditNote}
                      disabled={loading || Object.values(creditNoteCart).every(v => v === 0)}
                      className="px-10 py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-20 transition-all flex items-center gap-3"
                    >
                      <Save size={18} /> Confirmar Nota de Crédito
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Customer Modal */}
      <AnimatePresence>
        {confirmDeleteCustomer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Eliminar Cliente?</h2>
                <p className="text-slate-500 font-medium">
                  ¿Estás seguro de que deseas eliminar a <span className="font-bold text-slate-800">{confirmDeleteCustomer.name}</span>? 
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteCustomer(null)}
                  className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Check if customer has orders
                      const { count: orderCount, error: orderError } = await supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('customer_id', confirmDeleteCustomer.id);
                        
                      if (orderError) throw orderError;
                      if (orderCount && orderCount > 0) {
                        alert("No se puede eliminar el cliente porque tiene pedidos asociados.");
                        setLoading(false);
                        setConfirmDeleteCustomer(null);
                        return;
                      }

                      // Check if customer has gate entries
                      const { count: gateCount, error: gateError } = await supabase
                        .from('gate_entries')
                        .select('*', { count: 'exact', head: true })
                        .eq('customer_id', confirmDeleteCustomer.id);
                        
                      if (gateError) throw gateError;
                      if (gateCount && gateCount > 0) {
                        alert("No se puede eliminar el cliente porque tiene ingresos de portería asociados.");
                        setLoading(false);
                        setConfirmDeleteCustomer(null);
                        return;
                      }

                      const { error } = await supabase.from('customers').delete().eq('id', confirmDeleteCustomer.id);
                      if (error) throw error;
                      
                      onRefresh();
                      setConfirmDeleteCustomer(null);
                    } catch (error: any) {
                      console.error("Error deleting customer:", error);
                      alert("Ocurrió un error al intentar eliminar el cliente.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-700 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  {loading ? 'Eliminando...' : 'Sí, Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderCenterView;

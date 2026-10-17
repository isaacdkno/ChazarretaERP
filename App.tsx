
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Truck, 
  Store, 
  ClipboardList, 
  Warehouse, 
  UserCircle, 
  BadgeDollarSign, 
  Settings, 
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Plus,
  CheckCircle2,
  LayoutDashboard,
  Box,
  Github,
  AlertCircle,
  RefreshCw,
  Database,
  Package,
  BarChart3,
  Loader2,
  Menu,
  X,
  Radio
} from 'lucide-react';

import { UserRole, Order, Customer, OrderStatus, GateEntry, AuditLog, Product, PriceList, OrderStatusLabels, CreditNote, CreditNoteItem, AppUser, CurrentUser } from './types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getOrders, getCreditNotes, getGateEntries } from './services/supabaseService';
import { hashPassword, verifyPassword } from './utils/auth';
import { installGlobalAlertBridge, toast, playNotificationSound } from './utils/toast';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';

installGlobalAlertBridge();

const DistributorView = lazy(() => import('./components/DistributorView'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const GateView = lazy(() => import('./components/GateView'));
const OrderCenterView = lazy(() => import('./components/OrderCenterView'));
const FactoryView = lazy(() => import('./components/FactoryView'));
const DispatchView = lazy(() => import('./components/DispatchView'));
const LogisticsView = lazy(() => import('./components/LogisticsView'));
const CollectionView = lazy(() => import('./components/CollectionView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ProductManagement = lazy(() => import('./components/ProductManagement'));
const ReportsView = lazy(() => import('./components/ReportsView'));

export const computeCustomerLedgerBalance = (
  customerId: string,
  allOrders: Order[],
  allCreditNotes: CreditNote[]
): number => {
  const pendingOrders = allOrders.filter(
    o =>
      o.customerId === customerId &&
      (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PAID_PARTIAL)
  );
  const pendingOrderIds = pendingOrders.map(o => o.id);
  const applicableCNs = allCreditNotes.filter(
    cn => cn.customerId === customerId && pendingOrderIds.includes(cn.orderId)
  );
  const rawBalance =
    pendingOrders.reduce((sum, o) => sum + (Number(o.totalAmount || 0) - Number(o.paidAmount || 0)), 0) -
    applicableCNs.reduce((sum, cn) => sum + Number(cn.totalAmount || 0), 0);
  return Math.max(0, Math.round(rawBalance * 100) / 100);
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRealtimeLive, setIsRealtimeLive] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('erp_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('erp_user');
    }
  }, [currentUser]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gateEntries, setGateEntries] = useState<GateEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [dbReady, setDbReady] = useState<boolean | 'ERROR'>(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // Si no está configurado, no intentamos descargar nada
    if (!isSupabaseConfigured()) {
      setDbReady(false);
      setIsSynced(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Verificar conexión y traer clientes sin límite artificial de 100
      const [
        { data: custs, error: custError },
        { error: userTableError }
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('users').select('id').limit(1)
      ]);
      
      if (custError || userTableError) {
        console.warn("DB Error:", custError || userTableError);
        // El código 42P01 significa que la tabla no existe en Postgres
        if (custError?.code === '42P01' || userTableError?.code === '42P01') { 
          setDbReady(false);
        } else {
          setDbReady('ERROR');
        }
        setIsSynced(false);
        setLoading(false);
        return;
      }

      setDbReady(true);
      
      // 2. Cargar tablas maestras en paralelo para máxima velocidad
      const [
        { data: lists },
        { data: prods },
        { data: prices }
      ] = await Promise.all([
        supabase.from('price_lists').select('*'),
        supabase.from('products').select('*'),
        supabase.from('product_prices').select('*')
      ]);

      if (lists) {
        setPriceLists(lists.map(l => ({
          id: l.id,
          name: l.name,
          description: l.description || '',
          updatedAt: l.updated_at || new Date().toISOString()
        })));
      }

      if (custs) {
        setCustomers(custs.map(c => ({
          id: c.id,
          name: c.name,
          groupId: '', 
          priceListId: c.price_list_id,
          balance: Number(c.balance || 0),
          isBlocked: Boolean(c.is_blocked),
          creditLimit: c.credit_limit !== null && c.credit_limit !== undefined ? Number(c.credit_limit) : undefined,
          address: c.address,
          phone: c.phone,
          cuit: c.cuit
        })));
      }

      if (prods) {
        const formattedProducts = prods.map(p => {
          const productPrices: {[id: string]: number} = {};
          prices?.filter(pr => pr.product_id === p.id).forEach(pr => {
            productPrices[pr.price_list_id] = Number(pr.price || 0);
          });
          return {
            id: p.id,
            name: p.name,
            brand: p.brand as 'La Fornarina' | 'Villecco',
            category: p.category,
            barcode: p.barcode,
            bonusEnabled: p.bonus_enabled,
            bonusThreshold: p.bonus_threshold,
            bonusPercentage: p.bonus_percentage,
            prices: productPrices
          };
        });
        setProducts(formattedProducts);
      }

      // 3. Órdenes con items
      const { data: ords, error: ordsError } = await getOrders();
      
      if (ords) {
        const formattedOrders: Order[] = (ords as any[]).map(o => ({
          id: String(o.id),
          customerId: String(o.customer_id),
          customerName: o.customer_name || 'Desconocido',
          status: o.status as OrderStatus,
          totalAmount: o.total_amount,
          paidAmount: o.paid_amount || 0,
          createdAt: o.created_at,
          signatureUrl: o.signature_url,
          deliveryDate: o.delivery_date,
          items: (o.order_items || []).map((i: any) => ({
            id: String(i.id),
            productId: String(i.product_id),
            quantity: i.quantity,
            bonusQuantity: i.bonus_quantity,
            unitPrice: i.unit_price
          }))
        }));
        setOrders(formattedOrders);
      }

      // 4. Notas de Crédito
      const { data: cns, error: cnsError } = await getCreditNotes();
      
      if (cns) {
        const formattedCNs: CreditNote[] = (cns as any[]).map(cn => ({
          id: String(cn.id),
          orderId: String(cn.order_id),
          customerId: String(cn.customer_id),
          customerName: cn.customer_name || 'Desconocido',
          totalAmount: cn.total_amount,
          reason: cn.reason || '',
          createdAt: cn.created_at,
          items: (cn.credit_note_items || []).map((i: any) => ({
            id: String(i.id),
            productId: String(i.product_id),
            quantity: i.quantity,
            unitPrice: i.unit_price,
            total: i.total
          }))
        }));
        setCreditNotes(formattedCNs);
      }

      // 5. Ingresos de Portería
      const { data: ges, error: gesError } = await getGateEntries();
      
      if (ges) {
        const formattedGEs: GateEntry[] = (ges as any[]).map(ge => ({
          id: String(ge.id),
          customerId: String(ge.customer_id),
          customerName: ge.customer_name || 'Desconocido',
          status: ge.status as 'PENDING' | 'VALIDATED' | 'CONVERTED',
          items: ge.items || [],
          createdAt: ge.created_at
        }));
        setGateEntries(formattedGEs);
      }

      setIsSynced(true);
    } catch (error) {
      console.error("Error connecting to Supabase:", error);
      setDbReady('ERROR');
      setIsSynced(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('erp-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          playNotificationSound('chime');
          const newOrd = payload.new as any;
          toast.info(`Nueva comanda recibida de ${newOrd.customer_name || 'Cliente'}`, 'Tiempo Real');
        } else if (payload.eventType === 'UPDATE') {
          const newOrd = payload.new as any;
          const oldOrd = payload.old as any;
          if (oldOrd?.status !== newOrd?.status) {
            playNotificationSound('chime');
          }
        }
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_entries' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_notes' }, () => {
        fetchData();
      })
      .subscribe((status) => {
        setIsRealtimeLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const syncCustomerBalance = async (
    customerId: string,
    nextOrders: Order[],
    nextCreditNotes: CreditNote[]
  ) => {
    if (!customerId) return;
    const exactBalance = computeCustomerLedgerBalance(customerId, nextOrders, nextCreditNotes);
    await supabase.from('customers').update({ balance: exactBalance }).eq('id', customerId);
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, balance: exactBalance } : c));
  };

  const addOrder = async (order: Order) => {
    if (!isSupabaseConfigured()) {
      return;
    }
    setIsSynced(false);
    try {
      const orderData: any = {
        customer_id: order.customerId,
        customer_name: order.customerName,
        status: order.status,
        total_amount: order.totalAmount,
        paid_amount: 0,
        created_at: order.createdAt
      };

      if (order.deliveryDate !== undefined) orderData.delivery_date = order.deliveryDate;
      if (order.isCorrection !== undefined) orderData.is_correction = order.isCorrection;
      if (order.replacedOrderId !== undefined) orderData.replaced_order_id = order.replacedOrderId;

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select().single();

      if (orderError) throw orderError;

      const itemsToInsert = order.items.map(item => ({
        order_id: newOrder.id,
        product_id: item.productId,
        quantity: item.quantity,
        bonus_quantity: item.bonusQuantity,
        unit_price: item.unitPrice
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      const createdOrder: Order = { ...order, id: String(newOrder.id) };
      const nextOrders = [createdOrder, ...orders];
      setOrders(nextOrders);

      if (order.status === OrderStatus.DISPATCHED) {
        await syncCustomerBalance(order.customerId, nextOrders, creditNotes);
      }

      playNotificationSound('success');
      toast.success(`Comanda #ORD-${String(newOrder.id).substring(0, 6).toUpperCase()} registrada correctamente.`);
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addOrder:", err);
      toast.error("Error al guardar pedido en la nube.");
      throw err;
    }
  };

  const addCreditNote = async (creditNote: CreditNote) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      const { data: newCN, error: cnError } = await supabase
        .from('credit_notes')
        .insert([{
          order_id: creditNote.orderId,
          customer_id: creditNote.customerId,
          customer_name: creditNote.customerName,
          total_amount: creditNote.totalAmount,
          reason: creditNote.reason,
          created_at: creditNote.createdAt
        }])
        .select().single();

      if (cnError) throw cnError;

      const itemsToInsert = creditNote.items.map(item => ({
        credit_note_id: newCN.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase.from('credit_note_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      const createdCN: CreditNote = { ...creditNote, id: String(newCN.id) };
      const nextCNs = [createdCN, ...creditNotes];
      setCreditNotes(nextCNs);

      await syncCustomerBalance(creditNote.customerId, orders, nextCNs);
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addCreditNote:", err);
      toast.error("Error al guardar nota de crédito.");
      throw err;
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      // 1. Try update with all fields
      const { error: firstError } = await supabase.from('orders').update({
        status: updatedOrder.status,
        signature_url: updatedOrder.signatureUrl,
        total_amount: updatedOrder.totalAmount,
        paid_amount: updatedOrder.paidAmount,
        delivery_date: updatedOrder.deliveryDate
      }).eq('id', updatedOrder.id);

      // 2. If it fails, try without delivery_date
      if (firstError) {
        console.warn("First update attempt failed, trying without delivery_date:", firstError);
        const { error: secondError } = await supabase.from('orders').update({
          status: updatedOrder.status,
          signature_url: updatedOrder.signatureUrl,
          total_amount: updatedOrder.totalAmount,
          paid_amount: updatedOrder.paidAmount
        }).eq('id', updatedOrder.id);
        
        if (secondError) throw secondError;
      }

      const nextOrders = orders.map(o => String(o.id) === String(updatedOrder.id) ? updatedOrder : o);
      setOrders(nextOrders);

      // Sincronizar automáticamente el saldo exacto de la cuenta corriente del cliente
      await syncCustomerBalance(updatedOrder.customerId, nextOrders, creditNotes);

      setIsSynced(true);
    } catch (err) {
      console.error("Error in updateOrder:", err);
      setIsSynced(true);
      throw err;
    }
  };

  const addGateEntry = async (entry: GateEntry) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      const { data: newGE, error: geError } = await supabase
        .from('gate_entries')
        .insert([{
          customer_id: entry.customerId,
          customer_name: entry.customerName,
          status: entry.status,
          items: entry.items,
          created_at: entry.createdAt
        }])
        .select().single();

      if (geError) throw geError;

      setGateEntries(prev => [{ ...entry, id: String(newGE.id) }, ...prev]);
      toast.success("Ingreso de mercadería registrado en Portería.");
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addGateEntry:", err);
      toast.error("Error al guardar ingreso de portería.");
      throw err;
    }
  };

  const updateGateEntry = async (entry: GateEntry) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      const { error } = await supabase
        .from('gate_entries')
        .update({
          status: entry.status,
          items: entry.items
        })
        .eq('id', entry.id);

      if (error) throw error;

      setGateEntries(prev => prev.map(ge => ge.id === entry.id ? entry : ge));
      setIsSynced(true);
    } catch (err) {
      console.error("Error in updateGateEntry:", err);
      toast.error("Error al actualizar ingreso de portería.");
      throw err;
    }
  };

  const restoreBackup = async (data: any) => {
    if (!data.orders || !data.products || !data.customers) {
      toast.error("El archivo de backup no es válido.");
      return;
    }

    if (!window.confirm("⚠️ ATENCIÓN: Está a punto de restaurar datos desde un archivo. Esto reemplazará la información actual en su sesión de navegador. ¿Desea continuar?")) {
      return;
    }

    try {
      setOrders(data.orders);
      setProducts(data.products);
      setCustomers(data.customers);
      if (data.gateEntries) setGateEntries(data.gateEntries);
      if (data.priceLists) setPriceLists(data.priceLists);
      toast.success("Backup restaurado localmente.");
    } catch (err) {
      console.error("Error al restaurar backup:", err);
      toast.error("Hubo un error al procesar el archivo.");
    }
  };

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10">
        <ToastContainer />
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="font-black uppercase tracking-[0.3em] text-sm animate-pulse">Sincronizando con Supabase...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ToastContainer />
        <Login onLogin={(user) => setCurrentUser(user)} setCustomers={setCustomers} />
      </>
    );
  }

  const displayOrders = currentUser.role === UserRole.DISTRIBUTOR 
    ? orders.filter(o => (currentUser.customerId && o.customerId === currentUser.customerId) || o.customerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    : orders;

  const displayCustomers = currentUser.role === UserRole.DISTRIBUTOR
    ? customers.filter(c => (currentUser.customerId && c.id === currentUser.customerId) || c.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    : customers;

  const pendingOrdersBadge = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const validatedOrdersBadge = orders.filter(o => o.status === OrderStatus.VALIDATED).length;

  return (
    <HashRouter>
      <ToastContainer />
      <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
        {/* Barra Superior Móvil */}
        <div className="md:hidden bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-600/30">C</div>
            <div>
              <span className="font-black text-white tracking-tighter text-base block leading-none">CHAZARRETA</span>
              <span className="text-[9px] font-bold text-blue-400 tracking-widest uppercase">{currentUser.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Backdrop Móvil */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <nav className={`${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-72 flex' : 'hidden md:flex'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} bg-[#0f172a] text-slate-400 flex-col shrink-0 border-r border-white/5 transition-all duration-300 relative`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-3 top-10 bg-blue-600 text-white w-6 h-6 rounded-full items-center justify-center shadow-lg z-50 hover:bg-blue-700 transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={`p-8 mb-2 ${isSidebarCollapsed ? 'px-4' : ''}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-lg shadow-blue-600/30">C</div>
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in duration-300">
                  <span className="font-black text-white tracking-tighter text-xl block leading-none">CHAZARRETA</span>
                  <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">ERP Industrial</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar" onClick={() => setIsMobileMenuOpen(false)}>
            {currentUser.role === UserRole.ADMIN && (
              <>
                {!isSidebarCollapsed && <p className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in fade-in">General</p>}
                <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Inicio" isCollapsed={isSidebarCollapsed} />
                <SidebarLink to="/orders" icon={<ClipboardList size={20} />} label="Registro Comandas" isCollapsed={isSidebarCollapsed} />
              </>
            )}
            
            {!isSidebarCollapsed && <p className="px-4 py-2 mt-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in fade-in">Módulos Operativos</p>}
            {(currentUser.role === UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/new-order" icon={<Store size={20} />} label="Portal Distribuidor" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.GATE || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/gate" icon={<Truck size={20} />} label="Portería y Cambios" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.ORDER_CENTER || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/center" icon={<Settings size={20} />} label="Centro de Pedidos" isCollapsed={isSidebarCollapsed} badge={pendingOrdersBadge} />}
            {(currentUser.role === UserRole.FACTORY || currentUser.role === UserRole.DISPATCH || currentUser.role === UserRole.ADMIN) && (
              <SidebarLink to="/logistics" icon={<Box size={20} />} label="Producción y Despacho" isCollapsed={isSidebarCollapsed} badge={validatedOrdersBadge} />
            )}
            {(currentUser.role === UserRole.COLLECTION || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/collection" icon={<BadgeDollarSign size={20} />} label="Caja y Cobranzas" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && <SidebarLink to="/reports" icon={<BarChart3 size={20} />} label="Reportes y Métricas" isCollapsed={isSidebarCollapsed} />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/users" icon={<UserCircle size={20} />} label="Usuarios y Accesos" isCollapsed={isSidebarCollapsed} />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/audit" icon={<Database size={20} />} label="Base de Datos Cloud" isCollapsed={isSidebarCollapsed} />}
          </div>

          <div className={`m-4 p-5 bg-slate-800/50 rounded-[2rem] border border-white/5 transition-all ${isSidebarCollapsed ? 'p-2 m-2 rounded-2xl' : ''}`}>
            <div className={`flex items-center space-x-3 mb-4 ${isSidebarCollapsed ? 'space-x-0 justify-center' : ''}`}>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-blue-400 border border-white/10 shrink-0 font-black text-sm uppercase">
                {currentUser.name.substring(0, 2)}
              </div>
              {!isSidebarCollapsed && (
                <div className="overflow-hidden animate-in fade-in">
                  <p className="text-xs font-black text-white truncate">{currentUser.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                       {isRealtimeLive ? 'Tiempo Real Activo' : isSynced ? 'Sincronizado' : 'Conectando...'}
                     </p>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setCurrentUser(null)} 
              className={`w-full flex items-center justify-center py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest ${isSidebarCollapsed ? 'px-2' : 'space-x-2'}`}
              title={isSidebarCollapsed ? "Cerrar Sesión" : ""}
            >
              <LogOut size={16} /> {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-auto bg-[#f8fafc]">
          {/* Barra de Estado Operativa Desktop */}
          <div className="hidden md:flex items-center justify-between px-10 py-3.5 bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                {currentUser.role}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${isRealtimeLive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                <Radio size={13} className={isRealtimeLive ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />
                {isRealtimeLive ? 'En Vivo' : 'Cloud Sync'}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest transition-all"
                title="Sincronizar datos ahora"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
                Actualizar
              </button>
            </div>
          </div>

          <div className={`p-5 md:p-10 ${isSidebarCollapsed ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
            {!dbReady && dbReady !== 'ERROR' && (
              <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4 text-amber-700">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-tight">Estructura SQL No Detectada</h3>
                    <p className="text-xs font-medium">Las tablas en Supabase no han sido creadas o no son visibles aún.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={fetchData} className="px-6 py-2.5 bg-white border border-amber-200 text-amber-700 font-black text-[10px] uppercase rounded-xl hover:bg-amber-100 transition-all flex items-center gap-2">
                    <RefreshCw size={14} /> Reintentar Detección
                  </button>
                  {currentUser.role === UserRole.ADMIN && (
                    <Link to="/audit" className="px-6 py-2.5 bg-amber-600 text-white font-black text-[10px] uppercase rounded-xl hover:bg-amber-700 transition-all">Ir a Configuración</Link>
                  )}
                </div>
              </div>
            )}

            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-blue-600" size={48} /></div>}>
                <Routes>
                  <Route path="/" element={
                    currentUser.role === UserRole.ADMIN 
                      ? <HomeDashboard role={currentUser.role} orders={displayOrders} customers={displayCustomers} isSynced={isSynced} dbReady={dbReady} />
                      : currentUser.role === UserRole.DISTRIBUTOR 
                        ? <Navigate to="/new-order" replace />
                        : currentUser.role === UserRole.GATE
                          ? <Navigate to="/gate" replace />
                          : currentUser.role === UserRole.ORDER_CENTER
                            ? <Navigate to="/center" replace />
                            : currentUser.role === UserRole.FACTORY || currentUser.role === UserRole.DISPATCH
                              ? <Navigate to="/logistics" replace />
                              : currentUser.role === UserRole.COLLECTION
                                ? <Navigate to="/collection" replace />
                                : <Navigate to="/new-order" replace />
                  } />
                  <Route path="/orders" element={
                    currentUser.role === UserRole.ADMIN 
                      ? <OrdersTable orders={displayOrders} role={currentUser.role} />
                      : <Navigate to="/" replace />
                  } />
                  
                  {currentUser.role === UserRole.ADMIN && (
                    <>
                      <Route path="/users" element={<UserManagement currentUser={currentUser} onRefresh={fetchData} customers={customers} />} />
                    </>
                  )}

                  {(currentUser.role === UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && (
                    <Route path="/new-order" element={<DistributorView addOrder={addOrder} customers={customers} products={products} orders={orders} gateEntries={gateEntries} currentUser={currentUser} />} />
                  )}

                  {(currentUser.role !== UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && (
                    <>
                      <Route path="/gate" element={<GateView gateEntries={gateEntries} addGateEntry={addGateEntry} customers={customers} products={products} />} />
                      <Route path="/center" element={<OrderCenterView orders={orders} updateOrder={updateOrder} addOrder={addOrder} products={products} customers={customers} gateEntries={gateEntries} updateGateEntry={updateGateEntry} priceLists={priceLists} onRefresh={fetchData} currentUser={currentUser} addCreditNote={addCreditNote} creditNotes={creditNotes} />} />
                      <Route path="/logistics" element={<LogisticsView orders={orders} updateOrder={updateOrder} products={products} gateEntries={gateEntries} updateGateEntry={updateGateEntry} customers={customers} currentUser={currentUser} />} />
                      <Route path="/collection" element={<CollectionView orders={orders} updateOrder={updateOrder} customers={customers} setCustomers={setCustomers} currentUser={currentUser} creditNotes={creditNotes} products={products} />} />
                      {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                        <>
                          {currentUser.role === UserRole.ADMIN && <Route path="/audit" element={<AdminDashboard logs={auditLogs} onRefresh={fetchData} dbReady={dbReady} orders={orders} />} />}
                          <Route path="/reports" element={<ReportsView orders={orders} products={products} customers={customers} gateEntries={gateEntries} priceLists={priceLists} onRestore={restoreBackup} />} />
                        </>
                      )}
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

const SidebarLink: React.FC<{to: string, icon: React.ReactNode, label: string, isCollapsed: boolean, badge?: number}> = ({ to, icon, label, isCollapsed, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`relative flex items-center justify-between px-4 py-3 rounded-2xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${isCollapsed ? 'justify-center px-2' : ''}`}
      title={isCollapsed ? label : ""}
    >
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} min-w-0`}>
        <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} shrink-0`}>{icon}</span>
        {!isCollapsed && <span className="text-xs font-black uppercase tracking-tight truncate animate-in fade-in duration-300">{label}</span>}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className={`${isCollapsed ? 'absolute -top-1 -right-1 w-4 h-4 text-[9px]' : 'px-2 py-0.5 text-[10px]'} rounded-full font-black flex items-center justify-center ${isActive ? 'bg-white text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
          {badge}
        </span>
      )}
    </Link>
  );
};

const HomeDashboard: React.FC<{role: UserRole, orders: Order[], customers: Customer[], isSynced: boolean, dbReady: boolean | 'ERROR'}> = ({ role, orders, customers, isSynced, dbReady }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Panel Principal</h1>
          <p className="text-slate-500 font-medium">Operando modo <span className="text-blue-600 font-bold uppercase">{role}</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {role !== UserRole.FACTORY && role !== UserRole.DISPATCH && (
          <StatsCard 
            title={role === UserRole.DISTRIBUTOR ? "Mi Saldo" : "Saldo Global"} 
            value={`$${customers.reduce((acc, c) => acc + c.balance, 0).toLocaleString()}`} 
            subtitle={role === UserRole.DISTRIBUTOR ? "Cuenta Corriente" : "Cuentas Corrientes"} 
            icon={<BadgeDollarSign size={24}/>} 
            color="blue" 
          />
        )}
        <StatsCard title={role === UserRole.DISTRIBUTOR ? "Mis Pedidos" : "Órdenes Activas"} value={orders.length.toString()} subtitle={role === UserRole.DISTRIBUTOR ? "Historial de carga" : "Cola de producción"} icon={<ClipboardList size={24}/>} color="purple" />
        <StatsCard title="Estado Cloud" value={dbReady === true ? "ACTIVO" : (dbReady === false ? "DESCONECTADO" : "ERROR")} subtitle="Sync Supabase" icon={<CheckCircle2 size={24}/>} color={dbReady === true ? "emerald" : (dbReady === false ? "amber" : "red")} />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 font-black uppercase text-xs tracking-widest text-slate-800">
          {role === UserRole.DISTRIBUTOR ? "Mis Últimos Movimientos" : "Últimos Movimientos Cloud"}
        </div>
        <div className="divide-y divide-slate-100">
          {orders.slice(0, 8).map(order => (
            <div key={order.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/80 transition-all group">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 uppercase text-xs">{order.customerName}</p>
                  <p className="text-[10px] text-slate-400 font-bold">#ORD-{order.id.toString().substr(0, 6).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                {role !== UserRole.FACTORY && role !== UserRole.DISPATCH && (
                  <p className="font-black text-slate-900 tracking-tighter text-sm">${order.totalAmount.toLocaleString()}</p>
                )}
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="p-24 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                <Database size={40} />
              </div>
              <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Esperando sincronización de datos...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{title: string, value: string, subtitle: string, icon: React.ReactNode, color: string}> = ({ title, value, subtitle, icon, color }) => {
  const colors: {[key: string]: string} = { blue: 'text-blue-600 bg-blue-50', purple: 'text-purple-600 bg-purple-50', emerald: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', amber: 'text-amber-600 bg-amber-50' };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:scale-[1.02]">
      <div className={`w-14 h-14 ${colors[color]} rounded-2xl flex items-center justify-center mb-6`}>{icon}</div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{value}</h3>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{subtitle}</p>
    </div>
  );
};

const OrderStatusBadge: React.FC<{status: OrderStatus}> = ({ status }) => {
  const styles = { [OrderStatus.PENDING]: 'bg-amber-100 text-amber-700 border-amber-200', [OrderStatus.VALIDATED]: 'bg-blue-100 text-blue-700 border-blue-200', [OrderStatus.DISPATCHED]: 'bg-purple-100 text-purple-700 border-purple-200', [OrderStatus.PAID_PARTIAL]: 'bg-cyan-100 text-cyan-700 border-cyan-200', [OrderStatus.PAID_FULL]: 'bg-emerald-100 text-emerald-700 border-emerald-200', [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200' };
  return <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${styles[status]}`}>{OrderStatusLabels[status]}</span>;
};

const OrdersTable: React.FC<{orders: Order[], role: UserRole}> = ({ orders, role }) => {
  const showAmount = role !== UserRole.FACTORY && role !== UserRole.DISPATCH;
  
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase tracking-tight">Registro General Cloud</h1>
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-8 py-5">ID</th>
              <th className="px-8 py-5">Cliente</th>
              {showAmount && <th className="px-8 py-5">Importe</th>}
              <th className="px-8 py-5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5 font-mono text-[10px] font-bold text-slate-400">#{order.id.toString().substr(0, 8).toUpperCase()}</td>
                <td className="px-8 py-5 font-black text-slate-800 uppercase text-xs">{order.customerName}</td>
                {showAmount && <td className="px-8 py-5 font-black text-slate-900 tracking-tighter text-sm">${order.totalAmount.toLocaleString()}</td>}
                <td className="px-8 py-5"><OrderStatusBadge status={order.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Login: React.FC<{
  onLogin: (user: CurrentUser) => void,
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
}> = ({ onLogin, setCustomers }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [cuit, setCuit] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.DISTRIBUTOR);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const passwordHash = password ? await hashPassword(password) : '';

      // Fetch users from Supabase
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*');

      if (fetchError) {
        console.error("Error fetching users:", fetchError);
        // Fallback to localStorage if table doesn't exist yet (for initial setup)
        const storedUsersStr = localStorage.getItem('erp_users');
        let localUsers: AppUser[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
        
        if (isRegistering) {
          if (localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
            setError('El correo ya está registrado.');
            return;
          }
          
          const newUser: AppUser = {
            id: Math.random().toString(36).substr(2, 9),
            email: email.trim().toLowerCase(),
            name: username || 'Usuario',
            role: localUsers.length === 0 ? UserRole.ADMIN : role,
            isApproved: localUsers.length === 0, // First user is admin and approved
            createdAt: new Date().toISOString(),
            passwordHash
          };

          localUsers.push(newUser);
          localStorage.setItem('erp_users', JSON.stringify(localUsers));
          
          if (newUser.isApproved) {
            onLogin({ id: newUser.id, name: newUser.name, role: newUser.role, email: newUser.email });
          } else {
            setSuccess('Cuenta creada localmente. Espere aprobación.');
            setIsRegistering(false);
          }
        } else {
          const user = localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
          if (!user) { setError('Usuario no encontrado.'); return; }
          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) { setError('Contraseña incorrecta.'); return; }
          if (!user.isApproved) { setError('Cuenta no aprobada.'); return; }
          onLogin({ id: user.id, name: user.name, role: user.role, email: user.email, customerId: user.customerId });
        }
        return;
      }

      if (isRegistering) {
        const normalizedEmail = email.trim().toLowerCase();
        if (users?.find(u => u.email.toLowerCase() === normalizedEmail)) {
          setError('El correo ya está registrado.');
          return;
        }
        
        const assignedRole = users?.length === 0 ? UserRole.ADMIN : role;
        const isFirstUser = users?.length === 0;

        const baseUserPayload: Record<string, any> = {
          email: normalizedEmail,
          name: (username || 'Usuario').trim(),
          role: assignedRole,
          is_approved: isFirstUser,
          created_at: new Date().toISOString()
        };

        const extendedUserPayload: Record<string, any> = {
          ...baseUserPayload,
          phone: phone.trim() || null,
          address: address.trim() || null,
          cuit: cuit.trim() || null,
          password_hash: passwordHash
        };

        let { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert([extendedUserPayload])
          .select()
          .single();

        if (insertError) {
          // Fallback si la tabla users aún no tiene las columnas extendidas
          const fallbackInsert = await supabase
            .from('users')
            .insert([baseUserPayload])
            .select()
            .single();
          insertedUser = fallbackInsert.data;
          insertError = fallbackInsert.error;
        }

        if (insertError || !insertedUser) throw insertError;
        
        let linkedCustomerId: string | undefined = insertedUser.customer_id;

        // If approved and distributor, ensure customer exists
        if (insertedUser.is_approved && insertedUser.role === UserRole.DISTRIBUTOR) {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('name', insertedUser.name)
            .maybeSingle();

          if (!existingCust) {
            const newCustomer: Customer = {
              id: `c_${Date.now()}`,
              name: insertedUser.name,
              phone: insertedUser.phone || phone.trim(),
              address: insertedUser.address || address.trim(),
              cuit: insertedUser.cuit || cuit.trim(),
              priceListId: 'l1',
              balance: 0,
              isBlocked: false,
              groupId: ''
            };
            await supabase.from('customers').insert({
              id: newCustomer.id,
              name: newCustomer.name,
              phone: newCustomer.phone,
              address: newCustomer.address,
              cuit: newCustomer.cuit,
              price_list_id: newCustomer.priceListId,
              balance: newCustomer.balance,
              is_blocked: newCustomer.isBlocked
            });
            linkedCustomerId = newCustomer.id;
            await supabase.from('users').update({ customer_id: newCustomer.id }).eq('id', insertedUser.id);
            setCustomers(prev => [...prev, newCustomer]);
          } else {
            linkedCustomerId = existingCust.id;
          }
        }
        
        if (insertedUser.is_approved) {
          onLogin({
            id: insertedUser.id,
            name: insertedUser.name,
            role: insertedUser.role,
            email: insertedUser.email,
            customerId: linkedCustomerId
          });
        } else {
          setSuccess('Cuenta creada. Espere a que un administrador apruebe su acceso.');
          setIsRegistering(false);
          setPassword('');
        }
      } else {
        // Login
        const normalizedEmail = email.trim().toLowerCase();
        const user = users?.find(u => u.email.toLowerCase() === normalizedEmail);
        if (!user) {
          setError('Usuario no encontrado. Verifique su correo.');
          return;
        }

        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
          setError('Contraseña incorrecta. Verifique sus credenciales.');
          return;
        }

        if (!user.is_approved) {
          setError('Su cuenta aún no ha sido aprobada por un administrador.');
          return;
        }

        // Si el usuario heredado aún no tenía password_hash guardado, lo guardamos automáticamente
        if (!user.password_hash && passwordHash) {
          supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', user.id)
            .then(() => {});
        }

        // Normalizar rol si viene de SQL manual como 'ADMIN'
        let userRole = user.role;
        if (userRole === 'ADMIN') userRole = UserRole.ADMIN;
        
        onLogin({
          id: user.id,
          name: user.name,
          role: userRole,
          email: user.email,
          customerId: user.customer_id
        });
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError('Error de conexión con la base de datos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 border border-white/20">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 transform rotate-3">
            <Warehouse size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2 uppercase">CHAZARRETA <span className="text-blue-600">ERP</span></h1>
          <p className="text-slate-500 font-medium">{isRegistering ? 'Cree su cuenta de acceso' : 'Inicie sesión para continuar'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl text-xs font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Correo Electrónico</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
              placeholder="ejemplo@correo.com"
            />
          </div>

          {isRegistering && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Nombre de Usuario / Sucursal *</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                  placeholder="Nombre para facturación"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Teléfono *</label>
                <input 
                  type="text" 
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                  placeholder="Ej: 11 1234 5678"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Dirección</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                  placeholder="Ej: Calle 123"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">CUIT</label>
                <input 
                  type="text" 
                  value={cuit}
                  onChange={e => setCuit(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                  placeholder="Ej: 20-12345678-9"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
              placeholder="••••••••"
            />
          </div>

          {isRegistering && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Puesto de Trabajo Solicitado</label>
              <select 
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all appearance-none"
              >
                <option value={UserRole.DISTRIBUTOR}>Distribuidor / Sucursal</option>
                <option value={UserRole.GATE}>Portería</option>
                <option value={UserRole.ORDER_CENTER}>Centro de Pedidos</option>
                <option value={UserRole.FACTORY}>Producción</option>
                <option value={UserRole.DISPATCH}>Despacho</option>
                <option value={UserRole.COLLECTION}>Cobranza</option>
                <option value={UserRole.MANAGER}>Gerente / Dirección</option>
                <option value={UserRole.ADMIN}>Administrador</option>
              </select>
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 mt-4"
          >
            {isRegistering ? 'Solicitar Acceso' : 'Entrar al Sistema'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-4">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccess('');
            }}
            className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-blue-600 transition-colors block w-full"
          >
            {isRegistering ? '¿Ya tiene cuenta? Inicie sesión' : '¿No tiene cuenta? Regístrese aquí'}
          </button>
          
          {!isSupabaseConfigured() && (
            <Link 
              to="/audit" 
              onClick={() => {
                // Bypass login for setup if not configured
                onLogin({ name: 'Configurador', role: UserRole.ADMIN, email: 'setup@system.com' });
              }}
              className="text-amber-500 font-black uppercase text-[10px] tracking-widest hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <Database size={14} /> Configurar Base de Datos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

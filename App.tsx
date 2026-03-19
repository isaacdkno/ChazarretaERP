
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
  Loader2
} from 'lucide-react';

import { UserRole, Order, Customer, OrderStatus, GateEntry, AuditLog, Product, PriceList, OrderStatusLabels, CreditNote, CreditNoteItem, AppUser } from './types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getOrders, getCreditNotes, getGateEntries } from './services/supabaseService';
import ErrorBoundary from './components/ErrorBoundary';

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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{name: string, role: UserRole, email?: string} | null>(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      // 1. Verificar si la tabla existe (Test de conexión)
      // Usamos limit(0) para que sea una consulta súper liviana solo para verificar existencia
      const { data: custs, error: custError } = await supabase.from('customers').select('*').limit(100);
      const { error: userTableError } = await supabase.from('users').select('*').limit(1);
      
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
      
      // 0. Listas de Precios
      const { data: lists } = await supabase.from('price_lists').select('*');
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
          balance: c.balance,
          isBlocked: c.is_blocked,
          creditLimit: c.credit_limit,
          address: c.address,
          phone: c.phone,
          cuit: c.cuit
        })));
      }

      // 2. Productos y sus precios
      const { data: prods } = await supabase.from('products').select('*');
      const { data: prices } = await supabase.from('product_prices').select('*');
      
      if (prods) {
        const formattedProducts = prods.map(p => {
          const productPrices: {[id: string]: number} = {};
          prices?.filter(pr => pr.product_id === p.id).forEach(pr => {
            productPrices[pr.price_list_id] = pr.price;
          });
          return {
            id: p.id,
            name: p.name,
            brand: p.brand as 'La Fornarina' | 'Villecco',
            category: p.category,
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
  }, []);

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

      // Only add these if they are present to avoid errors with older schemas
      if (order.deliveryDate !== undefined) orderData.delivery_date = order.deliveryDate;
      if (order.isCorrection !== undefined) orderData.is_correction = order.isCorrection;
      if (order.replacedOrderId !== undefined) orderData.replaced_order_id = order.replacedOrderId;

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select().single();

      if (orderError) throw orderError;

      // If order is created as DISPATCHED (e.g. correction), increase customer balance
      if (order.status === OrderStatus.DISPATCHED) {
        const customer = customers.find(c => c.id === order.customerId);
        if (customer) {
          const newBalance = (customer.balance || 0) + order.totalAmount;
          const { error: balanceError } = await supabase.from('customers').update({ balance: newBalance }).eq('id', customer.id);
          if (balanceError) throw balanceError;
          setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, balance: newBalance } : c));
        }
      }

      const itemsToInsert = order.items.map(item => ({
        order_id: newOrder.id,
        product_id: item.productId,
        quantity: item.quantity,
        bonus_quantity: item.bonusQuantity,
        unit_price: item.unitPrice
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setOrders(prev => [{ ...order, id: String(newOrder.id) }, ...prev]);
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addOrder:", err);
      alert("Error al guardar pedido en la nube.");
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

      // Update customer balance (Credit note decreases balance)
      const customer = customers.find(c => c.id === creditNote.customerId);
      if (customer) {
        const newBalance = (customer.balance || 0) - creditNote.totalAmount;
        const { error: balanceError } = await supabase.from('customers').update({ balance: newBalance }).eq('id', customer.id);
        if (balanceError) throw balanceError;
        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, balance: newBalance } : c));
      }

      setCreditNotes(prev => [{ ...creditNote, id: newCN.id }, ...prev]);
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addCreditNote:", err);
      alert("Error al guardar nota de crédito.");
      throw err;
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      const oldOrder = orders.find(o => String(o.id) === String(updatedOrder.id));
      
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

      // Balance Logic (only if update succeeded)
      if (oldOrder) {
        const customer = customers.find(c => c.id === updatedOrder.customerId);
        if (customer) {
          let balanceDelta = 0;
          if ((oldOrder.status === OrderStatus.PENDING || oldOrder.status === OrderStatus.CANCELLED) && updatedOrder.status === OrderStatus.DISPATCHED) {
            balanceDelta = updatedOrder.totalAmount;
          } else if (oldOrder.status === OrderStatus.DISPATCHED && updatedOrder.status === OrderStatus.CANCELLED) {
            balanceDelta = -oldOrder.totalAmount;
          } else if (oldOrder.status === OrderStatus.DISPATCHED && updatedOrder.status === OrderStatus.DISPATCHED && oldOrder.totalAmount !== updatedOrder.totalAmount) {
            balanceDelta = updatedOrder.totalAmount - oldOrder.totalAmount;
          }

          if (balanceDelta !== 0) {
            const newBalance = (customer.balance || 0) + balanceDelta;
            await supabase.from('customers').update({ balance: newBalance }).eq('id', customer.id);
            setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, balance: newBalance } : c));
          }
        }
      }

      setOrders(prev => prev.map(o => String(o.id) === String(updatedOrder.id) ? updatedOrder : o));
      setIsSynced(true);
    } catch (err) {
      console.error("Error in updateOrder:", err);
      setIsSynced(true); // Reset sync state even on error to allow further actions
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
      setIsSynced(true);
    } catch (err) {
      console.error("Error in addGateEntry:", err);
      alert("Error al guardar ingreso de portería.");
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
      alert("Error al actualizar ingreso de portería.");
      throw err;
    }
  };

  const restoreBackup = async (data: any) => {
    // Basic validation
    if (!data.orders || !data.products || !data.customers) {
      alert("El archivo de backup no es válido.");
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
      
      // Note: In a production environment, we would also need to sync this back to Supabase.
      // For this version, we restore the local state to allow immediate consultation.
      console.log("Backup restaurado localmente.");
    } catch (err) {
      console.error("Error al restaurar backup:", err);
      alert("Hubo un error al procesar el archivo.");
    }
  };

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="font-black uppercase tracking-[0.3em] text-sm animate-pulse">Sincronizando con Supabase...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(user) => setCurrentUser(user)} setCustomers={setCustomers} />;
  }

  const displayOrders = currentUser.role === UserRole.DISTRIBUTOR 
    ? orders.filter(o => o.customerName.toLowerCase() === currentUser.name.toLowerCase())
    : orders;

  const displayCustomers = currentUser.role === UserRole.DISTRIBUTOR
    ? customers.filter(c => c.name.toLowerCase() === currentUser.name.toLowerCase())
    : customers;

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
        <nav className={`${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} w-full bg-[#0f172a] text-slate-400 flex flex-col shrink-0 border-r border-white/5 transition-all duration-300 relative`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-10 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-50 hover:bg-blue-700 transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={`p-8 mb-4 ${isSidebarCollapsed ? 'px-4' : ''}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0">C</div>
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in duration-300">
                  <span className="font-black text-white tracking-tighter text-xl block leading-none">CHAZARRETA</span>
                  <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Management System</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden">
            {currentUser.role === UserRole.ADMIN && (
              <>
                {!isSidebarCollapsed && <p className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in fade-in">General</p>}
                <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Inicio" isCollapsed={isSidebarCollapsed} />
                <SidebarLink to="/orders" icon={<ClipboardList size={20} />} label="Registro Comandas" isCollapsed={isSidebarCollapsed} />
              </>
            )}
            
            {!isSidebarCollapsed && <p className="px-4 py-2 mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-in fade-in">Tu Módulo</p>}
            {(currentUser.role === UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/new-order" icon={<LayoutDashboard size={20} />} label="Panel Distribuidor" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.GATE || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/gate" icon={<Truck size={20} />} label="Portería" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.ORDER_CENTER || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/center" icon={<Settings size={20} />} label="Gestión de Pedidos" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.FACTORY || currentUser.role === UserRole.DISPATCH || currentUser.role === UserRole.ADMIN) && (
              <SidebarLink to="/logistics" icon={<Box size={20} />} label="Logística (Prod/Despacho)" isCollapsed={isSidebarCollapsed} />
            )}
            {(currentUser.role === UserRole.COLLECTION || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/collection" icon={<BadgeDollarSign size={20} />} label="Caja y Cobranza" isCollapsed={isSidebarCollapsed} />}
            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && <SidebarLink to="/reports" icon={<BarChart3 size={20} />} label="Informes y Dashboards" isCollapsed={isSidebarCollapsed} />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/users" icon={<UserCircle size={20} />} label="Gestión de Usuarios" isCollapsed={isSidebarCollapsed} />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/audit" icon={<Github size={20} />} label="Sincronización Cloud" isCollapsed={isSidebarCollapsed} />}
          </div>

          <div className={`m-4 p-5 bg-slate-800/40 rounded-[2rem] border border-white/5 transition-all ${isSidebarCollapsed ? 'p-2 m-2 rounded-2xl' : ''}`}>
            <div className={`flex items-center space-x-3 mb-4 ${isSidebarCollapsed ? 'space-x-0 justify-center' : ''}`}>
              <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-blue-400 border border-white/5 shrink-0">
                <UserCircle size={24} />
              </div>
              {!isSidebarCollapsed && (
                <div className="overflow-hidden animate-in fade-in">
                  <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                  <div className="flex items-center gap-1.5">
                     <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                     <p className="text-[9px] font-bold text-slate-500 uppercase">{isSynced ? 'Conectado' : 'Sin Datos'}</p>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setCurrentUser(null)} 
              className={`w-full flex items-center justify-center py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest ${isSidebarCollapsed ? 'px-2' : 'space-x-2'}`}
              title={isSidebarCollapsed ? "Salir" : ""}
            >
              <LogOut size={16} /> {!isSidebarCollapsed && <span>Salir</span>}
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-auto bg-[#f8fafc]">
          <div className={`p-6 md:p-10 ${isSidebarCollapsed ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
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
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-blue-600" size={48} /></div>}>
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

const SidebarLink: React.FC<{to: string, icon: React.ReactNode, label: string, isCollapsed: boolean}> = ({ to, icon, label, isCollapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center px-4 py-3 rounded-2xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${isCollapsed ? 'justify-center px-2' : 'space-x-3'}`}
      title={isCollapsed ? label : ""}
    >
      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-500'} shrink-0`}>{icon}</span>
      {!isCollapsed && <span className="text-xs font-black uppercase tracking-tight truncate animate-in fade-in duration-300">{label}</span>}
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
  onLogin: (user: {name: string, role: UserRole, email: string}) => void,
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
          if (localUsers.find(u => u.email === email)) {
            setError('El correo ya está registrado.');
            return;
          }
          
          const newUser: AppUser = {
            id: Math.random().toString(36).substr(2, 9),
            email,
            name: username || 'Usuario',
            role,
            isApproved: localUsers.length === 0, // First user is admin and approved
            createdAt: new Date().toISOString()
          };
          
          if (localUsers.length === 0) newUser.role = UserRole.ADMIN;

          localUsers.push(newUser);
          localStorage.setItem('erp_users', JSON.stringify(localUsers));
          
          if (newUser.isApproved) {
            onLogin({ name: newUser.name, role: newUser.role, email: newUser.email });
          } else {
            setSuccess('Cuenta creada localmente. Espere aprobación.');
            setIsRegistering(false);
          }
        } else {
          const user = localUsers.find(u => u.email === email);
          if (!user) { setError('Usuario no encontrado.'); return; }
          if (!user.isApproved) { setError('Cuenta no aprobada.'); return; }
          onLogin({ name: user.name, role: user.role, email: user.email });
        }
        return;
      }

      if (isRegistering) {
        const normalizedEmail = email.trim().toLowerCase();
        if (users?.find(u => u.email.toLowerCase() === normalizedEmail)) {
          setError('El correo ya está registrado.');
          return;
        }
        
        const newUser = {
          email: normalizedEmail,
          name: username || 'Usuario',
          phone: phone,
          address: address,
          cuit: cuit,
          role,
          is_approved: users?.length === 0,
          created_at: new Date().toISOString()
        };
        
        if (users?.length === 0) newUser.role = UserRole.ADMIN;

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (insertError) throw insertError;
        
        // If approved and distributor, ensure customer exists
        if (insertedUser.is_approved && insertedUser.role === UserRole.DISTRIBUTOR) {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('name', insertedUser.name)
            .single();

          if (!existingCust) {
            const newCustomer = {
              id: `c_${Date.now()}`,
              name: insertedUser.name,
              phone: insertedUser.phone,
              address: insertedUser.address,
              cuit: insertedUser.cuit,
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
            setCustomers(prev => [...prev, newCustomer]);
          }
        }
        
        if (insertedUser.is_approved) {
          onLogin({ name: insertedUser.name, role: insertedUser.role, email: insertedUser.email });
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
        if (!user.is_approved) {
          setError('Su cuenta aún no ha sido aprobada por un administrador.');
          return;
        }

        // Normalizar rol si viene de SQL manual como 'ADMIN'
        let userRole = user.role;
        if (userRole === 'ADMIN') userRole = UserRole.ADMIN;
        
        onLogin({ name: user.name, role: userRole, email: user.email });
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

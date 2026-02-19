
import React, { useState, useEffect } from 'react';
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
  Plus,
  CheckCircle2,
  LayoutDashboard,
  Box,
  Github,
  AlertCircle,
  RefreshCw,
  Database
} from 'lucide-react';

import { UserRole, Order, Customer, OrderStatus, GateEntry, AuditLog, Product } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

import DistributorView from './components/DistributorView';
import GateView from './components/GateView';
import OrderCenterView from './components/OrderCenterView';
import FactoryView from './components/FactoryView';
import DispatchView from './components/DispatchView';
import CollectionView from './components/CollectionView';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{name: string, role: UserRole} | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
      
      if (custError) {
        console.warn("DB Error:", custError);
        // El código 42P01 significa que la tabla no existe en Postgres
        if (custError.code === '42P01') { 
          setDbReady(false);
        } else {
          setDbReady('ERROR');
        }
        setIsSynced(false);
        setLoading(false);
        return;
      }

      setDbReady(true);
      if (custs) {
        setCustomers(custs.map(c => ({
          id: c.id,
          name: c.name,
          groupId: '', 
          priceListId: c.price_list_id,
          balance: c.balance,
          isBlocked: c.is_blocked
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
            prices: productPrices
          };
        });
        setProducts(formattedProducts);
      }

      // 3. Órdenes con items
      const { data: ords } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      
      if (ords) {
        const formattedOrders: Order[] = ords.map(o => ({
          id: o.id,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Desconocido',
          status: o.status as OrderStatus,
          totalAmount: o.total_amount,
          createdAt: o.created_at,
          signatureUrl: o.signature_url,
          items: (o.order_items || []).map((i: any) => ({
            id: i.id,
            productId: i.product_id,
            quantity: i.quantity,
            bonusQuantity: i.bonus_quantity,
            unitPrice: i.unit_price
          }))
        }));
        setOrders(formattedOrders);
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
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: order.customerId,
          customer_name: order.customerName,
          status: order.status,
          total_amount: order.totalAmount,
          created_at: order.createdAt
        }])
        .select().single();

      if (orderError) throw orderError;

      const itemsToInsert = order.items.map(item => ({
        order_id: newOrder.id,
        product_id: item.productId,
        quantity: item.quantity,
        bonus_quantity: item.bonusQuantity,
        unit_price: item.unitPrice
      }));

      await supabase.from('order_items').insert(itemsToInsert);
      setOrders(prev => [{ ...order, id: newOrder.id }, ...prev]);
      setIsSynced(true);
    } catch (err) {
      console.error(err);
      alert("Error al guardar pedido en la nube.");
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    if (!isSupabaseConfigured()) return;
    setIsSynced(false);
    try {
      await supabase.from('orders').update({
        status: updatedOrder.status,
        signature_url: updatedOrder.signatureUrl,
        total_amount: updatedOrder.totalAmount
      }).eq('id', updatedOrder.id);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setIsSynced(true);
    } catch (err) {
      console.error(err);
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
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900">
        <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 border border-white/20">
          <div className="text-center mb-10">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 transform rotate-3">
              <Warehouse size={40} />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2 uppercase">CHAZARRETA <span className="text-blue-600">ERP</span></h1>
            <p className="text-slate-500 font-medium">Seleccione su puesto de trabajo</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {[
              { role: UserRole.DISTRIBUTOR, label: 'Distribuidor / Sucursal', desc: 'Pedidos y Cuenta Corriente', color: 'bg-blue-50 text-blue-600' },
              { role: UserRole.GATE, label: 'Portería', desc: 'Cambios y Vencidos', color: 'bg-emerald-50 text-emerald-600' },
              { role: UserRole.ORDER_CENTER, label: 'Centro de Pedidos', desc: 'Validación y Precios', color: 'bg-purple-50 text-purple-600' },
              { role: UserRole.FACTORY, label: 'Producción', desc: 'Consolidado de Fábrica', color: 'bg-orange-50 text-orange-600' },
              { role: UserRole.DISPATCH, label: 'Despacho', desc: 'Logística y Hoja de Ruta', color: 'bg-indigo-50 text-indigo-600' },
              { role: UserRole.COLLECTION, label: 'Cobranza', desc: 'Tesorería y Créditos', color: 'bg-cyan-50 text-cyan-600' },
              { role: UserRole.ADMIN, label: 'Administrador', desc: 'Auditoría y Config DB', color: 'bg-slate-100 text-slate-700' },
            ].map(item => (
              <button
                key={item.role}
                onClick={() => setCurrentUser({ name: 'Operador Chazarreta', role: item.role })}
                className="flex items-center p-5 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all group text-left"
              >
                <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform`}>
                  {item.role === UserRole.DISTRIBUTOR && <Store size={22}/>}
                  {item.role === UserRole.GATE && <Truck size={22}/>}
                  {item.role === UserRole.ORDER_CENTER && <ClipboardList size={22}/>}
                  {item.role === UserRole.FACTORY && <Warehouse size={22}/>}
                  {item.role === UserRole.DISPATCH && <Truck size={22}/>}
                  {item.role === UserRole.COLLECTION && <BadgeDollarSign size={22}/>}
                  {item.role === UserRole.ADMIN && <Settings size={22}/>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors uppercase text-sm tracking-tight">{item.label}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.desc}</p>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
        <nav className="w-full md:w-72 bg-[#0f172a] text-slate-400 flex flex-col shrink-0 border-r border-white/5">
          <div className="p-8 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">C</div>
              <div>
                <span className="font-black text-white tracking-tighter text-xl block leading-none">CHAZARRETA</span>
                <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Management System</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 px-4 space-y-1">
            <p className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">General</p>
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Inicio" />
            <SidebarLink to="/orders" icon={<ClipboardList size={20} />} label="Registro Comandas" />
            
            <p className="px-4 py-2 mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tu Módulo</p>
            {currentUser.role === UserRole.DISTRIBUTOR && <SidebarLink to="/new-order" icon={<Plus size={20} />} label="Cargar Pedido" />}
            {currentUser.role === UserRole.GATE && <SidebarLink to="/gate" icon={<Truck size={20} />} label="Portería" />}
            {currentUser.role === UserRole.ORDER_CENTER && <SidebarLink to="/center" icon={<Settings size={20} />} label="Gestión de Pedidos" />}
            {currentUser.role === UserRole.FACTORY && <SidebarLink to="/factory" icon={<Box size={20} />} label="Producción" />}
            {currentUser.role === UserRole.DISPATCH && <SidebarLink to="/dispatch" icon={<Truck size={20} />} label="Hoja de Ruta" />}
            {currentUser.role === UserRole.COLLECTION && <SidebarLink to="/collection" icon={<BadgeDollarSign size={20} />} label="Caja y Cobranza" />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/audit" icon={<Github size={20} />} label="Sincronización Cloud" />}
          </div>

          <div className="m-4 p-5 bg-slate-800/40 rounded-[2rem] border border-white/5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-blue-400 border border-white/5">
                <UserCircle size={24} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{currentUser.role}</p>
                <div className="flex items-center gap-1.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                   <p className="text-[9px] font-bold text-slate-500 uppercase">{isSynced ? 'Conectado' : 'Sin Datos'}</p>
                </div>
              </div>
            </div>
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
              <LogOut size={16} /> <span>Salir</span>
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-auto bg-[#f8fafc]">
          <div className="p-6 md:p-10 max-w-7xl mx-auto">
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

            <Routes>
              <Route path="/" element={<HomeDashboard role={currentUser.role} orders={orders} customers={customers} isSynced={isSynced} dbReady={dbReady} />} />
              <Route path="/orders" element={<OrdersTable orders={orders} />} />
              <Route path="/new-order" element={<DistributorView addOrder={addOrder} customers={customers} products={products} />} />
              <Route path="/gate" element={<GateView gateEntries={gateEntries} setGateEntries={setGateEntries} customers={customers} products={products} />} />
              <Route path="/center" element={<OrderCenterView orders={orders} updateOrder={updateOrder} addOrder={addOrder} products={products} customers={customers} />} />
              <Route path="/factory" element={<FactoryView orders={orders} />} />
              <Route path="/dispatch" element={<DispatchView orders={orders} updateOrder={updateOrder} />} />
              <Route path="/collection" element={<CollectionView orders={orders} updateOrder={updateOrder} customers={customers} setCustomers={setCustomers} />} />
              <Route path="/audit" element={<AdminDashboard logs={auditLogs} onRefresh={fetchData} dbReady={dbReady} orders={orders} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

const SidebarLink: React.FC<{to: string, icon: React.ReactNode, label: string}> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-500'}`}>{icon}</span>
      <span className="text-xs font-black uppercase tracking-tight">{label}</span>
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
        <StatsCard title="Saldo Global" value={`$${customers.reduce((acc, c) => acc + c.balance, 0).toLocaleString()}`} subtitle="Cuentas Corrientes" icon={<BadgeDollarSign size={24}/>} color="blue" />
        <StatsCard title="Órdenes Activas" value={orders.length.toString()} subtitle="Cola de producción" icon={<ClipboardList size={24}/>} color="purple" />
        <StatsCard title="Estado Cloud" value={dbReady === true ? "ACTIVO" : (dbReady === false ? "DESCONECTADO" : "ERROR")} subtitle="Sync Supabase" icon={<CheckCircle2 size={24}/>} color={dbReady === true ? "emerald" : (dbReady === false ? "amber" : "red")} />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 font-black uppercase text-xs tracking-widest text-slate-800">
          Últimos Movimientos Cloud
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
                <p className="font-black text-slate-900 tracking-tighter text-sm">${order.totalAmount.toLocaleString()}</p>
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
  return <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${styles[status]}`}>{status}</span>;
};

const OrdersTable: React.FC<{orders: Order[]}> = ({ orders }) => (
  <div className="space-y-6 animate-in slide-in-from-bottom-4">
    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase tracking-tight">Registro General Cloud</h1>
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <tr>
            <th className="px-8 py-5">ID</th>
            <th className="px-8 py-5">Cliente</th>
            <th className="px-8 py-5">Importe</th>
            <th className="px-8 py-5">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {orders.map(order => (
            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-8 py-5 font-mono text-[10px] font-bold text-slate-400">#{order.id.toString().substr(0, 8).toUpperCase()}</td>
              <td className="px-8 py-5 font-black text-slate-800 uppercase text-xs">{order.customerName}</td>
              <td className="px-8 py-5 font-black text-slate-900 tracking-tighter text-sm">${order.totalAmount.toLocaleString()}</td>
              <td className="px-8 py-5"><OrderStatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default App;

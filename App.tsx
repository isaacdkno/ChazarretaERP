
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
  const [currentUser, setCurrentUser] = useState<{name: string, role: UserRole, email?: string} | null>(null);
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
    return <Login onLogin={(user) => setCurrentUser(user)} />;
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
            {(currentUser.role === UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/new-order" icon={<Plus size={20} />} label="Cargar Pedido" />}
            {(currentUser.role === UserRole.GATE || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/gate" icon={<Truck size={20} />} label="Portería" />}
            {(currentUser.role === UserRole.ORDER_CENTER || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/center" icon={<Settings size={20} />} label="Gestión de Pedidos" />}
            {(currentUser.role === UserRole.FACTORY || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/factory" icon={<Box size={20} />} label="Producción" />}
            {(currentUser.role === UserRole.DISPATCH || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/dispatch" icon={<Truck size={20} />} label="Hoja de Ruta" />}
            {(currentUser.role === UserRole.COLLECTION || currentUser.role === UserRole.ADMIN) && <SidebarLink to="/collection" icon={<BadgeDollarSign size={20} />} label="Caja y Cobranza" />}
            {currentUser.role === UserRole.ADMIN && <SidebarLink to="/audit" icon={<Github size={20} />} label="Sincronización Cloud" />}
          </div>

          <div className="m-4 p-5 bg-slate-800/40 rounded-[2rem] border border-white/5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-blue-400 border border-white/5">
                <UserCircle size={24} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
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
              <Route path="/" element={<HomeDashboard role={currentUser.role} orders={displayOrders} customers={displayCustomers} isSynced={isSynced} dbReady={dbReady} />} />
              <Route path="/orders" element={<OrdersTable orders={displayOrders} role={currentUser.role} />} />
              
              {(currentUser.role === UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && (
                <Route path="/new-order" element={<DistributorView addOrder={addOrder} customers={customers} products={products} currentUser={currentUser} />} />
              )}

              {(currentUser.role !== UserRole.DISTRIBUTOR || currentUser.role === UserRole.ADMIN) && (
                <>
                  <Route path="/gate" element={<GateView gateEntries={gateEntries} setGateEntries={setGateEntries} customers={customers} products={products} />} />
                  <Route path="/center" element={<OrderCenterView orders={orders} updateOrder={updateOrder} addOrder={addOrder} products={products} customers={customers} />} />
                  <Route path="/factory" element={<FactoryView orders={orders} products={products} />} />
                  <Route path="/dispatch" element={<DispatchView orders={orders} updateOrder={updateOrder} products={products} />} />
                  <Route path="/collection" element={<CollectionView orders={orders} updateOrder={updateOrder} customers={customers} setCustomers={setCustomers} />} />
                  {currentUser.role === UserRole.ADMIN && (
                    <Route path="/audit" element={<AdminDashboard logs={auditLogs} onRefresh={fetchData} dbReady={dbReady} orders={orders} />} />
                  )}
                </>
              )}
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
  return <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black border tracking-widest ${styles[status]}`}>{status}</span>;
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

const Login: React.FC<{onLogin: (user: {name: string, role: UserRole, email: string}) => void}> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.DISTRIBUTOR);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // En una app real aquí iría la lógica de Supabase Auth
    // Por ahora simulamos el login exitoso
    onLogin({ name: username || 'Usuario', role, email });
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
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Nombre de Usuario / Sucursal</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                placeholder="Nombre para facturación"
              />
            </div>
          )}

          {!isRegistering && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Nombre de Usuario</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
                placeholder="Su usuario"
              />
            </div>
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

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Puesto de Trabajo</label>
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
              <option value={UserRole.ADMIN}>Administrador</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 mt-4"
          >
            {isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-blue-600 transition-colors"
          >
            {isRegistering ? '¿Ya tiene cuenta? Inicie sesión' : '¿No tiene cuenta? Regístrese aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;

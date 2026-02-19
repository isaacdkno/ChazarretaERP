
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
  BarChart3,
  Wifi,
  Github,
  LayoutDashboard,
  Box
} from 'lucide-react';

import { UserRole, Order, Customer, OrderStatus, GateEntry, AuditLog } from './types';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS } from './constants';

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
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [gateEntries, setGateEntries] = useState<GateEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSynced, setIsSynced] = useState(true);

  const addOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
    setIsSynced(false);
    setTimeout(() => setIsSynced(true), 1500);
  };

  const updateOrder = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setIsSynced(false);
    setTimeout(() => setIsSynced(true), 1500);
  };

  // Pantalla de Login / Selección de Rol
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900">
        <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 border border-white/20">
          <div className="text-center mb-10">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 transform rotate-3">
              <Warehouse size={40} />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">CHAZARRETA <span className="text-blue-600">ERP</span></h1>
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
              { role: UserRole.ADMIN, label: 'Administrador', desc: 'Auditoría y DB Config', color: 'bg-slate-100 text-slate-700' },
            ].map(item => (
              <button
                key={item.role}
                onClick={() => {
                  setCurrentUser({ name: 'Operador Chazarreta', role: item.role });
                  window.location.hash = '#/'; // Forzar reinicio a la raíz al loguear
                }}
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
                  <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{item.label}</p>
                  <p className="text-xs text-slate-400 font-medium">{item.desc}</p>
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
        {/* Navigation Sidebar */}
        <nav className="w-full md:w-72 bg-[#0f172a] text-slate-400 flex flex-col shrink-0 border-r border-white/5">
          <div className="p-8 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">C</div>
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
            
            {/* Links condicionales por rol para que nunca queden "atrapados" */}
            {currentUser.role === UserRole.DISTRIBUTOR && (
              <SidebarLink to="/new-order" icon={<Plus size={20} />} label="Cargar Pedido" />
            )}
            {currentUser.role === UserRole.GATE && (
              <SidebarLink to="/gate" icon={<Truck size={20} />} label="Control Portería" />
            )}
            {currentUser.role === UserRole.ORDER_CENTER && (
              <SidebarLink to="/center" icon={<Settings size={20} />} label="Gestión de Pedidos" />
            )}
            {currentUser.role === UserRole.FACTORY && (
              <SidebarLink to="/factory" icon={<Box size={20} />} label="Plan de Producción" />
            )}
            {currentUser.role === UserRole.DISPATCH && (
              <SidebarLink to="/dispatch" icon={<Truck size={20} />} label="Hoja de Ruta" />
            )}
            {currentUser.role === UserRole.COLLECTION && (
              <SidebarLink to="/collection" icon={<BadgeDollarSign size={20} />} label="Caja y Cobranza" />
            )}
            
            {(currentUser.role === UserRole.ADMIN) && (
              <>
                <p className="px-4 py-2 mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sistemas</p>
                <SidebarLink to="/audit" icon={<Github size={20} />} label="Sincronización Cloud" />
              </>
            )}
          </div>

          <div className="m-4 p-5 bg-slate-800/40 rounded-[2rem] border border-white/5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-blue-400 border border-white/5 shadow-inner">
                <UserCircle size={24} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                <div className="flex items-center gap-1.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase">{isSynced ? 'Online' : 'Sync...'}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setCurrentUser(null)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-bold"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-[#f8fafc]">
          <div className="p-6 md:p-10 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<HomeDashboard role={currentUser.role} orders={orders} customers={customers} isSynced={isSynced} />} />
              <Route path="/orders" element={<OrdersTable orders={orders} />} />
              
              <Route path="/new-order" element={<DistributorView addOrder={addOrder} customers={customers} products={MOCK_PRODUCTS} />} />
              <Route path="/gate" element={<GateView gateEntries={gateEntries} setGateEntries={setGateEntries} />} />
              <Route path="/center" element={<OrderCenterView orders={orders} updateOrder={updateOrder} addOrder={addOrder} />} />
              <Route path="/factory" element={<FactoryView orders={orders} />} />
              <Route path="/dispatch" element={<DispatchView orders={orders} updateOrder={updateOrder} />} />
              <Route path="/collection" element={<CollectionView orders={orders} updateOrder={updateOrder} customers={customers} setCustomers={setCustomers} />} />
              <Route path="/audit" element={<AdminDashboard logs={auditLogs} />} />

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
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-500'} transition-colors`}>{icon}</span>
      <span className="text-sm font-bold tracking-tight">{label}</span>
    </Link>
  );
};

const HomeDashboard: React.FC<{role: UserRole, orders: Order[], customers: Customer[], isSynced: boolean}> = ({ role, orders, customers, isSynced }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirección inteligente al entrar: te lleva a tu módulo principal solo si estás en la raíz
  useEffect(() => {
    if (location.pathname === '/') {
      const paths = {
        [UserRole.GATE]: '/gate',
        [UserRole.ORDER_CENTER]: '/center',
        [UserRole.FACTORY]: '/factory',
        [UserRole.DISPATCH]: '/dispatch',
        [UserRole.COLLECTION]: '/collection',
        [UserRole.ADMIN]: '/audit',
        [UserRole.DISTRIBUTOR]: '/', // El distribuidor se queda en el dashboard
      };
      
      const target = paths[role];
      if (target && target !== '/') {
        navigate(target, { replace: true });
      }
    }
  }, [role, navigate, location]);

  const customer = customers[0];
  const myOrders = orders.filter(o => o.customerId === customer.id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Panel de Control</h1>
          <p className="text-slate-500 font-medium">Bienvenido, estás operando en el modo <span className="text-blue-600 font-bold uppercase">{role}</span></p>
        </div>
        <div className="flex gap-3">
           <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isSynced ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}></div>
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{isSynced ? 'Sincronizado' : 'Pendiente Sync'}</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Saldo de Cuenta" value={`$${customer.balance.toLocaleString()}`} subtitle="Actualizado ahora" icon={<BadgeDollarSign size={24}/>} color="blue" />
        <StatsCard title="Pedidos Activos" value={orders.length.toString()} subtitle="Total del día" icon={<ClipboardList size={24}/>} color="purple" />
        <StatsCard title="Estado Sistema" value={isSynced ? "Operativo" : "Offline"} subtitle="Conexión Supabase" icon={<CheckCircle2 size={24}/>} color={isSynced ? "emerald" : "red"} />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Movimientos del Cliente</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {myOrders.slice(0, 5).map(order => (
            <div key={order.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/80 transition-all group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                  <FileText size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">#ORD-{order.id.substr(0, 6).toUpperCase()}</p>
                  <p className="text-xs text-slate-400 font-bold">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="text-right">
                  <p className="font-black text-slate-900">${order.totalAmount.toLocaleString()}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
          ))}
          {myOrders.length === 0 && (
            <div className="p-20 text-center">
               <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay movimientos recientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{title: string, value: string, subtitle: string, icon: React.ReactNode, color: string}> = ({ title, value, subtitle, icon, color }) => {
  const colors: {[key: string]: string} = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all">
      <div className={`w-14 h-14 ${colors[color]} rounded-2xl flex items-center justify-center mb-6`}>
        {icon}
      </div>
      <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{value}</h3>
      <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
    </div>
  );
};

const OrderStatusBadge: React.FC<{status: OrderStatus}> = ({ status }) => {
  const styles = {
    [OrderStatus.PENDING]: 'bg-amber-100 text-amber-700 border-amber-200',
    [OrderStatus.VALIDATED]: 'bg-blue-100 text-blue-700 border-blue-200',
    [OrderStatus.DISPATCHED]: 'bg-purple-100 text-purple-700 border-purple-200',
    [OrderStatus.PAID_PARTIAL]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    [OrderStatus.PAID_FULL]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black border tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
};

const OrdersTable: React.FC<{orders: Order[]}> = ({ orders }) => (
  <div className="space-y-6 animate-in slide-in-from-bottom-4">
    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Registro General de Comandas</h1>
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID</th>
            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cliente</th>
            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</th>
            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {orders.map(order => (
            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-8 py-5 font-mono text-xs font-bold text-slate-400">#{order.id.substr(0, 8)}</td>
              <td className="px-8 py-5 font-black text-slate-800 uppercase tracking-tight">{order.customerName}</td>
              <td className="px-8 py-5 font-black text-slate-900">${order.totalAmount.toLocaleString()}</td>
              <td className="px-8 py-5"><OrderStatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <div className="p-32 text-center text-slate-300 font-black uppercase tracking-widest">No hay datos</div>}
    </div>
  </div>
);

export default App;

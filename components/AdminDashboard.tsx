
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, History, Terminal, Cloud, CheckCircle2, Copy, Play, AlertTriangle, Search, Activity, Server, Key, Link as LinkIcon, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
// Added Order import to allow typing the new prop
import { AuditLog, Order } from '../types';
import { supabase, saveSupabaseConfig, clearSupabaseConfig, isSupabaseConfigured } from '../supabase';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  logs: AuditLog[];
  onRefresh: () => void;
  dbReady: boolean | 'ERROR';
  // Added orders to Props interface to resolve reference on line 341
  orders: Order[];
}

// Added orders to component destructuring
const AdminDashboard: React.FC<Props> = ({ logs, onRefresh, dbReady, orders }) => {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'DATABASE'>('DATABASE');
  const [isSeeding, setIsSeeding] = useState(false);
  
  const [configUrl, setConfigUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [configKey, setConfigKey] = useState(localStorage.getItem('supabase_key') || '');

  const [connectionStats, setConnectionStats] = useState({
    client: false,
    schema: false,
    seeding: false
  });

  useEffect(() => {
    setConnectionStats({
      client: isSupabaseConfigured(),
      schema: dbReady === true,
      seeding: false
    });
  }, [dbReady]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configUrl.includes('supabase.co')) {
      alert("La URL no parece ser un endpoint válido de Supabase.");
      return;
    }
    saveSupabaseConfig(configUrl, configKey);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('¡SQL Copiado! Ahora ve al Dashboard de Supabase -> SQL Editor -> New Query y pégalo allí.');
  };

  const seedDatabase = async () => {
    if (!confirm("¿Deseas cargar los productos y clientes maestros? Esto limpiará datos previos si existen.")) return;
    
    setIsSeeding(true);
    try {
      // Limpieza preventiva (opcional, en orden de jerarquía)
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('product_prices').delete().neq('product_id', 'none');
      await supabase.from('customers').delete().neq('id', 'none');
      await supabase.from('products').delete().neq('id', 'none');
      await supabase.from('price_lists').delete().neq('id', 'none');

      // 1. Listas de Precios
      await supabase.from('price_lists').insert(
        MOCK_PRICE_LISTS.map(l => ({ id: l.id, name: l.name, description: l.description }))
      );

      // 2. Productos
      await supabase.from('products').insert(
        MOCK_PRODUCTS.map(p => ({ 
          id: p.id, 
          name: p.name, 
          brand: p.brand, 
          category: p.category, 
          bonus_enabled: p.bonusEnabled 
        }))
      );

      // 3. Precios
      const pricesToInsert: any[] = [];
      MOCK_PRODUCTS.forEach(p => {
        Object.entries(p.prices).forEach(([listId, price]) => {
          pricesToInsert.push({
            product_id: p.id,
            price_list_id: listId,
            price: price
          });
        });
      });
      await supabase.from('product_prices').insert(pricesToInsert);

      // 4. Clientes
      await supabase.from('customers').insert(
        MOCK_CUSTOMERS.map(c => ({
          id: c.id,
          name: c.name,
          price_list_id: c.priceListId,
          balance: c.balance,
          is_blocked: c.isBlocked
        }))
      );

      alert("¡Base de datos inicializada con éxito!");
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("Error al sembrar datos. Asegúrate de haber ejecutado el SQL correctamente en el panel de Supabase.");
    } finally {
      setIsSeeding(false);
    }
  };

  const sqlSchema = `-- ERP CHAZARRETA v1.0 - Definición de Tablas
-- 1. Borrar tablas previas si existen (CUIDADO: Borra datos)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_prices;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS price_lists;
DROP TABLE IF EXISTS account_movements;
DROP TABLE IF EXISTS gate_entries;

-- 2. Crear Estructura Maestro
CREATE TABLE price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    bonus_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    UNIQUE(product_id, price_list_id)
);

CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_list_id TEXT REFERENCES price_lists(id),
    balance DECIMAL(12,2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    status TEXT DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    signature_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    bonus_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL
);

CREATE TABLE gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    product_name TEXT,
    quantity INTEGER,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Sistemas & Cloud</h1>
          <p className="text-slate-500 font-medium">Asistente de aprovisionamiento de base de datos.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'LOGS' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <History size={16} /> Auditoría
          </button>
          <button 
            onClick={() => setActiveTab('DATABASE')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'DATABASE' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Database size={16} /> Configuración DB
          </button>
        </div>
      </header>

      {activeTab === 'DATABASE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            
            {/* PASO 1: CREDENCIALES */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-slate-800 font-black text-lg uppercase tracking-tight leading-none mb-2">1. Vinculación del Proyecto</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Establecer conexión con el API de Supabase</p>
                  </div>
                </div>
                {connectionStats.client && <CheckCircle2 className="text-emerald-500" size={24} />}
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Project URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="https://xyz.supabase.co"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                        value={configUrl}
                        onChange={e => setConfigUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Anon / Public Key</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="password" 
                        placeholder="eyJhbGci..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                        value={configKey}
                        onChange={e => setConfigKey(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} /> Guardar Credenciales
                  </button>
                  <button 
                    type="button"
                    onClick={clearSupabaseConfig}
                    className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-100"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </form>
            </div>

            {/* PASO 2: SQL SCHEMA */}
            <div className={`bg-slate-900 rounded-[2.5rem] p-8 text-slate-300 border border-white/10 shadow-2xl relative overflow-hidden group transition-all ${!connectionStats.client ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100'}`}>
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Terminal size={120} />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-tight">2. Creación del Esquema</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Definir tablas y relaciones en PostgreSQL</p>
                  </div>
                </div>
                {connectionStats.schema && <CheckCircle2 className="text-emerald-400" size={24} />}
                {!connectionStats.schema && (
                  <button 
                    onClick={() => copyToClipboard(sqlSchema)}
                    className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20"
                  >
                    <Copy size={16} /> Copiar SQL para Supabase
                  </button>
                )}
              </div>
              {!connectionStats.schema && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] text-amber-200 font-bold uppercase tracking-widest flex items-center gap-2">
                   <AlertTriangle size={14} /> Debes ejecutar este código en el SQL Editor de Supabase para activar la app.
                </div>
              )}
              <pre className="bg-black/40 p-6 rounded-2xl font-mono text-[11px] overflow-x-auto border border-white/5 leading-relaxed text-blue-300 custom-scrollbar max-h-[250px]">
                {sqlSchema}
              </pre>
            </div>

            {/* PASO 3: SEEDING */}
            <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 transition-all ${!connectionStats.schema ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100'}`}>
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                       <Server size={24} />
                    </div>
                    <div>
                       <h3 className="text-slate-800 font-black text-lg uppercase tracking-tightLeading-none mb-2">3. Sembrado de Datos Maestro</h3>
                       <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cargar catálogos, listas y clientes iniciales</p>
                    </div>
                  </div>
               </div>
               <button 
                onClick={seedDatabase}
                disabled={isSeeding}
                className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-100 transition-all disabled:opacity-20"
               >
                 {isSeeding ? <Activity className="animate-spin" size={20} /> : <Play size={20} />}
                 {isSeeding ? "Sincronizando..." : "Ejecutar Inicialización de Datos"}
               </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8 rounded-[2.5rem] text-white shadow-2xl">
              <Cloud size={40} className="mb-6 text-blue-500 opacity-50" />
              <h3 className="text-xl font-black mb-6 uppercase tracking-tight leading-none">Estado de Provisión</h3>
              
              <div className="space-y-4">
                <ProvisionItem label="Conectividad API" status={connectionStats.client} />
                <ProvisionItem label="Base de Datos SQL" status={connectionStats.schema} />
                {/* Fixed line 341: Reference orders from props instead of undefined local scope */}
                <ProvisionItem label="Datos Maestros" status={connectionStats.schema && orders.length > 0} />
              </div>

              <a 
                href="https://supabase.com/dashboard/project/_/sql" 
                target="_blank" 
                rel="noreferrer"
                className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Abrir SQL Editor <ExternalLink size={14} />
              </a>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-4">¿Qué sigue?</h4>
               <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                 Una vez que el estado de provisión sea exitoso, podrás navegar por todos los módulos (Distribuidor, Portería, etc.) y los cambios se guardarán permanentemente en la nube.
               </p>
               <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Backup Cloud</p>
                  <p className="text-[10px] text-blue-400 font-bold uppercase leading-tight">Tus datos están protegidos por el motor PostgreSQL de Supabase.</p>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-xl tracking-tight uppercase">Logs de Auditoría</h2>
              <p className="text-slate-400 text-sm font-medium">Registro histórico de transacciones.</p>
            </div>
          </div>
          <div className="text-center py-32">
             <History size={60} className="mx-auto mb-4 text-slate-200 opacity-20" />
             <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm">No hay registros de auditoría</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ProvisionItem: React.FC<{label: string, status: boolean}> = ({ label, status }) => (
  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${status ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5 opacity-40'}`}>
    <span className={`text-[10px] font-black uppercase tracking-widest ${status ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</span>
    {status ? <CheckCircle2 size={16} className="text-emerald-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
  </div>
);

export default AdminDashboard;

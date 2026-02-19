
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, History, Terminal, Cloud, CheckCircle2, Copy, Play, AlertTriangle, Search, Activity, Server, Key, Link as LinkIcon, RefreshCw, Trash2 } from 'lucide-react';
import { AuditLog } from '../types';
import { supabase, saveSupabaseConfig, clearSupabaseConfig } from '../supabase';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  logs: AuditLog[];
  onRefresh: () => void;
  dbReady: boolean | 'ERROR';
}

const AdminDashboard: React.FC<Props> = ({ logs, onRefresh, dbReady }) => {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'DATABASE'>('DATABASE');
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Estados para el formulario de conexión
  const [configUrl, setConfigUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [configKey, setConfigKey] = useState(localStorage.getItem('supabase_key') || '');

  const [connectionStats, setConnectionStats] = useState({
    client: false,
    schema: false,
    seeding: false
  });

  useEffect(() => {
    setConnectionStats({
      client: !!(supabase as any).supabaseUrl && !!(supabase as any).supabaseKey && (supabase as any).supabaseUrl !== '',
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
    alert('SQL copiado. Pegalo en el SQL Editor de tu proyecto en Supabase.');
  };

  const seedDatabase = async () => {
    if (!confirm("¿Deseas cargar los productos, listas y clientes iniciales en Supabase?")) return;
    
    setIsSeeding(true);
    try {
      await supabase.from('price_lists').insert(
        MOCK_PRICE_LISTS.map(l => ({ id: l.id, name: l.name, description: l.description }))
      );

      await supabase.from('products').insert(
        MOCK_PRODUCTS.map(p => ({ 
          id: p.id, 
          name: p.name, 
          brand: p.brand, 
          category: p.category, 
          bonus_enabled: p.bonusEnabled 
        }))
      );

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

      await supabase.from('customers').insert(
        MOCK_CUSTOMERS.map(c => ({
          id: c.id,
          name: c.name,
          price_list_id: c.priceListId,
          balance: c.balance,
          is_blocked: c.isBlocked
        }))
      );

      alert("¡Datos cargados correctamente!");
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("Error al sembrar datos. Asegúrate de haber ejecutado el SQL primero.");
    } finally {
      setIsSeeding(false);
    }
  };

  const sqlSchema = `-- ERP CHAZARRETA v1.0 - Database Schema
-- Pegar en SQL Editor de Supabase y dar RUN.

CREATE TABLE IF NOT EXISTS price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    bonus_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    UNIQUE(product_id, price_list_id)
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_list_id TEXT REFERENCES price_lists(id),
    balance DECIMAL(12,2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    status TEXT DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    signature_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    bonus_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS account_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    type TEXT,
    amount DECIMAL(12,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Sistemas & Cloud</h1>
          <p className="text-slate-500 font-medium">Panel técnico de configuración y mantenimiento.</p>
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
            
            {/* 1. CONFIGURACIÓN DE CREDENCIALES */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
              <div className="flex items-start gap-4 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="text-slate-800 font-black text-lg uppercase tracking-tight leading-none mb-2">Conexión con Supabase</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Paso 1: Vincular proyecto</p>
                </div>
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
                    className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} /> Guardar y Conectar
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

            {/* 2. SQL EDITOR */}
            <div className={`bg-slate-900 rounded-[2.5rem] p-8 text-slate-300 border border-white/10 shadow-2xl relative overflow-hidden group transition-opacity ${!connectionStats.client ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Terminal size={120} />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-tight">Script de Inicialización SQL</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Paso 2: Crear Esquema</p>
                  </div>
                </div>
                <button 
                  onClick={() => copyToClipboard(sqlSchema)}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white border border-white/10"
                >
                  <Copy size={16} /> Copiar SQL
                </button>
              </div>
              <pre className="bg-black/40 p-6 rounded-2xl font-mono text-[11px] overflow-x-auto border border-white/5 leading-relaxed text-blue-300 custom-scrollbar max-h-[300px]">
                {sqlSchema}
              </pre>
            </div>

            {/* 3. SEEDING */}
            <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 transition-opacity ${!connectionStats.schema ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
               <div className="flex items-start gap-4 mb-8">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                     <Server size={24} />
                  </div>
                  <div>
                     <h3 className="text-slate-800 font-black text-lg uppercase tracking-tightLeading-none mb-2">Sembrado de Datos Maestro</h3>
                     <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Paso 3: Cargar Productos y Clientes</p>
                  </div>
               </div>
               <button 
                onClick={seedDatabase}
                disabled={isSeeding}
                className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-100 transition-all disabled:opacity-20"
               >
                 {isSeeding ? <Activity className="animate-spin" size={18} /> : <Play size={18} />}
                 {isSeeding ? "Sincronizando..." : "Ejecutar Seeding"}
               </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-500/20">
              <Cloud size={40} className="mb-6 opacity-50" />
              <h3 className="text-xl font-black mb-6 uppercase tracking-tight leading-none">Checklist de Nube</h3>
              
              <div className="space-y-4">
                <StatusItem label="Tokens de Acceso" active={connectionStats.client} />
                <StatusItem label="Esquema de Tablas" active={connectionStats.schema} />
                <StatusItem label="Datos Maestros" active={connectionStats.seeding} />
              </div>

              {!connectionStats.client && (
                <div className="mt-8 p-4 bg-white/10 rounded-2xl border border-white/10 text-[10px] font-medium leading-relaxed">
                   ⚠️ Faltan tokens. Obtenlos en el panel de Supabase: <br/> 
                   <span className="font-black">Settings -> API</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
               <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px] mb-4">Guía de Conexión</h4>
               <ul className="space-y-6">
                 <li className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">1</div>
                    <p className="text-xs font-bold text-slate-600 leading-snug">Ingresa la URL y el API Key arriba y dale a "Guardar".</p>
                 </li>
                 <li className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">2</div>
                    <p className="text-xs font-bold text-slate-600 leading-snug">Copia el SQL, ve a Supabase -> SQL Editor y ejecútalo.</p>
                 </li>
                 <li className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">3</div>
                    <p className="text-xs font-bold text-slate-600 leading-snug">Regresa aquí y presiona "Ejecutar Seeding".</p>
                 </li>
               </ul>
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
              <h2 className="font-black text-slate-800 text-xl tracking-tight uppercase">Logs de Auditoría Cloud</h2>
              <p className="text-slate-400 text-sm font-medium">Registro de operaciones críticas.</p>
            </div>
          </div>
          <div className="text-center py-32">
             <History size={60} className="mx-auto mb-4 text-slate-200 opacity-20" />
             <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm">Historial de transacciones vacío</p>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusItem: React.FC<{label: string, active: boolean}> = ({ label, active }) => (
  <div className={`flex items-center justify-between p-4 rounded-2xl border ${active ? 'bg-white/10 border-white/10' : 'bg-black/10 border-white/5 opacity-50'}`}>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {active ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
  </div>
);

export default AdminDashboard;

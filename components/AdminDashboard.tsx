
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, History, Terminal, Cloud, CheckCircle2, Copy, Play, AlertTriangle, Search, Activity, Server, Key, Link as LinkIcon, RefreshCw, Trash2, ExternalLink, Info, ShieldAlert, FileText, Printer } from 'lucide-react';
import { AuditLog, Order, PaymentReceipt } from '../types';
import { supabase, saveSupabaseConfig, clearSupabaseConfig, isSupabaseConfigured } from '../supabase';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  logs: AuditLog[];
  onRefresh: () => void;
  dbReady: boolean | 'ERROR';
  orders: Order[];
}

const AdminDashboard: React.FC<Props> = ({ logs, onRefresh, dbReady, orders }) => {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'DATABASE' | 'RECEIPTS'>('DATABASE');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  
  const [configUrl, setConfigUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [configKey, setConfigKey] = useState(localStorage.getItem('supabase_key') || '');

  useEffect(() => {
    if (activeTab === 'RECEIPTS') {
      fetchReceipts();
    }
  }, [activeTab]);

  const fetchReceipts = async () => {
    setLoadingReceipts(true);
    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (!error && data) {
      setReceipts(data);
    }
    setLoadingReceipts(false);
  };

  const printThermalTicket = (receipt: PaymentReceipt) => {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; font-size: 12px; line-height: 1.2; }
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
          <div class="flex bold" style="font-size: 14px;"><span>TOTAL COBRADO:</span> <span>$${receipt.amount.toLocaleString()}</span></div>
          <div class="line"></div>
          <div class="bold">COMANDAS AFECTADAS:</div>
          ${receipt.orderIds.map(id => {
            const order = orders.find(o => o.id === id);
            return `
              <div class="flex">
                <span>#ORD-${id.substr(0,6).toUpperCase()}</span>
                <span>$${order?.totalAmount.toLocaleString() || '0'}</span>
              </div>
            `;
          }).join('')}
          <div class="line"></div>
          <div class="center" style="margin-top: 20px;">GRACIAS POR SU PAGO<br></div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

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

  const handleRefreshConnection = async () => {
    setIsChecking(true);
    await onRefresh();
    setTimeout(() => setIsChecking(false), 800);
  };

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
    alert('¡SQL Completo Copiado! Pegalo en el SQL Editor de Supabase y presiona RUN. Esto cargará tablas y datos.');
  };

  const seedDatabase = async () => {
    if (!confirm("¿Deseas cargar los datos maestros? Esto reemplazará productos y clientes actuales.")) return;
    
    setIsSeeding(true);
    try {
      await supabase.from('order_items').delete().neq('quantity', -1);
      await supabase.from('orders').delete().neq('total_amount', -1);
      await supabase.from('gate_entries').delete().neq('quantity', -1);
      await supabase.from('account_movements').delete().neq('amount', -1);
      await supabase.from('product_prices').delete().neq('price', -1);
      await supabase.from('customers').delete().neq('name', 'none');
      await supabase.from('products').delete().neq('name', 'none');
      await supabase.from('price_lists').delete().neq('name', 'none');

      await supabase.from('price_lists').insert(
        MOCK_PRICE_LISTS.map(l => ({ id: l.id, name: l.name, description: l.description }))
      );

      await supabase.from('products').insert(
        MOCK_PRODUCTS.map(p => ({ 
          id: p.id, 
          name: p.name, 
          brand: p.brand, 
          category: p.category, 
          bonus_enabled: p.bonusEnabled,
          bonus_threshold: 20,
          bonus_percentage: 10
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

      alert("¡Inicialización completada con éxito!");
      onRefresh();
    } catch (error: any) {
      console.error(error);
      alert(`Error en el proceso: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const fullSqlScript = `-- ERP CHAZARRETA v1.0 - Esquema Completo + Datos Maestros
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS account_movements CASCADE;
DROP TABLE IF EXISTS gate_entries CASCADE;

CREATE TABLE price_lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT, category TEXT, bonus_enabled BOOLEAN DEFAULT TRUE, bonus_threshold INTEGER DEFAULT 20, bonus_percentage INTEGER DEFAULT 10, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE product_prices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id TEXT REFERENCES products(id) ON DELETE CASCADE, price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE, price DECIMAL(12,2) NOT NULL, UNIQUE(product_id, price_list_id));
CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, price_list_id TEXT REFERENCES price_lists(id), balance DECIMAL(12,2) DEFAULT 0, is_blocked BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL, customer_name TEXT, status TEXT DEFAULT 'PENDING', total_amount DECIMAL(12,2) DEFAULT 0, paid_amount DECIMAL(12,2) DEFAULT 0, signature_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT REFERENCES products(id), quantity INTEGER NOT NULL, bonus_quantity INTEGER DEFAULT 0, unit_price DECIMAL(12,2) NOT NULL);
CREATE TABLE gate_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id TEXT REFERENCES customers(id), product_name TEXT, quantity INTEGER, reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE account_movements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id TEXT REFERENCES customers(id), type TEXT, amount DECIMAL(12,2), description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE payment_receipts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id TEXT REFERENCES customers(id), customer_name TEXT, amount DECIMAL(12,2), cash_amount DECIMAL(12,2), transfer_amount DECIMAL(12,2), payment_mode TEXT, order_ids TEXT[], created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());

INSERT INTO price_lists (id, name, description) VALUES ('l1', 'Distribuidores', 'Precio para canales de distribución externos'), ('l2', 'Supermercados', 'Grandes superficies y cadenas'), ('l3', 'Sucursales', 'Venta directa en locales propios');
INSERT INTO products (id, name, brand, category, bonus_enabled) VALUES ('p1', 'Pan de Molde Blanco', 'La Fornarina', 'Panificados', true), ('p2', 'Pan de Molde Salvado', 'La Fornarina', 'Panificados', true), ('p3', 'Grisines Tradicionales', 'Villecco', 'Snacks', false), ('p4', 'Pepas de Membrillo', 'Villecco', 'Dulces', true);
INSERT INTO product_prices (product_id, price_list_id, price) VALUES ('p1', 'l1', 1080), ('p1', 'l2', 1150), ('p1', 'l3', 1200), ('p2', 'l1', 1215), ('p2', 'l2', 1280), ('p2', 'l3', 1350), ('p3', 'l1', 765), ('p3', 'l2', 810), ('p3', 'l3', 850), ('p4', 'l1', 990), ('p4', 'l2', 1050), ('p4', 'l3', 1100);
INSERT INTO customers (id, name, price_list_id, balance, is_blocked) VALUES ('c1', 'Distribuidora Norte', 'l1', 45000, false), ('c2', 'Sucursal Centro', 'l3', 0, false), ('c3', 'Coto / Carrefour', 'l2', 120000, false);`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Panel Administrativo</h1>
          <p className="text-slate-500 font-medium">Configuración de infraestructura y datos cloud.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('RECEIPTS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'RECEIPTS' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <FileText size={16} /> Recibos
          </button>
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
            <Database size={16} /> Base de Datos
          </button>
        </div>
      </header>

      {activeTab === 'DATABASE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            
            {/* GUIA DE PERSISTENCIA */}
            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
               <div className="relative z-10">
                 <h3 className="text-xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                   <ShieldCheck size={24} /> ¿Cómo dejar las llaves fijas?
                 </h3>
                 <p className="text-blue-100 text-xs font-medium leading-relaxed mb-6 max-w-xl">
                   Para no tener que pegar las llaves cada vez que recargas, puedes configurar <b>Variables de Entorno</b> en tu plataforma de hosting (Vercel, GitHub, etc.) con los nombres:
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                       <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Nombre Variable 1</p>
                       <code className="text-sm font-black">SUPABASE_URL</code>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                       <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Nombre Variable 2</p>
                       <code className="text-sm font-black">SUPABASE_ANON_KEY</code>
                    </div>
                 </div>
               </div>
               <Info className="absolute -bottom-4 -right-4 w-40 h-40 text-white/5 rotate-12" />
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-slate-800 font-black text-lg uppercase tracking-tight leading-none mb-2">1. Conexión Rápida (Local)</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Se guarda en este navegador</p>
                  </div>
                </div>
                {connectionStats.client && <CheckCircle2 className="text-emerald-500" size={24} />}
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Project URL</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10" value={configUrl} onChange={e => setConfigUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Anon Key</label>
                    <input type="password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10" value={configKey} onChange={e => setConfigKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiI..." />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2">
                    <RefreshCw size={16} /> Aplicar y Guardar
                  </button>
                  <button type="button" onClick={clearSupabaseConfig} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-100">
                    <Trash2 size={20} />
                  </button>
                </div>
              </form>
            </div>

            <div className={`bg-slate-900 rounded-[2.5rem] p-8 text-slate-300 border border-white/10 shadow-2xl relative overflow-hidden group transition-all ${!connectionStats.client ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-tight">2. Script de Datos Maestros</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Usa esto si la carga por API falla</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleRefreshConnection} disabled={isChecking} className="bg-white/5 hover:bg-white/10 px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white border border-white/10">
                    <RefreshCw className={isChecking ? 'animate-spin' : ''} size={16} /> Sincronizar UI
                  </button>
                  <button onClick={() => copyToClipboard(fullSqlScript)} className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20">
                    <Copy size={16} /> Copiar SQL
                  </button>
                </div>
              </div>
              <pre className="bg-black/40 p-6 rounded-2xl font-mono text-[10px] overflow-x-auto border border-white/5 leading-relaxed text-blue-300 custom-scrollbar max-h-[350px]">
                {fullSqlScript}
              </pre>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#0f172a] p-8 rounded-[2.5rem] text-white shadow-2xl">
              <Cloud size={40} className="mb-6 text-blue-500 opacity-50" />
              <h3 className="text-xl font-black mb-6 uppercase tracking-tight">Estatus Global</h3>
              <div className="space-y-4">
                <StatusItem label="API Conectada" status={connectionStats.client} />
                <StatusItem label="Tablas Creadas" status={connectionStats.schema} />
                <StatusItem label="Datos Cargados" status={connectionStats.schema && orders.length > 0} />
              </div>
              <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                Abrir SQL Editor <ExternalLink size={14} />
              </a>
            </div>
            
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200">
               <h4 className="font-black text-amber-800 uppercase tracking-tight text-xs mb-2 flex items-center gap-2">
                 <ShieldAlert size={14} /> Seguridad
               </h4>
               <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                 Nunca compartas tu <b>Service Role Key</b>. Usa siempre la <b>Anon Key</b> para el frontend. Si necesitas que el sistema sea accesible por varios usuarios sin configurar nada, pídeme "Hardcodear las llaves en el código".
               </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'RECEIPTS' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
              <FileText className="text-blue-500" size={20} /> Registro Maestro de Recibos
            </h2>
            <button onClick={fetchReceipts} className="p-2 hover:bg-slate-200 rounded-lg transition-all"><RefreshCw size={16} className={loadingReceipts ? 'animate-spin' : ''} /></button>
          </div>
          <div className="divide-y divide-slate-100">
            {receipts.length === 0 ? (
              <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                No se registran cobros en el sistema
              </div>
            ) : receipts.map(receipt => (
              <div key={receipt.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50/50 transition-all gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Printer size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Recibo #{receipt.id.toString().substr(0,8).toUpperCase()}</p>
                    <p className="font-black text-slate-800 uppercase text-sm">{receipt.customerName}</p>
                    <p className="text-[10px] text-slate-300 font-bold uppercase">{new Date(receipt.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">${receipt.amount.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Cobrado</p>
                  </div>
                  <button 
                    onClick={() => printThermalTicket(receipt)}
                    className="p-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg"
                  >
                    <Printer size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 text-center py-40">
           <History size={64} className="mx-auto mb-4 text-slate-200" />
           <p className="font-black uppercase tracking-widest text-slate-300">Historial de Auditoría Vacío</p>
        </div>
      )}
    </div>
  );
};

const StatusItem: React.FC<{label: string, status: boolean}> = ({ label, status }) => (
  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${status ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
    <span className={`text-[10px] font-black uppercase tracking-widest ${status ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
    {status ? <CheckCircle2 size={16} className="text-emerald-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
  </div>
);

export default AdminDashboard;


import React, { useState } from 'react';
import { ShieldCheck, Database, History, Terminal, Cloud, Github, CheckCircle2, Copy } from 'lucide-react';
import { AuditLog } from '../types';

interface Props {
  logs: AuditLog[];
}

const AdminDashboard: React.FC<Props> = ({ logs }) => {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'DATABASE'>('LOGS');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('SQL copiado al portapapeles. Pegalo en el editor de Supabase.');
  };

  const sqlSchema = `-- ERP CHAZARRETA v1.0 - Database Schema
-- Ejecutar en Supabase SQL Editor para inicializar

CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT CHECK (brand IN ('La Fornarina', 'Villecco')),
    bonus_enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    status TEXT DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Auditoría & Sistemas</h1>
          <p className="text-slate-500 font-medium">Control técnico y sincronización de datos en la nube.</p>
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
            <Database size={16} /> Base de Datos
          </button>
        </div>
      </header>

      {activeTab === 'DATABASE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-slate-300 border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Terminal size={120} />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg">Esquema SQL Proyectado</h3>
                    <p className="text-slate-500 text-sm font-medium">Estructura para sincronización cross-PC.</p>
                  </div>
                </div>
                <button 
                  onClick={() => copyToClipboard(sqlSchema)}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold text-white"
                >
                  <Copy size={16} /> Copiar SQL
                </button>
              </div>
              <pre className="bg-black/50 p-6 rounded-2xl font-mono text-xs overflow-x-auto border border-white/5 leading-relaxed text-blue-300">
                {sqlSchema}
              </pre>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-500/20">
              <Github size={40} className="mb-6 opacity-50" />
              <h3 className="text-xl font-black mb-2">GitHub Sync</h3>
              <p className="text-blue-100 text-sm font-medium mb-6">Tus cambios se guardan en el repositorio para que puedas abrir el ERP desde cualquier lugar.</p>
              <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10">
                 <CheckCircle2 size={20} className="text-emerald-400" />
                 <span className="text-xs font-bold uppercase tracking-widest">Repo Actualizado</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6">Servicios Cloud</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Cloud size={20} className="text-blue-500" />
                    <span className="text-sm font-bold text-slate-700">Supabase DB</span>
                  </div>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-tighter">Online</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Github size={20} className="text-slate-700" />
                    <span className="text-sm font-bold text-slate-700">GitHub Branch</span>
                  </div>
                  <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-tighter">Main</span>
                </div>
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
              <p className="text-slate-400 text-sm font-medium underline decoration-blue-500/30">Registro de cada acción crítica en el sistema.</p>
            </div>
          </div>
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 p-5 border border-slate-50 rounded-3xl hover:bg-slate-50 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                  <History size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-slate-800 tracking-tight text-lg">
                      {log.userId} <span className="font-medium text-slate-400">realizó</span> {log.action}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Anterior</p>
                      <p className="text-xs text-slate-500 font-mono truncate">{log.oldValue || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Nuevo</p>
                      <p className="text-xs text-blue-600 font-black font-mono truncate">{log.newValue}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-32">
                 <History size={60} className="mx-auto mb-4 text-slate-200 opacity-20" />
                 <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm">Sin registros pendientes</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

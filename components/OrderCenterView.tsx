
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Settings2, 
  Trash2, 
  Check, 
  Search, 
  Package, 
  Save, 
  Edit3,
  UserPlus,
  ShoppingCart,
  Percent,
  Layers,
  Info,
  History,
  TrendingUp as TrendingUpIcon,
  ChevronRight,
  Zap,
  Filter
} from 'lucide-react';
import { Order, OrderStatus, OrderItem, Product, Customer, PriceList } from '../types';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder?: (order: Order) => void;
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder }) => {
  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'CREATE' | 'CATALOG' | 'PRICES'>('CATALOG');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Centro de Pedidos</h1>
          <p className="text-slate-500">Gestión operativa y actualización de precios.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: 'VALIDATE', label: 'Validar', icon: <ClipboardCheck size={18} /> },
            { id: 'CREATE', label: 'Cargar', icon: <Plus size={18} /> },
            { id: 'CATALOG', label: 'Bonificaciones', icon: <Percent size={18} /> },
            { id: 'PRICES', label: 'Precios', icon: <Layers size={18} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'CATALOG' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
             {/* Header con buscador interno */}
             <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
               <div>
                 <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Reglas por Producto</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Configuración individual de mercadería sin cargo</p>
               </div>
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                  type="text"
                  placeholder="Filtrar productos..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none w-full md:w-64 transition-all"
                 />
               </div>
             </div>
             
             <div className="divide-y divide-slate-100">
                {filteredProducts.map(p => (
                  <div key={p.id} className={`p-8 transition-all group ${p.bonusEnabled ? 'bg-white' : 'bg-slate-50/30 opacity-70'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                      {/* Identificación del Producto */}
                      <div className="flex items-center gap-5 min-w-[320px]">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={p.bonusEnabled}
                            onChange={() => setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusEnabled: !prod.bonusEnabled} : prod))}
                            className="w-7 h-7 rounded-xl text-blue-600 focus:ring-blue-500 border-slate-300 transition-all cursor-pointer"
                          />
                          {p.bonusEnabled && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                          )}
                        </div>
                        <div>
                          <p className={`font-black text-xl tracking-tight uppercase ${p.bonusEnabled ? 'text-slate-800' : 'text-slate-400'}`}>
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.brand}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</span>
                          </div>
                        </div>
                      </div>

                      {/* Configuración Granular */}
                      {p.bonusEnabled ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in zoom-in-95 duration-200">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Umbral Mínimo</label>
                            <div className="relative">
                              <input 
                                type="number"
                                placeholder="Ej: 20"
                                className="bg-white border border-slate-200 px-5 py-3 rounded-2xl text-base font-black w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={p.bonusThreshold || ''}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || undefined;
                                  setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusThreshold: val} : prod));
                                }}
                              />
                              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">Uni</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bonificación</label>
                            <div className="relative">
                              <input 
                                type="number"
                                placeholder="Ej: 10"
                                className="bg-white border border-slate-200 px-5 py-3 rounded-2xl text-base font-black w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={p.bonusPercentage || ''}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || undefined;
                                  setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusPercentage: val} : prod));
                                }}
                              />
                              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">%</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center lg:justify-end">
                           <span className="px-6 py-2 rounded-full border border-slate-100 text-slate-300 text-[10px] font-black uppercase tracking-widest bg-slate-50/50">Sin Bonificación</span>
                        </div>
                      )}
                      
                      {/* Indicador de cálculo rápido */}
                      {p.bonusEnabled && p.bonusThreshold && p.bonusPercentage && (
                        <div className="lg:w-48 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                           <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                              <Zap size={14} className="fill-white" />
                           </div>
                           <div className="leading-none">
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter mb-1">Impacto estimado</p>
                              <p className="text-xs font-bold text-emerald-700">+{Math.floor(p.bonusThreshold * (p.bonusPercentage / 100))}u Sin Cargo</p>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-20 text-center">
                    <Package className="mx-auto mb-4 text-slate-200" size={48} />
                    <p className="text-slate-400 font-bold">No se encontraron productos para configurar.</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'PRICES' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-12 text-center">
           <Layers className="mx-auto mb-6 text-blue-100" size={64} />
           <h3 className="text-xl font-black text-slate-800 mb-2">Gestión de Tarifarios</h3>
           <p className="text-slate-500 max-w-md mx-auto">Este módulo permite la actualización masiva de precios por lista (Distribuidores, Supermercados, Sucursales).</p>
        </div>
      )}
      {activeTab === 'VALIDATE' && <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 text-slate-400 italic font-bold uppercase tracking-widest text-center">Módulo de Validación de Comandas</div>}
      {activeTab === 'CREATE' && <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 text-slate-400 italic font-bold uppercase tracking-widest text-center">Módulo de Carga Manual</div>}
    </div>
  );
};

export default OrderCenterView;

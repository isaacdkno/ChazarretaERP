
import React, { useState } from 'react';
import { 
  Truck, 
  RotateCcw, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Package, 
  ChevronRight, 
  ArrowDownCircle,
  History
} from 'lucide-react';
import { GateEntry, GateEntryItem } from '../types';
import { MOCK_CUSTOMERS, MOCK_PRODUCTS } from '../constants';

interface Props {
  gateEntries: GateEntry[];
  setGateEntries: React.Dispatch<React.SetStateAction<GateEntry[]>>;
}

const GateView: React.FC<Props> = ({ gateEntries, setGateEntries }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [currentItems, setCurrentItems] = useState<GateEntryItem[]>([]);
  
  // Estado para el ítem que se está editando en el momento
  const [itemForm, setItemForm] = useState({
    productId: '',
    quantity: 1,
    reason: 'Vencimiento'
  });

  const handleAddItem = () => {
    const product = MOCK_PRODUCTS.find(p => p.id === itemForm.productId);
    if (!product || !selectedCustomerId) return;

    const newItem: GateEntryItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      productName: product.name,
      quantity: itemForm.quantity,
      reason: itemForm.reason
    };

    setCurrentItems([...currentItems, newItem]);
    // Reset del sub-formulario
    setItemForm({ ...itemForm, productId: '', quantity: 1 });
  };

  const removeItem = (id: string) => {
    setCurrentItems(currentItems.filter(item => item.id !== id));
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentItems.length === 0) return;

    const customer = MOCK_CUSTOMERS.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    const newEntry: GateEntry = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: customer.id,
      customerName: customer.name,
      items: currentItems,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    setGateEntries(prev => [newEntry, ...prev]);
    
    // Reset total
    setCurrentItems([]);
    setSelectedCustomerId('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-emerald-100">
            <Truck size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Portería: Registro de Entradas</h1>
            <p className="text-slate-500 font-medium">Control de devoluciones y canjes de mercadería.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FORMULARIO DE CARGA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
               <Plus className="text-emerald-500" size={20} /> Nueva Hoja de Entrada
            </h2>
            
            <div className="space-y-6">
              {/* Selector de Cliente */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Cliente / Distribuidor</label>
                <select 
                  required
                  disabled={currentItems.length > 0}
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className={`w-full p-4 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${currentItems.length > 0 ? 'bg-slate-50 opacity-70' : 'bg-white'}`}
                >
                  <option value="">Seleccionar Distribuidor...</option>
                  {MOCK_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {currentItems.length > 0 && (
                  <p className="text-[9px] font-bold text-blue-500 uppercase mt-2 ml-1">Cliente fijado por carga en curso</p>
                )}
              </div>

              {/* Sección de Ítem Temporal */}
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Agregar Producto</p>
                
                <div>
                  <select 
                    value={itemForm.productId}
                    onChange={e => setItemForm({...itemForm, productId: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar Producto...</option>
                    {MOCK_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number" 
                    min="1"
                    placeholder="Cantidad"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({...itemForm, quantity: parseInt(e.target.value) || 0})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                  />
                  <select 
                    value={itemForm.reason}
                    onChange={e => setItemForm({...itemForm, reason: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                  >
                    <option value="Vencimiento">Vencimiento</option>
                    <option value="Rotura">Rotura</option>
                    <option value="Error de Pedido">Error</option>
                    <option value="Canje">Canje</option>
                  </select>
                </div>

                <button 
                  type="button"
                  disabled={!itemForm.productId || !selectedCustomerId}
                  onClick={handleAddItem}
                  className="w-full py-3 bg-white text-emerald-600 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-emerald-600 disabled:hover:border-emerald-100"
                >
                  <Plus size={16} /> Agregar a la Lista
                </button>
              </div>

              {/* Tabla de Ítems Preparados */}
              {currentItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Items en la Hoja ({currentItems.length})</p>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    {currentItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm uppercase">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} unidades • {item.reason}</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={handleFinalSubmit}
                    className="w-full py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 mt-4"
                  >
                    <ClipboardCheck size={20} /> Registrar Entrada Completa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LISTA DE PENDIENTES */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">
                <History className="text-blue-500" size={20} /> Entradas de Hoy
              </h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {gateEntries.length === 0 ? (
                <div className="p-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <Package size={40} />
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No hay ingresos registrados hoy.</p>
                </div>
              ) : (
                gateEntries.map(entry => (
                  <div key={entry.id} className="p-8 hover:bg-slate-50 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
                          <ArrowDownCircle size={22} />
                        </div>
                        <div>
                          <p className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2">{entry.customerName}</p>
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">
                               {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                                <Plus size={10} /> {entry.items.length} Artículos
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 pl-16 md:pl-0">
                        <div className="text-right">
                           <p className="text-2xl font-black text-slate-900 tracking-tighter">
                             {entry.items.reduce((sum, item) => sum + item.quantity, 0)}
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">unidades</span>
                           </p>
                           <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">A espera de Producción</span>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" size={24} />
                      </div>
                    </div>
                    
                    {/* Detalles expandidos (simulados visualmente) */}
                    <div className="mt-6 ml-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {entry.items.map(item => (
                         <div key={item.id} className="bg-white/50 border border-slate-100 p-3 rounded-xl flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{item.productName}</span>
                            <span className="text-[10px] font-black text-blue-500 uppercase">{item.quantity}u • {item.reason}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateView;

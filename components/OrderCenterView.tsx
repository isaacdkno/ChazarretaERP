
import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  Save, 
  Edit3,
  Percent,
  Layers,
  Zap,
  Tag,
  Filter,
  X,
  PlusCircle,
  Settings,
  DollarSign
} from 'lucide-react';
import { Order, OrderStatus, Product, Customer, PriceList } from '../types';
import { MOCK_PRODUCTS, MOCK_PRICE_LISTS } from '../constants';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
  addOrder?: (order: Order) => void;
}

const OrderCenterView: React.FC<Props> = ({ orders, updateOrder, addOrder }) => {
  const [activeTab, setActiveTab] = useState<'VALIDATE' | 'PRODUCTS' | 'BONUS' | 'PRICES'>('PRODUCTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [priceLists, setPriceLists] = useState<PriceList[]>(MOCK_PRICE_LISTS);
  
  // Estado para formularios
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    brand: 'La Fornarina',
    category: 'Panificados',
    bonusEnabled: true,
    prices: {}
  });

  const [showPriceListForm, setShowPriceListForm] = useState(false);
  const [newPriceList, setNewPriceList] = useState({ name: '', description: '' });

  // --- LÓGICA DE PRODUCTOS ---
  const handleSaveProduct = () => {
    if (!newProduct.name) return;
    
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...editingProduct, ...newProduct } as Product : p));
    } else {
      const productToAdd: Product = {
        ...newProduct,
        id: Math.random().toString(36).substr(2, 9),
        prices: priceLists.reduce((acc, list) => ({ ...acc, [list.id]: 0 }), {})
      } as Product;
      setProducts([productToAdd, ...products]);
    }
    setShowProductForm(false);
    setEditingProduct(null);
    setNewProduct({ brand: 'La Fornarina', category: 'Panificados', bonusEnabled: true, prices: {} });
  };

  const deleteProduct = (id: string) => {
    if (confirm('¿Está seguro de eliminar este producto? Esto afectará históricos y listas.')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  // --- LÓGICA DE LISTAS DE PRECIOS ---
  const handleSavePriceList = () => {
    if (!newPriceList.name) return;
    const newList: PriceList = {
      id: 'l' + (priceLists.length + 1),
      name: newPriceList.name,
      description: newPriceList.description
    };
    setPriceLists([...priceLists, newList]);
    // Inicializar precios en 0 para todos los productos en esta nueva lista
    setProducts(products.map(p => ({
      ...p,
      prices: { ...p.prices, [newList.id]: 0 }
    })));
    setShowPriceListForm(false);
    setNewPriceList({ name: '', description: '' });
  };

  const updateProductPrice = (productId: string, listId: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setProducts(products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          prices: { ...p.prices, [listId]: numericValue }
        };
      }
      return p;
    }));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Admin Maestro</h1>
          <p className="text-slate-500 font-medium">Control central de catálogo, precios y bonificaciones.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: 'PRODUCTS', label: 'Productos', icon: <Package size={18} /> },
            { id: 'PRICES', label: 'Tarifarios', icon: <DollarSign size={18} /> },
            { id: 'BONUS', label: 'Bonificaciones', icon: <Percent size={18} /> },
            { id: 'VALIDATE', label: 'Validar Pedidos', icon: <ClipboardCheck size={18} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* VISTA: GESTIÓN DE PRODUCTOS */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar en el catálogo..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-12 pr-6 py-3 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none w-80 font-medium transition-all"
                />
             </div>
             <button 
              onClick={() => { setEditingProduct(null); setNewProduct({ brand: 'La Fornarina', category: 'Panificados', bonusEnabled: true, prices: {} }); setShowProductForm(true); }}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
             >
               <PlusCircle size={18} /> Nuevo Producto
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white border border-slate-200 p-6 rounded-[2.5rem] hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                   <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${p.brand === 'La Fornarina' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                      {p.brand}
                   </span>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingProduct(p); setNewProduct(p); setShowProductForm(true); }}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteProduct(p.id)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
                <h3 className="font-black text-slate-800 text-xl uppercase leading-tight mb-2">{p.name}</h3>
                <div className="flex items-center gap-4 mt-6 pt-6 border-t border-slate-50">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoría</p>
                      <p className="text-sm font-bold text-slate-700">{p.category}</p>
                   </div>
                   <div className="ml-auto flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${p.bonusEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <span className="text-[10px] font-black text-slate-500 uppercase">Bonificable</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA: MATRIZ DE PRECIOS */}
      {activeTab === 'PRICES' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
               <div>
                  <h2 className="font-black text-slate-800 uppercase tracking-tight text-xl">Matriz de Tarifarios</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Edición directa de precios por lista</p>
               </div>
               <button 
                onClick={() => setShowPriceListForm(true)}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
               >
                 <Plus size={16} /> Crear Nueva Lista
               </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Producto / Marca</th>
                    {priceLists.map(list => (
                      <th key={list.id} className="px-8 py-5 text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-slate-100 text-center">
                        {list.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-5">
                        <p className="font-black text-slate-800 uppercase text-sm">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{p.brand}</p>
                      </td>
                      {priceLists.map(list => (
                        <td key={list.id} className="px-4 py-5">
                          <div className="relative group/input max-w-[140px] mx-auto">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                             <input 
                              type="number" 
                              value={p.prices[list.id] || 0}
                              onChange={(e) => updateProductPrice(p.id, list.id, e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-transparent border border-transparent rounded-lg text-sm font-black text-slate-800 text-center focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all group-hover:border-slate-200"
                             />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA: BONIFICACIONES (YA GRANULAR) */}
      {activeTab === 'BONUS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
               <div>
                 <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Bonificación Granular</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Reglas automáticas de mercadería sin cargo</p>
               </div>
             </div>
             <div className="divide-y divide-slate-100">
                {products.map(p => (
                  <div key={p.id} className={`p-8 transition-all ${p.bonusEnabled ? 'bg-white' : 'bg-slate-50/30 opacity-60'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                      <div className="flex items-center gap-5 min-w-[320px]">
                        <input 
                          type="checkbox" 
                          checked={p.bonusEnabled}
                          onChange={() => setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusEnabled: !prod.bonusEnabled} : prod))}
                          className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500 border-slate-300 transition-all cursor-pointer"
                        />
                        <div>
                          <p className="font-black text-lg tracking-tight uppercase text-slate-800">{p.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.brand}</p>
                        </div>
                      </div>

                      {p.bonusEnabled && (
                        <>
                        <div className="flex-1 grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Umbral Unidades</label>
                            <input 
                              type="number"
                              className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl text-sm font-black w-full outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                              value={p.bonusThreshold || ''}
                              onChange={e => setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusThreshold: parseInt(e.target.value) || undefined} : prod))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bonif %</label>
                            <input 
                              type="number"
                              className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl text-sm font-black w-full outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                              value={p.bonusPercentage || ''}
                              onChange={e => setProducts(products.map(prod => prod.id === p.id ? {...prod, bonusPercentage: parseInt(e.target.value) || undefined} : prod))}
                            />
                          </div>
                        </div>
                        {p.bonusThreshold && p.bonusPercentage && (
                          <div className="lg:w-48 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                             <Zap size={16} className="text-emerald-500 fill-emerald-500" />
                             <div>
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Impacto Est.</p>
                                <p className="text-xs font-bold text-emerald-700">+{Math.ceil(p.bonusThreshold * (p.bonusPercentage / 100))}u Gratis</p>
                             </div>
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* VISTA: VALIDACIÓN (PLACEHOLDER) */}
      {activeTab === 'VALIDATE' && <div className="p-20 bg-white rounded-[2.5rem] border border-slate-200 text-slate-300 font-black text-center uppercase tracking-[0.2em] shadow-inner">Módulo de Validación de Comandas</div>}

      {/* --- MODALES DE FORMULARIO --- */}

      {/* Modal Producto */}
      {showProductForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                 <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                 <button onClick={() => setShowProductForm(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
              </div>
              <div className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Artículo</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="Ej: Pan de Molde XL"
                      value={newProduct.name || ''}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Marca</label>
                       <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none"
                        value={newProduct.brand}
                        onChange={e => setNewProduct({...newProduct, brand: e.target.value as any})}
                       >
                         <option value="La Fornarina">La Fornarina</option>
                         <option value="Villecco">Villecco</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                       <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        placeholder="Ej: Dulces"
                        value={newProduct.category || ''}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="pt-4 flex items-center gap-4">
                    <input 
                      type="checkbox" 
                      id="bonus_en"
                      checked={newProduct.bonusEnabled}
                      onChange={e => setNewProduct({...newProduct, bonusEnabled: e.target.checked})}
                      className="w-6 h-6 rounded-lg text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="bonus_en" className="text-sm font-bold text-slate-600 uppercase tracking-widest">Habilitar Bonificaciones Automáticas</label>
                 </div>
                 <button 
                  onClick={handleSaveProduct}
                  className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 mt-4"
                 >
                   <Save size={18} /> {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Lista de Precios */}
      {showPriceListForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                 <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Nuevo Tarifario</h2>
                 <button onClick={() => setShowPriceListForm(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
              </div>
              <div className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre de la Lista</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="Ej: Lista Exportación"
                      value={newPriceList.name}
                      onChange={e => setNewPriceList({...newPriceList, name: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Descripción</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="Detalles sobre quién aplica esta tarifa..."
                      rows={3}
                      value={newPriceList.description}
                      onChange={e => setNewPriceList({...newPriceList, description: e.target.value})}
                    />
                 </div>
                 <button 
                  onClick={handleSavePriceList}
                  className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 mt-4"
                 >
                   <Save size={18} /> Crear Lista y Cargar Precios
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default OrderCenterView;

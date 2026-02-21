
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Tag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Settings2
} from 'lucide-react';
import { Product, PriceList } from '../types';
import { supabase } from '../supabase';

interface Props {
  products: Product[];
  priceLists: PriceList[];
  onRefresh: () => void;
}

const ProductManagement: React.FC<Props> = ({ products, priceLists, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'PRICE_LISTS'>('PRODUCTS');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Form states for new/edit product
  const [editProduct, setEditProduct] = useState<Partial<Product>>({});
  const [showNewForm, setShowNewForm] = useState(false);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveProduct = async () => {
    if (!editProduct.name || !editProduct.brand) return;
    setLoading(true);
    try {
      const productData = {
        name: editProduct.name,
        brand: editProduct.brand || 'La Fornarina',
        category: editProduct.category || 'General',
        bonus_enabled: editProduct.bonusEnabled ?? true,
        bonus_threshold: editProduct.bonusThreshold || 20,
        bonus_percentage: editProduct.bonusPercentage || 10
      };

      if (isEditing) {
        await supabase.from('products').update(productData).eq('id', isEditing);
      } else {
        const { data } = await supabase.from('products').insert([{
          ...productData,
          id: 'p-' + Math.random().toString(36).substr(2, 5)
        }]).select().single();
        
        // Initialize prices for the new product
        if (data) {
          const initialPrices = priceLists.map(list => ({
            product_id: data.id,
            price_list_id: list.id,
            price: 0
          }));
          await supabase.from('product_prices').insert(initialPrices);
        }
      }
      
      onRefresh();
      setIsEditing(null);
      setShowNewForm(false);
      setEditProduct({});
    } catch (error) {
      console.error(error);
      alert("Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (productId: string, listId: string, price: number) => {
    try {
      await supabase.from('product_prices')
        .upsert({ product_id: productId, price_list_id: listId, price })
        .eq('product_id', productId)
        .eq('price_list_id', listId);
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Catálogo y Precios</h1>
          <p className="text-slate-500 font-medium">Administra tus productos y múltiples listas de precios.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRODUCTS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Productos
          </button>
          <button 
            onClick={() => setActiveTab('PRICE_LISTS')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRICE_LISTS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Listas de Precios
          </button>
        </div>
      </header>

      {activeTab === 'PRODUCTS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Listado de Productos */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre o marca..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setShowNewForm(true)}
                  className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg"
                >
                  <Plus size={16} /> Nuevo Producto
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <div key={product.id} className="p-6 hover:bg-slate-50/50 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                          <Package size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 uppercase tracking-tight">{product.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{product.brand}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setIsEditing(product.id);
                            setEditProduct(product);
                            setShowNewForm(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Precios por Lista */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {priceLists.map(list => (
                        <div key={list.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{list.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400">$</span>
                            <input 
                              type="number"
                              className="w-full bg-transparent font-black text-slate-800 outline-none"
                              value={product.prices[list.id] || 0}
                              onChange={e => handleUpdatePrice(product.id, list.id, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
              <Settings2 size={40} className="mb-6 text-blue-500 opacity-50" />
              <h3 className="text-xl font-black mb-4 uppercase tracking-tight">Gestión de Precios</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Los cambios en los precios se aplican instantáneamente a las nuevas comandas. Las comandas ya creadas mantienen el precio histórico.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Productos</p>
                    <p className="text-lg font-black">{products.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                    <Tag size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Listas Activas</p>
                    <p className="text-lg font-black">{priceLists.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-20 text-center">
          <Tag size={64} className="mx-auto mb-6 text-slate-200" />
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Configuración de Listas</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Las listas de precios permiten segmentar tus clientes (Distribuidores, Supermercados, etc.) y asignarles valores diferenciados automáticamente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {priceLists.map(list => (
              <div key={list.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-left">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm mb-4">
                  <ChevronRight size={20} />
                </div>
                <h4 className="font-black text-slate-800 uppercase tracking-tight mb-1">{list.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{list.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Nuevo/Editar Producto */}
      {showNewForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setShowNewForm(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre del Producto</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                    value={editProduct.name || ''}
                    onChange={e => setEditProduct({...editProduct, name: e.target.value})}
                    placeholder="Ej: Pan de Molde"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Marca</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                    value={editProduct.brand || 'La Fornarina'}
                    onChange={e => setEditProduct({...editProduct, brand: e.target.value as any})}
                  >
                    <option value="La Fornarina">La Fornarina</option>
                    <option value="Villecco">Villecco</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                    value={editProduct.category || 'Panificados'}
                    onChange={e => setEditProduct({...editProduct, category: e.target.value})}
                  >
                    <option value="Panificados">Panificados</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Dulces">Dulces</option>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 self-end">
                  <input 
                    type="checkbox"
                    id="bonus"
                    className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500"
                    checked={editProduct.bonusEnabled ?? true}
                    onChange={e => setEditProduct({...editProduct, bonusEnabled: e.target.checked})}
                  />
                  <label htmlFor="bonus" className="text-xs font-bold text-blue-800">Bonificación Activa</label>
                </div>
              </div>

              {editProduct.bonusEnabled && (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuración de Regalo (Ej: 10+1)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Mínimo para Regalo</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                        value={editProduct.bonusThreshold || 20}
                        onChange={e => setEditProduct({...editProduct, bonusThreshold: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">% de Regalo</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                          value={editProduct.bonusPercentage || 10}
                          onChange={e => setEditProduct({...editProduct, bonusPercentage: parseInt(e.target.value)})}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowNewForm(false)}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProduct}
                disabled={loading}
                className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Guardando...' : <Save size={16} />} Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;

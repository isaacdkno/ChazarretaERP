
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
  Settings2,
  FileText,
  Download,
  History as HistoryIcon,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { Product, PriceList, PriceHistory } from '../types';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  products: Product[];
  priceLists: PriceList[];
  onRefresh: () => void;
}

const PriceInput: React.FC<{
  initialValue: number;
  onSave: (value: number) => void;
}> = ({ initialValue, onSave }) => {
  const [value, setValue] = useState(initialValue.toString());

  useEffect(() => {
    setValue(initialValue.toString());
  }, [initialValue]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-black text-slate-400">$</span>
      <input 
        type="number"
        className="w-full bg-transparent font-black text-slate-800 outline-none"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => {
          const numValue = parseFloat(value) || 0;
          if (numValue !== initialValue) {
            onSave(numValue);
          }
        }}
      />
    </div>
  );
};

const ProductManagement: React.FC<Props> = ({ products, priceLists, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'PRICE_LISTS'>('PRODUCTS');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<'TODAS' | 'La Fornarina' | 'Villecco'>('TODAS');
  const [loading, setLoading] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);

  // Form states for new/edit product
  const [editProduct, setEditProduct] = useState<Partial<Product>>({});
  const [showNewForm, setShowNewForm] = useState(false);

  // Form states for new/edit price list
  const [editPriceList, setEditPriceList] = useState<Partial<PriceList>>({});
  const [showPriceListForm, setShowPriceListForm] = useState(false);
  const [isEditingPriceList, setIsEditingPriceList] = useState<string | null>(null);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = selectedBrand === 'TODAS' || p.brand === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  const fetchPriceHistory = async (listId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('price_list_id', listId)
        .order('effective_date', { ascending: false });
      
      if (error) throw error;
      
      const mappedData: PriceHistory[] = (data || []).map(item => ({
        id: item.id,
        priceListId: item.price_list_id,
        productId: item.product_id,
        price: item.price,
        effectiveDate: item.effective_date
      }));

      setPriceHistory(mappedData);
      setViewingHistory(listId);
    } catch (error) {
      console.error(error);
      alert("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    const name = editProduct.name?.trim();
    const brand = editProduct.brand || 'La Fornarina';
    
    if (!name) {
      alert("El nombre del producto es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name: name,
        brand: brand,
        category: editProduct.category || 'Panificados',
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

  const handleUpdatePrice = async (productId: string, listId: string, newPrice: number) => {
    try {
      const product = products.find(p => p.id === productId);
      const oldPrice = product?.prices[listId] || 0;

      if (oldPrice === newPrice) return;

      await supabase.from('price_history').insert([{
        price_list_id: listId,
        product_id: productId,
        price: oldPrice,
        effective_date: new Date().toISOString()
      }]);

      await supabase.from('product_prices')
        .upsert({ product_id: productId, price_list_id: listId, price: newPrice });

      await supabase.from('price_lists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', listId);

      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSavePriceList = async () => {
    const name = editPriceList.name?.trim();
    if (!name) {
      alert("El nombre de la lista es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const listData = {
        name,
        description: editPriceList.description || '',
        updated_at: new Date().toISOString()
      };

      if (isEditingPriceList) {
        await supabase.from('price_lists').update(listData).eq('id', isEditingPriceList);
      } else {
        const newListId = 'list-' + Math.random().toString(36).substr(2, 5);
        await supabase.from('price_lists').insert([{
          ...listData,
          id: newListId
        }]);

        const initialPrices = products.map(p => ({
          product_id: p.id,
          price_list_id: newListId,
          price: 0
        }));
        await supabase.from('product_prices').insert(initialPrices);
      }

      onRefresh();
      setShowPriceListForm(false);
      setIsEditingPriceList(null);
      setEditPriceList({});
    } catch (error) {
      console.error(error);
      alert("Error al guardar la lista de precios");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (list: PriceList) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('CHAZARRETA ERP', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Lista de Precios: ${list.name.toUpperCase()}`, 14, 32);
    doc.text(`Vigente desde: ${format(new Date(list.updatedAt), 'dd/MM/yyyy HH:mm')}`, 14, 40);
    
    const tableData = products.map(p => [
      p.name,
      p.brand,
      p.category,
      `$${p.prices[list.id]?.toLocaleString() || '0'}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Producto', 'Marca', 'Categoría', 'Precio']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 50 },
    });

    doc.save(`Lista_Precios_${list.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
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
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar por nombre..."
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setIsEditing(null);
                      setEditProduct({
                        category: 'Panificados',
                        brand: 'La Fornarina',
                        bonusEnabled: true,
                        bonusThreshold: 20,
                        bonusPercentage: 10
                      });
                      setShowNewForm(true);
                    }}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg"
                  >
                    <Plus size={16} /> Nuevo Producto
                  </button>
                </div>

                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                  {(['TODAS', 'La Fornarina', 'Villecco'] as const).map(brand => (
                    <button
                      key={brand}
                      onClick={() => setSelectedBrand(brand)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        selectedBrand === brand 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {priceLists.map(list => (
                        <div key={list.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{list.name}</p>
                          <PriceInput 
                            initialValue={product.prices[list.id] || 0}
                            onSave={newPrice => handleUpdatePrice(product.id, list.id, newPrice)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
        <div className="space-y-8">
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setIsEditingPriceList(null);
                setEditPriceList({});
                setShowPriceListForm(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg"
            >
              <Plus size={16} /> Nueva Lista de Precios
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {priceLists.map(list => (
              <div key={list.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                  <button 
                    onClick={() => {
                      setIsEditingPriceList(list.id);
                      setEditPriceList(list);
                      setShowPriceListForm(true);
                    }}
                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>

                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                  <Tag size={28} />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{list.name}</h3>
                <p className="text-slate-500 text-xs font-medium mb-6 line-clamp-2">{list.description || 'Sin descripción'}</p>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Vigencia desde</span>
                    <span className="text-slate-900">{format(new Date(list.updatedAt), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Última actualización</span>
                    <span className="text-slate-900">{format(new Date(list.updatedAt), 'HH:mm')} hs</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => exportToPDF(list)}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all"
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button 
                    onClick={() => fetchPriceHistory(list.id)}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <HistoryIcon size={14} /> Historial
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {showPriceListForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {isEditingPriceList ? 'Editar Lista' : 'Nueva Lista de Precios'}
              </h2>
              <button onClick={() => setShowPriceListForm(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombre de la Lista</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                  value={editPriceList.name || ''}
                  onChange={e => setEditPriceList({...editPriceList, name: e.target.value})}
                  placeholder="Ej: Lista Minorista"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Descripción</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px]"
                  value={editPriceList.description || ''}
                  onChange={e => setEditPriceList({...editPriceList, description: e.target.value})}
                  placeholder="Detalles sobre quién usa esta lista..."
                />
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowPriceListForm(false)}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSavePriceList}
                disabled={loading}
                className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Guardando...' : <Save size={16} />} Guardar Lista
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewingHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <button onClick={() => setViewingHistory(null)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                    <ArrowLeft size={20} className="text-slate-600" />
                  </button>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      Historial de Precios
                    </h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      {priceLists.find(l => l.id === viewingHistory)?.name}
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                  <HistoryIcon size={24} />
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-8">
                {priceHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <Calendar size={48} />
                    <p className="font-black uppercase tracking-widest text-xs">No hay cambios registrados aún</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {priceHistory.map((item) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                              <Package size={18} />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 uppercase text-xs">{product?.name || 'Producto Eliminado'}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(item.effectiveDate), 'dd/MM/yyyy HH:mm')} hs</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-slate-900 tracking-tighter">${item.price.toLocaleString()}</p>
                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Precio Anterior</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setViewingHistory(null)}
                  className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-600 transition-all shadow-xl"
                >
                  Cerrar Historial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductManagement;

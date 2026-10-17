
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
  ArrowLeft,
  TrendingUp,
  Clock as ClockIcon,
  Zap as ZapIcon
} from 'lucide-react';
import { Product, PriceList, PriceHistory, PriceUpdateJob } from '../types';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
    <div className="flex items-center gap-0.5 px-1 bg-slate-50 border border-slate-100 rounded hover:bg-white hover:border-blue-200 transition-all">
      <span className="text-[8px] font-black text-slate-300">$</span>
      <input 
        type="number"
        className="w-full bg-transparent font-bold text-slate-700 outline-none text-[10px] text-right py-0.5"
        value={value}
        onChange={e => setValue(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
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
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'PRICE_LISTS' | 'ARCHIVED'>('PRODUCTS');
  const [archivedLists, setArchivedLists] = useState<any[]>([]);
  const [viewingArchivedList, setViewingArchivedList] = useState<any | null>(null);

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<'TODAS' | 'La Fornarina' | 'Villecco'>('TODAS');
  const [loading, setLoading] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [showMassiveUpdate, setShowMassiveUpdate] = useState(false);
  const [massiveUpdateConfig, setMassiveUpdateConfig] = useState({
    listId: 'ALL',
    category: 'ALL',
    brand: 'ALL',
    operation: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: 0,
    roundToTen: true,
    scheduledFor: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [scheduledJobs, setScheduledJobs] = useState<PriceUpdateJob[]>([]);

  // Form states for new/edit product
  const [editProduct, setEditProduct] = useState<Partial<Product>>({});
  const [showNewForm, setShowNewForm] = useState(false);

  // Form states for new/edit price list
  const [editPriceList, setEditPriceList] = useState<Partial<PriceList>>({});
  const [showPriceListForm, setShowPriceListForm] = useState(false);
  const [isEditingPriceList, setIsEditingPriceList] = useState<string | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedListToArchive, setSelectedListToArchive] = useState<string>('');
  const [archivedSearchTerm, setArchivedSearchTerm] = useState('');

  useEffect(() => {
    fetchScheduledJobs();
    processPendingJobs();
    if (activeTab === 'ARCHIVED') {
      fetchArchivedLists();
    }
  }, [activeTab]);

  const fetchArchivedLists = async () => {
    const { data, error } = await supabase
      .from('archived_price_lists')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setArchivedLists(data);
  };

  const handleArchiveList = async () => {
    if (!selectedListToArchive) return;
    
    const listsToArchive = selectedListToArchive === 'ALL' 
      ? priceLists 
      : priceLists.filter(l => l.id === selectedListToArchive);

    if (listsToArchive.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const list of listsToArchive) {
      const pricesSnapshot: Record<string, number> = {};
      products.forEach(p => {
        if (p.prices[list.id]) {
          pricesSnapshot[p.id] = p.prices[list.id];
        }
      });

      try {
        const { error } = await supabase.from('archived_price_lists').insert([{
          original_list_id: list.id,
          name: `${list.name} - ${format(new Date(), 'MMMM yyyy', { locale: es }).toUpperCase()}`,
          valid_from: new Date().toISOString(),
          prices_snapshot: pricesSnapshot
        }]);

        if (error) throw error;
        successCount++;
      } catch (error: any) {
        console.error(`Error al archivar la lista ${list.name}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      alert(selectedListToArchive === 'ALL' 
        ? `Se archivaron ${successCount} listas correctamente.${errorCount > 0 ? ` Fallaron ${errorCount}.` : ''}`
        : "Copia de seguridad creada exitosamente.");
      setShowArchiveModal(false);
      setSelectedListToArchive('');
      fetchArchivedLists();
    } else {
      alert("No se pudo crear ninguna copia de seguridad. Revise la consola para más detalles.");
    }
  };

  const translateMonthNames = (name: string) => {
    return name
      .replace(/JANUARY/g, 'ENERO')
      .replace(/FEBRUARY/g, 'FEBRERO')
      .replace(/MARCH/g, 'MARZO')
      .replace(/APRIL/g, 'ABRIL')
      .replace(/MAY/g, 'MAYO')
      .replace(/JUNE/g, 'JUNIO')
      .replace(/JULY/g, 'JULIO')
      .replace(/AUGUST/g, 'AGOSTO')
      .replace(/SEPTEMBER/g, 'SEPTIEMBRE')
      .replace(/OCTOBER/g, 'OCTUBRE')
      .replace(/NOVEMBER/g, 'NOVIEMBRE')
      .replace(/DECEMBER/g, 'DICIEMBRE');
  };

  const exportArchivedListToPDF = (archivedList: any) => {
    const doc = new jsPDF();
    const today = format(new Date(archivedList.created_at), 'dd/MM/yyyy');

    // Header with wrapping
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    const title = `LISTA HISTÓRICA: ${translateMonthNames(archivedList.name).toUpperCase()}`;
    const splitTitle = doc.splitTextToSize(title, 180); // Wrap at 180mm width
    doc.text(splitTitle, 14, 20);
    
    // Calculate Y position based on title height
    const titleHeight = splitTitle.length * 7;
    let yPos = 20 + titleHeight;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha de Archivo: ${today}`, 14, yPos);
    doc.text(`ID Referencia: ${archivedList.id.split('-')[0]}`, 14, yPos + 5);

    const tableData = products
      .filter(p => archivedList.prices_snapshot[p.id] !== undefined)
      .map(p => [
        p.name.toUpperCase(),
        p.brand.toUpperCase(),
        p.category.toUpperCase(),
        `$${archivedList.prices_snapshot[p.id].toLocaleString('es-AR')}`
      ]);

    autoTable(doc, {
      head: [['Producto', 'Marca', 'Categoría', 'Precio Histórico']],
      body: tableData,
      startY: yPos + 12,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });

    doc.save(`lista_historica_${archivedList.name.replace(/\s+/g, '_').toLowerCase()}_${today}.pdf`);
  };

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
        category: editProduct.category || 'ESPECIALIDADES',
        bonus_enabled: editProduct.bonusEnabled ?? true,
        bonus_threshold: editProduct.bonusThreshold ?? 20,
        bonus_percentage: editProduct.bonusPercentage ?? 10
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(productData).eq('id', isEditing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('products').insert([{
          ...productData,
          id: 'p-' + Math.random().toString(36).substr(2, 5)
        }]).select().single();
        
        if (error) throw error;

        if (data) {
          const initialPrices = priceLists.map(list => ({
            product_id: data.id,
            price_list_id: list.id,
            price: 0
          }));
          const { error: pricesError } = await supabase.from('product_prices').insert(initialPrices);
          if (pricesError) throw pricesError;
        }
      }
      
      onRefresh();
      setIsEditing(null);
      setShowNewForm(false);
      setEditProduct({});
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(`Error al guardar el producto: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (productId: string, listId: string, newPrice: number) => {
    try {
      const product = products.find(p => p.id === productId);
      const oldPrice = product?.prices[listId] || 0;

      if (oldPrice === newPrice) return;

      const { error: historyError } = await supabase.from('price_history').insert([{
        price_list_id: listId,
        product_id: productId,
        price: oldPrice,
        effective_date: new Date().toISOString()
      }]);
      if (historyError) {
        console.warn("Could not save price history, table might not exist.", historyError);
      }

      const { error: upsertError } = await supabase.from('product_prices')
        .upsert({ product_id: productId, price_list_id: listId, price: newPrice }, { onConflict: 'product_id,price_list_id' });
        
      if (upsertError) {
        console.error("Error upserting price:", upsertError);
        throw upsertError;
      }

      const { error: updateError } = await supabase.from('price_lists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', listId);
        
      if (updateError) {
        console.warn("Could not update updated_at on price_lists, column might not exist.");
      }

      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  const fetchScheduledJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('price_update_jobs')
        .select('*')
        .order('scheduled_for', { ascending: true });
      
      if (error) {
        console.warn("Table price_update_jobs might not exist yet.");
        return;
      }
      
      setScheduledJobs((data || []).map(j => ({
        id: j.id,
        priceListId: j.price_list_id,
        category: j.category,
        brand: j.brand,
        operation: j.operation,
        value: j.value,
        status: j.status,
        scheduledFor: j.scheduled_for,
        createdAt: j.created_at
      })));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchScheduledJobs();
    processPendingJobs();
  }, []);

  const batchUpdatePrices = async (
    updates: { productId: string; listId: string; oldPrice: number; newPrice: number }[]
  ) => {
    if (updates.length === 0) return;
    const nowIso = new Date().toISOString();

    const historyRows = updates.map(u => ({
      price_list_id: u.listId,
      product_id: u.productId,
      price: u.oldPrice,
      effective_date: nowIso
    }));

    const { error: historyError } = await supabase.from('price_history').insert(historyRows);
    if (historyError) {
      console.warn("Could not save batch price history, table might not exist.", historyError);
    }

    const upsertRows = updates.map(u => ({
      product_id: u.productId,
      price_list_id: u.listId,
      price: u.newPrice
    }));

    const { error: upsertError } = await supabase
      .from('product_prices')
      .upsert(upsertRows, { onConflict: 'product_id,price_list_id' });

    if (upsertError) {
      console.error("Error batch upserting prices:", upsertError);
      throw upsertError;
    }

    const affectedListIds = Array.from(new Set(updates.map(u => u.listId)));
    const { error: updateError } = await supabase
      .from('price_lists')
      .update({ updated_at: nowIso })
      .in('id', affectedListIds);

    if (updateError) {
      console.warn("Could not update updated_at on price_lists, column might not exist.");
    }
  };

  const processPendingJobs = async () => {
    try {
      // 1. Fetch pending jobs that are due (scheduled_for <= now)
      const { data: pendingJobs, error } = await supabase
        .from('price_update_jobs')
        .select('*')
        .eq('status', 'PENDING')
        .lte('scheduled_for', new Date().toISOString());

      if (error || !pendingJobs || pendingJobs.length === 0) return;

      let processedCount = 0;
      const allUpdates: { productId: string; listId: string; oldPrice: number; newPrice: number }[] = [];

      // 2. Process each job
      for (const job of pendingJobs) {
        const targetLists = job.price_list_id === 'ALL' 
          ? priceLists.map(l => l.id) 
          : [job.price_list_id];
        
        const targetProducts = products.filter(p => {
          const matchesCategory = !job.category || p.category === job.category;
          const matchesBrand = !job.brand || p.brand === job.brand;
          return matchesCategory && matchesBrand;
        });

        for (const listId of targetLists) {
          for (const product of targetProducts) {
            const currentPrice = product.prices[listId] || 0;
            let newPrice = currentPrice;
            
            if (job.operation === 'PERCENTAGE') {
              newPrice = currentPrice * (1 + job.value / 100);
            } else {
              newPrice = currentPrice + job.value;
            }

            // Round logic (defaulting to nearest 10 for scheduled jobs for safety)
            newPrice = Math.round(newPrice / 10) * 10;

            if (newPrice !== currentPrice) {
              allUpdates.push({
                productId: product.id,
                listId,
                oldPrice: currentPrice,
                newPrice
              });
            }
          }
        }

        // 3. Mark job as COMPLETED
        await supabase
          .from('price_update_jobs')
          .update({ status: 'COMPLETED' })
          .eq('id', job.id);
        
        processedCount++;
      }

      if (allUpdates.length > 0) {
        await batchUpdatePrices(allUpdates);
      }

      if (processedCount > 0) {
        alert(`Se han ejecutado ${processedCount} actualizaciones de precios programadas pendientes.`);
        fetchScheduledJobs(); // Refresh the list
        onRefresh(); // Refresh products once
      }

    } catch (error) {
      console.error("Error processing pending jobs:", error);
    }
  };

  const handleMassiveUpdate = async (isScheduled: boolean) => {
    setLoading(true);
    try {
      if (isScheduled) {
        const jobData = {
          id: 'job-' + Math.random().toString(36).substr(2, 5),
          price_list_id: massiveUpdateConfig.listId,
          category: massiveUpdateConfig.category === 'ALL' ? null : massiveUpdateConfig.category,
          brand: massiveUpdateConfig.brand === 'ALL' ? null : massiveUpdateConfig.brand,
          operation: massiveUpdateConfig.operation,
          value: massiveUpdateConfig.value,
          status: 'PENDING',
          scheduled_for: massiveUpdateConfig.scheduledFor,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('price_update_jobs').insert([jobData]);
        if (error) throw error;
        
        setShowMassiveUpdate(false);
        alert("Actualización programada con éxito.");
        fetchScheduledJobs();
      } else {
        // Immediate execution (batched)
        const targetLists = massiveUpdateConfig.listId === 'ALL' 
          ? priceLists.map(l => l.id) 
          : [massiveUpdateConfig.listId];
        
        const targetProducts = products.filter(p => {
          const matchesCategory = massiveUpdateConfig.category === 'ALL' || p.category === massiveUpdateConfig.category;
          const matchesBrand = massiveUpdateConfig.brand === 'ALL' || p.brand === massiveUpdateConfig.brand;
          return matchesCategory && matchesBrand;
        });

        const updates: { productId: string; listId: string; oldPrice: number; newPrice: number }[] = [];

        for (const listId of targetLists) {
          for (const product of targetProducts) {
            const currentPrice = product.prices[listId] || 0;
            let newPrice = currentPrice;
            
            if (massiveUpdateConfig.operation === 'PERCENTAGE') {
              newPrice = currentPrice * (1 + massiveUpdateConfig.value / 100);
            } else {
              newPrice = currentPrice + massiveUpdateConfig.value;
            }

            // Round to nearest 10 if enabled
            if (massiveUpdateConfig.roundToTen) {
              newPrice = Math.round(newPrice / 10) * 10;
            } else {
              newPrice = Math.round(newPrice * 100) / 100;
            }

            if (newPrice !== currentPrice) {
              updates.push({
                productId: product.id,
                listId,
                oldPrice: currentPrice,
                newPrice
              });
            }
          }
        }

        if (updates.length > 0) {
          await batchUpdatePrices(updates);
        }

        setShowMassiveUpdate(false);
        alert("Actualización masiva completada.");
      }
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("Error al procesar la actualización masiva.");
    } finally {
      setLoading(false);
    }
  };

  const cancelJob = async (id: string) => {
    try {
      await supabase.from('price_update_jobs').update({ status: 'CANCELLED' }).eq('id', id);
      fetchScheduledJobs();
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
        description: editPriceList.description || ''
      };

      if (isEditingPriceList) {
        const { error } = await supabase.from('price_lists').update(listData).eq('id', isEditingPriceList);
        if (error) throw error;
      } else {
        const newListId = 'list-' + Math.random().toString(36).substr(2, 5);
        const { error } = await supabase.from('price_lists').insert([{
          ...listData,
          id: newListId
        }]);
        if (error) throw error;

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
    doc.text(`Vigente desde: ${format(new Date(list.updatedAt || new Date()), 'dd/MM/yyyy HH:mm')}`, 14, 40);
    
    const tableData = products
      .filter(p => (p.prices[list.id] || 0) > 0)
      .map(p => [
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
          
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Productos: <span className="text-slate-900">{products.length}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Listas Activas: <span className="text-slate-900">{priceLists.length}</span></span>
            </div>
          </div>
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
          <button 
            onClick={() => setActiveTab('ARCHIVED')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ARCHIVED' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Archivo Histórico
          </button>
        </div>
      </header>

      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
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
                  <button 
                    onClick={() => setShowMassiveUpdate(true)}
                    className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg"
                  >
                    <TrendingUp size={16} /> Actualización Masiva
                  </button>
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
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px] table-fixed">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 sticky left-0 bg-slate-100 z-20 border-r border-slate-200 w-[250px]">Producto / Marca</th>
                    {priceLists.map(list => (
                      <th key={list.id} className="px-4 py-3 text-center border-l border-slate-200 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          <span className="truncate w-full">{list.name}</span>
                          <span className="text-[7px] text-slate-400 font-bold mt-0.5">Ref: {list.id.substr(0,4)}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right border-l border-slate-200 w-[80px]">Acc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-blue-50/30 transition-all group">
                      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center text-slate-400 group-hover:bg-white transition-all">
                            <Package size={12} />
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-slate-800 uppercase text-[10px] truncate">{product.name}</p>
                            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest truncate">{product.brand}</p>
                          </div>
                        </div>
                      </td>
                      {priceLists.map(list => (
                        <td key={list.id} className="px-4 py-2 border-l border-slate-100">
                          <div className="w-full">
                            <PriceInput 
                              initialValue={product.prices[list.id] || 0}
                              onSave={newPrice => handleUpdatePrice(product.id, list.id, newPrice)}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right border-l border-slate-100 flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setIsEditing(product.id);
                            setEditProduct(product);
                            setShowNewForm(true);
                          }}
                          className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                          title="Editar Producto"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteProduct(product)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                          title="Eliminar Producto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={priceLists.length + 2} className="px-6 py-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                          <Package size={32} />
                        </div>
                        <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No se encontraron productos</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PRICE_LISTS' && (
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
                    <span className="text-slate-900">{format(new Date(list.updatedAt || new Date()), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Última actualización</span>
                    <span className="text-slate-900">{format(new Date(list.updatedAt || new Date()), 'HH:mm')} hs</span>
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

      {activeTab === 'ARCHIVED' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar en el archivo..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 transition-all"
                value={archivedSearchTerm}
                onChange={e => setArchivedSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowArchiveModal(true)}
              className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg whitespace-nowrap"
            >
              <Layers size={16} /> Generar Nueva Copia de Seguridad
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-6 py-4">Nombre de la Lista</th>
                    <th className="px-6 py-4">Fecha de Archivo</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {archivedLists
                    .filter(list => 
                      translateMonthNames(list.name).toLowerCase().includes(archivedSearchTerm.toLowerCase()) ||
                      format(new Date(list.created_at), 'dd/MM/yyyy').includes(archivedSearchTerm)
                    )
                    .map(list => (
                    <tr key={list.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Layers size={20} />
                          </div>
                          <span className="font-bold text-slate-700 text-sm">{translateMonthNames(list.name)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                          {format(new Date(list.created_at), 'dd/MM/yyyy HH:mm')} hs
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setViewingArchivedList(list)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            title="Ver Detalle"
                          >
                            <FileText size={18} />
                          </button>
                          <button 
                            onClick={() => exportArchivedListToPDF(list)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Descargar PDF"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {archivedLists.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                          <Layers size={32} />
                        </div>
                        <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No hay listas archivadas</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                Crear Copia de Seguridad
              </h2>
              <button onClick={() => setShowArchiveModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Seleccionar Lista a Archivar</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                  value={selectedListToArchive}
                  onChange={e => setSelectedListToArchive(e.target.value)}
                >
                  <option value="">Seleccione una lista...</option>
                  <option value="ALL" className="font-black text-blue-600">TODAS LAS LISTAS (Copia Masiva)</option>
                  {priceLists.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed">
                  {selectedListToArchive === 'ALL' 
                    ? "Se creará una copia de seguridad individual para CADA lista de precios activa en el sistema."
                    : "Se guardará una copia exacta de todos los precios actuales de esta lista. Podrás consultarla o descargarla en PDF en cualquier momento futuro."
                  }
                </p>
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowArchiveModal(false)}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleArchiveList}
                disabled={!selectedListToArchive}
                className="flex-1 py-4 bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-amber-700 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} /> Guardar Copia
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingArchivedList && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{translateMonthNames(viewingArchivedList.name)}</h2>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                  Archivado el {format(new Date(viewingArchivedList.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportArchivedListToPDF(viewingArchivedList)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm">
                  <Download size={20} />
                </button>
                <button onClick={() => setViewingArchivedList(null)} className="p-3 bg-white text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-8">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 rounded-tl-xl">Producto</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-right rounded-tr-xl">Precio Histórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .filter(p => viewingArchivedList.prices_snapshot[p.id] !== undefined)
                    .map(product => (
                    <tr key={product.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 font-bold text-slate-700 text-xs">{product.name}</td>
                      <td className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.brand}</td>
                      <td className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.category}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                        ${viewingArchivedList.prices_snapshot[product.id].toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div className="grid grid-cols-1 gap-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                    value={editProduct.category || 'ESPECIALIDADES'}
                    onChange={e => setEditProduct({...editProduct, category: e.target.value})}
                  >
                    <option value="ESPECIALIDADES">ESPECIALIDADES</option>
                    <option value="PANES SALUDABLES">PANES SALUDABLES</option>
                    <option value="GALLETERIA">GALLETERIA</option>
                    <option value="MIGA FRACCIONADO">MIGA FRACCIONADO</option>
                    <option value="PREPIZZAS">PREPIZZAS</option>
                    <option value="MOLDES">MOLDES</option>
                    <option value="PAN DULCE">PAN DULCE</option>
                    <option value="PAN RALLADO">PAN RALLADO</option>
                    <option value="PARRILLEROS">PARRILLEROS</option>
                    <option value="TOSTADAS">TOSTADAS</option>
                    <option value="PANADERIA">PANADERIA</option>
                    <option value="Panificados">Panificados (Legado)</option>
                    <option value="Snacks">Snacks (Legado)</option>
                    <option value="Dulces">Dulces (Legado)</option>
                    <option value="Hamburguesas">Hamburguesas (Legado)</option>
                    <option value="General">General (Legado)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <input 
                  type="checkbox"
                  id="bonus"
                  className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500"
                  checked={editProduct.bonusEnabled ?? true}
                  onChange={e => setEditProduct({...editProduct, bonusEnabled: e.target.checked})}
                />
                <label htmlFor="bonus" className="text-xs font-bold text-blue-800">Bonificación Activa (Regalo por cantidad)</label>
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
                        value={editProduct.bonusThreshold ?? 20}
                        onChange={e => setEditProduct({...editProduct, bonusThreshold: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">% de Regalo</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                          value={editProduct.bonusPercentage ?? 10}
                          onChange={e => setEditProduct({...editProduct, bonusPercentage: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                          onWheel={(e) => e.currentTarget.blur()}
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
        {showMassiveUpdate && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Actualización Masiva</h2>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Modifique precios por lote o programe cambios</p>
                  </div>
                  <button onClick={() => setShowMassiveUpdate(false)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Lista de Precios</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                        value={massiveUpdateConfig.listId}
                        onChange={e => setMassiveUpdateConfig({...massiveUpdateConfig, listId: e.target.value})}
                      >
                        <option value="ALL">Todas las Listas</option>
                        {priceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Categoría</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                        value={massiveUpdateConfig.category}
                        onChange={e => setMassiveUpdateConfig({...massiveUpdateConfig, category: e.target.value})}
                      >
                        <option value="ALL">Todas las Categorías</option>
                        {Array.from(new Set(products.map(p => p.category))).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Operación</label>
                      <div className="flex p-1 bg-slate-100 rounded-2xl">
                        <button 
                          onClick={() => setMassiveUpdateConfig({...massiveUpdateConfig, operation: 'PERCENTAGE'})}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${massiveUpdateConfig.operation === 'PERCENTAGE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Porcentaje (%)
                        </button>
                        <button 
                          onClick={() => setMassiveUpdateConfig({...massiveUpdateConfig, operation: 'FIXED'})}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${massiveUpdateConfig.operation === 'FIXED' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Monto Fijo ($)
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Valor del Cambio</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10"
                          value={massiveUpdateConfig.value || ''}
                          onChange={e => setMassiveUpdateConfig({...massiveUpdateConfig, value: parseFloat(e.target.value) || 0})}
                          placeholder={massiveUpdateConfig.operation === 'PERCENTAGE' ? "Ej: 15" : "Ej: 500"}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                          {massiveUpdateConfig.operation === 'PERCENTAGE' ? '%' : '$'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-[2rem] p-6 border border-blue-100 mb-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                        <ClockIcon size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Programación</p>
                        <p className="text-sm font-bold text-blue-900">¿Cuándo aplicar este cambio?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="roundToTen"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={massiveUpdateConfig.roundToTen}
                        onChange={e => setMassiveUpdateConfig({...massiveUpdateConfig, roundToTen: e.target.checked})}
                      />
                      <label htmlFor="roundToTen" className="text-[10px] font-black text-blue-800 uppercase">Redondear a $10</label>
                    </div>
                  </div>
                  <input 
                    type="datetime-local"
                    className="w-full px-6 py-4 bg-white border border-blue-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/20"
                    value={massiveUpdateConfig.scheduledFor}
                    onChange={e => setMassiveUpdateConfig({...massiveUpdateConfig, scheduledFor: e.target.value})}
                  />
                  <p className="text-[9px] text-blue-400 mt-3 font-medium leading-relaxed">
                    <span className="font-black uppercase">Nota:</span> El cambio se aplicará automáticamente la primera vez que alguien ingrese al sistema después de la fecha y hora seleccionada.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <button 
                    onClick={() => handleMassiveUpdate(false)}
                    disabled={loading || massiveUpdateConfig.value === 0}
                    className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ZapIcon size={18} /> Aplicar Ahora
                  </button>
                  <button 
                    onClick={() => handleMassiveUpdate(true)}
                    disabled={loading || massiveUpdateConfig.value === 0}
                    className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Calendar size={18} /> Programar Cambio
                  </button>
                </div>

                {scheduledJobs.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cambios Programados</h3>
                    <div className="space-y-3">
                      {scheduledJobs.filter(j => j.status === 'PENDING').map(job => (
                        <div key={job.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                              <Calendar size={14} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-800 uppercase">
                                {job.operation === 'PERCENTAGE' ? `+${job.value}%` : `+$${job.value}`} en {job.priceListId === 'ALL' ? 'Todas' : priceLists.find(l => l.id === job.priceListId)?.name}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Ejecución: {format(new Date(job.scheduledFor), 'dd/MM HH:mm')} hs</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => cancelJob(job.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

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

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDeleteProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Eliminar Producto?</h2>
                <p className="text-slate-500 font-medium">
                  ¿Estás seguro de que deseas eliminar el producto <span className="font-bold text-slate-800">{confirmDeleteProduct.name}</span>? 
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteProduct(null)}
                  className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Check if product is used in any orders
                      const { count, error: countError } = await supabase
                        .from('order_items')
                        .select('*', { count: 'exact', head: true })
                        .eq('product_id', confirmDeleteProduct.id);
                        
                      if (countError) throw countError;
                      if (count && count > 0) {
                        alert("No se puede eliminar el producto porque tiene pedidos asociados.");
                        setLoading(false);
                        setConfirmDeleteProduct(null);
                        return;
                      }

                      // Check if product is used in any credit notes
                      const { count: cnCount, error: cnCountError } = await supabase
                        .from('credit_note_items')
                        .select('*', { count: 'exact', head: true })
                        .eq('product_id', confirmDeleteProduct.id);
                        
                      if (cnCountError) throw cnCountError;
                      if (cnCount && cnCount > 0) {
                        alert("No se puede eliminar el producto porque tiene notas de crédito asociadas.");
                        setLoading(false);
                        setConfirmDeleteProduct(null);
                        return;
                      }

                      // Delete dependencies first
                      await supabase.from('product_prices').delete().eq('product_id', confirmDeleteProduct.id);
                      await supabase.from('price_history').delete().eq('product_id', confirmDeleteProduct.id);

                      // Delete the product
                      const { error } = await supabase.from('products').delete().eq('id', confirmDeleteProduct.id);
                      if (error) throw error;
                      
                      onRefresh();
                      setConfirmDeleteProduct(null);
                    } catch (error: any) {
                      console.error("Error deleting product:", error);
                      alert("Ocurrió un error al intentar eliminar el producto.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-700 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  {loading ? 'Eliminando...' : 'Sí, Eliminar'}
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


import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  Download, 
  FileText, 
  Calendar, 
  Filter, 
  ChevronDown, 
  TrendingUp, 
  Users, 
  Package, 
  Database,
  Smartphone,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search
} from 'lucide-react';
import { Order, Product, Customer, OrderStatus, GateEntry, OrderStatusLabels, PriceList } from '../types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subDays, isSameDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  gateEntries: GateEntry[];
  priceLists: PriceList[];
  onRestore?: (data: any) => Promise<void>;
}

type TabType = 'SALES' | 'DISTRIBUTORS' | 'PRODUCTION' | 'PIVOT' | 'MOBILE' | 'BACKUP';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ReportsView: React.FC<Props> = ({ orders, products, customers, gateEntries, priceLists, onRestore }) => {
  const [activeTab, setActiveTab] = useState<TabType>('SALES');
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  // Pivot State
  const [pivotMode, setPivotMode] = useState<'LIST' | 'MATRIX'>('LIST');
  const [pivotRow, setPivotRow] = useState<'customer' | 'product' | 'brand' | 'day'>('product');
  const [pivotCol, setPivotCol] = useState<'month' | 'customer'>('month');
  const [pivotValue, setPivotValue] = useState<'total' | 'quantity' | 'count'>('quantity');
  const [filterGroup, setFilterGroup] = useState('');

  // --- Data Processing ---

  const mobileStats = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);

    const ordersToday = orders.filter(o => isSameDay(parseISO(o.createdAt), today));
    const ordersYesterday = orders.filter(o => isSameDay(parseISO(o.createdAt), yesterday));

    const ventasHoy = ordersToday.reduce((acc, o) => acc + o.totalAmount, 0);
    const ventasAyer = ordersYesterday.reduce((acc, o) => acc + o.totalAmount, 0);
    const pedidosHoy = ordersToday.length;

    // Note: receipts are not passed as props to ReportsView, but we can infer them from orders if they were paid?
    // Actually, we don't have receipts here. We might need to pass them or use paidAmount from orders.
    const cobranzasHoy = ordersToday.reduce((acc, o) => acc + (o.paidAmount || 0), 0);

    const diff = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : 0;

    return { ventasHoy, pedidosHoy, cobranzasHoy, diff };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = parseISO(order.createdAt);
      const inRange = isWithinInterval(orderDate, {
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      });
      const customer = customers.find(c => c.id === order.customerId);
      const matchesCustomer = !filterCustomer || order.customerId === filterCustomer;
      const matchesGroup = !filterGroup || (customer && customer.groupId === filterGroup);
      return inRange && matchesCustomer && matchesGroup;
    });
  }, [orders, dateRange, filterCustomer, filterGroup, customers]);

  const matrixData = useMemo(() => {
    if (pivotMode !== 'MATRIX') return { headers: [], rows: [] };

    const colKeys = new Set<string>();
    const rowStats: Record<string, { label: string, values: Record<string, number>, total: number }> = {};

    filteredOrders.forEach(order => {
      const rowKey = pivotRow === 'customer' ? order.customerId : '';
      const rowLabel = pivotRow === 'customer' ? order.customerName : '';

      const processItem = (item: any, product: Product) => {
        const rKey = pivotRow === 'product' ? product.id : 
                     pivotRow === 'brand' ? product.brand : rowKey;
        const rLabel = pivotRow === 'product' ? product.name : 
                       pivotRow === 'brand' ? product.brand : rowLabel;

        const dateObj = parseISO(order.createdAt);
        const cKey = pivotCol === 'month' ? format(dateObj, 'MMM yyyy') : order.customerName;
        colKeys.add(cKey);

        if (!rowStats[rKey]) rowStats[rKey] = { label: rLabel, values: {}, total: 0 };
        
        const val = pivotValue === 'total' ? (item.quantity * item.unitPrice) : item.quantity;
        rowStats[rKey].values[cKey] = (rowStats[rKey].values[cKey] || 0) + val;
        rowStats[rKey].total += val;
      };

      if (pivotRow === 'customer') {
        const dateObj = parseISO(order.createdAt);
        const cKey = pivotCol === 'month' ? format(dateObj, 'MMM yyyy') : order.customerName;
        colKeys.add(cKey);
        if (!rowStats[rowKey]) rowStats[rowKey] = { label: rowLabel, values: {}, total: 0 };
        const val = pivotValue === 'total' ? order.totalAmount : order.items.reduce((acc, i) => acc + i.quantity, 0);
        rowStats[rowKey].values[cKey] = (rowStats[rowKey].values[cKey] || 0) + val;
        rowStats[rowKey].total += val;
      } else {
        order.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) processItem(item, product);
        });
      }
    });

    const sortedCols = Array.from(colKeys).sort((a, b) => {
      if (pivotCol === 'month') {
        // Simple month sorting: compare year then month index
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const [mA, yA] = a.split(' ');
        const [mB, yB] = b.split(' ');
        if (yA !== yB) return parseInt(yA) - parseInt(yB);
        return months.indexOf(mA) - months.indexOf(mB);
      }
      return a.localeCompare(b);
    });

    const sortedRows = Object.values(rowStats).sort((a, b) => b.total - a.total);

    return { headers: sortedCols, rows: sortedRows };
  }, [filteredOrders, pivotMode, pivotRow, pivotCol, pivotValue, products]);

  const pivotData = useMemo(() => {
    if (pivotMode !== 'LIST') return [];
    const stats: Record<string, { label: string, total: number, quantity: number, count: number }> = {};

    filteredOrders.forEach(order => {
      const rowKey = pivotRow === 'customer' ? order.customerId :
                     pivotRow === 'day' ? format(parseISO(order.createdAt), 'yyyy-MM-dd') : '';
      
      const rowLabel = pivotRow === 'customer' ? order.customerName :
                       pivotRow === 'day' ? format(parseISO(order.createdAt), 'dd/MM/yyyy') : '';

      if (pivotRow === 'customer' || pivotRow === 'day') {
        if (!stats[rowKey]) stats[rowKey] = { label: rowLabel, total: 0, quantity: 0, count: 0 };
        stats[rowKey].total += order.totalAmount;
        stats[rowKey].count += 1;
        order.items.forEach(item => stats[rowKey].quantity += item.quantity);
      } else {
        // Product or Brand based pivot
        order.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return;
          if (filterBrand && product.brand !== filterBrand) return;

          const itemKey = pivotRow === 'product' ? product.id : product.brand;
          const itemLabel = pivotRow === 'product' ? product.name : product.brand;

          if (!stats[itemKey]) stats[itemKey] = { label: itemLabel, total: 0, quantity: 0, count: 0 };
          stats[itemKey].total += item.quantity * item.unitPrice;
          stats[itemKey].quantity += item.quantity;
          // Count here is a bit tricky, let's say unique orders for that product/brand
          stats[itemKey].count += 1; 
        });
      }
    });

    return Object.values(stats).sort((a, b) => b[pivotValue] - a[pivotValue]);
  }, [filteredOrders, pivotRow, pivotValue, products, filterBrand]);

  const salesByProduct = useMemo(() => {
    const stats: Record<string, { name: string, quantity: number, total: number, brand: string }> = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        if (filterBrand && product.brand !== filterBrand) return;
        if (filterProduct && product.id !== filterProduct) return;

        if (!stats[item.productId]) {
          stats[item.productId] = { 
            name: product.name, 
            quantity: 0, 
            total: 0, 
            brand: product.brand 
          };
        }
        stats[item.productId].quantity += item.quantity;
        stats[item.productId].total += item.quantity * item.unitPrice;
      });
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [filteredOrders, products, filterBrand, filterProduct]);

  const salesByDistributor = useMemo(() => {
    const stats: Record<string, { name: string, total: number, count: number }> = {};
    
    filteredOrders.forEach(order => {
      if (!stats[order.customerId]) {
        stats[order.customerId] = { name: order.customerName, total: 0, count: 0 };
      }
      stats[order.customerId].total += order.totalAmount;
      stats[order.customerId].count += 1;
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [filteredOrders]);

  const salesTrend = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const day = format(parseISO(order.createdAt), 'dd/MM');
      daily[day] = (daily[day] || 0) + order.totalAmount;
    });
    return Object.keys(daily).map(day => ({ day, total: daily[day] }));
  }, [filteredOrders]);

  // --- Exports ---

  const exportToExcel = () => {
    // 1. Flat table for Looker Studio (Detalle de Ventas)
    const flatData: any[] = [];
    filteredOrders.forEach(order => {
      const customer = customers.find(c => c.id === order.customerId);
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        flatData.push({
          'ID Pedido': order.id,
          'Fecha': format(parseISO(order.createdAt), 'yyyy-MM-dd'),
          'Hora': format(parseISO(order.createdAt), 'HH:mm:ss'),
          'Cliente ID': order.customerId,
          'Cliente Nombre': order.customerName,
          'Grupo Cliente': customer?.groupId || 'Sin Grupo',
          'Estado Pedido': OrderStatusLabels[order.status] || order.status,
          'Producto ID': item.productId,
          'Producto Nombre': product?.name || 'Desconocido',
          'Marca': product?.brand || 'Sin Marca',
          'Categoría': product?.category || 'Sin Categoría',
          'Cantidad': item.quantity,
          'Cantidad Bonificada': item.bonusQuantity || 0,
          'Precio Unitario': item.unitPrice,
          'Subtotal': item.quantity * item.unitPrice
        });
      });
    });

    // 2. Summary by Product (Original)
    const summaryData = salesByProduct.map(s => ({
      'Producto': s.name,
      'Marca': s.brand,
      'Cantidad': s.quantity,
      'Total Venta': s.total
    }));

    // 3. Orders Summary
    const ordersData = filteredOrders.map(o => ({
      'ID Pedido': o.id,
      'Fecha': format(parseISO(o.createdAt), 'yyyy-MM-dd'),
      'Cliente': o.customerName,
      'Estado': OrderStatusLabels[o.status] || o.status,
      'Total': o.totalAmount
    }));

    const wb = XLSX.utils.book_new();
    
    const wsFlat = XLSX.utils.json_to_sheet(flatData);
    XLSX.utils.book_append_sheet(wb, wsFlat, 'Detalle_Ventas_Looker');

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Productos');

    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Resumen_Pedidos');

    XLSX.writeFile(wb, `Reporte_Completo_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Reporte de Ventas por Artículo', 14, 22);
    doc.setFontSize(10);
    doc.text(`Periodo: ${dateRange.start} al ${dateRange.end}`, 14, 30);

    const tableData = salesByProduct.map(s => [
      s.name,
      s.brand,
      s.quantity.toString(),
      `$${s.total.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Producto', 'Marca', 'Cantidad', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Reporte_Ventas_${dateRange.start}.pdf`);
  };

  const handleBackup = () => {
    const backupData = {
      orders,
      products,
      customers,
      gateEntries,
      priceLists,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERP_Backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Basic validation
        if (!data.orders || !data.products || !data.customers) {
          throw new Error("El archivo no tiene el formato correcto de backup.");
        }

        if (onRestore) {
          await onRestore(data);
          alert("Backup restaurado con éxito.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al restaurar el backup: " + (err instanceof Error ? err.message : "Archivo inválido"));
      }
    };
    reader.readAsText(file);
  };

  // --- Render Helpers ---

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-black ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Módulo de Informes</h1>
          <p className="text-slate-500 font-medium">Análisis detallado de ventas, producción y estado del negocio.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
          {[
            { id: 'SALES', label: 'Ventas', icon: BarChart3 },
            { id: 'DISTRIBUTORS', label: 'Distribuidores', icon: Users },
            { id: 'PRODUCTION', label: 'Producción', icon: Package },
            { id: 'PIVOT', label: 'Tabla Dinámica', icon: Database },
            { id: 'MOBILE', label: 'Móvil', icon: Smartphone },
            { id: 'BACKUP', label: 'Backup', icon: Database },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Filters Bar */}
      {activeTab !== 'BACKUP' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-slate-400" size={18} />
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-slate-300 font-black text-[10px]">AL</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden md:block" />

          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <Filter className="text-slate-400" size={18} />
            <select 
              value={filterCustomer}
              onChange={e => setFilterCustomer(e.target.value)}
              className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 flex-1"
            >
              <option value="">Todos los Clientes</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select 
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
              className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-40"
            >
              <option value="">Todos los Grupos</option>
              {Array.from(new Set(customers.map(c => c.groupId).filter(Boolean))).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select 
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-40"
            >
              <option value="">Todas las Marcas</option>
              <option value="La Fornarina">La Fornarina</option>
              <option value="Villecco">Villecco</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={exportToExcel} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Exportar Excel">
              <Download size={18} />
            </button>
            <button onClick={exportToPDF} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Exportar PDF">
              <FileText size={18} />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'SALES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <TrendingUp className="text-blue-500" size={20} /> Tendencia de Ventas
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(v: any) => [`$${v.toLocaleString()}`, 'Ventas']}
                    />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Ventas por Artículo</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Buscar producto..." 
                    value={filterProduct}
                    onChange={e => setFilterProduct(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-4">Producto</th>
                      <th className="px-8 py-4">Marca</th>
                      <th className="px-8 py-4 text-center">Cantidad</th>
                      <th className="px-8 py-4 text-right">Total Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesByProduct.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-800 text-xs">{s.name}</td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${s.brand === 'La Fornarina' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {s.brand}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-center font-black text-slate-600 text-xs">{s.quantity} u.</td>
                        <td className="px-8 py-4 text-right font-black text-slate-900 text-xs">${s.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <StatCard title="Total Ventas" value={`$${filteredOrders.reduce((acc, o) => acc + o.totalAmount, 0).toLocaleString()}`} icon={TrendingUp} color="bg-blue-50 text-blue-600" trend={12} />
            <StatCard title="Pedidos" value={filteredOrders.length.toString()} icon={FileText} color="bg-purple-50 text-purple-600" trend={5} />
            <StatCard title="Artículos Vendidos" value={salesByProduct.reduce((acc, s) => acc + s.quantity, 0).toString()} icon={Package} color="bg-emerald-50 text-emerald-600" trend={-2} />
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Mix de Marcas</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'La Fornarina', value: salesByProduct.filter(s => s.brand === 'La Fornarina').reduce((acc, s) => acc + s.total, 0) },
                        { name: 'Villecco', value: salesByProduct.filter(s => s.brand === 'Villecco').reduce((acc, s) => acc + s.total, 0) }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(v: any) => `$${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-black uppercase text-slate-500">La Fornarina</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-black uppercase text-slate-500">Villecco</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DISTRIBUTORS' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Comparativa de Ventas por Distribuidor</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDistributor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(v) => `$${v/1000}k`} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} width={150} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    formatter={(v: any) => [`$${v.toLocaleString()}`, 'Total Comprado']}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {salesByDistributor.map((dist, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{dist.name}</p>
                  <p className="text-xl font-black text-slate-900">${dist.total.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">{dist.count} pedidos realizados</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                  #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'PRODUCTION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Volumen de Producción (Pedidos Validados)</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-900/20">
              <Package className="mb-4 opacity-50" size={32} />
              <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Total Producido (u.)</p>
              <p className="text-4xl font-black tracking-tighter mb-4">
                {salesByProduct.reduce((acc, s) => acc + s.quantity, 0).toLocaleString()}
              </p>
              <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-3/4" />
              </div>
              <p className="text-[10px] font-bold mt-4 opacity-70 uppercase tracking-widest">75% de la capacidad mensual</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Top 5 Producidos</h3>
              <div className="space-y-4">
                {salesByProduct.slice(0, 5).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-black text-[10px]">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{s.quantity} u.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PIVOT' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Análisis de Ventas</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setPivotMode('LIST')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pivotMode === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Lista
                  </button>
                  <button 
                    onClick={() => setPivotMode('MATRIX')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pivotMode === 'MATRIX' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Matriz (Looker)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filas:</span>
                  <select 
                    value={pivotRow}
                    onChange={e => setPivotRow(e.target.value as any)}
                    className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="customer">Cliente</option>
                    <option value="product">Producto</option>
                    <option value="brand">Marca</option>
                    {pivotMode === 'LIST' && <option value="day">Día</option>}
                  </select>
                </div>
                {pivotMode === 'MATRIX' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Columnas:</span>
                    <select 
                      value={pivotCol}
                      onChange={e => setPivotCol(e.target.value as any)}
                      className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="month">Mes</option>
                      <option value="customer">Cliente</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor:</span>
                  <select 
                    value={pivotValue}
                    onChange={e => setPivotValue(e.target.value as any)}
                    className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="total">Importe Total ($)</option>
                    <option value="quantity">Cantidad Total (u.)</option>
                    {pivotMode === 'LIST' && <option value="count">Cant. Operaciones</option>}
                  </select>
                </div>
              </div>
            </div>

            {pivotMode === 'LIST' ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-4">{pivotRow === 'customer' ? 'Cliente' : pivotRow === 'product' ? 'Producto' : pivotRow === 'brand' ? 'Marca' : 'Fecha'}</th>
                      <th className="px-8 py-4 text-right">Importe Total</th>
                      <th className="px-8 py-4 text-right">Cantidad</th>
                      <th className="px-8 py-4 text-right">Operaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pivotData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-800 text-xs uppercase">{row.label}</td>
                        <td className="px-8 py-4 text-right font-black text-slate-900 text-xs">${row.total.toLocaleString()}</td>
                        <td className="px-8 py-4 text-right font-black text-slate-600 text-xs">{row.quantity.toLocaleString()} u.</td>
                        <td className="px-8 py-4 text-right font-black text-blue-600 text-xs">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  {pivotData.length > 0 && (
                    <tfoot className="bg-slate-50/50">
                      <tr className="text-xs font-black text-slate-900">
                        <td className="px-8 py-4 uppercase tracking-widest">Totales</td>
                        <td className="px-8 py-4 text-right">${pivotData.reduce((acc, r) => acc + r.total, 0).toLocaleString()}</td>
                        <td className="px-8 py-4 text-right">{pivotData.reduce((acc, r) => acc + r.quantity, 0).toLocaleString()} u.</td>
                        <td className="px-8 py-4 text-right">{pivotData.reduce((acc, r) => acc + r.count, 0)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white">
                      <th className="px-6 py-4 sticky left-0 bg-emerald-700 z-10 border-r border-emerald-500/30">
                        {pivotRow === 'customer' ? 'NOMBRE CLIENTE' : 'NOMBRE PRODUCTO'}
                      </th>
                      {matrixData.headers.map(header => (
                        <th key={header} className="px-6 py-4 text-center border-r border-emerald-500/30 min-w-[120px]">
                          {header}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right bg-emerald-700">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrixData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-3 font-bold text-slate-800 text-[11px] uppercase sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 z-10">
                          {row.label}
                        </td>
                        {matrixData.headers.map(header => (
                          <td key={header} className="px-6 py-3 text-center text-slate-600 text-[11px] font-medium border-r border-slate-50">
                            {row.values[header] ? (
                              pivotValue === 'total' ? `$${row.values[header].toLocaleString()}` : row.values[header].toLocaleString()
                            ) : '-'}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-right font-black text-slate-900 text-[11px] bg-slate-50/50">
                          {pivotValue === 'total' ? `$${row.total.toLocaleString()}` : row.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50">
                    <tr className="text-[11px] font-black text-emerald-900">
                      <td className="px-6 py-4 sticky left-0 bg-emerald-50 z-10 border-r border-emerald-100 uppercase tracking-widest">TOTAL GENERAL</td>
                      {matrixData.headers.map(header => (
                        <td key={header} className="px-6 py-4 text-center border-r border-emerald-100">
                          {pivotValue === 'total' 
                            ? `$${matrixData.rows.reduce((acc, r) => acc + (r.values[header] || 0), 0).toLocaleString()}`
                            : matrixData.rows.reduce((acc, r) => acc + (r.values[header] || 0), 0).toLocaleString()
                          }
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right bg-emerald-100">
                        {pivotValue === 'total'
                          ? `$${matrixData.rows.reduce((acc, r) => acc + r.total, 0).toLocaleString()}`
                          : matrixData.rows.reduce((acc, r) => acc + r.total, 0).toLocaleString()
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'MOBILE' && (
        <div className="max-w-md mx-auto space-y-6 pb-12">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Estado del Negocio</p>
                <h2 className="text-2xl font-black tracking-tight">Dashboard Gerencial</h2>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center">
                <Smartphone size={20} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ventas Hoy</p>
                <p className="text-3xl font-black tracking-tighter">${mobileStats.ventasHoy.toLocaleString()}</p>
                <div className={`flex items-center gap-1 ${mobileStats.diff >= 0 ? 'text-emerald-400' : 'text-red-400'} text-[10px] font-black mt-2`}>
                  {mobileStats.diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} 
                  {Math.abs(mobileStats.diff).toFixed(1)}% vs ayer
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Pedidos</p>
                  <p className="text-xl font-black">{mobileStats.pedidosHoy}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Cobranzas</p>
                  <p className="text-xl font-black">${(mobileStats.cobranzasHoy / 1000).toFixed(1)}k</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Saldos de Distribuidores</h3>
            <div className="space-y-4">
              {customers.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-bold text-slate-700 uppercase">{c.name}</span>
                  <span className={`text-xs font-black ${c.balance > 100000 ? 'text-red-600' : 'text-slate-900'}`}>
                    ${c.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-200 transition-all">
              Ver Todos los Saldos
            </button>
          </div>
        </div>
      )}

      {activeTab === 'BACKUP' && (
        <div className="max-w-2xl mx-auto py-12">
          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-xl text-center">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-900/10 border border-blue-100">
              <Database size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-4">Sistema de Backup</h2>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">
              Resguarde la información de su negocio. Se recomienda realizar un backup <span className="text-blue-600 font-black">diario</span> al finalizar la jornada laboral.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Último Backup</p>
                <p className="text-sm font-bold text-slate-700">Hoy, 08:30 AM</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Frecuencia Sugerida</p>
                <p className="text-sm font-bold text-blue-600">Diaria (Automática)</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleBackup}
                className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
              >
                <Download size={18} /> Descargar Backup Manual
              </button>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleRestore}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <button 
                  className="w-full py-5 bg-slate-100 text-slate-600 font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
                >
                  <RefreshCw size={18} /> Restaurar desde Archivo
                </button>
              </div>
              
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">El archivo se descargará en formato JSON compatible con el sistema.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;

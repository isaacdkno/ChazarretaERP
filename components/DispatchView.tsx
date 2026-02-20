
import React, { useState, useRef } from 'react';
import { Truck, CheckCircle, Signature, RotateCcw } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => void;
}

const DispatchView: React.FC<Props> = ({ orders, updateOrder }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const readyOrders = orders.filter(o => o.status === OrderStatus.VALIDATED);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const confirmDelivery = () => {
    if (!selectedOrder || !canvasRef.current) return;
    const signatureUrl = canvasRef.current.toDataURL();
    updateOrder({ 
      ...selectedOrder, 
      status: OrderStatus.DISPATCHED,
      signatureUrl 
    });
    setSelectedOrder(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Despacho y Logística</h1>
        <p className="text-slate-500">Confirma la carga física y captura la firma del cliente.</p>
      </header>

      {!selectedOrder ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {readyOrders.map(order => (
            <div key={order.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all cursor-pointer" onClick={() => setSelectedOrder(order)}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">Listo para Carga</span>
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{order.customerName}</h3>
              <p className="text-xs text-slate-400 mb-4">{order.items.length} productos</p>
              <button className="w-full py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">Abrir para Firma</button>
            </div>
          ))}
          {readyOrders.length === 0 && (
            <div className="col-span-full p-20 text-center text-slate-400">
              <CheckCircle className="mx-auto mb-4 opacity-20" size={64} />
              <p>No hay pedidos pendientes de despacho.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-lg">Confirmar Entrega: {selectedOrder.customerName}</h2>
            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600"><RotateCcw size={20}/></button>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
              <p className="text-sm font-bold text-slate-400 uppercase mb-4">Detalle de Carga</p>
              <ul className="space-y-2">
                {selectedOrder.items.map(item => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 font-medium">Prod #{item.productId}</span>
                    <span className="font-bold text-slate-900">{item.quantity} u. + {item.bonusQuantity} SC</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Signature size={18} className="text-blue-500" /> Firma del Cliente / Chofer
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden canvas-container">
                <canvas 
                  ref={canvasRef}
                  width={600}
                  height={250}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[250px] touch-none"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={clearCanvas} className="text-xs font-bold text-red-500 hover:underline">Borrar Firma</button>
              </div>
            </div>

            <button 
              onClick={confirmDelivery}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle size={24} /> Confirmar Carga y Generar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchView;

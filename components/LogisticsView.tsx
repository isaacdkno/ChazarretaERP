
import React, { useState } from 'react';
import { Box, Truck } from 'lucide-react';
import FactoryView from './FactoryView';
import DispatchView from './DispatchView';
import { Order, Product, GateEntry, Customer, CurrentUser } from '../types';

interface Props {
  orders: Order[];
  updateOrder: (order: Order) => Promise<void> | void;
  products: Product[];
  gateEntries: GateEntry[];
  updateGateEntry: (entry: GateEntry) => Promise<void>;
  customers: Customer[];
  currentUser: CurrentUser;
}

const LogisticsView: React.FC<Props> = (props) => {
  const [activeTab, setActiveTab] = useState<'factory' | 'dispatch'>('factory');

  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-slate-200 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('factory')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'factory'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Box size={16} /> Producción
        </button>
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'dispatch'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck size={16} /> Despacho
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'factory' ? (
          <FactoryView 
            orders={props.orders} 
            products={props.products} 
            gateEntries={props.gateEntries} 
            customers={props.customers}
            currentUser={props.currentUser}
          />
        ) : (
          <DispatchView 
            orders={props.orders} 
            updateOrder={props.updateOrder} 
            products={props.products} 
            gateEntries={props.gateEntries} 
            updateGateEntry={props.updateGateEntry} 
            customers={props.customers}
            currentUser={props.currentUser}
          />
        )}
      </div>
    </div>
  );
};

export default LogisticsView;

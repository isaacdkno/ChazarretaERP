import React, { useState, useEffect, useMemo } from 'react';
import { AppUser, UserRole, Customer, CurrentUser } from '../types';
import { CheckCircle2, XCircle, Shield, UserX, UserCheck, Plus, Search, Edit2, Mail, User as UserIcon, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import { hashPassword } from '../utils/auth';

interface Props {
  currentUser: CurrentUser;
  onRefresh?: () => void;
  customers: Customer[];
}

const UserManagement: React.FC<Props> = ({ currentUser, onRefresh, customers }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);
  
  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerTargetUserId, setCustomerTargetUserId] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [priceLists, setPriceLists] = useState<{id: string, name: string}[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [customerFormData, setCustomerFormData] = useState({ name: '', phone: '', address: '', cuit: '', price_list_id: '' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.DISTRIBUTOR,
    isApproved: true,
    phone: '',
    address: '',
    cuit: '',
    customerId: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchPriceLists = async () => {
    const { data, error } = await supabase.from('price_lists').select('id, name');
    if (error) {
      console.error("Error fetching price lists:", error);
    } else {
      setPriceLists(data || []);
    }
  };

  useEffect(() => {
    fetchPriceLists();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUsers: AppUser[] = (data || []).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as UserRole,
        isApproved: u.is_approved,
        createdAt: u.created_at,
        address: u.address,
        phone: u.phone,
        cuit: u.cuit,
        customerId: u.customer_id,
        passwordHash: u.password_hash
      }));

      setUsers(formattedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      const stored = localStorage.getItem('erp_users');
      if (stored) setUsers(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: UserRole.DISTRIBUTOR,
      isApproved: true,
      phone: '',
      address: '',
      cuit: '',
      customerId: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleCreateCustomer = (user: AppUser) => {
    setCustomerTargetUserId(user.id);
    setCustomerFormData({ 
      name: user.name, 
      phone: user.phone || '', 
      address: user.address || '', 
      cuit: user.cuit || '', 
      price_list_id: priceLists.length > 0 ? priceLists[0].id : 'l1' 
    });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async () => {
    if (savingCustomer) return;
    setSavingCustomer(true);
    if (!customerFormData.name.trim()) {
      alert("El nombre del cliente es obligatorio.");
      setSavingCustomer(false);
      return;
    }
    try {
      const newCustomerId = crypto.randomUUID();
      const { error } = await supabase.from('customers').insert({
        id: newCustomerId,
        name: customerFormData.name.trim(),
        phone: customerFormData.phone,
        address: customerFormData.address,
        cuit: customerFormData.cuit,
        price_list_id: customerFormData.price_list_id || null,
        balance: 0,
        is_blocked: false
      });
      
      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      if (customerTargetUserId) {
        await supabase
          .from('users')
          .update({ customer_id: newCustomerId })
          .eq('id', customerTargetUserId);
      }
      
      setShowCustomerModal(false);
      setCustomerTargetUserId(null);
      await fetchUsers();
      if (onRefresh) onRefresh();
      alert("Cliente guardado y vinculado correctamente.");
    } catch (err) {
      console.error("Error saving customer:", err);
      let errorMessage = "Error desconocido";
      if (err && typeof err === 'object') {
        errorMessage = JSON.stringify(err, Object.getOwnPropertyNames(err));
      } else {
        errorMessage = String(err);
      }
      alert("Error al guardar cliente: " + errorMessage);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isApproved: user.isApproved,
      phone: user.phone || '',
      address: user.address || '',
      cuit: user.cuit || '',
      customerId: user.customerId || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('Nombre y correo son obligatorios.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const passwordHash = formData.password.trim()
        ? await hashPassword(formData.password)
        : undefined;

      const basePayload: Record<string, any> = {
        name: formData.name.trim(),
        email: normalizedEmail,
        role: formData.role,
        is_approved: formData.isApproved
      };

      const extendedPayload: Record<string, any> = {
        ...basePayload,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        cuit: formData.cuit.trim() || null,
        customer_id: formData.role === UserRole.DISTRIBUTOR ? (formData.customerId || null) : null,
        ...(passwordHash ? { password_hash: passwordHash } : {})
      };

      if (editingUser) {
        let { error } = await supabase
          .from('users')
          .update(extendedPayload)
          .eq('id', editingUser.id);

        if (error) {
          // Fallback si aún no se migraron las columnas nuevas en Supabase
          const fallbackRes = await supabase
            .from('users')
            .update(basePayload)
            .eq('id', editingUser.id);
          error = fallbackRes.error;
        }

        if (error) throw error;
      } else {
        const { data: existing } = await supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
        if (existing) {
          setFormError('El correo ya está registrado.');
          setFormLoading(false);
          return;
        }

        let { error } = await supabase
          .from('users')
          .insert([extendedPayload]);

        if (error) {
          const fallbackRes = await supabase
            .from('users')
            .insert([basePayload]);
          error = fallbackRes.error;
        }

        if (error) throw error;
      }

      await fetchUsers();
      setShowModal(false);
      
    } catch (err: any) {
      console.error("Error saving user:", err);
      setFormError(err.message || 'Error al guardar el usuario.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleApproval = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newIsApproved = !user.isApproved;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: newIsApproved })
        .eq('id', userId);

      if (error) {
        const newUsers = users.map(u => u.id === userId ? { ...u, isApproved: newIsApproved } : u);
        setUsers(newUsers);
        localStorage.setItem('erp_users', JSON.stringify(newUsers));
      } else {
        fetchUsers();
      }

      if (newIsApproved && user.role === UserRole.DISTRIBUTOR) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('name', user.name)
          .maybeSingle();

        if (!existing) {
          const newCustId = `c_${Date.now()}`;
          await supabase.from('customers').insert({
            id: newCustId,
            name: user.name,
            price_list_id: 'l1',
            balance: 0,
            is_blocked: false
          });
          await supabase.from('users').update({ customer_id: newCustId }).eq('id', user.id);
          if (onRefresh) onRefresh();
        } else if (!user.customerId) {
          await supabase.from('users').update({ customer_id: existing.id }).eq('id', user.id);
        }
      }
    } catch (err) {
      console.error("Error toggling approval:", err);
    }
  };

  const changeRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        const newUsers = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
        setUsers(newUsers);
        localStorage.setItem('erp_users', JSON.stringify(newUsers));
      } else {
        fetchUsers();
      }
    } catch (err) {
      console.error("Error changing role:", err);
    }
  };

  const deleteUser = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error("Error deleting user:", error);
        alert("Error al eliminar usuario.");
      } else {
        fetchUsers();
      }
      setConfirmDeleteUser(null);
    } catch (err) {
      console.error("Error deleting user:", err);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser.role !== UserRole.ADMIN) {
    return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestión de Usuarios</h1>
          <p className="text-slate-500 font-medium">Administre los accesos y permisos del sistema.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 shrink-0"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 uppercase tracking-widest text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
        >
          <option value="ALL">Todos los Roles</option>
          {Object.values(UserRole).map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-8 py-5">Usuario</th>
              <th className="px-8 py-5">Email</th>
              <th className="px-8 py-5">Rol / Permisos</th>
              <th className="px-8 py-5">Estado</th>
              <th className="px-8 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  No se encontraron usuarios
                </td>
              </tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5 font-black text-slate-800 uppercase text-xs">
                  {user.name}
                </td>
                <td className="px-8 py-5 text-slate-500 text-sm">
                  {user.email}
                </td>
                <td className="px-8 py-5">
                  <select 
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value as UserRole)}
                    className="bg-slate-100 border-none text-xs font-bold uppercase rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td className="px-8 py-5">
                  {user.isApproved ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={12} /> Aprobado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                      <Shield size={12} /> Pendiente
                    </span>
                  )}
                </td>
                <td className="px-8 py-5 text-right space-x-2">
                  <button 
                    onClick={() => handleOpenEdit(user)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Editar Usuario"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => toggleApproval(user.id)}
                    className={`p-2 rounded-lg transition-colors ${user.isApproved ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    title={user.isApproved ? "Revocar Acceso" : "Aprobar Acceso"}
                  >
                    {user.isApproved ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteUser(user)}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Eliminar Usuario"
                  >
                    <XCircle size={18} />
                  </button>
                  {user.role === UserRole.DISTRIBUTOR && !customers.find(c => c.name.toLowerCase() === user.name.toLowerCase()) && (
                    <button 
                      onClick={() => handleCreateCustomer(user)}
                      className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      title="Crear Cliente"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              
              {formError && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold uppercase tracking-widest text-center border border-red-100">
                  {formError}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder={editingUser ? "Dejar vacío para no cambiar" : "••••••••"}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rol del Sistema</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 uppercase text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  >
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {formData.role === UserRole.DISTRIBUTOR && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente / Distribuidor Vinculado</label>
                    <select 
                      value={formData.customerId}
                      onChange={e => setFormData({...formData, customerId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Vincular automáticamente por nombre...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono</label>
                  <input 
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Ej: 11 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dirección</label>
                  <input 
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Ej: Calle Falsa 123"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CUIT</label>
                  <input 
                    type="text"
                    value={formData.cuit}
                    onChange={e => setFormData({...formData, cuit: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Ej: 20-12345678-9"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox"
                    id="isApproved"
                    checked={formData.isApproved}
                    onChange={e => setFormData({...formData, isApproved: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isApproved" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Aprobar acceso inmediatamente
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveUser}
                disabled={formLoading}
                className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-xl"
              >
                {formLoading ? 'Guardando...' : 'Guardar Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserX size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Eliminar Usuario?</h2>
              <p className="text-slate-500 font-medium">
                ¿Estás seguro de que deseas eliminar a <span className="font-bold text-slate-800">{confirmDeleteUser.name}</span>? 
                Perderá el acceso al sistema inmediatamente.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setConfirmDeleteUser(null)}
                className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deleteUser(confirmDeleteUser.id)}
                disabled={loading}
                className="flex-1 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-700 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6">Crear Cliente</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre</label>
                  <input type="text" value={customerFormData.name} onChange={e => setCustomerFormData({...customerFormData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono</label>
                  <input type="text" value={customerFormData.phone} onChange={e => setCustomerFormData({...customerFormData, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dirección</label>
                  <input type="text" value={customerFormData.address} onChange={e => setCustomerFormData({...customerFormData, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lista de Precios</label>
                  <select 
                    value={customerFormData.price_list_id} 
                    onChange={e => setCustomerFormData({...customerFormData, price_list_id: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800"
                  >
                    <option value="">Seleccionar...</option>
                    {priceLists.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CUIT</label>
                  <input type="text" value={customerFormData.cuit} onChange={e => setCustomerFormData({...customerFormData, cuit: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowCustomerModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase text-xs">Cancelar</button>
                  <button 
                    onClick={handleSaveCustomer} 
                    disabled={savingCustomer}
                    className={`flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-bold uppercase text-xs ${savingCustomer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {savingCustomer ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

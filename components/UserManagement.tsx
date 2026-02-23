import React, { useState, useEffect } from 'react';
import { AppUser, UserRole } from '../types';
import { CheckCircle2, XCircle, Shield, UserX, UserCheck } from 'lucide-react';

interface Props {
  currentUser: {name: string, role: UserRole, email?: string};
}

const UserManagement: React.FC<Props> = ({ currentUser }) => {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    // Load users from localStorage for now (mock implementation)
    const storedUsers = localStorage.getItem('erp_users');
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }
  }, []);

  const saveUsers = (newUsers: AppUser[]) => {
    setUsers(newUsers);
    localStorage.setItem('erp_users', JSON.stringify(newUsers));
  };

  const toggleApproval = (userId: string) => {
    const newUsers = users.map(u => 
      u.id === userId ? { ...u, isApproved: !u.isApproved } : u
    );
    saveUsers(newUsers);
  };

  const changeRole = (userId: string, newRole: UserRole) => {
    const newUsers = users.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    );
    saveUsers(newUsers);
  };

  const deleteUser = (userId: string) => {
    if (window.confirm('¿Está seguro de eliminar este usuario?')) {
      const newUsers = users.filter(u => u.id !== userId);
      saveUsers(newUsers);
    }
  };

  if (currentUser.role !== UserRole.ADMIN) {
    return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestión de Usuarios</h1>
        <p className="text-slate-500 font-medium">Administre los accesos y permisos del sistema.</p>
      </header>

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
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  No hay usuarios registrados
                </td>
              </tr>
            ) : users.map(user => (
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
                    onClick={() => toggleApproval(user.id)}
                    className={`p-2 rounded-lg transition-colors ${user.isApproved ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    title={user.isApproved ? "Revocar Acceso" : "Aprobar Acceso"}
                  >
                    {user.isApproved ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>
                  <button 
                    onClick={() => deleteUser(user.id)}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Eliminar Usuario"
                  >
                    <XCircle size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;

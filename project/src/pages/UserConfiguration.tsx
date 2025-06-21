import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, Search, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const AVAILABLE_TABS = [
  'Mapa',
  'Muestreos',
  'Personal',
  'Administración',
  'Reportes',
  'Configuración'
] as const;

interface User {
  id: string;
  email: string;
  tabs: string;
}

export default function UserConfiguration() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<string[]>(['Mapa']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Users' },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('Users')
        .select('id, email, tabs')
        .order('email');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Error loading users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedTabs.length) {
      toast.error('Please complete all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('Users')
        .insert({
          email,
          password,
          tabs: selectedTabs.join(',')
        });

      if (error) throw error;

      toast.success('User created successfully');
      setEmail('');
      setPassword('');
      setSelectedTabs(['Mapa']);
    } catch (error) {
      console.error(error);
      toast.error('Error creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUserTabs = async (userId: string, tabs: string[]) => {
    try {
      const { error } = await supabase
        .from('Users')
        .update({ tabs: tabs.join(',') })
        .eq('id', userId);

      if (error) throw error;
      toast.success('User permissions updated');
    } catch (error) {
      console.error(error);
      toast.error('Error updating user permissions');
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white">User Configuration</h2>
          <p className="text-[#A3A3A3]">Manage access permissions for system users</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="text-xl font-semibold text-white">Create New User</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Allowed Tabs
              </label>
              <div className="grid grid-cols-3 gap-3">
                {AVAILABLE_TABS.map(tab => (
                  <label key={tab} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTabs.includes(tab)}
                      onChange={e => {
                        setSelectedTabs(prev =>
                          e.target.checked
                            ? [...prev, tab]
                            : prev.filter(t => t !== tab)
                        );
                      }}
                      className="form-checkbox h-4 w-4 text-[#3B82F6]"
                    />
                    <span className="text-white">{tab}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#3B82F6] text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Existing Users</h3>

          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#262626] text-white pl-10 pr-4 py-2 rounded-lg"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center text-[#A3A3A3] py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-[#A3A3A3] py-4">
                No users found
              </p>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="bg-[#262626] rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-white font-medium">{user.email}</h4>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[#A3A3A3] text-sm">Allowed Tabs:</p>
                    <div className="grid grid-cols-3 gap-3">
                      {AVAILABLE_TABS.map(tab => (
                        <label key={tab} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={user.tabs.split(',').includes(tab)}
                            onChange={e => {
                              const currentTabs = user.tabs.split(',');
                              const newTabs = e.target.checked
                                ? [...currentTabs, tab]
                                : currentTabs.filter(t => t !== tab);
                              handleUpdateUserTabs(user.id, newTabs);
                            }}
                            className="form-checkbox h-4 w-4 text-[#3B82F6]"
                          />
                          <span className="text-white">{tab}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

interface User {
  email: string;
  tabs: string;
}

interface AuthState {
  user: User | null;
  allowedTabs: string[];
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  allowedTabs: JSON.parse(localStorage.getItem('user') || 'null')?.tabs?.split(',') || [],
  
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ 
      user,
      allowedTabs: user?.tabs?.split(',') || []
    });
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error('Invalid credentials');
    }

    set({ 
      user: data,
      allowedTabs: data.tabs?.split(',') || []
    });
    localStorage.setItem('user', JSON.stringify(data));
  },

  logout: async () => {
    localStorage.removeItem('user');
    set({ user: null, allowedTabs: [] });
    window.location.reload();
  },
}));
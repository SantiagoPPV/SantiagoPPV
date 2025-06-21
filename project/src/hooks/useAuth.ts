import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for custom session
    const user = localStorage.getItem('user');
    if (user) {
      setSession({ user: JSON.parse(user), expires_at: 0 } as Session);
    }

    // Get Supabase session for OAuth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && session.user.app_metadata.provider === 'google') {
        setSession(session);
        supabase
          .from('Users')
          .upsert({
            email: session.user.email,
          }, {
            onConflict: 'email',
          })
          .then(({ error }) => {
            if (error) console.error('Error storing OAuth user:', error);
          });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.user.app_metadata.provider === 'google') {
        setSession(session);
        supabase
          .from('Users')
          .upsert({
            email: session.user.email,
          }, {
            onConflict: 'email',
          })
          .then(({ error }) => {
            if (error) console.error('Error storing OAuth user:', error);
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
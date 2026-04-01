import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  profile: { full_name: string; phone: string; role: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  isApproved: false, isAdmin: false, profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; role: string } | null>(null);
  const initialized = useRef(false);

  const fetchUserData = async (userId: string) => {
    try {
      const [approvedRes, adminRes, profileRes] = await Promise.all([
        supabase.rpc('is_approved'),
        supabase.rpc('is_admin'),
        (supabase as any).from('profiles').select('full_name, phone, role').eq('user_id', userId).maybeSingle(),
      ]);
      setIsApproved(approvedRes.data === true);
      setIsAdmin(adminRes.data === true);
      setProfile(profileRes.data as any);
    } catch (e) {
      console.error('fetchUserData error:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!initialized.current && mounted) {
        console.warn('Auth timeout - forcing load');
        initialized.current = true;
        setLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchUserData(newSession.user.id);
        } else {
          setIsApproved(false);
          setIsAdmin(false);
          setProfile(null);
        }
        initialized.current = true;
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted || initialized.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchUserData(s.user.id);
      }
      initialized.current = true;
      setLoading(false);
    }).catch(() => {
      if (mounted && !initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isApproved, isAdmin, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

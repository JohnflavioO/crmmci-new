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
      const results = await Promise.allSettled([
        (supabase as any).from('user_approvals').select('status').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
        (supabase as any).from('profiles').select('full_name, phone, role').eq('user_id', userId).maybeSingle(),
      ]);
      const approvalRes = results[0].status === 'fulfilled' ? results[0].value : { data: null };
      const roleRes = results[1].status === 'fulfilled' ? results[1].value : { data: null };
      const profileRes = results[2].status === 'fulfilled' ? results[2].value : { data: null };
      setIsApproved((approvalRes.data as any)?.status === 'approved');
      setIsAdmin(roleRes.data?.some((r: any) => r.role === 'admin') ?? false);
      setProfile(profileRes.data as any);
    } catch (e) {
      console.error('fetchUserData error:', e);
    }
  };

  useEffect(() => {
    // Safety timeout - if auth takes more than 4 seconds, stop loading
    const timeout = setTimeout(() => {
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    }, 4000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
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

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (initialized.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchUserData(s.user.id);
      }
      initialized.current = true;
      setLoading(false);
    }).catch(() => {
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    return () => {
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

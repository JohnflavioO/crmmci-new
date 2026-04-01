import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  const fetchUserData = async (userId: string) => {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const fetches = Promise.all([
        (supabase as any).from('user_approvals').select('status').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
        (supabase as any).from('profiles').select('full_name, phone, role').eq('user_id', userId).maybeSingle(),
      ]);
      const [approvalRes, roleRes, profileRes] = await Promise.race([fetches, timeout]) as any[];
      setIsApproved((approvalRes.data as any)?.status === 'approved');
      setIsAdmin(roleRes.data?.some((r: any) => r.role === 'admin') ?? false);
      setProfile(profileRes.data as any);
    } catch (err) {
      console.error('fetchUserData error/timeout:', err);
      setIsApproved(false);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setIsApproved(false);
          setIsAdmin(false);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isFinanceiro: boolean;
  isLogistica: boolean;
  profile: { full_name: string; phone: string; role: string; avatar_url?: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  isApproved: false, isAdmin: false, isGestor: false, isFinanceiro: false, isLogistica: false, profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const MAX_LOADING_MS = 12000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const [isFinanceiro, setIsFinanceiro] = useState(false);
  const [isLogistica, setIsLogistica] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; role: string } | null>(null);

  // Safety timeout: never stay loading forever
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('[Auth] Loading timeout reached, forcing loaded state');
          return false;
        }
        return prev;
      });
    }, MAX_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let currentUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (!newUserId) {
          currentUserId = null;
          setIsApproved(false);
          setIsAdmin(false);
          setIsGestor(false);
          setIsFinanceiro(false);
          setIsLogistica(false);
          setProfile(null);
          setLoading(false);
        } else if (newUserId !== currentUserId) {
          currentUserId = newUserId;
          setLoading(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.error('[Auth] getSession error, clearing session:', error.message);
        supabase.auth.signOut().catch(() => {});
        setLoading(false);
        return;
      }
      const uid = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (!uid) {
        setLoading(false);
      } else if (uid !== currentUserId) {
        currentUserId = uid;
      }
    }).catch((err) => {
      console.error('[Auth] getSession exception:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [approvedRes, adminRes, gestorRes, financeiroRes, logisticaRes, profileRes] = await Promise.all([
          supabase.rpc('is_approved'),
          supabase.rpc('is_admin'),
          supabase.rpc('is_gestor'),
          supabase.rpc('is_financeiro'),
          supabase.rpc('is_logistica' as any),
          (supabase as any).from('profiles').select('full_name, phone, role, avatar_url').eq('user_id', user.id).maybeSingle(),
        ]);

        if (cancelled) return;

        // Check for auth errors (invalid token)
        const hasAuthError = [approvedRes, adminRes, gestorRes, financeiroRes, logisticaRes].some(
          r => r.error?.message?.includes('JWT') || r.error?.code === 'PGRST301'
        );
        if (hasAuthError) {
          console.warn('[Auth] JWT/auth error detected, signing out');
          await supabase.auth.signOut();
          return;
        }

        setIsApproved(approvedRes.data === true);
        setIsAdmin(adminRes.data === true);
        setIsGestor(gestorRes.data === true);
        setIsFinanceiro(financeiroRes.data === true);
        setIsLogistica(logisticaRes.data === true);
        setProfile(profileRes.data as any);
      } catch (e) {
        console.error('[Auth] fetchUserData error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

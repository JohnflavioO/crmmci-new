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
  isSupportTech: boolean;
  isSupportManager: boolean;
  isSupport: boolean;
  isSupportOnly: boolean;
  profile: { full_name: string; phone: string; role: string; avatar_url?: string; company_id?: string; can_access_support_manager?: boolean } | null;
  forcePasswordChange: boolean;
  signOut: () => Promise<void>;
}

type BooleanRpcResult = {
  data: boolean;
  error: { message?: string; code?: string } | null;
};

const safeBooleanRpc = async (functionName: string): Promise<BooleanRpcResult> => {
  try {
    const { data, error } = await (supabase.rpc(functionName as any) as any);
    if (error) console.error(`[Auth] ${functionName} RPC error:`, error);
    return { data: data === true, error: error ?? null };
  } catch (error: any) {
    console.error(`[Auth] ${functionName} RPC exception:`, error);
    return { data: false, error };
  }
};

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  isApproved: false, isAdmin: false, isGestor: false, isFinanceiro: false, isLogistica: false,
  isSupportTech: false, isSupportManager: false, isSupport: false, isSupportOnly: false,
  profile: null, forcePasswordChange: false,
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
  const [isSupportTech, setIsSupportTech] = useState(false);
  const [isSupportManager, setIsSupportManager] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; role: string; avatar_url?: string; force_password_change?: boolean; company_id?: string; can_access_support_manager?: boolean } | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  // Safety timeout: never stay loading forever.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (!prev) return prev;
        console.warn('[Auth] Safety timeout reached, forcing loading=false');
        return false;
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
          setIsSupportTech(false);
          setIsSupportManager(false);
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
        console.log('[Auth] Fetching user data for:', user.id);
        const [approvedRes, adminRes, gestorRes, financeiroRes, logisticaRes, supportTechRes, supportManagerRes, profileRes] = await Promise.all([
          safeBooleanRpc('is_approved'),
          safeBooleanRpc('is_admin'),
          safeBooleanRpc('is_gestor'),
          safeBooleanRpc('is_financeiro'),
          safeBooleanRpc('is_logistica'),
          safeBooleanRpc('is_support_tech'),
          safeBooleanRpc('is_support_manager'),
          supabase.from('profiles').select('full_name, phone, role, avatar_url, force_password_change, company_id, can_access_support_manager').eq('user_id', user.id).maybeSingle(),
        ]);

        console.log('[Auth] Results:', {
          approved: approvedRes.data,
          admin: adminRes.data,
          gestor: gestorRes.data,
          financeiro: financeiroRes.data,
          logistica: logisticaRes.data,
          profile: profileRes.data,
          error: profileRes.error
        });

        if (cancelled) return;

        // Check for auth errors (invalid token)
        const hasAuthError = [approvedRes, adminRes, gestorRes, financeiroRes, logisticaRes].some(
          r => r.error?.message?.includes('JWT') || r.error?.code === 'PGRST301' || r.error?.message?.includes('invalid input syntax for type uuid')
        );
        if (hasAuthError) {
          console.warn('[Auth] Critical auth error detected, signing out for safety');
          await supabase.auth.signOut();
          return;
        }

        const normalizedRole = profileRes.data?.role?.toLowerCase();
        const approvedByRole = !!normalizedRole && ['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica'].includes(normalizedRole);

        // Se o usuário tem o perfil com role correta, ele está aprovado
        const approvedState = approvedRes.data === true || approvedByRole;
        
        console.log('[Auth] Final state mapping:', {
          role: normalizedRole,
          approvedByRole,
          rpcApproved: approvedRes.data,
          finalApproved: approvedState
        });

        setIsApproved(approvedState);
        setIsAdmin(adminRes.data === true || normalizedRole === 'admin');
        setIsGestor(gestorRes.data === true || normalizedRole === 'gestor');
        setIsFinanceiro(financeiroRes.data === true || normalizedRole === 'financeiro');
        setIsLogistica(logisticaRes.data === true || normalizedRole === 'logistica');
        setIsSupportTech(supportTechRes.data === true || normalizedRole === 'support_tech');
        setIsSupportManager(supportManagerRes.data === true || normalizedRole === 'support_manager');
        setProfile(profileRes.data as any);
        setForcePasswordChange(profileRes.data?.force_password_change === true);
        
        setLoading(false);

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
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] SignOut error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, session, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, 
      isSupportTech, isSupportManager, isSupport: isSupportTech || isSupportManager, 
      isSupportOnly: (isSupportTech || isSupportManager) && !isAdmin && !isGestor && !isFinanceiro && !isLogistica,
      profile, forcePasswordChange, signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

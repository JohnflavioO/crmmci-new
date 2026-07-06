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

const isDev = import.meta.env.DEV;
const devLog = (...args: any[]) => { if (isDev) console.log(...args); };
const devWarn = (...args: any[]) => { if (isDev) console.warn(...args); };

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  isApproved: false, isAdmin: false, isGestor: false, isFinanceiro: false, isLogistica: false,
  isSupportTech: false, isSupportManager: false, isSupport: false, isSupportOnly: false,
  profile: null, forcePasswordChange: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const APPROVED_ROLES = new Set(['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica', 'support_tech', 'support_manager']);

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

  // Safety timeout: hard cap on splash — never > 3s.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (!prev) return prev;
        devWarn('[Auth] Safety timeout reached, forcing loading=false');
        return false;
      });
    }, 3000);
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
        } else if (newUserId !== currentUserId) {
          currentUserId = newUserId;
        }
        // Sessão resolvida — libera o splash imediatamente.
        // Roles/profile carregam em background; App.tsx já lida com profile ausente.
        setLoading(false);
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
      if (uid && uid !== currentUserId) currentUserId = uid;
      setLoading(false);
    }).catch((err) => {
      console.error('[Auth] getSession exception:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let attempt = 0;

    const fetchData = async () => {
      attempt += 1;
      try {
        // 1 SELECT profiles + 1 SELECT user_roles + 1 SELECT user_approvals — all parallel
        const [profileRes, rolesRes, approvalRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, phone, role, avatar_url, force_password_change, company_id, can_access_support_manager')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id),
          supabase
            .from('user_approvals')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (profileRes.error) console.error('[Auth] Profile fetch error:', profileRes.error);
        if (rolesRes.error) console.error('[Auth] Roles fetch error:', rolesRes.error);

        const profileData = profileRes.data;
        const normalizedRole = profileData?.role?.toLowerCase();
        const roleSet = new Set<string>((rolesRes.data ?? []).map((r: any) => String(r.role).toLowerCase()));
        if (normalizedRole) roleSet.add(normalizedRole);

        const approvedByStatus = approvalRes.data?.status === 'approved';
        const approvedByRole = [...roleSet].some(r => APPROVED_ROLES.has(r));

        setIsApproved(approvedByStatus || approvedByRole);
        setIsAdmin(roleSet.has('admin'));
        setIsGestor(roleSet.has('gestor'));
        setIsFinanceiro(roleSet.has('financeiro'));
        setIsLogistica(roleSet.has('logistica'));
        setIsSupportTech(roleSet.has('support_tech'));
        setIsSupportManager(roleSet.has('support_manager'));

        if (profileData) {
          setProfile(profileData as any);
          setForcePasswordChange(profileData.force_password_change === true);
        } else if (attempt < 2) {
          devWarn('[Auth] Profile empty, retrying');
          setTimeout(() => { if (!cancelled) fetchData(); }, 800);
          return;
        }

        devLog('[Auth] ready', { roles: [...roleSet] });
        setLoading(false);
      } catch (e) {
        console.error('[Auth] fetchUserData error:', e);
        if (attempt < 2 && !cancelled) {
          setTimeout(() => { if (!cancelled) fetchData(); }, 800);
          return;
        }
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

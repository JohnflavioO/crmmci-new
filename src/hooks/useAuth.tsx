import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  profile: { full_name: string; phone: string; role: string; avatar_url?: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  isApproved: false, isAdmin: false, isGestor: false, profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; role: string } | null>(null);

  // Step 1: Set up auth listener (no data fetching here)
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
          setProfile(null);
          setLoading(false);
        } else if (newUserId !== currentUserId) {
          // Only set loading true for a NEW user login
          currentUserId = newUserId;
          setLoading(true);
        }
        // If same user, don't touch loading - data is already loaded
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      const uid = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (!uid) {
        setLoading(false);
      } else if (uid !== currentUserId) {
        currentUserId = uid;
        // loading stays true, useEffect on user?.id will handle it
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Step 2: Fetch user data separately when user changes
  useEffect(() => {
    if (!user) return;
    
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [approvedRes, adminRes, gestorRes, profileRes] = await Promise.all([
          supabase.rpc('is_approved'),
          supabase.rpc('is_admin'),
          supabase.rpc('is_gestor'),
          (supabase as any).from('profiles').select('full_name, phone, role, avatar_url').eq('user_id', user.id).maybeSingle(),
        ]);

        if (cancelled) return;

        setIsApproved(approvedRes.data === true);
        setIsAdmin(adminRes.data === true);
        setIsGestor(gestorRes.data === true);
        setProfile(profileRes.data as any);
      } catch (e) {
        console.error('fetchUserData error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isApproved, isAdmin, isGestor, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  fullName: string | null;
  isSubscribed: boolean;
  isAdmin: boolean;
  subscriptionEnd?: string | null;
  subscriptionEndUnix?: number | null;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  productName?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isSubscribed: boolean;
  isAdmin: boolean;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async (supabaseUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        return { subscribed: false, subscriptionEnd: null, subscriptionEndUnix: null, subscriptionStatus: null, stripeCustomerId: null, productName: null };
      }
      return {
        subscribed: data?.subscribed ?? false,
        subscriptionEnd: data?.subscription_end ?? null,
        subscriptionEndUnix: data?.subscription_end_unix ?? null,
        subscriptionStatus: data?.subscription_status ?? null,
        stripeCustomerId: data?.stripe_customer_id ?? null,
        productName: data?.product_name ?? null,
      };
    } catch (err) {
      console.error('Error invoking check-subscription:', err);
      return { subscribed: false, subscriptionEnd: null, subscriptionEndUnix: null, subscriptionStatus: null, stripeCustomerId: null, productName: null };
    }
  };

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  };

  const buildUser = async (supabaseUser: SupabaseUser): Promise<User> => {
    const [subscriptionInfo, isAdmin] = await Promise.all([
      checkSubscription(supabaseUser),
      checkAdminRole(supabaseUser.id),
    ]);

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      fullName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
      isSubscribed: subscriptionInfo.subscribed,
      isAdmin,
      subscriptionEnd: subscriptionInfo.subscriptionEnd,
      subscriptionEndUnix: subscriptionInfo.subscriptionEndUnix,
      subscriptionStatus: subscriptionInfo.subscriptionStatus,
      stripeCustomerId: subscriptionInfo.stripeCustomerId,
      productName: subscriptionInfo.productName,
    };
  };

  const refreshSubscription = async () => {
    if (!session?.user) return;
    const updatedUser = await buildUser(session.user);
    setUser(updatedUser);
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Use setTimeout to prevent potential deadlock with Supabase client
          setTimeout(async () => {
            const builtUser = await buildUser(currentSession.user);
            setUser(builtUser);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        const builtUser = await buildUser(existingSession.user);
        setUser(builtUser);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        isSubscribed: user?.isSubscribed ?? false,
        isAdmin: user?.isAdmin ?? false,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

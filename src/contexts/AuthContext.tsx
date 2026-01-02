import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, demoUsers } from "@/data/mockData";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  isSubscribed: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "cte_skills_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check demo users
    const demoUser = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (demoUser) {
      setUser(demoUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
      return { success: true };
    }

    // Check localStorage for registered users
    const registeredUsers = JSON.parse(localStorage.getItem("cte_registered_users") || "[]");
    const registeredUser = registeredUsers.find((u: User & { password: string }) => 
      u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (registeredUser) {
      const { password: _, ...userWithoutPassword } = registeredUser;
      setUser(userWithoutPassword);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithoutPassword));
      return { success: true };
    }

    return { success: false, error: "Invalid email or password" };
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if email already exists
    const demoUser = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (demoUser) {
      return { success: false, error: "Email already registered" };
    }

    const registeredUsers = JSON.parse(localStorage.getItem("cte_registered_users") || "[]");
    const existingUser = registeredUsers.find((u: User) => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return { success: false, error: "Email already registered" };
    }

    // Create new user
    const newUser: User & { password: string } = {
      id: `user-${Date.now()}`,
      email,
      fullName,
      isSubscribed: false,
      password,
    };

    registeredUsers.push(newUser);
    localStorage.setItem("cte_registered_users", JSON.stringify(registeredUsers));

    const { password: _, ...userWithoutPassword } = newUser;
    setUser(userWithoutPassword);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithoutPassword));

    return { success: true };
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        isSubscribed: user?.isSubscribed ?? false,
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

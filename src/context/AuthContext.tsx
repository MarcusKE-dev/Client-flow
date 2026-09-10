import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, ProfessionType } from '../types';
import { db, seedInitialData } from '../db';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;
  login: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  completeOnboarding: (name: string, profession: ProfessionType, reminderPref: User['reminderPref']) => Promise<void>;
  resetDatabase: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        await seedInitialData(false);
        const users = await db.users.toArray();
        if (!isMounted) return;
        if (users.length > 0) {
          setUser(users[0]);
          setIsOnboarded(true);
        } else {
          setIsOnboarded(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, name: string = 'Professional Agent') => {
    setIsLoading(true);
    try {
      let foundUser = await db.users.where('email').equalsIgnoreCase(email).first();
      if (!foundUser) {
        const newUser: User = {
          id: 'usr_' + Date.now().toString(36),
          name: name,
          email: email.toLowerCase(),
          profession: 'insurance',
          reminderPref: '15m',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.users.put(newUser);
        foundUser = newUser;
      }
      setUser(foundUser);
      setIsOnboarded(true);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated: User = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await db.users.put(updated);
    setUser(updated);
  };

  const completeOnboarding = async (name: string, profession: ProfessionType, reminderPref: User['reminderPref']) => {
    const newUser: User = {
      id: user?.id || 'usr_' + Date.now().toString(36),
      name: name.trim() || 'Agent',
      email: user?.email || 'agent@clientflow.local',
      profession: profession,
      reminderPref: reminderPref,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.users.put(newUser);
    setUser(newUser);
    setIsOnboarded(true);
  };

  const resetDatabase = async () => {
    setIsLoading(true);
    await seedInitialData(true);
    const users = await db.users.toArray();
    if (users.length > 0) {
      setUser(users[0]);
    }
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isOnboarded,
        login,
        logout,
        updateUser,
        completeOnboarding,
        resetDatabase
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

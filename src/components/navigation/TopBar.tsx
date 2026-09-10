import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  X, 
  User, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Phone,
  Briefcase,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../db';
import type { Customer, Appointment, FollowUp } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface TopBarProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: () => void;
  onSelectTab: (tab: any) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSelectCustomer, onOpenQuickCapture, onSelectTab }) => {
  const { isOnline, syncStatus, pendingCount, syncNow } = useSync();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    customers: Customer[];
    appointments: (Appointment & { customerName?: string })[];
    followUps: (FollowUp & { customerName?: string })[];
  }>({ customers: [], appointments: [], followUps: [] });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Instant global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ customers: [], appointments: [], followUps: [] });
      setIsSearchOpen(false);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    let isMounted = true;

    async function doSearch() {
      try {
        const allCustomers = await db.customers.toArray();
        const matchingCustomers = allCustomers.filter(c => 
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          (c.notes && c.notes.toLowerCase().includes(query)) ||
          c.interests.some(i => i.toLowerCase().includes(query)) ||
          c.tags.some(t => t.toLowerCase().includes(query))
        ).slice(0, 5);

        const allAppointments = await db.appointments.toArray();
        const matchingAppointments = allAppointments.filter(a =>
          a.title.toLowerCase().includes(query) ||
          a.purpose.toLowerCase().includes(query) ||
          (a.locationAddress && a.locationAddress.toLowerCase().includes(query))
        ).slice(0, 3).map(a => {
          const cust = allCustomers.find(c => c.id === a.customerId);
          return { ...a, customerName: cust?.name };
        });

        const allFollowUps = await db.followUps.toArray();
        const matchingFollowUps = allFollowUps.filter(f =>
          f.title.toLowerCase().includes(query) ||
          (f.notes && f.notes.toLowerCase().includes(query))
        ).slice(0, 3).map(f => {
          const cust = allCustomers.find(c => c.id === f.customerId);
          return { ...f, customerName: cust?.name };
        });

        if (isMounted) {
          setSearchResults({
            customers: matchingCustomers,
            appointments: matchingAppointments,
            followUps: matchingFollowUps
          });
          setIsSearchOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }

    const timer = setTimeout(doSearch, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalHits = searchResults.customers.length + searchResults.appointments.length + searchResults.followUps.length;

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-[#1E293B] border-b border-[#E5E7EB] dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
      {/* Global Search Input */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers, phones, notes, meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setIsSearchOpen(true);
            }}
            className="w-full bg-[#F3F4F6] dark:bg-slate-800/80 hover:bg-[#E5E7EB]/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm text-[#111827] dark:text-slate-100 placeholder-[#9CA3AF] pl-9 pr-8 py-1.5 rounded-md border border-transparent focus:border-[#1D70F5] focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Instant Search Results Dropdown */}
        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1E293B] rounded-md shadow-lg border border-[#E5E7EB] dark:border-slate-700 max-h-96 overflow-y-auto z-50 divide-y divide-[#F3F4F6] dark:divide-slate-700/50">
            {totalHits === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280] dark:text-slate-400">
                No matching customers, meetings, or follow-ups found for "{searchQuery}"
              </div>
            ) : (
              <>
                {/* Customers Section */}
                {searchResults.customers.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      Customers
                    </div>
                    {searchResults.customers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onSelectCustomer(c.id);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="px-3 py-2 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-[#1D70F5] text-[#1D70F5] font-semibold text-xs flex items-center justify-center shrink-0">
                            {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#111827] dark:text-slate-100 truncate">{c.name}</p>
                              <StatusBadge status={c.status} />
                            </div>
                            <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate">
                              {c.phone} {c.company ? `• ${c.company}` : ''}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Appointments Section */}
                {searchResults.appointments.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      Meetings
                    </div>
                    {searchResults.appointments.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          onSelectCustomer(a.customerId);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="px-3 py-2 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CalendarIcon className="w-4 h-4 text-[#1D70F5] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#111827] dark:text-slate-100 truncate">{a.title}</p>
                            <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                              {a.date} at {a.startTime} • {a.customerName || 'Client'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* FollowUps Section */}
                {searchResults.followUps.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      Follow-ups
                    </div>
                    {searchResults.followUps.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => {
                          onSelectCustomer(f.customerId);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="px-3 py-2 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#111827] dark:text-slate-100 truncate">{f.title}</p>
                            <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                              Due: {f.dueDate} • {f.customerName || 'Client'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right controls: Theme Toggle & Connectivity Status */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-md border border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#4B5563] dark:text-amber-400 hover:bg-[#F3F4F6] dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[#4B5563]" />
          )}
        </button>

        {/* Sync Status Badge */}
        <div 
          onClick={() => onSelectTab('more')}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#F9FAFB] dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 text-xs text-[#4B5563] dark:text-slate-300 cursor-pointer hover:bg-[#F3F4F6] dark:hover:bg-slate-700"
          title="Click to open Sync Center"
        >
          {isOnline ? (
            syncStatus === 'syncing' ? (
              <RefreshCw className="w-3 h-3 text-[#1D70F5] animate-spin" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )
          ) : (
            <WifiOff className="w-3 h-3 text-amber-500" />
          )}
          <span className="hidden sm:inline font-medium text-[11px]">
            {!isOnline 
              ? 'Saved offline' 
              : syncStatus === 'syncing' 
              ? 'Syncing' 
              : pendingCount > 0 
              ? `${pendingCount} waiting` 
              : 'Synced'}
          </span>
        </div>
      </div>
    </header>
  );

};

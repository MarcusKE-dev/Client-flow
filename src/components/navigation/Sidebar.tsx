import React from 'react';
import { 
  Calendar, 
  Users, 
  CheckSquare, 
  Briefcase, 
  Clock, 
  MoreHorizontal, 
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Plus
} from 'lucide-react';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 'today' | 'customers' | 'calendar' | 'followups' | 'opportunities' | 'activity' | 'more';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickCapture: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenQuickCapture }) => {
  const { user } = useAuth();
  const { isOnline, syncStatus, pendingCount, syncNow } = useSync();

  const navItems = [
    { id: 'today' as NavTab, label: 'Today', icon: Clock },
    { id: 'customers' as NavTab, label: 'Customers', icon: Users },
    { id: 'calendar' as NavTab, label: 'Calendar', icon: Calendar },
    { id: 'followups' as NavTab, label: 'Follow-ups', icon: CheckSquare },
    { id: 'opportunities' as NavTab, label: 'Opportunities', icon: Briefcase },
    { id: 'activity' as NavTab, label: 'Activity', icon: Activity },
    { id: 'more' as NavTab, label: 'More', icon: MoreHorizontal },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#1E293B] border-r border-[#E5E7EB] dark:border-slate-800 h-screen sticky top-0 shrink-0 select-none">
      {/* Quick Action Button */}
      <div className="p-4 pt-5">
        <button
          onClick={onOpenQuickCapture}
          className="w-full bg-[#1D70F5] hover:bg-[#1B2CC1] text-white font-medium text-sm py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:translate-y-px"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Action</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#1D70F5]/10 text-[#1D70F5] dark:bg-[#1D70F5]/20 dark:text-[#60A5FA] font-semibold'
                  : 'text-[#4B5563] dark:text-slate-300 hover:bg-[#F3F4F6] dark:hover:bg-slate-800/60 hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#1D70F5] dark:text-[#60A5FA]' : 'text-[#6B7280] dark:text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sync Status & User Footer */}
      <div className="p-3 border-t border-[#E5E7EB] dark:border-slate-800 bg-[#F9FAFB] dark:bg-slate-900/50">
        {/* Subtle Sync Indicator */}
        <div className="flex items-center justify-between px-2 py-1.5 text-xs text-[#6B7280] dark:text-slate-400 mb-2 rounded bg-white dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              syncStatus === 'syncing' ? (
                <RefreshCw className="w-3 h-3 text-[#1D70F5] animate-spin" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              )
            ) : (
              <WifiOff className="w-3 h-3 text-amber-500" />
            )}
            <span className="font-medium text-[#374151] dark:text-slate-300">
              {!isOnline
                ? 'Offline (Saved on device)'
                : syncStatus === 'syncing'
                ? 'Syncing...'
                : pendingCount > 0
                ? `${pendingCount} waiting to sync`
                : 'Synced locally'}
            </span>
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => syncNow()}
              className="text-[#1D70F5] hover:text-[#1B2CC1] font-semibold text-xs cursor-pointer"
            >
              Sync
            </button>
          )}
        </div>

        {/* User Card */}
        <div 
          onClick={() => onSelectTab('more')}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#1B2CC1] text-white flex items-center justify-center font-bold text-xs uppercase">
            {user?.name ? user.name.slice(0, 2) : 'CF'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#111827] dark:text-slate-200 truncate">{user?.name || 'My Profile'}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400 truncate capitalize">{user?.profession || 'Advisor'}</p>
          </div>
        </div>
      </div>
    </aside>
  );

};

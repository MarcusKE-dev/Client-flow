import React from 'react';
import { 
  Clock, 
  Users, 
  Calendar, 
  CheckSquare, 
  MoreHorizontal,
  Plus
} from 'lucide-react';
import type { NavTab } from './Sidebar';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickCapture: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onOpenQuickCapture }) => {
  const navItems = [
    { id: 'today' as NavTab, label: 'Today', icon: Clock },
    { id: 'customers' as NavTab, label: 'Customers', icon: Users },
    { id: 'calendar' as NavTab, label: 'Calendar', icon: Calendar },
    { id: 'followups' as NavTab, label: 'Follow-ups', icon: CheckSquare },
    { id: 'more' as NavTab, label: 'More', icon: MoreHorizontal },
  ];

  return (
    <>
      {/* Mobile Floating Quick Action button */}
      <button
        onClick={onOpenQuickCapture}
        aria-label="Quick Action"
        className="md:hidden fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full bg-[#1D70F5] hover:bg-[#1B2CC1] text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5 stroke-[2.2]" />
      </button>

      {/* Edge-to-edge Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5E7EB] flex items-center justify-around h-16 pb-safe px-1 select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
                isActive ? 'text-[#1D70F5]' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
              <span className={`text-[11px] mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

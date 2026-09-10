import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider, useSync } from './context/SyncContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar, type NavTab } from './components/navigation/Sidebar';
import { BottomNav } from './components/navigation/BottomNav';
import { TopBar } from './components/navigation/TopBar';
import { TodayView } from './components/today/TodayView';
import { CustomerListView } from './components/customers/CustomerListView';
import { CustomerProfileView } from './components/customers/CustomerProfileView';
import { FollowUpsView } from './components/followups/FollowUpsView';
import { CalendarView } from './components/calendar/CalendarView';
import { OpportunitiesView } from './components/opportunities/OpportunitiesView';
import { ActivityView } from './components/activity/ActivityView';
import { SettingsView } from './components/settings/SettingsView';
import { QuickCaptureModal } from './components/common/QuickCaptureModal';
import { WifiOff } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('today');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const { isOnline, pendingCount } = useSync();

  // Keyboard shortcut: 'n' or '+' for quick action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in an input/textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.key === 'q' || e.key === 'Q') {
        setIsQuickCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  const handleBackFromCustomer = () => {
    setSelectedCustomerId(null);
  };

  const handleSelectTab = (tab: NavTab) => {
    setSelectedCustomerId(null);
    setCurrentTab(tab);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F7FA] dark:bg-[#0F172A] font-sans antialiased text-[#111827] dark:text-[#F8FAFC]">
      {/* Desktop Persistent Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Offline Status Warning Strip (Clean, Informative) */}
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between z-30 shrink-0 select-none shadow-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode: Working from local device storage. All records will sync when reconnected.</span>
            </div>
            {pendingCount > 0 && (
              <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-full font-bold">
                {pendingCount} changes queued
              </span>
            )}
          </div>
        )}

        {/* Universal TopBar with Instant Global Search */}
        <TopBar
          onSelectCustomer={handleSelectCustomer}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
          onSelectTab={handleSelectTab}
        />

        {/* Dynamic Viewport Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {selectedCustomerId ? (
            <CustomerProfileView
              customerId={selectedCustomerId}
              onBack={handleBackFromCustomer}
            />
          ) : (
            <>
              {currentTab === 'today' && (
                <TodayView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                  onOpenCalendar={() => setCurrentTab('calendar')}
                  onOpenFollowUps={() => setCurrentTab('followups')}
                />
              )}

              {currentTab === 'customers' && (
                <CustomerListView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                />
              )}

              {currentTab === 'calendar' && (
                <CalendarView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                />
              )}

              {currentTab === 'followups' && (
                <FollowUpsView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                />
              )}

              {currentTab === 'opportunities' && (
                <OpportunitiesView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                />
              )}

              {currentTab === 'activity' && (
                <ActivityView
                  onSelectCustomer={handleSelectCustomer}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                />
              )}

              {currentTab === 'more' && (
                <SettingsView />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Action & Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Global Quick Action Modal */}
      {isQuickCaptureOpen && (
        <QuickCaptureModal
          onClose={() => setIsQuickCaptureOpen(false)}
          onSuccess={() => setIsQuickCaptureOpen(false)}
          onOpenCustomer={(custId) => {
            setSelectedCustomerId(custId);
            setIsQuickCaptureOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <AppContent />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

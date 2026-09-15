import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Clock, 
  AlertCircle, 
  Check, 
  Calendar, 
  Phone, 
  MessageCircle, 
  ChevronRight, 
  ArrowRight,
  MoreVertical,
  Filter
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { FollowUp, Customer } from '../../types';
import { formatDate, formatTime, getRelativeDateLabel, getWhatsAppUrl } from '../../utils';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import type { ActionTab } from '../common/QuickCaptureModal';

type FollowUpSection = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'completed';

interface FollowUpsViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: (initialTab?: ActionTab) => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture
}) => {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [activeSection, setActiveSection] = useState<FollowUpSection>('today');
  const [isLoading, setIsLoading] = useState(true);

  // "What's next?" completion prompt state
  const [completingItem, setCompletingItem] = useState<FollowUp | null>(null);

  // New follow-up prompt
  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null);
  const [newDateValue, setNewDateValue] = useState('');

  const loadFollowUps = async () => {
    try {
      const [allFollowUps, allCustomers] = await Promise.all([
        db.followUps.toArray(),
        db.customers.toArray()
      ]);

      const cMap = new Map<string, Customer>();
      allCustomers.forEach(c => cMap.set(c.id, c));
      setCustomersMap(cMap);

      setFollowUps(allFollowUps);
    } catch (err) {
      console.error('Error loading follow-ups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, []);

  // Categorize follow-ups by date
  const categorized = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const result = {
      overdue: [] as FollowUp[],
      today: [] as FollowUp[],
      tomorrow: [] as FollowUp[],
      this_week: [] as FollowUp[],
      later: [] as FollowUp[],
      completed: [] as FollowUp[]
    };

    followUps.forEach((f) => {
      if (f.status === 'completed') {
        result.completed.push(f);
      } else if (f.dueDate < todayStr) {
        result.overdue.push(f);
      } else if (f.dueDate === todayStr) {
        result.today.push(f);
      } else if (f.dueDate === tomorrowStr) {
        result.tomorrow.push(f);
      } else if (f.dueDate <= weekEndStr) {
        result.this_week.push(f);
      } else {
        result.later.push(f);
      }
    });

    // Sort appropriately
    result.overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    result.today.sort((a, b) => a.dueTime.localeCompare(b.dueTime));
    result.tomorrow.sort((a, b) => a.dueTime.localeCompare(b.dueTime));
    result.this_week.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    result.later.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    result.completed.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

    return result;
  }, [followUps]);

  // Handle completion workflow
  const handleMarkDone = (flw: FollowUp) => {
    setCompletingItem(flw);
  };

  const finalizeCompletion = async (nextActionChoice: 'just_done' | 'another_followup' | 'meeting' | 'note') => {
    if (!completingItem || !user) return;
    const now = new Date();
    const nowIso = now.toISOString();

    await db.followUps.update(completingItem.id, {
      status: 'completed',
      completedAt: nowIso,
      updatedAt: nowIso
    });
    await queueMutation('update', 'followUps', completingItem.id, { status: 'completed' });

    // Log interaction
    const intId = generateId('int');
    await db.interactions.put({
      id: intId,
      userId: user.id,
      customerId: completingItem.customerId,
      type: 'other',
      date: nowIso.split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      summary: `Completed follow-up: ${completingItem.title}`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const targetCustId = completingItem.customerId;
    setCompletingItem(null);
    await loadFollowUps();

    if (nextActionChoice !== 'just_done') {
      onSelectCustomer(targetCustId);
    }
  };

  const handleApplyReschedule = async (flw: FollowUp, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().split('T')[0];

    await db.followUps.update(flw.id, {
      dueDate: dateStr,
      updatedAt: new Date().toISOString()
    });
    await queueMutation('update', 'followUps', flw.id, { dueDate: dateStr });
    loadFollowUps();
  };

  const displayedList = categorized[activeSection];

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA]">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Follow-ups
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Never let a customer commitment slip through
            </p>
          </div>

          <button
            onClick={() => onOpenQuickCapture('followup')}
            className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-4 py-2.5 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Follow-up</span>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="max-w-5xl mx-auto mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold select-none">
          <button
            onClick={() => setActiveSection('overdue')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'overdue'
                ? 'bg-red-600 text-white font-bold'
                : categorized.overdue.length > 0
                ? 'bg-white text-red-700 border border-red-200'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>Overdue</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.overdue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('today')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'today'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>Today</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.today.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('tomorrow')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'tomorrow'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>Tomorrow</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.tomorrow.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('this_week')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'this_week'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>This Week</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.this_week.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('later')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'later'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>Later</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.later.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('completed')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSection === 'completed'
                ? 'bg-emerald-700 text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            <span>Completed</span>
            <span className="text-[10px] px-1 rounded-full bg-black/10">
              {categorized.completed.length}
            </span>
          </button>
        </div>
      </div>

      {/* List Content */}
      <div className="max-w-5xl mx-auto px-0 sm:px-6 py-3 sm:py-5">
        {displayedList.length === 0 ? (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-10 text-center">
            <CheckSquare className="w-10 h-10 text-[#9CA3AF] mx-auto mb-2" />
            <h3 className="text-base font-semibold text-[#111827]">
              {activeSection === 'overdue' 
                ? 'Great job! No overdue follow-ups.' 
                : activeSection === 'completed'
                ? 'No completed tasks yet.'
                : 'No follow-ups scheduled for this period.'}
            </h3>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              Plan ahead and keep relationships active by scheduling touchpoints.
            </p>
            <button
              onClick={() => onOpenQuickCapture('followup')}
              className="mt-4 px-3.5 py-1.5 bg-[#1D70F5] text-white text-xs font-semibold rounded cursor-pointer hover:bg-[#1B2CC1]"
            >
              Add Follow-up
            </button>
          </div>
        ) : (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs divide-y divide-[#E5E7EB]">
            {displayedList.map((flw) => {
              const customer = customersMap.get(flw.customerId);
              const isCompleted = flw.status === 'completed';

              return (
                <div key={flw.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left Checkbox & Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      {!isCompleted ? (
                        <button
                          onClick={() => handleMarkDone(flw)}
                          title="Complete follow-up"
                          className="w-5 h-5 rounded border border-[#9CA3AF] hover:border-emerald-600 hover:bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-transparent hover:text-emerald-600" />
                        </button>
                      ) : (
                        <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectCustomer(flw.customerId)}
                            className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] cursor-pointer text-left truncate"
                          >
                            {customer?.name || 'Customer'}
                          </button>
                          {customer && (
                            <StatusBadge status={customer.status} />
                          )}
                          {customer?.company && (
                            <span className="text-xs text-[#6B7280]">
                              • {customer.company}
                            </span>
                          )}

                          {flw.priority === 'high' && (
                            <span className="text-[10px] font-bold uppercase text-red-700">
                              High Priority
                            </span>
                          )}
                        </div>

                        <p className={`text-xs font-semibold text-[#111827] mt-0.5 ${isCompleted ? 'line-through text-[#6B7280]' : ''}`}>
                          {flw.title}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-[#6B7280] mt-1">
                          <span className="flex items-center gap-1 font-medium text-[#374151]">
                            <Calendar className="w-3 h-3" />
                            {formatDate(flw.dueDate)} {flw.dueTime ? `at ${formatTime(flw.dueTime)}` : ''}
                          </span>

                          {flw.notes && (
                            <span className="truncate max-w-xs">{flw.notes}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Action Bar */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] bg-white transition-colors"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}

                      {customer?.phone && (
                        <a
                          href={getWhatsAppUrl(customer.phone, `Hi ${customer.name}, following up regarding: ${flw.title}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] bg-white transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}

                      {!isCompleted && (
                        <>
                          <button
                            onClick={() => handleApplyReschedule(flw, 1)}
                            className="px-2 py-1 text-[11px] font-medium text-[#4B5563] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded cursor-pointer"
                          >
                            +1 Day
                          </button>
                          <button
                            onClick={() => handleApplyReschedule(flw, 7)}
                            className="px-2 py-1 text-[11px] font-medium text-[#4B5563] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded cursor-pointer"
                          >
                            +1 Wk
                          </button>
                          <button
                            onClick={() => handleMarkDone(flw)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                          >
                            Done
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* "What's Next?" Modal */}
      {completingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-base text-[#111827]">Follow-up Completed</h3>
              <p className="text-xs text-[#6B7280] mt-1 font-medium">
                "{completingItem.title}"
              </p>
              <p className="text-xs font-bold text-[#111827] mt-3">What happens next?</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => finalizeCompletion('just_done')}
                className="w-full py-2 px-3 text-xs font-medium text-[#111827] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Done (No further action needed)</span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => finalizeCompletion('another_followup')}
                className="w-full py-2 px-3 text-xs font-semibold text-[#1D70F5] bg-[#1D70F5]/10 hover:bg-[#1D70F5]/15 border border-[#1D70F5]/30 rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Schedule another follow-up</span>
                <ChevronRight className="w-4 h-4 text-[#1D70F5]" />
              </button>

              <button
                onClick={() => finalizeCompletion('meeting')}
                className="w-full py-2 px-3 text-xs font-medium text-[#374151] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Schedule a meeting</span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => finalizeCompletion('note')}
                className="w-full py-2 px-3 text-xs font-medium text-[#374151] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Add detailed notes to customer</span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>

            <button
              onClick={() => setCompletingItem(null)}
              className="w-full py-1.5 text-xs text-[#6B7280] hover:text-[#111827] text-center cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

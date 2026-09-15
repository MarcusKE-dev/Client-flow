import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  AlertCircle, 
  Clock, 
  Phone, 
  MessageCircle, 
  FileText, 
  MapPin, 
  ChevronRight, 
  Check, 
  UserCheck, 
  ArrowRight,
  Sparkles,
  Plus,
  RefreshCw,
  ExternalLink,
  MoreVertical,
  CalendarCheck
} from 'lucide-react';
import { db, queueMutation } from '../../db';
import type { Customer, Appointment, FollowUp, Interaction, ImportantDate } from '../../types';
import type { ActionTab } from '../common/QuickCaptureModal';
import { formatDate, formatTime, getWhatsAppUrl, getRelativeDateLabel, calculateAttentionStatus } from '../../utils';
import { MeetingBriefModal } from '../meeting/MeetingBriefModal';
import { PostMeetingModal } from '../meeting/PostMeetingModal';
import { MessageTemplateModal } from '../common/MessageTemplateModal';
import { StatusBadge } from '../common/StatusBadge';

interface TodayViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: (initialTab?: ActionTab) => void;
  onOpenCalendar: () => void;
  onOpenFollowUps: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture,
  onOpenCalendar,
  onOpenFollowUps
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUpsDue, setFollowUpsDue] = useState<FollowUp[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<FollowUp[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [attentionCustomers, setAttentionCustomers] = useState<Customer[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [recentActivities, setRecentActivities] = useState<Interaction[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedBriefAppointment, setSelectedBriefAppointment] = useState<Appointment | null>(null);
  const [postMeetingAppointment, setPostMeetingAppointment] = useState<Appointment | null>(null);
  const [templateCustomer, setTemplateCustomer] = useState<Customer | null>(null);
  const [templateAppointment, setTemplateAppointment] = useState<Appointment | null>(null);

  // Follow-up completion prompt state ("What's next?")
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);

  const loadTodayData = useCallback(async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const allCustomers = await db.customers.toArray();
      const cMap = new Map<string, Customer>();
      allCustomers.forEach(c => cMap.set(c.id, c));
      setCustomersMap(cMap);

      // Appointments today
      const allApts = await db.appointments.toArray();
      const todayApts = allApts
        .filter(a => a.date === todayStr && a.status !== 'cancelled')
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setAppointments(todayApts);

      // Upcoming appointments (tomorrow and future)
      const upcomingApts = allApts
        .filter(a => a.date > todayStr && a.status === 'upcoming')
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .slice(0, 4);
      setUpcomingAppointments(upcomingApts);

      // Follow-ups
      const allFollowUps = await db.followUps.toArray();
      const dueToday = allFollowUps
        .filter(f => f.dueDate === todayStr && f.status === 'pending')
        .sort((a, b) => a.dueTime.localeCompare(b.dueTime));
      setFollowUpsDue(dueToday);

      const overdue = allFollowUps
        .filter(f => f.dueDate < todayStr && f.status === 'pending')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setOverdueFollowUps(overdue);

      // Customers requiring attention (cadence exceeded or overdue)
      const attention = allCustomers.filter(c => {
        if (c.isArchived) return false;
        const status = calculateAttentionStatus(c, allFollowUps);
        return status === 'needs_attention';
      }).slice(0, 4);
      setAttentionCustomers(attention);

      // Important dates coming up in next 30 days
      const allDates = await db.importantDates.toArray();
      const futureDates = allDates
        .filter(d => d.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3);
      setImportantDates(futureDates);

      // Recent activities
      const allInteractions = await db.interactions.toArray();
      const recent = allInteractions
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
      setRecentActivities(recent);

    } catch (err) {
      console.error('Error loading Today data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  // Handle direct follow-up completion
  const handleMarkFollowUpDone = async (flw: FollowUp) => {
    setCompletingFollowUp(flw);
  };

  const confirmFollowUpDone = async (action: 'just_done' | 'add_note' | 'another_followup') => {
    if (!completingFollowUp) return;
    const now = new Date();
    const nowIso = now.toISOString();

    await db.followUps.update(completingFollowUp.id, {
      status: 'completed',
      completedAt: nowIso,
      updatedAt: nowIso
    });
    await queueMutation('update', 'followUps', completingFollowUp.id, { status: 'completed' });

    // Also log an interaction
    const intId = 'int_' + Math.random().toString(36).substring(2, 8);
    const cust = customersMap.get(completingFollowUp.customerId);
    await db.interactions.put({
      id: intId,
      userId: completingFollowUp.userId,
      customerId: completingFollowUp.customerId,
      type: 'other',
      date: nowIso.split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      summary: `Completed follow-up: ${completingFollowUp.title}`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const targetCustId = completingFollowUp.customerId;
    setCompletingFollowUp(null);
    await loadTodayData();

    if (action === 'another_followup' || action === 'add_note') {
      onSelectCustomer(targetCustId);
    }
  };

  // Reschedule follow-up
  const handleReschedule = async (flw: FollowUp, daysToAdd: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);
    const targetStr = target.toISOString().split('T')[0];

    await db.followUps.update(flw.id, {
      dueDate: targetStr,
      updatedAt: new Date().toISOString()
    });
    await queueMutation('update', 'followUps', flw.id, { dueDate: targetStr });
    loadTodayData();
  };

  const nextAppointment = appointments.find(a => a.status === 'upcoming');
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA]">
      {/* Edge-to-edge Header Banner */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              {todayFormatted}
            </h1>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2 text-center select-none">
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded">
              <span className="block text-base font-bold text-[#111827]">{appointments.length}</span>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280]">Meetings</span>
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded">
              <span className="block text-base font-bold text-[#111827]">{followUpsDue.length}</span>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280]">Due Today</span>
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded">
              <span className={`block text-base font-bold ${overdueFollowUps.length > 0 ? 'text-red-700' : 'text-[#111827]'}`}>
                {overdueFollowUps.length}
              </span>
              <span className={`text-[10px] uppercase font-semibold ${overdueFollowUps.length > 0 ? 'text-red-700' : 'text-[#6B7280]'}`}>
                Overdue
              </span>
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 rounded">
              <span className="block text-base font-bold text-[#111827]">{attentionCustomers.length}</span>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280]">Attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="max-w-5xl mx-auto px-0 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-6">

        {/* 1. NEXT APPOINTMENT HIGHLIGHT (if any) */}
        {nextAppointment && (
          <div className="bg-white border-y sm:border sm:border-l-4 sm:border-l-[#1D70F5] border-l-4 border-l-[#1D70F5] border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-[#1D70F5] text-white text-[11px] font-bold uppercase px-2 py-0.5 rounded">
                    Next Up
                  </span>
                  <span className="text-sm font-semibold text-[#1D70F5]">
                    {formatTime(nextAppointment.startTime)} - {formatTime(nextAppointment.endTime)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#111827]">
                  {customersMap.get(nextAppointment.customerId)?.name || 'Client'} — {nextAppointment.title}
                </h3>
                <p className="text-xs text-[#4B5563] flex items-center gap-2">
                  {nextAppointment.locationAddress && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                      {nextAppointment.locationAddress}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedBriefAppointment(nextAppointment)}
                  className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-4 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4" />
                  <span>Meeting Brief</span>
                </button>
                {customersMap.get(nextAppointment.customerId)?.phone && (
                  <a
                    href={`tel:${customersMap.get(nextAppointment.customerId)?.phone}`}
                    className="p-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] transition-colors"
                    title="Call customer"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </a>
                )}
                {customersMap.get(nextAppointment.customerId)?.phone && (
                  <a
                    href={getWhatsAppUrl(customersMap.get(nextAppointment.customerId)!.phone, `Hi ${customersMap.get(nextAppointment.customerId)?.name}, ready for our ${formatTime(nextAppointment.startTime)} meeting.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] transition-colors"
                    title="WhatsApp customer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. OVERDUE FOLLOW-UPS (Crucial Attention Area) */}
        {overdueFollowUps.length > 0 && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Overdue Follow-ups ({overdueFollowUps.length})
                </h2>
              </div>
              <button
                onClick={onOpenFollowUps}
                className="text-xs font-semibold text-red-700 hover:text-red-900 cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {overdueFollowUps.map((flw) => {
                const customer = customersMap.get(flw.customerId);
                return (
                  <div key={flw.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => handleMarkFollowUpDone(flw)}
                        title="Mark complete"
                        className="w-5 h-5 rounded border-2 border-red-400 hover:border-red-600 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-transparent hover:text-red-600" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectCustomer(flw.customerId)}
                            className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] truncate text-left cursor-pointer"
                          >
                            {customer?.name || 'Customer'}
                          </button>
                          {customer && (
                            <StatusBadge status={customer.status} />
                          )}
                          <span className="text-[11px] font-semibold text-red-600">
                            Due {getRelativeDateLabel(flw.dueDate)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-[#374151] mt-0.5">{flw.title}</p>
                        {flw.notes && <p className="text-[11px] text-[#6B7280] truncate">{flw.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="p-1.5 text-xs text-[#374151] hover:text-emerald-600 border border-[#E5E7EB] rounded bg-white hover:bg-[#F9FAFB]"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {customer?.phone && (
                        <a
                          href={getWhatsAppUrl(customer.phone, `Hi ${customer.name}, following up on: ${flw.title}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-xs text-[#374151] hover:text-emerald-600 border border-[#E5E7EB] rounded bg-white hover:bg-[#F9FAFB]"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleReschedule(flw, 1)}
                        className="text-[11px] font-medium text-[#1D70F5] hover:text-[#1B2CC1] px-2 py-1 bg-white border border-[#E5E7EB] rounded cursor-pointer"
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TODAY'S APPOINTMENTS */}
        <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#1D70F5]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Today's Appointments ({appointments.length})
              </h2>
            </div>
            <button
              onClick={onOpenCalendar}
              className="text-xs font-semibold text-[#1D70F5] hover:text-[#1B2CC1] cursor-pointer"
            >
              Open Calendar
            </button>
          </div>

          {appointments.length === 0 ? (
            <div className="p-6 text-center">
              <CalendarCheck className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#111827]">Your calendar is clear for today.</p>
              <button
                onClick={() => onOpenQuickCapture('meeting')}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Meeting</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {appointments.map((apt) => {
                const customer = customersMap.get(apt.customerId);
                const isCompleted = apt.status === 'completed';

                return (
                  <div key={apt.id} className={`p-4 hover:bg-[#F9FAFB] transition-colors ${isCompleted ? 'opacity-60 bg-gray-50/50' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Time & Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-16 shrink-0 text-center py-1 bg-[#F3F4F6] rounded border border-[#E5E7EB]">
                          <span className="block text-xs font-bold text-[#111827]">
                            {formatTime(apt.startTime).split(' ')[0]}
                          </span>
                          <span className="text-[10px] font-semibold text-[#6B7280]">
                            {formatTime(apt.startTime).split(' ')[1]}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSelectCustomer(apt.customerId)}
                              className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] truncate text-left cursor-pointer"
                            >
                              {customer?.name || 'Customer'}
                            </button>
                            {customer && (
                              <StatusBadge status={customer.status} />
                            )}
                            {customer?.company && (
                              <span className="text-xs text-[#6B7280] hidden sm:inline truncate">
                                • {customer.company}
                              </span>
                            )}
                            {isCompleted && (
                              <StatusBadge status="completed" label="Completed" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-[#374151] mt-0.5">{apt.purpose || apt.title}</p>
                          {apt.locationAddress && (
                            <p className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                              <span className="truncate">{apt.locationAddress}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setSelectedBriefAppointment(apt)}
                          className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#1D70F5]" />
                          <span>Brief</span>
                        </button>

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
                            href={getWhatsAppUrl(customer.phone, `Hi ${customer.name}, looking forward to our meeting today at ${formatTime(apt.startTime)}.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] bg-white transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          </a>
                        )}

                        {!isCompleted ? (
                          <button
                            onClick={() => setPostMeetingAppointment(apt)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium px-2 py-1">Finished</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. TODAY'S FOLLOW-UPS DUE */}
        <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Follow-ups Due Today ({followUpsDue.length})
              </h2>
            </div>
            <button
              onClick={onOpenFollowUps}
              className="text-xs font-semibold text-[#1D70F5] hover:text-[#1B2CC1] cursor-pointer"
            >
              All Follow-ups
            </button>
          </div>

          {followUpsDue.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-[#111827]">You're caught up on today's follow-ups.</p>
              <button
                onClick={() => onOpenQuickCapture('followup')}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#1D70F5]" />
                <span>Add Follow-up</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {followUpsDue.map((flw) => {
                const customer = customersMap.get(flw.customerId);
                return (
                  <div key={flw.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => handleMarkFollowUpDone(flw)}
                        title="Mark complete"
                        className="w-5 h-5 rounded border border-[#9CA3AF] hover:border-[#1D70F5] hover:bg-[#1D70F5]/10 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
                      >
                        <Check className="w-3 h-3 text-transparent hover:text-[#1D70F5]" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectCustomer(flw.customerId)}
                            className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] truncate text-left cursor-pointer"
                          >
                            {customer?.name || 'Customer'}
                          </button>
                          {customer && (
                            <StatusBadge status={customer.status} />
                          )}
                          <span className="text-xs text-[#6B7280]">
                            at {formatTime(flw.dueTime)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-[#374151] mt-0.5">{flw.title}</p>
                        {flw.notes && <p className="text-[11px] text-[#6B7280] truncate">{flw.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="p-1.5 text-xs text-[#374151] hover:text-emerald-600 border border-[#E5E7EB] rounded bg-white"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {customer?.phone && (
                        <a
                          href={getWhatsAppUrl(customer.phone, `Hi ${customer.name}, following up on: ${flw.title}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-xs text-[#374151] hover:text-emerald-600 border border-[#E5E7EB] rounded bg-white"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleMarkFollowUpDone(flw)}
                        className="px-2.5 py-1 bg-white border border-[#E5E7EB] hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 text-xs font-semibold rounded cursor-pointer transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. CUSTOMERS REQUIRING ATTENTION (Deterministic Cadence & Inactivity) */}
        {attentionCustomers.length > 0 && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Customers Requiring Attention ({attentionCustomers.length})
                </h2>
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                Cadence due or no next action
              </span>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {attentionCustomers.map((cust) => (
                <div key={cust.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onSelectCustomer(cust.id)}
                        className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] truncate text-left cursor-pointer"
                      >
                        {cust.name}
                      </button>
                      <StatusBadge status={cust.status} />
                      <span className="text-[11px] text-[#6B7280]">
                        {cust.company || cust.phone}
                      </span>
                    </div>
                    <p className="text-xs text-[#4B5563] mt-0.5">
                      Cadence: Stay in touch every {cust.cadenceDays || 30} days •{' '}
                      {cust.lastInteractionAt ? (
                        <span>Last contacted {formatDate(cust.lastInteractionAt)}</span>
                      ) : (
                        <span className="text-amber-800 font-medium">No recorded interaction</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cust.phone && (
                      <a
                        href={getWhatsAppUrl(cust.phone, `Hi ${cust.name}, checking in to see how you are doing.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-xs text-emerald-700 border border-emerald-200 rounded bg-white hover:bg-emerald-50"
                        title="Quick WhatsApp check-in"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => onSelectCustomer(cust.id)}
                      className="text-xs font-semibold text-[#1D70F5] hover:text-[#1B2CC1] px-2.5 py-1 bg-white border border-[#E5E7EB] rounded cursor-pointer"
                    >
                      Plan Action
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. UPCOMING APPOINTMENTS & IMPORTANT DATES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Upcoming appointments */}
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Upcoming Appointments
              </h2>
              <button
                onClick={onOpenCalendar}
                className="text-xs text-[#1D70F5] hover:underline cursor-pointer"
              >
                Calendar
              </button>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280]">
                No future appointments booked yet.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {upcomingAppointments.map((apt) => {
                  const customer = customersMap.get(apt.customerId);
                  return (
                    <div key={apt.id} className="p-3 hover:bg-[#F9FAFB] flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-[#1D70F5] uppercase">
                          {getRelativeDateLabel(apt.date)} at {formatTime(apt.startTime)}
                        </span>
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {customer?.name} — {apt.title}
                        </p>
                        {apt.locationAddress && (
                          <p className="text-[11px] text-[#6B7280] truncate">{apt.locationAddress}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedBriefAppointment(apt)}
                        className="text-xs text-[#1D70F5] hover:text-[#1B2CC1] font-semibold shrink-0 cursor-pointer ml-2"
                      >
                        Brief
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Important Dates / Renewals */}
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Key Dates & Renewals
              </h2>
              <span className="text-[11px] text-[#6B7280]">Next 30 days</span>
            </div>

            {importantDates.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280]">
                No renewal or birthday dates upcoming.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {importantDates.map((d) => {
                  const customer = customersMap.get(d.customerId);
                  return (
                    <div key={d.id} className="p-3 hover:bg-[#F9FAFB] flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-purple-700 uppercase">
                          {getRelativeDateLabel(d.date)}
                        </span>
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {d.customLabel || d.type.replace('_', ' ')}
                        </p>
                        <p className="text-[11px] text-[#6B7280] truncate">
                          {customer?.name} {customer?.company ? `(${customer.company})` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => onSelectCustomer(d.customerId)}
                        className="text-xs text-[#1D70F5] hover:underline shrink-0 cursor-pointer ml-2"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 7. RECENT ACTIVITY LOG */}
        <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Recent Activity History
            </h2>
            <span className="text-[11px] text-[#6B7280]">Real-time journal</span>
          </div>

          <div className="divide-y divide-[#E5E7EB]">
            {recentActivities.map((act) => {
              const customer = customersMap.get(act.customerId);
              return (
                <div key={act.id} className="p-3 hover:bg-[#F9FAFB] flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] shrink-0 mt-0.5 font-bold text-xs capitalize">
                    {act.type.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[#111827] truncate">
                        {customer?.name || 'Customer'}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF] shrink-0">
                        {formatDate(act.date)}
                      </span>
                    </div>
                    <p className="text-xs text-[#374151] mt-0.5">{act.summary}</p>
                    {act.outcome && (
                      <p className="text-[11px] text-[#6B7280] italic mt-0.5">
                        Outcome: {act.outcome}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODAL 1: Meeting Brief */}
      {selectedBriefAppointment && (
        <MeetingBriefModal
          appointment={selectedBriefAppointment}
          onClose={() => setSelectedBriefAppointment(null)}
          onOpenCustomer={(cid) => {
            setSelectedBriefAppointment(null);
            onSelectCustomer(cid);
          }}
          onCompleteMeeting={(apt) => {
            setSelectedBriefAppointment(null);
            setPostMeetingAppointment(apt);
          }}
        />
      )}

      {/* MODAL 2: Post-Meeting Workflow */}
      {postMeetingAppointment && (
        <PostMeetingModal
          appointment={postMeetingAppointment}
          customerName={customersMap.get(postMeetingAppointment.customerId)?.name}
          onClose={() => setPostMeetingAppointment(null)}
          onRefreshData={loadTodayData}
        />
      )}

      {/* MODAL 3: Message Template Drawer */}
      {templateCustomer && (
        <MessageTemplateModal
          customer={templateCustomer}
          appointment={templateAppointment}
          onClose={() => {
            setTemplateCustomer(null);
            setTemplateAppointment(null);
          }}
        />
      )}

      {/* MODAL 4: Follow-up Completion Prompt ("What's next?") */}
      {completingFollowUp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-base text-[#111827]">Follow-up Completed</h3>
              <p className="text-xs text-[#6B7280] mt-1">
                "{completingFollowUp.title}"
              </p>
              <p className="text-xs font-semibold text-[#111827] mt-3">What happens next?</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => confirmFollowUpDone('just_done')}
                className="w-full py-2 px-3 text-xs font-medium text-[#111827] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Task complete (no immediate next action)</span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>

              <button
                onClick={() => confirmFollowUpDone('another_followup')}
                className="w-full py-2 px-3 text-xs font-semibold text-[#1D70F5] bg-[#1D70F5]/10 hover:bg-[#1D70F5]/15 border border-[#1D70F5]/30 rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Schedule another follow-up or meeting</span>
                <ChevronRight className="w-4 h-4 text-[#1D70F5]" />
              </button>

              <button
                onClick={() => confirmFollowUpDone('add_note')}
                className="w-full py-2 px-3 text-xs font-medium text-[#374151] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer transition-colors text-left flex items-center justify-between"
              >
                <span>Open customer profile & add detailed note</span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>

            <button
              onClick={() => setCompletingFollowUp(null)}
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

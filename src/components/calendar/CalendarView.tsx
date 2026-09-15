import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  User, 
  FileText, 
  Check, 
  X, 
  Download,
  AlertCircle
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { Appointment, Customer, AppointmentStatus } from '../../types';
import { formatDate, formatTime, generateIcsFile, downloadFile, getMapUrl } from '../../utils';
import { MeetingBriefModal } from '../meeting/MeetingBriefModal';
import { PostMeetingModal } from '../meeting/PostMeetingModal';
import { StatusBadge } from '../common/StatusBadge';
import type { ActionTab } from '../common/QuickCaptureModal';

type CalendarViewMode = 'day' | 'week' | 'month';

interface CalendarViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: (initialTab?: ActionTab) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [briefAppointment, setBriefAppointment] = useState<Appointment | null>(null);
  const [postMeetingAppointment, setPostMeetingAppointment] = useState<Appointment | null>(null);

  const loadAppointments = async () => {
    try {
      const [allApts, allCusts] = await Promise.all([
        db.appointments.toArray(),
        db.customers.toArray()
      ]);
      const cMap = new Map<string, Customer>();
      allCusts.forEach(c => cMap.set(c.id, c));
      setCustomersMap(cMap);
      setAppointments(allApts);
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  // Format ISO date YYYY-MM-DD
  const toDateStr = (d: Date): string => {
    return d.toISOString().split('T')[0];
  };

  // Date navigation helpers
  const handlePrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Compute 7 days of the current week (Monday to Sunday)
  const currentWeekDays = useMemo(() => {
    const curr = new Date(selectedDate);
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));

    const days: { date: Date; dateStr: string; label: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const nextD = new Date(monday);
      nextD.setDate(monday.getDate() + i);
      days.push({
        date: nextD,
        dateStr: toDateStr(nextD),
        label: nextD.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayNum: nextD.getDate()
      });
    }
    return days;
  }, [selectedDate]);

  // Compute month days grid
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const daysInMonth = lastDay.getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Preceding blanks
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    for (let i = offset; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ dateStr: toDateStr(d), dayNum: d.getDate(), isCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ dateStr: toDateStr(d), dayNum: i, isCurrentMonth: true });
    }

    return days;
  }, [selectedDate]);

  // Export single appointment to iCal .ics
  const handleExportIcs = (apt: Appointment) => {
    const customer = customersMap.get(apt.customerId);
    const icsString = generateIcsFile(apt, customer?.name || 'Customer');
    downloadFile(`${apt.title.replace(/\s+/g, '_')}.ics`, icsString, 'text/calendar');
  };

  const selectedDateStr = toDateStr(selectedDate);
  const todayStr = toDateStr(new Date());

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA]">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Calendar
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Personal customer meetings and schedule
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenQuickCapture('meeting')}
              className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-3.5 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Meeting</span>
            </button>
          </div>
        </div>

        {/* Date Navigation & View Mode Switcher */}
        <div className="max-w-6xl mx-auto mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] rounded cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handlePrev}
              className="p-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] text-[#374151] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] text-[#374151] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-sm font-bold text-[#111827] ml-1">
              {viewMode === 'month'
                ? selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                : viewMode === 'week'
                ? `Week of ${formatDate(currentWeekDays[0].dateStr)}`
                : formatDate(selectedDateStr)}
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded text-xs font-semibold self-start sm:self-auto border border-[#E5E7EB]">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                viewMode === 'day' ? 'bg-white text-[#1D70F5] shadow-xs' : 'text-[#6B7280]'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                viewMode === 'week' ? 'bg-white text-[#1D70F5] shadow-xs' : 'text-[#6B7280]'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`hidden md:block px-3 py-1 rounded cursor-pointer transition-colors ${
                viewMode === 'month' ? 'bg-white text-[#1D70F5] shadow-xs' : 'text-[#6B7280]'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="max-w-6xl mx-auto px-0 sm:px-6 py-3 sm:py-5">

        {/* 1. WEEK VIEW (Default & most practical for professional workflow) */}
        {viewMode === 'week' && (
          <div className="space-y-4">
            {/* Weekly Overview Planner (spot overloaded days) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 px-2 sm:px-0">
              {currentWeekDays.map((day) => {
                const dayApts = appointments.filter(a => a.date === day.dateStr && a.status !== 'cancelled');
                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDateStr;

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDate(day.date)}
                    className={`p-2 rounded text-center border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#1D70F5] bg-[#1D70F5]/5 ring-1 ring-[#1D70F5]'
                        : isToday
                        ? 'border-[#1D70F5]/40 bg-white'
                        : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-[#6B7280] block">
                      {day.label}
                    </span>
                    <span className={`text-base font-bold block ${isToday ? 'text-[#1D70F5]' : 'text-[#111827]'}`}>
                      {day.dayNum}
                    </span>
                    <div className="mt-1">
                      {dayApts.length > 0 ? (
                        <span className={`inline-block text-[10px] font-bold ${
                          dayApts.length >= 3 
                            ? 'text-amber-800' // Overloaded alert
                            : 'text-[#1D70F5]'
                        }`}>
                          {dayApts.length} mtg{dayApts.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9CA3AF]">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detailed Selected Day Schedule */}
            <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
              <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                  {formatDate(selectedDateStr)} Schedule
                </span>
                <span className="text-xs text-[#6B7280]">
                  {appointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').length} meetings
                </span>
              </div>

              {appointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').length === 0 ? (
                <div className="p-8 text-center text-sm text-[#6B7280]">
                  No appointments scheduled for {formatDate(selectedDateStr)}.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {appointments
                    .filter(a => a.date === selectedDateStr && a.status !== 'cancelled')
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((apt) => {
                      const customer = customersMap.get(apt.customerId);
                      const isCompleted = apt.status === 'completed';

                      return (
                        <div key={apt.id} className="p-4 hover:bg-[#F9FAFB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-20 text-center py-1 bg-[#F3F4F6] rounded border border-[#E5E7EB] shrink-0">
                              <span className="block text-xs font-bold text-[#111827]">
                                {formatTime(apt.startTime)}
                              </span>
                              <span className="text-[10px] text-[#6B7280]">
                                to {formatTime(apt.endTime)}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => onSelectCustomer(apt.customerId)}
                                  className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] cursor-pointer"
                                >
                                  {customer?.name || 'Customer'}
                                </button>
                                {customer && (
                                  <StatusBadge status={customer.status} />
                                )}
                                {isCompleted && (
                                  <StatusBadge status="completed" label="Completed" />
                                )}
                              </div>
                              <p className="text-xs font-semibold text-[#374151] mt-0.5">{apt.title}</p>
                              {apt.purpose && (
                                <p className="text-xs text-[#6B7280] mt-0.5">{apt.purpose}</p>
                              )}
                              {apt.locationAddress && (
                                <p className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                                  <span>{apt.locationAddress}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => setBriefAppointment(apt)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-[#1D70F5] bg-[#1D70F5]/10 hover:bg-[#1D70F5]/20 rounded transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Brief</span>
                            </button>

                            <button
                              onClick={() => handleExportIcs(apt)}
                              className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#4B5563] cursor-pointer"
                              title="Export .ics file for Google / Apple / Outlook Calendar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {!isCompleted ? (
                              <button
                                onClick={() => setPostMeetingAppointment(apt)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                              >
                                Complete
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. DAY VIEW */}
        {viewMode === 'day' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Day View: {formatDate(selectedDateStr)}
              </span>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {appointments
                .filter(a => a.date === selectedDateStr && a.status !== 'cancelled')
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((apt) => {
                  const customer = customersMap.get(apt.customerId);
                  return (
                    <div key={apt.id} className="p-4 hover:bg-[#F9FAFB] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#1D70F5]">
                          {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                        </span>
                        <h4 className="font-bold text-sm text-[#111827] mt-0.5">
                          {customer?.name} — {apt.title}
                        </h4>
                        <p className="text-xs text-[#6B7280]">{apt.purpose}</p>
                      </div>

                      <button
                        onClick={() => setBriefAppointment(apt)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D70F5] border border-[#1D70F5]/20 rounded hover:bg-[#1D70F5]/5 cursor-pointer"
                      >
                        Meeting Brief
                      </button>
                    </div>
                  );
                })}
              {appointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').length === 0 && (
                <div className="p-8 text-center text-sm text-[#6B7280]">
                  No appointments scheduled for this day.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. MONTH VIEW (Desktop) */}
        {viewMode === 'month' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs">
            <div className="grid grid-cols-7 border-b border-[#E5E7EB] text-center text-[11px] font-bold uppercase tracking-wider text-[#6B7280] py-2 bg-[#F9FAFB]">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-[#E5E7EB]">
              {monthDays.map((day, idx) => {
                const dayApts = appointments.filter(a => a.date === day.dateStr && a.status !== 'cancelled');
                const isToday = day.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(new Date(day.dateStr));
                      setViewMode('week');
                    }}
                    className={`min-h-[75px] p-1.5 cursor-pointer transition-colors hover:bg-[#F9FAFB] ${
                      !day.isCurrentMonth ? 'bg-gray-50/60 opacity-40' : ''
                    } ${isToday ? 'bg-blue-50/30' : ''}`}
                  >
                    <span className={`text-xs font-semibold block ${isToday ? 'text-[#1D70F5] font-bold' : 'text-[#374151]'}`}>
                      {day.dayNum}
                    </span>

                    <div className="mt-1 space-y-0.5">
                      {dayApts.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="text-[10px] text-[#1D70F5] truncate font-medium"
                        >
                          {formatTime(a.startTime).split(' ')[0]} {a.title}
                        </div>
                      ))}
                      {dayApts.length > 2 && (
                        <span className="text-[9px] text-[#6B7280] block">
                          +{dayApts.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Meeting Brief Modal */}
      {briefAppointment && (
        <MeetingBriefModal
          appointment={briefAppointment}
          onClose={() => setBriefAppointment(null)}
          onOpenCustomer={(cid) => {
            setBriefAppointment(null);
            onSelectCustomer(cid);
          }}
          onCompleteMeeting={(apt) => {
            setBriefAppointment(null);
            setPostMeetingAppointment(apt);
          }}
        />
      )}

      {/* Post-Meeting Workflow Modal */}
      {postMeetingAppointment && (
        <PostMeetingModal
          appointment={postMeetingAppointment}
          customerName={customersMap.get(postMeetingAppointment.customerId)?.name}
          onClose={() => setPostMeetingAppointment(null)}
          onRefreshData={loadAppointments}
        />
      )}
    </div>
  );
};

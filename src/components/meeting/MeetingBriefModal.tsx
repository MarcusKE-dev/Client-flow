import React, { useState, useEffect } from 'react';
import { 
  X, 
  Phone, 
  MessageCircle, 
  User, 
  Calendar, 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { db } from '../../db';
import type { Appointment, Customer, Interaction, FollowUp } from '../../types';
import { formatDate, formatTime, getWhatsAppUrl, getMapUrl } from '../../utils';
import { StatusBadge } from '../common/StatusBadge';

interface MeetingBriefModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onOpenCustomer: (customerId: string) => void;
  onCompleteMeeting?: (appointment: Appointment) => void;
}

export const MeetingBriefModal: React.FC<MeetingBriefModalProps> = ({
  appointment,
  onClose,
  onOpenCustomer,
  onCompleteMeeting
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lastInteraction, setLastInteraction] = useState<Interaction | null>(null);
  const [previousFollowUp, setPreviousFollowUp] = useState<FollowUp | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!appointment) return;
    let isMounted = true;

    async function loadBriefData() {
      setIsLoading(true);
      try {
        const cust = await db.customers.get(appointment!.customerId);
        if (isMounted) setCustomer(cust || null);

        // Fetch last interaction before this appointment
        const interactions = await db.interactions
          .where('customerId')
          .equals(appointment!.customerId)
          .sortBy('date');
        const last = interactions.length > 0 ? interactions[interactions.length - 1] : null;
        if (isMounted) setLastInteraction(last);

        // Fetch last completed follow-up
        const followUps = await db.followUps
          .where('customerId')
          .equals(appointment!.customerId)
          .toArray();
        const prevCompleted = followUps
          .filter(f => f.status === 'completed')
          .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
        if (isMounted) setPreviousFollowUp(prevCompleted || null);

      } catch (err) {
        console.error('Error loading meeting brief:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBriefData();
    return () => { isMounted = false; };
  }, [appointment]);

  if (!appointment) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1D70F5] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-white/90" />
            <div>
              <h2 className="font-bold text-base tracking-tight leading-tight">Meeting Brief</h2>
              <p className="text-[11px] text-white/80">Structured pre-meeting intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Clean edge-to-edge structured sections with dividers */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#6B7280]">Loading meeting brief...</div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] text-sm">
            {/* Top Appointment Meta */}
            <div className="p-4 bg-[#F9FAFB]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#111827]">{customer?.name || 'Customer'}</h3>
                    {customer && <StatusBadge status={customer.status} />}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {customer?.company ? `${customer.company} • ` : ''}{customer?.phone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="inline-flex items-center gap-1 font-semibold text-[#1D70F5] bg-white border border-[#1D70F5]/20 px-2 py-0.5 rounded text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(appointment.startTime)}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1">{formatDate(appointment.date)}</p>
                </div>
              </div>

              {appointment.locationAddress && (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#4B5563]">
                  <MapPin className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                  <span className="truncate">{appointment.locationAddress}</span>
                  <a
                    href={getMapUrl(appointment.locationAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1D70F5] hover:underline shrink-0 ml-1 inline-flex items-center gap-0.5 text-[11px]"
                  >
                    Map <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Purpose */}
            <div className="px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                Purpose
              </span>
              <p className="font-semibold text-[#111827]">{appointment.purpose || appointment.title}</p>
            </div>

            {/* Last Interaction */}
            <div className="px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                Last Interaction
              </span>
              {lastInteraction ? (
                <div>
                  <p className="text-xs font-semibold text-[#111827]">
                    {formatDate(lastInteraction.date)} • <span className="capitalize">{lastInteraction.type}</span>
                  </p>
                  <p className="text-xs text-[#374151] mt-0.5">{lastInteraction.summary}</p>
                  {lastInteraction.outcome && (
                    <p className="text-xs text-[#6B7280] mt-1 bg-[#F9FAFB] p-1.5 rounded border border-[#E5E7EB]">
                      <span className="font-medium text-[#111827]">Outcome:</span> {lastInteraction.outcome}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF] italic">No previous interactions logged.</p>
              )}
            </div>

            {/* Current Interests */}
            <div className="px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                Current Interest
              </span>
              {customer?.interests && customer.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {customer.interests.map((interest, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-[#1D70F5]/10 text-[#1D70F5] border border-[#1D70F5]/20 rounded text-xs font-medium"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">General relationship</p>
              )}
            </div>

            {/* Outstanding & Previous Follow-up */}
            <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                  Outstanding Action
                </span>
                <p className="text-xs font-medium text-[#111827]">
                  {customer?.nextAction || 'None flagged'}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                  Previous Follow-up
                </span>
                <p className="text-xs text-[#374151]">
                  {previousFollowUp ? (
                    <>
                      <span className="text-emerald-700 font-medium">Completed</span> ({formatDate(previousFollowUp.completedAt || previousFollowUp.dueDate)})
                      <span className="block text-[#6B7280] truncate">{previousFollowUp.title}</span>
                    </>
                  ) : (
                    'No prior follow-up'
                  )}
                </p>
              </div>
            </div>

            {/* Relationship Notes & Preferences */}
            <div className="px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                Relationship Context & Preferences
              </span>
              <p className="text-xs text-[#374151] leading-relaxed">
                {customer?.notes || 'No specific preferences recorded.'}
              </p>
              {customer?.preferredTime && (
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Prefers <strong className="capitalize text-[#111827]">{customer.preferredTime}</strong> appointments via <strong className="capitalize text-[#111827]">{customer.preferredChannel}</strong>.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Bar Footer */}
        <div className="p-3 bg-[#F9FAFB] border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
          {/* Communication Shortcuts */}
          <div className="flex items-center gap-2">
            {customer?.phone && (
              <>
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-medium rounded transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Call</span>
                </a>
                <a
                  href={getWhatsAppUrl(customer.phone, `Hi ${customer.name}, regarding our meeting today at ${formatTime(appointment.startTime)}...`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-medium rounded transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>
              </>
            )}
            <button
              onClick={() => {
                onClose();
                onOpenCustomer(appointment.customerId);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#1D70F5] hover:text-[#1B2CC1] font-medium cursor-pointer"
            >
              <span>Customer Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Complete Meeting Button */}
          {appointment.status === 'upcoming' && onCompleteMeeting && (
            <button
              onClick={() => {
                onClose();
                onCompleteMeeting(appointment);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Completed</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

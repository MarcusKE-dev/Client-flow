import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Briefcase, 
  Mic, 
  ArrowRight,
  Clock,
  Plus
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { Appointment, Customer, Interaction, FollowUp, Opportunity } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface PostMeetingModalProps {
  appointment: Appointment | null;
  customerName?: string;
  onClose: () => void;
  onRefreshData: () => void;
  onOpenVoiceRecorder?: (customerId: string) => void;
}

export const PostMeetingModal: React.FC<PostMeetingModalProps> = ({
  appointment,
  customerName = 'Customer',
  onClose,
  onRefreshData,
  onOpenVoiceRecorder
}) => {
  const { user } = useAuth();
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  
  // Follow-up subform
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpTitle, setFollowUpTitle] = useState('Follow up on meeting action items');
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [followUpTime, setFollowUpTime] = useState('10:00');

  // Opportunity subform
  const [createOpportunity, setCreateOpportunity] = useState(false);
  const [oppTitle, setOppTitle] = useState('');
  const [oppProduct, setOppProduct] = useState('');
  const [oppValue, setOppValue] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  if (!appointment) return null;

  const handleSavePostMeeting = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // 1. Update appointment to completed with outcome
      await db.appointments.update(appointment.id, {
        status: 'completed',
        outcome: outcome.trim() || 'Meeting concluded',
        notes: notes.trim() ? `${appointment.notes || ''}\nPost-meeting notes: ${notes.trim()}`.trim() : appointment.notes,
        updatedAt: now.toISOString()
      });
      await queueMutation('update', 'appointments', appointment.id, { status: 'completed', outcome });

      // 2. Create interaction record for history
      const interactionId = generateId('int');
      const newInteraction: Interaction = {
        id: interactionId,
        userId: user.id,
        customerId: appointment.customerId,
        type: 'meeting',
        date: appointment.date,
        time: appointment.startTime,
        summary: appointment.purpose || appointment.title,
        outcome: outcome.trim() || 'Meeting completed successfully',
        nextActionNotes: scheduleFollowUp ? followUpTitle : undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      await db.interactions.put(newInteraction);
      await queueMutation('insert', 'interactions', interactionId, newInteraction);

      // 3. Schedule next follow-up if checked
      if (scheduleFollowUp && followUpTitle.trim()) {
        const flwId = generateId('flw');
        const newFollowUp: FollowUp = {
          id: flwId,
          userId: user.id,
          customerId: appointment.customerId,
          title: followUpTitle.trim(),
          dueDate: followUpDate,
          dueTime: followUpTime,
          priority: 'normal',
          reminderTime: '15m',
          status: 'pending',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
        await db.followUps.put(newFollowUp);
        await queueMutation('insert', 'followUps', flwId, newFollowUp);

        // Update customer's nextAction
        await db.customers.update(appointment.customerId, {
          lastInteractionAt: now.toISOString(),
          lastInteractionSummary: outcome.trim() || appointment.purpose,
          lastInteractionType: 'meeting',
          nextAction: followUpTitle.trim(),
          nextActionDate: followUpDate,
          nextActionType: 'followup',
          updatedAt: now.toISOString()
        });
      } else {
        await db.customers.update(appointment.customerId, {
          lastInteractionAt: now.toISOString(),
          lastInteractionSummary: outcome.trim() || appointment.purpose,
          lastInteractionType: 'meeting',
          updatedAt: now.toISOString()
        });
      }

      // 4. Create opportunity if checked
      if (createOpportunity && oppTitle.trim()) {
        const oppId = generateId('opp');
        const newOpp: Opportunity = {
          id: oppId,
          userId: user.id,
          customerId: appointment.customerId,
          title: oppTitle.trim(),
          product: oppProduct.trim() || 'Service Proposal',
          estimatedValue: parseFloat(oppValue) || 0,
          stage: 'interested',
          expectedCloseDate: followUpDate,
          isArchived: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
        await db.opportunities.put(newOpp);
        await queueMutation('insert', 'opportunities', oppId, newOpp);
      }

      onRefreshData();
      onClose();
    } catch (err) {
      console.error('Error saving post meeting workflow:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#059669] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-white" />
            <div>
              <h2 className="font-bold text-base tracking-tight leading-tight">Meeting Completed</h2>
              <p className="text-[11px] text-emerald-100">
                {appointment.title} with {customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
              What happened? (Outcome)
            </label>
            <input
              type="text"
              placeholder="e.g. Discussed family medical quote, customer requested revision..."
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
              Additional Notes / Details
            </label>
            <textarea
              rows={2}
              placeholder="Key discussion points, preferences mentioned..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
            />
          </div>

          {/* Schedule next follow-up checkbox & fields */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-[#111827]">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="w-4 h-4 text-[#1D70F5] rounded border-[#D1D5DB]"
              />
              <span>Schedule next follow-up action</span>
            </label>

            {scheduleFollowUp && (
              <div className="pl-6 space-y-2 text-xs">
                <div>
                  <label className="text-[#6B7280] block mb-0.5">Follow-up Task</label>
                  <input
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#6B7280] block mb-0.5">Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] block mb-0.5">Time</label>
                    <input
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optional Create Opportunity toggle */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-[#111827]">
              <input
                type="checkbox"
                checked={createOpportunity}
                onChange={(e) => setCreateOpportunity(e.target.checked)}
                className="w-4 h-4 text-[#1D70F5] rounded border-[#D1D5DB]"
              />
              <span>Create sales opportunity from this meeting</span>
            </label>

            {createOpportunity && (
              <div className="pl-6 space-y-2 text-xs">
                <div>
                  <label className="text-[#6B7280] block mb-0.5">Opportunity Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Family Medical Cover Policy"
                    value={oppTitle}
                    onChange={(e) => setOppTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#6B7280] block mb-0.5">Product / Service</label>
                    <input
                      type="text"
                      placeholder="e.g. Medical Plan"
                      value={oppProduct}
                      onChange={(e) => setOppProduct(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] block mb-0.5">Estimated Value (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 250000"
                      value={oppValue}
                      onChange={(e) => setOppValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded text-xs focus:border-[#1D70F5] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Voice Note Link */}
          {onOpenVoiceRecorder && (
            <div className="flex items-center justify-between p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded text-xs text-[#1D70F5]">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <span>Want to record a quick audio voice note?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVoiceRecorder(appointment.customerId);
                }}
                className="font-semibold underline cursor-pointer hover:text-[#1B2CC1]"
              >
                Record Now
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-[#4B5563] hover:bg-white border border-transparent hover:border-[#E5E7EB] rounded cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSavePostMeeting}
            className="px-4 py-2 text-xs font-semibold bg-[#1D70F5] hover:bg-[#1B2CC1] text-white rounded cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <span>{isSaving ? 'Saving...' : 'Save & Finish'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

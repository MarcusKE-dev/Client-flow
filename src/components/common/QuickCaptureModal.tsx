import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Calendar, 
  CheckSquare, 
  PhoneCall, 
  FileText, 
  Briefcase, 
  AlertCircle,
  Clock,
  MapPin,
  Check
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { Customer, Appointment, FollowUp, Interaction, Opportunity } from '../../types';
import { useAuth } from '../../context/AuthContext';

type ActionTab = 'customer' | 'meeting' | 'followup' | 'interaction' | 'opportunity';

interface QuickCaptureModalProps {
  initialTab?: ActionTab;
  preselectedCustomerId?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenCustomer?: (customerId: string) => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  initialTab = 'customer',
  preselectedCustomerId,
  onClose,
  onSuccess,
  onOpenCustomer
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActionTab>(initialTab);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustId, setSelectedCustId] = useState<string>(preselectedCustomerId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Customer form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custInterest, setCustInterest] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  // 2. Meeting form
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [meetingStartTime, setMeetingStartTime] = useState('10:00');
  const [meetingEndTime, setMeetingEndTime] = useState('11:00');
  const [meetingLocationType, setMeetingLocationType] = useState<Appointment['locationType']>('customer_office');
  const [meetingLocationAddress, setMeetingLocationAddress] = useState('');
  const [meetingPurpose, setMeetingPurpose] = useState('');

  // 3. Follow-up form
  const [flwTitle, setFlwTitle] = useState('');
  const [flwDueDate, setFlwDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [flwDueTime, setFlwDueTime] = useState('14:00');
  const [flwPriority, setFlwPriority] = useState<FollowUp['priority']>('normal');
  const [flwNotes, setFlwNotes] = useState('');

  // 4. Interaction form
  const [intType, setIntType] = useState<Interaction['type']>('call');
  const [intSummary, setIntSummary] = useState('');
  const [intOutcome, setIntOutcome] = useState('');
  const [intScheduleNext, setIntScheduleNext] = useState(true);
  const [intNextNotes, setIntNextNotes] = useState('');

  // 5. Opportunity form
  const [oppTitle, setOppTitle] = useState('');
  const [oppProduct, setOppProduct] = useState('');
  const [oppValue, setOppValue] = useState('');
  const [oppStage, setOppStage] = useState<Opportunity['stage']>('interested');
  const [oppCloseDate, setOppCloseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    async function loadCustomers() {
      const all = await db.customers.toArray();
      const activeList = all.filter(c => !c.isArchived);
      setCustomers(activeList);
      if (!selectedCustId && activeList.length > 0) {
        setSelectedCustId(activeList[0].id);
      }
    }
    loadCustomers();
  }, []);

  // Real-time duplicate check when entering phone or email
  useEffect(() => {
    if (activeTab !== 'customer') return;
    const cleanP = custPhone.replace(/[^\d]/g, '');
    const cleanE = custEmail.trim().toLowerCase();

    if (cleanP.length >= 7 || (cleanE.length > 5 && cleanE.includes('@'))) {
      const match = customers.find(c => {
        const cPhoneClean = c.phone.replace(/[^\d]/g, '');
        const cEmail = (c.email || '').toLowerCase();
        return (cleanP.length >= 7 && cPhoneClean.endsWith(cleanP.slice(-8))) || (cleanE && cEmail === cleanE);
      });
      setDuplicateWarning(match || null);
    } else {
      setDuplicateWarning(null);
    }
  }, [custPhone, custEmail, customers, activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    const now = new Date();
    const nowIso = now.toISOString();

    try {
      if (activeTab === 'customer') {
        if (!custName.trim() || !custPhone.trim()) return;
        const newCustId = generateId('cust');
        const newCust: Customer = {
          id: newCustId,
          userId: user.id,
          name: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim() || undefined,
          company: custCompany.trim() || undefined,
          status: 'prospect',
          priority: 'normal',
          cadenceDays: 30,
          tags: ['New Lead'],
          interests: custInterest.trim() ? [custInterest.trim()] : ['General'],
          notes: '',
          preferredChannel: 'phone',
          preferredTime: 'morning',
          isFavorite: false,
          isArchived: false,
          lastInteractionAt: null,
          lastInteractionSummary: null,
          nextAction: null,
          nextActionDate: null,
          nextActionType: null,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.customers.put(newCust);
        await queueMutation('insert', 'customers', newCustId, newCust);
        if (onOpenCustomer) {
          onClose();
          onOpenCustomer(newCustId);
          return;
        }
      } else if (activeTab === 'meeting') {
        if (!selectedCustId || !meetingTitle.trim()) return;
        const aptId = generateId('apt');
        const newApt: Appointment = {
          id: aptId,
          userId: user.id,
          customerId: selectedCustId,
          title: meetingTitle.trim(),
          date: meetingDate,
          startTime: meetingStartTime,
          endTime: meetingEndTime,
          locationType: meetingLocationType,
          locationAddress: meetingLocationAddress.trim() || undefined,
          purpose: meetingPurpose.trim() || meetingTitle.trim(),
          reminderTime: '15m',
          status: 'upcoming',
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.appointments.put(newApt);
        await queueMutation('insert', 'appointments', aptId, newApt);

        // Update customer next action
        await db.customers.update(selectedCustId, {
          nextAction: meetingTitle.trim(),
          nextActionDate: meetingDate,
          nextActionType: 'meeting',
          updatedAt: nowIso
        });
      } else if (activeTab === 'followup') {
        if (!selectedCustId || !flwTitle.trim()) return;
        const flwId = generateId('flw');
        const newFlw: FollowUp = {
          id: flwId,
          userId: user.id,
          customerId: selectedCustId,
          title: flwTitle.trim(),
          dueDate: flwDueDate,
          dueTime: flwDueTime,
          priority: flwPriority,
          notes: flwNotes.trim() || undefined,
          reminderTime: '15m',
          status: 'pending',
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.followUps.put(newFlw);
        await queueMutation('insert', 'followUps', flwId, newFlw);

        // Update customer next action
        await db.customers.update(selectedCustId, {
          nextAction: flwTitle.trim(),
          nextActionDate: flwDueDate,
          nextActionType: 'followup',
          updatedAt: nowIso
        });
      } else if (activeTab === 'interaction') {
        if (!selectedCustId || !intSummary.trim()) return;
        const intId = generateId('int');
        const newInt: Interaction = {
          id: intId,
          userId: user.id,
          customerId: selectedCustId,
          type: intType,
          date: now.toISOString().split('T')[0],
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          summary: intSummary.trim(),
          outcome: intOutcome.trim() || undefined,
          nextActionNotes: intNextNotes.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.interactions.put(newInt);
        await queueMutation('insert', 'interactions', intId, newInt);

        // Update customer last interaction
        const custUpdates: Partial<Customer> = {
          lastInteractionAt: nowIso,
          lastInteractionSummary: intSummary.trim(),
          lastInteractionType: intType,
          updatedAt: nowIso
        };
        if (intScheduleNext && intNextNotes.trim()) {
          const flwId = generateId('flw');
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 2);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          const autoFlw: FollowUp = {
            id: flwId,
            userId: user.id,
            customerId: selectedCustId,
            title: intNextNotes.trim(),
            dueDate: nextDateStr,
            dueTime: '10:00',
            priority: 'normal',
            reminderTime: '15m',
            status: 'pending',
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.followUps.put(autoFlw);
          custUpdates.nextAction = intNextNotes.trim();
          custUpdates.nextActionDate = nextDateStr;
          custUpdates.nextActionType = 'followup';
        }
        await db.customers.update(selectedCustId, custUpdates);
      } else if (activeTab === 'opportunity') {
        if (!selectedCustId || !oppTitle.trim()) return;
        const oppId = generateId('opp');
        const newOpp: Opportunity = {
          id: oppId,
          userId: user.id,
          customerId: selectedCustId,
          title: oppTitle.trim(),
          product: oppProduct.trim() || 'Core Service',
          estimatedValue: parseFloat(oppValue) || 0,
          stage: oppStage,
          expectedCloseDate: oppCloseDate,
          isArchived: false,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.opportunities.put(newOpp);
        await queueMutation('insert', 'opportunities', oppId, newOpp);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Quick capture error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1D70F5] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base tracking-tight leading-tight">Quick Action</h2>
            <p className="text-[11px] text-white/80">Rapid entry with instant local persistence</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5E7EB] bg-[#F9FAFB] overflow-x-auto text-xs font-semibold select-none">
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === 'customer'
                ? 'border-[#1D70F5] text-[#1D70F5] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('meeting')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === 'meeting'
                ? 'border-[#1D70F5] text-[#1D70F5] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Meeting</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followup')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === 'followup'
                ? 'border-[#1D70F5] text-[#1D70F5] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Follow-up</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('interaction')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === 'interaction'
                ? 'border-[#1D70F5] text-[#1D70F5] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Log Call/Note</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('opportunity')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === 'opportunity'
                ? 'border-[#1D70F5] text-[#1D70F5] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Opportunity</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-3.5 text-sm max-h-[70vh] overflow-y-auto">
          {/* Customer Selector for non-customer tabs */}
          {activeTab !== 'customer' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                Customer *
              </label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''} - {c.phone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TAB 1: ADD CUSTOMER */}
          {activeTab === 'customer' && (
            <div className="space-y-3">
              {duplicateWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Possible duplicate detected</p>
                    <p className="mt-0.5">
                      <strong>{duplicateWarning.name}</strong> has a matching phone ({duplicateWarning.phone}).
                    </p>
                    {onOpenCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomer(duplicateWarning.id);
                        }}
                        className="mt-1 text-[#1D70F5] font-semibold underline cursor-pointer"
                      >
                        Open existing profile instead
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Kamau"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +254 712 345 678"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={custCompany}
                    onChange={(e) => setCustCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Primary Interest / Product
                </label>
                <input
                  type="text"
                  placeholder="e.g. Medical, Life Insurance, Pension, Property"
                  value={custInterest}
                  onChange={(e) => setCustInterest(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE MEETING */}
          {activeTab === 'meeting' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Meeting Title / Purpose *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Policy review & quotation presentation"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={meetingStartTime}
                    onChange={(e) => setMeetingStartTime(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={meetingEndTime}
                    onChange={(e) => setMeetingEndTime(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Location Type
                  </label>
                  <select
                    value={meetingLocationType}
                    onChange={(e: any) => setMeetingLocationType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  >
                    <option value="customer_office">Customer Office</option>
                    <option value="branch">Our Branch</option>
                    <option value="home">Client Home</option>
                    <option value="online">Online / Phone</option>
                    <option value="other">Other Venue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Venue Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delta Corner, Westlands"
                    value={meetingLocationAddress}
                    onChange={(e) => setMeetingLocationAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADD FOLLOW-UP */}
          {activeTab === 'followup' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Follow-up Action *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call to confirm medical quotation receipt"
                  value={flwTitle}
                  onChange={(e) => setFlwTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={flwDueDate}
                    onChange={(e) => setFlwDueDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={flwDueTime}
                    onChange={(e) => setFlwDueTime(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Priority
                  </label>
                  <select
                    value={flwPriority}
                    onChange={(e: any) => setFlwPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Context, specific documents to remember..."
                  value={flwNotes}
                  onChange={(e) => setFlwNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: LOG INTERACTION */}
          {activeTab === 'interaction' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Interaction Type
                  </label>
                  <select
                    value={intType}
                    onChange={(e: any) => setIntType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none capitalize"
                  >
                    <option value="call">Phone Call</option>
                    <option value="meeting">In-Person Meeting</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="note">Internal Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Date & Time
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Just now (Today)"
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Summary of Discussion *
                </label>
                <textarea
                  rows={2}
                  placeholder="What did you discuss? Customer concerns, questions..."
                  value={intSummary}
                  onChange={(e) => setIntSummary(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Outcome / Resolution
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer agreed to proposal, requested revised schedule"
                  value={intOutcome}
                  onChange={(e) => setIntOutcome(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="bg-[#F9FAFB] p-2.5 rounded border border-[#E5E7EB] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={intScheduleNext}
                    onChange={(e) => setIntScheduleNext(e.target.checked)}
                    className="w-4 h-4 text-[#1D70F5] rounded border-[#D1D5DB]"
                  />
                  <span>Create next action item from this</span>
                </label>
                {intScheduleNext && (
                  <input
                    type="text"
                    placeholder="Next step, e.g. Call back Friday to confirm payment"
                    value={intNextNotes}
                    onChange={(e) => setIntNextNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ADD OPPORTUNITY */}
          {activeTab === 'opportunity' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Fleet Comprehensive Policy"
                  value={oppTitle}
                  onChange={(e) => setOppTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Product / Line
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Motor, Medical, Pension"
                    value={oppProduct}
                    onChange={(e) => setOppProduct(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Estimated Value (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 450000"
                    value={oppValue}
                    onChange={(e) => setOppValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Stage
                  </label>
                  <select
                    value={oppStage}
                    onChange={(e: any) => setOppStage(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none capitalize"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={oppCloseDate}
                    onChange={(e) => setOppCloseDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Action Footer */}
          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-[#4B5563] hover:text-[#111827] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1D70F5] hover:bg-[#1B2CC1] text-white rounded cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

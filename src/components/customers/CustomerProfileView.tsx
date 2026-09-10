import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Mail, 
  Smartphone, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Mic, 
  Star, 
  MapPin, 
  Building, 
  Clock, 
  Plus, 
  Upload, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  ExternalLink,
  Download,
  Play,
  Pause,
  Save,
  Tag,
  Briefcase
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { 
  Customer, 
  Interaction, 
  Appointment, 
  FollowUp, 
  Opportunity, 
  ImportantDate, 
  CustomerFile 
} from '../../types';
import { 
  formatDate, 
  formatTime, 
  getRelativeDateLabel, 
  getWhatsAppUrl, 
  getEmailUrl, 
  getSmsUrl, 
  getMapUrl, 
  formatCurrency, 
  calculateAttentionStatus 
} from '../../utils';
import { useAuth } from '../../context/AuthContext';
import { VoiceNoteModal } from '../common/VoiceNoteModal';
import { MessageTemplateModal } from '../common/MessageTemplateModal';
import { StatusBadge } from '../common/StatusBadge';

interface CustomerProfileViewProps {
  customerId: string;
  onBack: () => void;
  onRefreshData?: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerId,
  onBack,
  onRefreshData
}) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Editable Free-form Notes
  const [freeNotes, setFreeNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);

  // Sub-modals & dialogs
  const [isVoiceNoteOpen, setIsVoiceNoteOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddDateOpen, setIsAddDateOpen] = useState(false);

  // Inline action forms
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [newIntType, setNewIntType] = useState<Interaction['type']>('call');
  const [newIntSummary, setNewIntSummary] = useState('');
  const [newIntOutcome, setNewIntOutcome] = useState('');

  // Playing audio states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const cust = await db.customers.get(customerId);
      if (!cust) return;
      setCustomer(cust);
      setFreeNotes(cust.notes || '');

      const [ints, apts, flws, opps, dates, fls] = await Promise.all([
        db.interactions.where('customerId').equals(customerId).sortBy('date'),
        db.appointments.where('customerId').equals(customerId).toArray(),
        db.followUps.where('customerId').equals(customerId).toArray(),
        db.opportunities.where('customerId').equals(customerId).toArray(),
        db.importantDates.where('customerId').equals(customerId).toArray(),
        db.files.where('customerId').equals(customerId).toArray()
      ]);

      setInteractions(ints.reverse());
      setAppointments(apts.sort((a, b) => b.date.localeCompare(a.date)));
      setFollowUps(flws.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      setOpportunities(opps);
      setImportantDates(dates);
      setFiles(fls);
    } catch (err) {
      console.error('Error loading customer profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save free-form notes
  const handleSaveNotes = async () => {
    if (!customer) return;
    setIsSavingNotes(true);
    try {
      const now = new Date().toISOString();
      await db.customers.update(customer.id, {
        notes: freeNotes,
        updatedAt: now
      });
      await queueMutation('update', 'customers', customer.id, { notes: freeNotes });
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2000);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!customer) return;
    const newFav = !customer.isFavorite;
    await db.customers.update(customer.id, { isFavorite: newFav });
    await queueMutation('update', 'customers', customer.id, { isFavorite: newFav });
    setCustomer({ ...customer, isFavorite: newFav });
  };

  // Quick cadence change
  const handleChangeCadence = async (days: number) => {
    if (!customer) return;
    await db.customers.update(customer.id, { cadenceDays: days });
    await queueMutation('update', 'customers', customer.id, { cadenceDays: days });
    setCustomer({ ...customer, cadenceDays: days });
  };

  // Add interaction
  const handleCreateInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !user || !newIntSummary.trim()) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const intId = generateId('int');
    const newInt: Interaction = {
      id: intId,
      userId: user.id,
      customerId: customer.id,
      type: newIntType,
      date: nowIso.split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      summary: newIntSummary.trim(),
      outcome: newIntOutcome.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.interactions.put(newInt);
    await queueMutation('insert', 'interactions', intId, newInt);

    // Update customer last interaction
    await db.customers.update(customer.id, {
      lastInteractionAt: nowIso,
      lastInteractionSummary: newIntSummary.trim(),
      lastInteractionType: newIntType,
      updatedAt: nowIso
    });

    setNewIntSummary('');
    setNewIntOutcome('');
    setShowAddInteraction(false);
    loadData();
  };

  // Complete a follow-up directly from profile
  const handleCompleteFollowUp = async (flwId: string) => {
    const now = new Date().toISOString();
    await db.followUps.update(flwId, {
      status: 'completed',
      completedAt: now,
      updatedAt: now
    });
    await queueMutation('update', 'followUps', flwId, { status: 'completed' });
    loadData();
  };

  // Upload attachment file (IndexedDB Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !customer || !user) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const fileId = generateId('file');
      const now = new Date().toISOString();
      const newFile: CustomerFile = {
        id: fileId,
        userId: user.id,
        customerId: customer.id,
        name: file.name,
        type: 'other',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: base64,
        createdAt: now,
        updatedAt: now
      };
      await db.files.put(newFile);
      await queueMutation('insert', 'files', fileId, newFile);
      loadData();
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    await db.files.delete(fileId);
    await queueMutation('delete', 'files', fileId, {});
    loadData();
  };

  // Audio playback toggle
  const toggleAudio = (fileId: string) => {
    const audio = audioRefs.current[fileId];
    if (!audio) return;
    if (playingAudioId === fileId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      // Pause any currently playing audio
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }
      audio.play();
      setPlayingAudioId(fileId);
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="flex-1 p-8 text-center text-sm text-[#6B7280]">
        Loading customer profile...
      </div>
    );
  }

  const attentionStatus = calculateAttentionStatus(customer, followUps);
  const pendingFlws = followUps.filter(f => f.status === 'pending');
  const upcomingApts = appointments.filter(a => a.status === 'upcoming');

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA]">
      {/* Top Bar Navigation */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#374151] hover:text-[#1D70F5] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              customer.isFavorite 
                ? 'border-amber-300 bg-amber-50 text-amber-600' 
                : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]'
            }`}
            title="Toggle Favorite"
          >
            <Star className={`w-4 h-4 ${customer.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#111827] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded cursor-pointer transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* 1. TOP SECTION: CUSTOMER IDENTIFIERS & PRIMARY ACTIONS */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                  {customer.name}
                </h1>
                <StatusBadge status={customer.status} size="sm" />

                {attentionStatus === 'overdue' && (
                  <StatusBadge status="overdue" label="Action Overdue" size="sm" />
                )}
                {attentionStatus === 'needs_attention' && (
                  <StatusBadge status="needs_attention" label="Cadence Due" size="sm" />
                )}
              </div>

              {/* Company & Location */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4B5563] mt-1.5">
                {customer.company && (
                  <span className="flex items-center gap-1 font-medium text-[#111827]">
                    <Building className="w-3.5 h-3.5 text-[#6B7280]" />
                    {customer.company}
                  </span>
                )}
                {customer.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                    {customer.location}
                  </span>
                )}
              </div>

              {/* Tags */}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {customer.tags.map((t, idx) => (
                    <span key={idx} className="text-[11px] font-medium text-[#374151] bg-[#F3F4F6] px-2 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Contact Info */}
            <div className="text-xs sm:text-right space-y-1 text-[#374151]">
              <p className="font-semibold text-sm text-[#111827]">{customer.phone}</p>
              {customer.email && (
                <p className="text-[#6B7280] truncate">{customer.email}</p>
              )}
            </div>
          </div>

          {/* PRIMARY SHORTCUT ACTION BAR */}
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center gap-2">
            {/* Call */}
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call</span>
            </a>

            {/* WhatsApp */}
            <a
              href={getWhatsAppUrl(customer.phone, `Hello ${customer.name},`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>

            {/* Email */}
            {customer.email && (
              <a
                href={getEmailUrl(customer.email, 'ClientFlow Update')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#1D70F5]" />
                <span>Email</span>
              </a>
            )}

            {/* SMS */}
            <a
              href={getSmsUrl(customer.phone)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#4B5563]" />
              <span>SMS</span>
            </a>

            <div className="h-4 w-px bg-[#E5E7EB] mx-1 hidden sm:block" />

            {/* Template Launcher */}
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1D70F5]/10 hover:bg-[#1D70F5]/20 text-[#1D70F5] text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Templates</span>
            </button>

            {/* Voice Note */}
            <button
              onClick={() => setIsVoiceNoteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-[#1D70F5]" />
              <span>Voice Note</span>
            </button>

            {/* Log Interaction */}
            <button
              onClick={() => setShowAddInteraction(!showAddInteraction)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded transition-colors cursor-pointer ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Note/Call</span>
            </button>
          </div>
        </div>

        {/* INLINE QUICK INTERACTION FORM */}
        {showAddInteraction && (
          <div className="bg-white border border-[#1D70F5]/30 rounded-md p-4 shadow-xs animate-in fade-in">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] mb-2.5">
              Log Activity / Interaction
            </h3>
            <form onSubmit={handleCreateInteraction} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">Type</label>
                  <select
                    value={newIntType}
                    onChange={(e: any) => setNewIntType(e.target.value)}
                    className="w-full text-xs p-2 border border-[#D1D5DB] rounded bg-white"
                  >
                    <option value="call">Phone Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="note">Note</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">Date & Time</label>
                  <input
                    type="text"
                    disabled
                    value="Just now (Today)"
                    className="w-full text-xs p-2 border border-gray-200 rounded bg-gray-50 text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">Discussion Summary *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="What was discussed..."
                  value={newIntSummary}
                  onChange={(e) => setNewIntSummary(e.target.value)}
                  className="w-full text-xs p-2 border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">Outcome / Agreed Next Step</label>
                <input
                  type="text"
                  placeholder="e.g. Customer promised to transfer premium on Friday"
                  value={newIntOutcome}
                  onChange={(e) => setNewIntOutcome(e.target.value)}
                  className="w-full text-xs p-2 border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddInteraction(false)}
                  className="px-3 py-1.5 text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. NEXT ACTION (Crucial workflow focus) */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Next Action
            </span>
            {customer.nextActionDate && (
              <span className="text-xs font-bold text-[#1D70F5]">
                {getRelativeDateLabel(customer.nextActionDate)}
              </span>
            )}
          </div>

          {customer.nextAction ? (
            <div className="flex items-center justify-between gap-3 bg-[#F9FAFB] p-3 rounded border border-[#E5E7EB]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111827]">{customer.nextAction}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Scheduled for {formatDate(customer.nextActionDate)}
                </p>
              </div>
              <button
                onClick={() => {
                  db.customers.update(customer.id, {
                    nextAction: null,
                    nextActionDate: null,
                    nextActionType: null
                  });
                  setCustomer({
                    ...customer,
                    nextAction: null,
                    nextActionDate: null,
                    nextActionType: null
                  });
                }}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                Mark Done
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] italic">
              No immediate next action scheduled. Stay on top by scheduling a follow-up.
            </p>
          )}
        </div>

        {/* 3. CUSTOMER SUMMARY & RELATIONSHIP CADENCE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Customer Summary & Interests */}
          <div className="bg-white border border-[#E5E7EB] rounded-md p-4 shadow-xs space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block">
              Customer Summary & Interests
            </span>

            {customer.interests && customer.interests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {customer.interests.map((int, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-[#1D70F5]/10 text-[#1D70F5] border border-[#1D70F5]/20 rounded text-xs font-medium"
                  >
                    {int}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9CA3AF]">No product interests assigned.</p>
            )}

            <div className="pt-2 border-t border-[#E5E7EB] text-xs text-[#4B5563] space-y-1">
              <p>
                <strong className="text-[#111827]">Decision Maker:</strong> {customer.decisionMaker || 'Customer directly'}
              </p>
              {customer.assistant && (
                <p>
                  <strong className="text-[#111827]">Assistant / Contact:</strong> {customer.assistant}
                </p>
              )}
              {customer.dependentsNotes && (
                <p>
                  <strong className="text-[#111827]">Family / Dependents:</strong> {customer.dependentsNotes}
                </p>
              )}
            </div>
          </div>

          {/* Relationship & Contact Cadence */}
          <div className="bg-white border border-[#E5E7EB] rounded-md p-4 shadow-xs space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block">
              Relationship Cadence
            </span>

            <div className="text-xs space-y-1.5 text-[#374151]">
              <div className="flex justify-between items-center">
                <span>Last Contacted:</span>
                <span className="font-semibold text-[#111827]">
                  {formatDate(customer.lastInteractionAt)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Contact Frequency:</span>
                <select
                  value={customer.cadenceDays || 30}
                  onChange={(e) => handleChangeCadence(parseInt(e.target.value, 10))}
                  className="font-semibold text-[#1D70F5] bg-transparent border-b border-[#1D70F5] focus:outline-none cursor-pointer text-xs"
                >
                  <option value={7}>Every 7 days</option>
                  <option value={14}>Every 14 days</option>
                  <option value={30}>Every 30 days</option>
                  <option value={60}>Every 60 days</option>
                  <option value={90}>Every 90 days</option>
                  <option value={180}>Every 6 months</option>
                  <option value={365}>Every year</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span>Preferred Channel:</span>
                <span className="capitalize font-medium text-[#111827]">
                  {customer.preferredChannel} ({customer.preferredTime})
                </span>
              </div>
            </div>

            <div className={`text-xs ${
              attentionStatus === 'healthy' 
                ? 'text-emerald-700' 
                : 'text-amber-800 font-medium'
            }`}>
              {attentionStatus === 'healthy' ? (
                <span>Relationship cadence is healthy. Next touchpoint within schedule.</span>
              ) : (
                <span>Attention due: customer contact cadence has expired. Schedule a call or check-in.</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. FREE-FORM NOTES */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Notes
            </span>
            <div className="flex items-center gap-2">
              {notesSavedNotice && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="px-2.5 py-1 text-xs font-semibold bg-[#1D70F5] hover:bg-[#1B2CC1] text-white rounded cursor-pointer transition-colors"
              >
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={freeNotes}
            onChange={(e) => setFreeNotes(e.target.value)}
            placeholder="Record general customer context, meeting habits, preferences..."
            className="w-full text-xs p-2.5 border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none leading-relaxed"
          />
        </div>

        {/* 5. OPPORTUNITIES & IMPORTANT DATES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Opportunities */}
          <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Opportunities ({opportunities.length})
              </span>
            </div>

            {opportunities.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280]">
                No active opportunities.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="p-3 hover:bg-[#F9FAFB] flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111827] truncate">{opp.title}</p>
                      <p className="text-[11px] text-[#6B7280]">{opp.product}</p>
                      <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase text-[#1D70F5]">
                        {opp.stage}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[#111827]">
                        {formatCurrency(opp.estimatedValue)}
                      </span>
                      <p className="text-[10px] text-[#6B7280]">Close: {formatDate(opp.expectedCloseDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Important Dates */}
          <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Important Dates ({importantDates.length})
              </span>
            </div>

            {importantDates.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280]">
                No special dates recorded.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {importantDates.map((date) => (
                  <div key={date.id} className="p-3 hover:bg-[#F9FAFB] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#111827]">
                        {date.customLabel || date.type.replace('_', ' ')}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">{date.notes || 'Annual reminder'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-purple-700">
                        {formatDate(date.date)}
                      </span>
                      <p className="text-[10px] text-[#6B7280]">{getRelativeDateLabel(date.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. FILES & VOICE RECORDINGS */}
        <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Files & Audio Notes ({files.length})
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1D70F5] hover:text-[#1B2CC1] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              No documents or voice notes attached yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {files.map((file) => {
                const isVoice = file.type === 'voice_note' || file.mimeType.includes('audio');

                return (
                  <div key={file.id} className="p-3 hover:bg-[#F9FAFB] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isVoice ? (
                        <div className="w-8 h-8 rounded-full bg-[#1D70F5]/10 text-[#1D70F5] flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 text-[#4B5563] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111827] truncate">{file.name}</p>
                        <p className="text-[10px] text-[#6B7280]">
                          {formatDate(file.createdAt)} • {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Voice player */}
                      {isVoice && (
                        <>
                          <audio
                            ref={(el) => {
                              if (el) audioRefs.current[file.id] = el;
                            }}
                            src={file.dataUrl}
                            onEnded={() => setPlayingAudioId(null)}
                            className="hidden"
                          />
                          <button
                            onClick={() => toggleAudio(file.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-[#1D70F5] text-white rounded flex items-center gap-1 cursor-pointer"
                          >
                            {playingAudioId === file.id ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>Play</span>
                              </>
                            )}
                          </button>
                        </>
                      )}

                      {/* Download */}
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        className="p-1.5 text-[#4B5563] hover:text-[#111827] border border-[#E5E7EB] rounded bg-white"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 border border-[#E5E7EB] rounded bg-white cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7. ACTIVITY TIMELINE */}
        <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Activity Timeline ({interactions.length})
            </span>
          </div>

          {interactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6B7280]">
              No activities logged yet. Tap "Log Note/Call" above to start the record.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {interactions.map((int) => (
                <div key={int.id} className="p-3.5 hover:bg-[#F9FAFB] flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-[#F3F4F6] text-[#6B7280] font-bold text-xs uppercase flex items-center justify-center shrink-0 mt-0.5">
                    {int.type.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#111827] capitalize">
                        {int.type}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {formatDate(int.date)} {int.time ? `at ${formatTime(int.time)}` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#374151] mt-0.5 leading-relaxed">{int.summary}</p>
                    {int.outcome && (
                      <p className="text-[11px] text-[#6B7280] mt-1 bg-[#F9FAFB] p-1.5 rounded border border-[#E5E7EB]">
                        <strong className="text-[#111827]">Outcome:</strong> {int.outcome}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Voice Note Modal */}
      {isVoiceNoteOpen && (
        <VoiceNoteModal
          customerId={customer.id}
          onClose={() => setIsVoiceNoteOpen(false)}
          onSaved={loadData}
        />
      )}

      {/* Message Template Modal */}
      {isTemplateModalOpen && (
        <MessageTemplateModal
          customer={customer}
          onClose={() => setIsTemplateModalOpen(false)}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden my-auto">
            <div className="bg-[#1D70F5] text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-bold text-base">Edit Customer Profile</h2>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await db.customers.put(customer);
                await queueMutation('update', 'customers', customer.id, customer);
                setIsEditProfileOpen(false);
              }}
              className="p-5 space-y-3 text-xs max-h-[75vh] overflow-y-auto"
            >
              <div>
                <label className="font-bold text-[#374151] block mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Email</label>
                  <input
                    type="email"
                    value={customer.email || ''}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Company</label>
                  <input
                    type="text"
                    value={customer.company || ''}
                    onChange={(e) => setCustomer({ ...customer, company: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Location</label>
                  <input
                    type="text"
                    value={customer.location || ''}
                    onChange={(e) => setCustomer({ ...customer, location: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Status</label>
                  <select
                    value={customer.status}
                    onChange={(e: any) => setCustomer({ ...customer, status: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-xs"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="completed">Completed</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#374151] block mb-1">Priority</label>
                  <select
                    value={customer.priority}
                    onChange={(e: any) => setCustomer({ ...customer, priority: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-[#374151] block mb-1">Interests (comma separated)</label>
                <input
                  type="text"
                  value={customer.interests.join(', ')}
                  onChange={(e) => setCustomer({ ...customer, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-[#374151] block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={customer.tags.join(', ')}
                  onChange={(e) => setCustomer({ ...customer, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-3 py-1.5 text-[#4B5563] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1D70F5] text-white font-semibold rounded cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

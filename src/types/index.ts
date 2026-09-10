// ClientFlow Core Data Types

export type ProfessionType = 
  | 'insurance'
  | 'banking'
  | 'financial'
  | 'real_estate'
  | 'sales'
  | 'consulting'
  | 'other'
  | string;

export type CustomerStatus = 'prospect' | 'active' | 'inactive' | 'follow-up' | 'completed';
export type CustomerPriority = 'low' | 'normal' | 'high';
export type PreferredChannel = 'phone' | 'whatsapp' | 'email' | 'sms' | 'in-person';
export type PreferredTime = 'morning' | 'afternoon' | 'evening';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profession: ProfessionType;
  customProfession?: string;
  company?: string;
  reminderPref: 'immediate' | '15m' | '30m' | '1h';
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  location?: string;
  status: CustomerStatus;
  priority: CustomerPriority;
  cadenceDays: number; // e.g. 7, 14, 30, 60, 90, 180, 365
  tags: string[];
  interests: string[];
  notes: string;
  preferredChannel: PreferredChannel;
  preferredTime: PreferredTime;
  decisionMaker?: string;
  assistant?: string;
  dependentsNotes?: string;
  isFavorite: boolean;
  isArchived: boolean;
  lastInteractionAt: string | null; // ISO string
  lastInteractionSummary: string | null;
  lastInteractionType?: InteractionType | null;
  nextAction: string | null;
  nextActionDate: string | null; // YYYY-MM-DD
  nextActionType: 'meeting' | 'call' | 'followup' | 'email' | 'whatsapp' | null;
  createdAt: string;
  updatedAt: string;
}

export type InteractionType = 'call' | 'meeting' | 'whatsapp' | 'email' | 'sms' | 'note' | 'other';

export interface Interaction {
  id: string;
  userId: string;
  customerId: string;
  type: InteractionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  summary: string;
  outcome?: string;
  nextActionNotes?: string;
  durationMinutes?: number;
  voiceNoteUrl?: string; // audio data url if recorded
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled' | 'rescheduled';
export type LocationType = 'customer_office' | 'branch' | 'home' | 'online' | 'other';
export type ReminderOption = 'none' | 'at_time' | '5m' | '15m' | '30m' | '1h' | '1d';

export interface Appointment {
  id: string;
  userId: string;
  customerId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  locationType: LocationType;
  locationAddress?: string;
  purpose: string;
  notes?: string;
  reminderTime: ReminderOption;
  status: AppointmentStatus;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface FollowUp {
  id: string;
  userId: string;
  customerId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM
  priority: CustomerPriority;
  notes?: string;
  reminderTime: ReminderOption;
  status: FollowUpStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage = 'new' | 'contacted' | 'interested' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Opportunity {
  id: string;
  userId: string;
  customerId: string;
  title: string;
  product: string;
  estimatedValue: number;
  stage: OpportunityStage;
  expectedCloseDate: string; // YYYY-MM-DD
  notes?: string;
  nextAction?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ImportantDateType = 'birthday' | 'anniversary' | 'policy_renewal' | 'contract_renewal' | 'review_date' | 'other';

export interface ImportantDate {
  id: string;
  userId: string;
  customerId: string;
  type: ImportantDateType;
  customLabel?: string;
  date: string; // YYYY-MM-DD
  reminderDaysBefore: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FileType = 'quotation' | 'proposal' | 'contract' | 'application' | 'statement' | 'id' | 'voice_note' | 'other';

export interface CustomerFile {
  id: string;
  userId: string;
  customerId: string;
  name: string;
  type: FileType;
  mimeType: string;
  size: number;
  dataUrl: string; // Base64 data URI for offline storage
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  userId: string;
  title: string;
  channel: 'whatsapp' | 'email' | 'sms';
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'insert' | 'update' | 'delete';
  table: string;
  recordId: string;
  payload: unknown;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
  errorMessage?: string;
}

export interface SyncMetadata {
  lastSyncAt: string | null;
  pendingCount: number;
  syncedCount: number;
  syncErrors: string[];
}

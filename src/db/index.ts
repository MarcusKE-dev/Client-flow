import Dexie, { type Table } from 'dexie';
import type {
  User,
  Customer,
  Interaction,
  Appointment,
  FollowUp,
  Opportunity,
  ImportantDate,
  CustomerFile,
  MessageTemplate,
  SyncQueueItem
} from '../types';

export class ClientFlowDatabase extends Dexie {
  users!: Table<User, string>;
  customers!: Table<Customer, string>;
  interactions!: Table<Interaction, string>;
  appointments!: Table<Appointment, string>;
  followUps!: Table<FollowUp, string>;
  opportunities!: Table<Opportunity, string>;
  importantDates!: Table<ImportantDate, string>;
  files!: Table<CustomerFile, string>;
  templates!: Table<MessageTemplate, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('ClientFlowDB');
    this.version(1).stores({
      users: 'id, email',
      customers: 'id, userId, name, phone, email, status, priority, isFavorite, isArchived, cadenceDays, lastInteractionAt, nextActionDate, updatedAt',
      interactions: 'id, userId, customerId, date, type, createdAt',
      appointments: 'id, userId, customerId, date, startTime, status, updatedAt',
      followUps: 'id, userId, customerId, dueDate, status, priority, updatedAt',
      opportunities: 'id, userId, customerId, stage, expectedCloseDate, isArchived, updatedAt',
      importantDates: 'id, userId, customerId, date, type',
      files: 'id, userId, customerId, type, createdAt',
      templates: 'id, userId, category',
      syncQueue: 'id, status, timestamp, table'
    });
  }
}

export const db = new ClientFlowDatabase();

// Local Mutation Helper with Offline Queue Logging
export async function queueMutation(action: 'insert' | 'update' | 'delete', table: string, recordId: string, payload: unknown) {
  try {
    const queueItem: SyncQueueItem = {
      id: 'sq_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      action,
      table,
      recordId,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    await db.syncQueue.add(queueItem);
  } catch (err) {
    console.error('Failed to log mutation to syncQueue:', err);
  }
}

// Generate stable IDs
export function generateId(prefix: string = 'rec'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
}

// Seed Initial Realistic Demonstration Data with concurrency protection
let seedPromise: Promise<void> | null = null;

export async function seedInitialData(forceReset: boolean = false): Promise<void> {
  if (seedPromise && !forceReset) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const existingUsers = await db.users.count();
      if (existingUsers > 0 && !forceReset) {
        return;
      }

      if (forceReset) {
        await Promise.all([
          db.users.clear(),
          db.customers.clear(),
          db.interactions.clear(),
          db.appointments.clear(),
          db.followUps.clear(),
          db.opportunities.clear(),
          db.importantDates.clear(),
          db.files.clear(),
          db.templates.clear(),
          db.syncQueue.clear()
        ]);
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // e.g. 2026-09-10
      
      // Date helpers
      const getOffsetDate = (days: number): string => {
        const d = new Date(now);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      };

      const yesterdayStr = getOffsetDate(-1);
      const fiveDaysAgo = getOffsetDate(-5);
      const eightDaysAgo = getOffsetDate(-8);
      const twoDaysAgo = getOffsetDate(-2);
      const tomorrowStr = getOffsetDate(1);
      const nextTwoDays = getOffsetDate(2);
      const nextThreeDays = getOffsetDate(3);
      const fortyTwoDaysAgo = getOffsetDate(-42);

      const userId = 'usr_marcus_01';
      const defaultUser: User = {
        id: userId,
        name: 'Marcus Ke',
        email: 'marcuske001@gmail.com',
        phone: '+254 700 123 456',
        profession: 'insurance',
        company: 'Apex Assurance & Financial Solutions',
        reminderPref: '15m',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.users.put(defaultUser);

  // Customers
  const customers: Customer[] = [
    {
      id: 'cust_john_kamau',
      userId,
      name: 'John Kamau',
      phone: '+254 712 345 678',
      email: 'john.kamau@kamaultd.co.ke',
      company: 'Kamau Logistics Ltd',
      location: 'Westlands, Nairobi',
      status: 'active',
      priority: 'high',
      cadenceDays: 30,
      tags: ['VIP', 'Renewal', 'Business'],
      interests: ['Life Insurance', 'Medical', 'Motor'],
      notes: 'Customer prefers afternoon meetings. Decision maker. Has three dependents (wife & 2 school-going children). Very punctual.',
      preferredChannel: 'whatsapp',
      preferredTime: 'afternoon',
      decisionMaker: 'Self (John Kamau - MD)',
      assistant: 'Grace (Tel: 0722 000 111)',
      dependentsNotes: 'Wife Catherine, son Brian (12), daughter Joy (8)',
      isFavorite: true,
      isArchived: false,
      lastInteractionAt: fiveDaysAgo + 'T14:30:00Z',
      lastInteractionSummary: 'Customer was considering family comprehensive medical cover. Requested formal quotation.',
      lastInteractionType: 'call',
      nextAction: 'Policy review meeting & deliver quotation',
      nextActionDate: todayStr,
      nextActionType: 'meeting',
      createdAt: getOffsetDate(-90) + 'T08:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_mary_wanjiku',
      userId,
      name: 'Mary Wanjiku',
      phone: '+254 722 890 123',
      email: 'mary.wanjiku@apexconsult.ke',
      company: 'Apex Consulting Group',
      location: 'Upper Hill, Nairobi',
      status: 'prospect',
      priority: 'high',
      cadenceDays: 14,
      tags: ['High Priority', 'New Lead', 'Referral'],
      interests: ['Medical', 'Investment'],
      notes: 'Managing Partner at Apex. Key decision maker for corporate medical scheme for 18 staff members. Prefers phone follow-ups.',
      preferredChannel: 'phone',
      preferredTime: 'morning',
      decisionMaker: 'Mary Wanjiku & Executive Board',
      assistant: 'Kevin (Admin Officer)',
      dependentsNotes: 'Corporate scheme for 18 employees + dependents',
      isFavorite: true,
      isArchived: false,
      lastInteractionAt: twoDaysAgo + 'T10:15:00Z',
      lastInteractionSummary: 'Sent updated inpatient hospital network schedule and tier options.',
      lastInteractionType: 'email',
      nextAction: 'Follow up on medical quotation via phone',
      nextActionDate: todayStr,
      nextActionType: 'call',
      createdAt: getOffsetDate(-45) + 'T09:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_abc_enterprises',
      userId,
      name: 'ABC Enterprises Ltd',
      phone: '+254 733 456 789',
      email: 'hr@abcenterprises.co.ke',
      company: 'ABC Enterprises Ltd',
      location: 'Commercial Street, Industrial Area, Nairobi',
      status: 'active',
      priority: 'high',
      cadenceDays: 30,
      tags: ['Business', 'VIP', 'Key Account'],
      interests: ['Pension', 'Medical', 'Group Life'],
      notes: 'Long-standing group client. Annual employee benefits review coming up. Contract value significant.',
      preferredChannel: 'in-person',
      preferredTime: 'afternoon',
      decisionMaker: 'Mr. Mwangi (Managing Director)',
      assistant: 'Ann (HR Executive)',
      dependentsNotes: '55 permanent employees on group life & pension',
      isFavorite: true,
      isArchived: false,
      lastInteractionAt: eightDaysAgo + 'T11:00:00Z',
      lastInteractionSummary: 'Received employee census update from HR department.',
      lastInteractionType: 'email',
      nextAction: 'Proposal discussion meeting at their office',
      nextActionDate: todayStr,
      nextActionType: 'meeting',
      createdAt: getOffsetDate(-180) + 'T10:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_peter_otieno',
      userId,
      name: 'Peter Otieno',
      phone: '+254 721 555 432',
      email: 'peter.otieno@lakeviewfarms.ke',
      company: 'Lakeview Agro Logistics',
      location: 'Kilimani, Nairobi',
      status: 'active',
      priority: 'normal',
      cadenceDays: 30,
      tags: ['Renewal', 'Family'],
      interests: ['Motor', 'Life Insurance'],
      notes: 'Commercial vehicle fleet renewal due in 3 weeks. Very reliable client, always settles premiums on time.',
      preferredChannel: 'phone',
      preferredTime: 'afternoon',
      decisionMaker: 'Self',
      assistant: 'None',
      dependentsNotes: 'Fleet of 6 light commercial trucks',
      isFavorite: false,
      isArchived: false,
      lastInteractionAt: getOffsetDate(-7) + 'T16:00:00Z',
      lastInteractionSummary: 'Discussed fleet valuation and excess protector rider.',
      lastInteractionType: 'call',
      nextAction: 'Confirm policy renewal terms and send debit note',
      nextActionDate: todayStr,
      nextActionType: 'followup',
      createdAt: getOffsetDate(-120) + 'T11:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_jane_mwangi',
      userId,
      name: 'Jane Mwangi',
      phone: '+254 710 998 877',
      email: 'jane.mwangi@gmail.com',
      company: 'Freelance Architectural Consultant',
      location: 'Lavington, Nairobi',
      status: 'follow-up',
      priority: 'high',
      cadenceDays: 14,
      tags: ['High Priority', 'Follow-up'],
      interests: ['Medical', 'Pension'],
      notes: 'Looking for comprehensive individual medical cover for herself and elderly mother. Waiting on policy documents.',
      preferredChannel: 'whatsapp',
      preferredTime: 'morning',
      decisionMaker: 'Self',
      assistant: 'None',
      dependentsNotes: 'Mother (68 years old, pre-existing hypertension)',
      isFavorite: false,
      isArchived: false,
      lastInteractionAt: getOffsetDate(-4) + 'T09:30:00Z',
      lastInteractionSummary: 'Requested underwriter pre-authorization form for mother.',
      lastInteractionType: 'whatsapp',
      nextAction: 'Send requested medical underwriter documents (Overdue)',
      nextActionDate: yesterdayStr,
      nextActionType: 'whatsapp',
      createdAt: getOffsetDate(-25) + 'T14:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_david_kariuki',
      userId,
      name: 'David Kariuki',
      phone: '+254 725 112 233',
      email: 'd.kariuki@safariadventures.com',
      company: 'Safari Adventures Kenya Ltd',
      location: 'Karen, Nairobi',
      status: 'prospect',
      priority: 'normal',
      cadenceDays: 30,
      tags: ['New Lead', 'Referral'],
      interests: ['Investment', 'Pension'],
      notes: 'Referred by John Kamau. High net worth safari operator looking into guaranteed education and retirement trust.',
      preferredChannel: 'whatsapp',
      preferredTime: 'morning',
      decisionMaker: 'Self',
      assistant: 'Phylis',
      dependentsNotes: 'Two children enrolled in international academy',
      isFavorite: false,
      isArchived: false,
      lastInteractionAt: getOffsetDate(-3) + 'T15:20:00Z',
      lastInteractionSummary: 'Initial WhatsApp introduction and confirmed 10 AM meeting slot.',
      lastInteractionType: 'whatsapp',
      nextAction: 'First exploratory financial planning meeting',
      nextActionDate: tomorrowStr,
      nextActionType: 'meeting',
      createdAt: getOffsetDate(-10) + 'T16:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_grace_njeri',
      userId,
      name: 'Grace Njeri',
      phone: '+254 715 674 321',
      email: 'grace.njeri@horizonlaw.co.ke',
      company: 'Horizon Legal LLP',
      location: 'CBD, Nairobi',
      status: 'active',
      priority: 'normal',
      cadenceDays: 30,
      tags: ['VIP', 'Referral'],
      interests: ['Business', 'Professional Indemnity'],
      notes: 'Senior litigation partner. Very busy, hates long calls. Wants bullet points on professional indemnity cover.',
      preferredChannel: 'email',
      preferredTime: 'evening',
      decisionMaker: 'Senior partners committee',
      assistant: 'Faith',
      dependentsNotes: '5-partner firm',
      isFavorite: false,
      isArchived: false,
      lastInteractionAt: fortyTwoDaysAgo + 'T11:00:00Z', // 42 days ago -> overdue cadence!
      lastInteractionSummary: 'Settled last year renewal premium.',
      lastInteractionType: 'email',
      nextAction: null,
      nextActionDate: null,
      nextActionType: null,
      createdAt: getOffsetDate(-300) + 'T12:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'cust_mwangaza_investments',
      userId,
      name: 'Mwangaza Investments',
      phone: '+254 720 334 455',
      email: 'accounts@mwangazagroup.ke',
      company: 'Mwangaza Group',
      location: 'Upper Hill, Nairobi',
      status: 'prospect',
      priority: 'high',
      cadenceDays: 14,
      tags: ['Business', 'High Value', 'VIP'],
      interests: ['Investment', 'Commercial Property'],
      notes: 'Looking at commercial property asset protection and director keyman insurance package.',
      preferredChannel: 'in-person',
      preferredTime: 'morning',
      decisionMaker: 'Board of Directors',
      assistant: 'Dorothy',
      dependentsNotes: 'Commercial asset book value $2.4M',
      isFavorite: true,
      isArchived: false,
      lastInteractionAt: getOffsetDate(-6) + 'T14:00:00Z',
      lastInteractionSummary: 'Presented preliminary structural insurance comparison table.',
      lastInteractionType: 'meeting',
      nextAction: 'Follow up on board decision on Keyman policy',
      nextActionDate: nextThreeDays,
      nextActionType: 'call',
      createdAt: getOffsetDate(-35) + 'T10:00:00Z',
      updatedAt: now.toISOString()
    }
  ];

  await db.customers.bulkPut(customers);

  // Appointments
  const appointments: Appointment[] = [
    {
      id: 'apt_john_today',
      userId,
      customerId: 'cust_john_kamau',
      title: 'Policy Review & Medical Quotation',
      date: todayStr,
      startTime: '09:00',
      endTime: '10:00',
      locationType: 'customer_office',
      locationAddress: 'Kamau Logistics, Delta Corner, Westlands',
      purpose: 'Review current life insurance policy and present revised family medical cover options.',
      notes: 'Customer prefers afternoon meetings normally, but agreed to morning review today. Has 3 dependents.',
      reminderTime: '30m',
      status: 'upcoming',
      createdAt: getOffsetDate(-3) + 'T10:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'apt_mary_today',
      userId,
      customerId: 'cust_mary_wanjiku',
      title: 'Follow up on medical quotation',
      date: todayStr,
      startTime: '11:30',
      endTime: '12:00',
      locationType: 'online',
      locationAddress: 'Phone Call / Google Meet',
      purpose: 'Clarify maternity and chronic illness sub-limits requested by HR committee.',
      notes: 'Make sure to highlight direct cashless admission across Nairobi Hospital and Aga Khan.',
      reminderTime: '15m',
      status: 'upcoming',
      createdAt: getOffsetDate(-2) + 'T14:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'apt_abc_today',
      userId,
      customerId: 'cust_abc_enterprises',
      title: 'Proposal discussion & Scheme renewal',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:30',
      locationType: 'customer_office',
      locationAddress: 'ABC Enterprises Head Office, Commercial St, Industrial Area',
      purpose: 'Present the annual group pension and life insurance proposal to Managing Director.',
      notes: 'Bring 3 printed bound copies of proposal document and rate cards.',
      reminderTime: '1h',
      status: 'upcoming',
      createdAt: getOffsetDate(-5) + 'T09:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'apt_david_tomorrow',
      userId,
      customerId: 'cust_david_kariuki',
      title: 'Initial financial planning session',
      date: tomorrowStr,
      startTime: '10:00',
      endTime: '11:00',
      locationType: 'branch',
      locationAddress: 'Branch Office, Coffee Lounge',
      purpose: 'Discuss personal retirement planning and children education policies.',
      notes: 'Referred by John Kamau. Needs comprehensive education fund projections.',
      reminderTime: '30m',
      status: 'upcoming',
      createdAt: getOffsetDate(-2) + 'T11:00:00Z',
      updatedAt: now.toISOString()
    }
  ];

  await db.appointments.bulkPut(appointments);

  // Follow-ups
  const followUps: FollowUp[] = [
    {
      id: 'flw_mary_today',
      userId,
      customerId: 'cust_mary_wanjiku',
      title: 'Medical quotation follow-up call',
      dueDate: todayStr,
      dueTime: '11:00',
      priority: 'high',
      notes: 'Confirm she received the updated premium breakdown spreadsheet.',
      reminderTime: '15m',
      status: 'pending',
      createdAt: getOffsetDate(-1) + 'T08:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'flw_peter_today',
      userId,
      customerId: 'cust_peter_otieno',
      title: 'Policy renewal confirmation',
      dueDate: todayStr,
      dueTime: '16:00',
      priority: 'normal',
      notes: 'Confirm renewal premium payment receipt and issue certificate cover note.',
      reminderTime: '30m',
      status: 'pending',
      createdAt: getOffsetDate(-2) + 'T12:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'flw_jane_overdue',
      userId,
      customerId: 'cust_jane_mwangi',
      title: 'Send requested medical underwriting documents',
      dueDate: yesterdayStr,
      dueTime: '14:00',
      priority: 'high',
      notes: 'Customer needed pre-authorization terms before hospital appointment.',
      reminderTime: 'at_time',
      status: 'pending',
      createdAt: getOffsetDate(-3) + 'T14:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'flw_mwangaza_later',
      userId,
      customerId: 'cust_mwangaza_investments',
      title: 'Check Keyman proposal decision',
      dueDate: nextTwoDays,
      dueTime: '10:00',
      priority: 'high',
      notes: 'Call Dorothy to check if board resolution was signed.',
      reminderTime: '1h',
      status: 'pending',
      createdAt: getOffsetDate(-1) + 'T10:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'flw_john_prev_done',
      userId,
      customerId: 'cust_john_kamau',
      title: 'Draft comprehensive family quotation',
      dueDate: getOffsetDate(-2),
      dueTime: '17:00',
      priority: 'high',
      notes: 'Finalize calculations including dental and optical riders.',
      reminderTime: 'none',
      status: 'completed',
      completedAt: getOffsetDate(-2) + 'T16:45:00Z',
      createdAt: getOffsetDate(-5) + 'T09:00:00Z',
      updatedAt: getOffsetDate(-2) + 'T16:45:00Z'
    }
  ];

  await db.followUps.bulkPut(followUps);

  // Interactions (Activity History)
  const interactions: Interaction[] = [
    {
      id: 'int_1',
      userId,
      customerId: 'cust_john_kamau',
      type: 'call',
      date: fiveDaysAgo,
      time: '14:30',
      summary: 'Discussed life insurance upgrade & family medical cover.',
      outcome: 'Customer requested quotation for family with inpatient Ksh 5M and outpatient Ksh 200k.',
      nextActionNotes: 'Prepare quotation and meet on 10th September.',
      durationMinutes: 18,
      createdAt: fiveDaysAgo + 'T14:50:00Z',
      updatedAt: fiveDaysAgo + 'T14:50:00Z'
    },
    {
      id: 'int_2',
      userId,
      customerId: 'cust_john_kamau',
      type: 'whatsapp',
      date: getOffsetDate(-2),
      time: '17:02',
      summary: 'Sent preliminary quotation breakdown over WhatsApp as requested.',
      outcome: 'John acknowledged receipt and confirmed meeting for 9 AM.',
      durationMinutes: 5,
      createdAt: getOffsetDate(-2) + 'T17:05:00Z',
      updatedAt: getOffsetDate(-2) + 'T17:05:00Z'
    },
    {
      id: 'int_3',
      userId,
      customerId: 'cust_mary_wanjiku',
      type: 'call',
      date: twoDaysAgo,
      time: '10:15',
      summary: 'Reviewed staff group medical needs with Mary.',
      outcome: 'Agreed to send tier matrix with Aga Khan and Nairobi Hospital included.',
      nextActionNotes: 'Call back at 11:00 AM on 10th.',
      durationMinutes: 14,
      createdAt: twoDaysAgo + 'T10:30:00Z',
      updatedAt: twoDaysAgo + 'T10:30:00Z'
    },
    {
      id: 'int_4',
      userId,
      customerId: 'cust_jane_mwangi',
      type: 'whatsapp',
      date: getOffsetDate(-4),
      time: '09:30',
      summary: 'Jane asked for medical underwriter guidelines for elderly dependents.',
      outcome: 'Promised to retrieve specific pre-existing condition forms.',
      nextActionNotes: 'Send requested documents ASAP.',
      createdAt: getOffsetDate(-4) + 'T09:35:00Z',
      updatedAt: getOffsetDate(-4) + 'T09:35:00Z'
    },
    {
      id: 'int_5',
      userId,
      customerId: 'cust_peter_otieno',
      type: 'call',
      date: getOffsetDate(-7),
      time: '16:00',
      summary: 'Annual commercial vehicle renewal review.',
      outcome: 'Agreed on 5.5% comprehensive rate with excess protector included.',
      durationMinutes: 12,
      createdAt: getOffsetDate(-7) + 'T16:15:00Z',
      updatedAt: getOffsetDate(-7) + 'T16:15:00Z'
    }
  ];

  await db.interactions.bulkPut(interactions);

  // Opportunities
  const opportunities: Opportunity[] = [
    {
      id: 'opp_john_medical',
      userId,
      customerId: 'cust_john_kamau',
      title: 'Family Comprehensive Medical & Life Bundle',
      product: 'Medical & Life Insurance',
      estimatedValue: 320000, // KSh 320,000
      stage: 'proposal',
      expectedCloseDate: getOffsetDate(10),
      notes: 'Customer is eager to get cover in place before international travel in October.',
      nextAction: 'Review quote at 9 AM meeting',
      isArchived: false,
      createdAt: fiveDaysAgo + 'T15:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'opp_mary_group',
      userId,
      customerId: 'cust_mary_wanjiku',
      title: 'Apex Consulting Staff Medical Scheme (18 Staff)',
      product: 'Corporate Medical Cover',
      estimatedValue: 1450000, // KSh 1,450,000
      stage: 'interested',
      expectedCloseDate: getOffsetDate(20),
      notes: 'Competitive bidding against two other insurers. Our hospital network advantage is key.',
      nextAction: 'Follow up call at 11:30 AM',
      isArchived: false,
      createdAt: getOffsetDate(-15) + 'T11:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'opp_abc_renewal',
      userId,
      customerId: 'cust_abc_enterprises',
      title: 'Annual Group Pension & Life Renewal 2026',
      product: 'Occupational Pension & Group Life',
      estimatedValue: 4800000, // KSh 4,800,000
      stage: 'negotiation',
      expectedCloseDate: getOffsetDate(15),
      notes: 'Meeting today with Managing Director to lock in guaranteed interest rate tier.',
      nextAction: 'Proposal discussion meeting today 2 PM',
      isArchived: false,
      createdAt: getOffsetDate(-30) + 'T10:00:00Z',
      updatedAt: now.toISOString()
    },
    {
      id: 'opp_mwangaza_keyman',
      userId,
      customerId: 'cust_mwangaza_investments',
      title: 'Executive Keyman & Director Portfolio Plan',
      product: 'Keyman Life & Investment Plan',
      estimatedValue: 2800000,
      stage: 'proposal',
      expectedCloseDate: getOffsetDate(25),
      notes: 'Board meeting approval scheduled for late September.',
      nextAction: 'Call Dorothy in 2 days',
      isArchived: false,
      createdAt: getOffsetDate(-20) + 'T09:00:00Z',
      updatedAt: now.toISOString()
    }
  ];

  await db.opportunities.bulkPut(opportunities);

  // Important Dates
  const importantDates: ImportantDate[] = [
    {
      id: 'date_peter_renewal',
      userId,
      customerId: 'cust_peter_otieno',
      type: 'policy_renewal',
      customLabel: 'Commercial Fleet Policy Renewal',
      date: getOffsetDate(18),
      reminderDaysBefore: 14,
      notes: 'Certificates must be dispatched before vehicle NTSA inspection.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'date_john_bday',
      userId,
      customerId: 'cust_john_kamau',
      type: 'birthday',
      customLabel: "John's Birthday",
      date: getOffsetDate(5),
      reminderDaysBefore: 1,
      notes: 'Send personalized WhatsApp birthday greetings and gift token.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'date_abc_renewal',
      userId,
      customerId: 'cust_abc_enterprises',
      type: 'contract_renewal',
      customLabel: 'Group Pension Scheme Anniversary',
      date: getOffsetDate(22),
      reminderDaysBefore: 30,
      notes: 'Annual trustees meeting report required.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  await db.importantDates.bulkPut(importantDates);

  // Default Message Templates
  const templates: MessageTemplate[] = [
    {
      id: 'tmpl_appt_conf',
      userId,
      title: 'Appointment Confirmation',
      channel: 'whatsapp',
      category: 'Appointments',
      content: 'Hello {customer_name}, confirming our meeting on {appointment_date} at {appointment_time} at {location}. Looking forward to discussing {product}. Best regards.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'tmpl_quote_flw',
      userId,
      title: 'Quotation Follow-up',
      channel: 'whatsapp',
      category: 'Follow-ups',
      content: 'Hi {customer_name}, hope you are doing well. Just following up on the {product} quotation I shared earlier. Have you had a chance to review it? Happy to answer any questions.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'tmpl_renewal',
      userId,
      title: 'Policy Renewal Reminder',
      channel: 'whatsapp',
      category: 'Renewals',
      content: 'Dear {customer_name}, your policy for {product} is coming up for renewal soon. Let me know if you would like me to review the terms or make any adjustments to your cover.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'tmpl_doc_req',
      userId,
      title: 'Document Request',
      channel: 'email',
      category: 'Documentation',
      content: 'Dear {customer_name},\n\nIn order to finalize your application for {product}, could you kindly share a copy of your National ID and KRA PIN certificate?\n\nThank you,\n{user_name}',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  await db.templates.bulkPut(templates);
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

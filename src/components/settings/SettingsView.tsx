import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Briefcase, 
  Upload, 
  Download, 
  RefreshCw, 
  Database, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  FileSpreadsheet, 
  Save, 
  RotateCcw,
  Wifi,
  WifiOff,
  ChevronRight,
  Eye,
  Trash2
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import type { Customer, ProfessionType, User as UserType } from '../../types';
import { downloadFile, formatDate } from '../../utils';
import * as XLSX from 'xlsx';
import { CustomSelect } from '../common/CustomSelect';

const standardProfessions = [
  'insurance',
  'banking',
  'financial',
  'real_estate',
  'sales',
  'consulting',
  'other'
];

export const SettingsView: React.FC = () => {
  const { user, updateUser, resetDatabase } = useAuth();
  const { isOnline, syncStatus, pendingCount, lastSyncAt, syncQueue, syncNow, clearSyncQueue } = useSync();

  // Settings subtab
  const [activeTab, setActiveTab] = useState<'profile' | 'import' | 'export' | 'backup' | 'sync'>('profile');

  // Profile fields
  const [userName, setUserName] = useState(user?.name || '');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [userPhone, setUserPhone] = useState(user?.phone || '');
  const [userProfession, setUserProfession] = useState<string>(user?.profession || 'insurance');
  const [isCustomProfession, setIsCustomProfession] = useState(false);
  const [customProfessionName, setCustomProfessionName] = useState('');
  const [userCompany, setUserCompany] = useState(user?.company || '');
  const [userReminder, setUserReminder] = useState<UserType['reminderPref']>(user?.reminderPref || '15m');
  const [profileSaved, setProfileSaved] = useState(false);

  // CSV Import states
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({
    name: '',
    phone: '',
    email: '',
    company: '',
    product: '',
    notes: '',
    location: ''
  });
  const [parsedImportItems, setParsedImportItems] = useState<{
    ready: Partial<Customer>[];
    duplicates: { item: Partial<Customer>; reason: string }[];
    invalid: { row: string[]; reason: string }[];
  }>({ ready: [], duplicates: [], invalid: [] });
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Backup & Restore states
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setUserName(user.name);
      setUserEmail(user.email);
      setUserPhone(user.phone || '');
      setUserCompany(user.company || '');
      setUserReminder(user.reminderPref);

      if (user.customProfession || (!standardProfessions.includes(user.profession) && user.profession)) {
        setIsCustomProfession(true);
        setUserProfession('custom');
        setCustomProfessionName(user.customProfession || user.profession);
      } else {
        setIsCustomProfession(false);
        setUserProfession(user.profession || 'insurance');
        setCustomProfessionName('');
      }
    }
  }, [user]);

  // Handle saving profile & profession
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalProfession = isCustomProfession
      ? (customProfessionName.trim() || 'Custom Professional')
      : userProfession;

    await updateUser({
      name: userName.trim(),
      email: userEmail.trim(),
      phone: userPhone.trim(),
      profession: finalProfession as any,
      customProfession: isCustomProfession ? customProfessionName.trim() : undefined,
      company: userCompany.trim(),
      reminderPref: userReminder
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  // CSV Parser with Quotes & Commas support
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      const result: string[] = [];
      let inQuotes = false;
      let curVal = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(curVal.trim());
          curVal = '';
        } else {
          curVal += char;
        }
      }
      result.push(curVal.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  // Handle CSV file upload
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRawCsvText(text);
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-detect columns based on common names
      const mapping: { [key: string]: string } = {};
      headers.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('name') || lower.includes('client') || lower.includes('customer')) {
          if (!mapping.name) mapping.name = h;
        } else if (lower.includes('phone') || lower.includes('tel') || lower.includes('mobile')) {
          if (!mapping.phone) mapping.phone = h;
        } else if (lower.includes('email') || lower.includes('mail')) {
          if (!mapping.email) mapping.email = h;
        } else if (lower.includes('company') || lower.includes('org') || lower.includes('business')) {
          if (!mapping.company) mapping.company = h;
        } else if (lower.includes('product') || lower.includes('service') || lower.includes('interest')) {
          if (!mapping.product) mapping.product = h;
        } else if (lower.includes('note') || lower.includes('desc') || lower.includes('comment')) {
          if (!mapping.notes) mapping.notes = h;
        } else if (lower.includes('loc') || lower.includes('city') || lower.includes('address')) {
          if (!mapping.location) mapping.location = h;
        }
      });
      setColumnMapping(mapping);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Run validation on mapped CSV
  const runCsvValidation = async () => {
    const existing = await db.customers.toArray();
    const ready: Partial<Customer>[] = [];
    const duplicates: { item: Partial<Customer>; reason: string }[] = [];
    const invalid: { row: string[]; reason: string }[] = [];

    const nameIdx = csvHeaders.indexOf(columnMapping.name);
    const phoneIdx = csvHeaders.indexOf(columnMapping.phone);
    const emailIdx = csvHeaders.indexOf(columnMapping.email);
    const compIdx = csvHeaders.indexOf(columnMapping.company);
    const prodIdx = csvHeaders.indexOf(columnMapping.product);
    const noteIdx = csvHeaders.indexOf(columnMapping.notes);
    const locIdx = csvHeaders.indexOf(columnMapping.location);

    if (nameIdx === -1) {
      alert('Please map at least the Customer Name column.');
      return;
    }

    csvRows.forEach((row) => {
      const name = row[nameIdx]?.trim();
      const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() : '';
      const email = emailIdx >= 0 ? row[emailIdx]?.trim() : '';
      const company = compIdx >= 0 ? row[compIdx]?.trim() : '';
      const product = prodIdx >= 0 ? row[prodIdx]?.trim() : '';
      const notes = noteIdx >= 0 ? row[noteIdx]?.trim() : '';
      const location = locIdx >= 0 ? row[locIdx]?.trim() : '';

      if (!name) {
        invalid.push({ row, reason: 'Missing customer name' });
        return;
      }

      // Check duplicates against existing database
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const isDuplicate = existing.some(c => {
        const cClean = c.phone.replace(/[^\d]/g, '');
        return (cleanPhone.length >= 7 && cClean.endsWith(cleanPhone.slice(-8))) ||
               (email && c.email && c.email.toLowerCase() === email.toLowerCase());
      });

      const item: Partial<Customer> = {
        name,
        phone: phone || '+254 700 000 000',
        email: email || undefined,
        company: company || undefined,
        interests: product ? [product] : ['General'],
        notes: notes || '',
        location: location || undefined
      };

      if (isDuplicate) {
        duplicates.push({ item, reason: 'Matching phone number or email already in database' });
      } else {
        ready.push(item);
      }
    });

    setParsedImportItems({ ready, duplicates, invalid });
  };

  // Perform import
  const handleExecuteImport = async (includeDuplicates: boolean = false) => {
    if (!user) return;
    setIsImporting(true);
    try {
      const toImport = includeDuplicates
        ? [...parsedImportItems.ready, ...parsedImportItems.duplicates.map(d => d.item)]
        : parsedImportItems.ready;

      const nowIso = new Date().toISOString();
      const newCustomers: Customer[] = toImport.map((item) => {
        const id = generateId('cust');
        return {
          id,
          userId: user.id,
          name: item.name || 'Imported Client',
          phone: item.phone || '+254 700 000 000',
          email: item.email,
          company: item.company,
          location: item.location,
          status: 'prospect',
          priority: 'normal',
          cadenceDays: 30,
          tags: ['Excel Import'],
          interests: item.interests || ['General'],
          notes: item.notes || '',
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
      });

      await db.customers.bulkPut(newCustomers);
      for (const nc of newCustomers) {
        await queueMutation('insert', 'customers', nc.id, nc);
      }

      setImportSuccessMsg(`Successfully imported ${newCustomers.length} customers!`);
      setParsedImportItems({ ready: [], duplicates: [], invalid: [] });
      setRawCsvText('');
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  // Export customers to Excel spreadsheet (.xlsx)
  const handleExportCustomersExcel = async () => {
    const all = await db.customers.toArray();
    const data = all.map(c => ({
      'Name': c.name || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Company': c.company || '',
      'Location': c.location || '',
      'Status': c.status || '',
      'Priority': c.priority || '',
      'Cadence (Days)': c.cadenceDays || 30,
      'Interests': (c.interests || []).join(', '),
      'Tags': (c.tags || []).join(', '),
      'Next Action': c.nextAction || '',
      'Next Action Date': c.nextActionDate || '',
      'Notes': c.notes || '',
      'Created Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    XLSX.writeFile(workbook, `ClientFlow_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export full CRM workbook with multiple sheets (.xlsx)
  const handleExportFullExcelWorkbook = async () => {
    const [customers, followUps, appointments, opportunities, interactions, importantDates] = await Promise.all([
      db.customers.toArray(),
      db.followUps.toArray(),
      db.appointments.toArray(),
      db.opportunities.toArray(),
      db.interactions.toArray(),
      db.importantDates.toArray()
    ]);

    const custMap = new Map(customers.map(c => [c.id, c.name]));
    const workbook = XLSX.utils.book_new();

    // 1. Customers Sheet
    const custData = customers.map(c => ({
      'Customer ID': c.id,
      'Name': c.name || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Company': c.company || '',
      'Location': c.location || '',
      'Status': c.status || '',
      'Priority': c.priority || '',
      'Cadence (Days)': c.cadenceDays || 30,
      'Interests': (c.interests || []).join(', '),
      'Tags': (c.tags || []).join(', '),
      'Next Action': c.nextAction || '',
      'Next Action Date': c.nextActionDate || '',
      'Notes': c.notes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(custData), 'Customers');

    // 2. Follow-Ups Sheet
    const flwData = followUps.map(f => ({
      'Customer': custMap.get(f.customerId) || 'Unknown',
      'Follow-up Title': f.title,
      'Due Date': f.dueDate,
      'Due Time': f.dueTime || '',
      'Status': f.status,
      'Priority': f.priority,
      'Notes': f.notes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(flwData), 'Follow-Ups');

    // 3. Appointments Sheet
    const aptData = appointments.map(a => ({
      'Customer': custMap.get(a.customerId) || 'Unknown',
      'Appointment Title': a.title,
      'Date': a.date,
      'Start Time': a.startTime,
      'End Time': a.endTime,
      'Location Type': a.locationType || '',
      'Address': a.locationAddress || '',
      'Status': a.status,
      'Notes': a.notes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(aptData), 'Appointments');

    // 4. Pipeline Deals Sheet
    const oppData = opportunities.map(o => ({
      'Customer': custMap.get(o.customerId) || 'Unknown',
      'Opportunity Title': o.title,
      'Product': o.product || '',
      'Stage': o.stage,
      'Estimated Value': o.estimatedValue,
      'Expected Close': o.expectedCloseDate || '',
      'Next Action': o.nextAction || '',
      'Notes': o.notes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(oppData), 'Pipeline Deals');

    // 5. Interactions History Sheet
    const intData = interactions.map(i => ({
      'Customer': custMap.get(i.customerId) || 'Unknown',
      'Type': i.type,
      'Date': i.date,
      'Time': i.time || '',
      'Summary': i.summary,
      'Outcome': i.outcome || '',
      'Next Action Notes': i.nextActionNotes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(intData), 'Interactions History');

    // 6. Important Dates Sheet
    const impData = importantDates.map(d => ({
      'Customer': custMap.get(d.customerId) || 'Unknown',
      'Type': d.type,
      'Custom Label': d.customLabel || '',
      'Date': d.date,
      'Reminder Days Before': d.reminderDaysBefore,
      'Notes': d.notes || ''
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(impData), 'Important Dates');

    XLSX.writeFile(workbook, `ClientFlow_CRM_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export customers to CSV
  const handleExportCustomersCsv = async () => {
    const all = await db.customers.toArray();
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Location', 'Status', 'Priority', 'CadenceDays', 'Interests', 'Tags', 'NextAction', 'NextActionDate', 'Notes'];
    const rows = all.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${(c.location || '').replace(/"/g, '""')}"`,
      `"${c.status}"`,
      `"${c.priority}"`,
      c.cadenceDays,
      `"${(c.interests || []).join(';')}"`,
      `"${(c.tags || []).join(';')}"`,
      `"${(c.nextAction || '').replace(/"/g, '""')}"`,
      `"${c.nextActionDate || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    downloadFile(`ClientFlow_Customers_${new Date().toISOString().split('T')[0]}.csv`, csvContent, 'text/csv');
  };

  // Full Database JSON Backup
  const handleExportFullBackup = async () => {
    const [users, customers, interactions, appointments, followUps, opportunities, importantDates, templates] = await Promise.all([
      db.users.toArray(),
      db.customers.toArray(),
      db.interactions.toArray(),
      db.appointments.toArray(),
      db.followUps.toArray(),
      db.opportunities.toArray(),
      db.importantDates.toArray(),
      db.templates.toArray()
    ]);

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: users[0],
      customers,
      interactions,
      appointments,
      followUps,
      opportunities,
      importantDates,
      templates
    };

    const json = JSON.stringify(backupData, null, 2);
    downloadFile(`ClientFlow_FullBackup_${new Date().toISOString().split('T')[0]}.json`, json, 'application/json');
    setBackupNotice('Complete backup exported safely.');
    setTimeout(() => setBackupNotice(null), 3000);
  };

  // Restore JSON Backup
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        setIsRestoring(true);
        const data = JSON.parse(evt.target?.result as string);
        if (!data.customers || !Array.isArray(data.customers)) {
          alert('Invalid ClientFlow backup file format.');
          return;
        }

        if (!confirm(`Restore backup from ${formatDate(data.exportedAt)}? This will merge ${data.customers.length} customers and associated records.`)) {
          return;
        }

        if (data.user) await db.users.put(data.user);
        if (data.customers) await db.customers.bulkPut(data.customers);
        if (data.interactions) await db.interactions.bulkPut(data.interactions);
        if (data.appointments) await db.appointments.bulkPut(data.appointments);
        if (data.followUps) await db.followUps.bulkPut(data.followUps);
        if (data.opportunities) await db.opportunities.bulkPut(data.opportunities);
        if (data.importantDates) await db.importantDates.bulkPut(data.importantDates);
        if (data.templates) await db.templates.bulkPut(data.templates);

        setBackupNotice('Backup restored successfully!');
        setTimeout(() => setBackupNotice(null), 3000);
      } catch (err) {
        console.error('Failed to parse backup:', err);
        alert('Failed to restore backup file.');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA] dark:bg-[#0F172A] dark:text-slate-100">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Settings & Tools
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Profile, Excel import, backup, and local sync management
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-5xl mx-auto mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'profile'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            My Profile & Role
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'import'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            Import from Excel/CSV
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'export'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            Export Data
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'backup'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            Backup & Restore
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'sync'
                ? 'bg-[#1D70F5] text-white font-bold'
                : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            Sync Center
          </button>
        </div>
      </div>

      {/* Main Settings Body */}
      <div className="max-w-5xl mx-auto px-0 sm:px-6 py-4 sm:py-5">
        {backupNotice && (
          <div className="mb-4 mx-4 sm:mx-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{backupNotice}</span>
          </div>
        )}

        {/* 1. PROFILE & PROFESSION */}
        {activeTab === 'profile' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Professional Profile</h2>
              <p className="text-xs text-[#6B7280]">Configure your name and industry specialization</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs max-w-lg">
              <div>
                <label className="block font-bold text-[#374151] mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#374151] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#374151] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#374151] dark:text-slate-200 mb-1">Primary Profession / Role</label>
                <CustomSelect
                  value={isCustomProfession ? 'custom' : userProfession}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsCustomProfession(true);
                      setUserProfession('custom');
                    } else {
                      setIsCustomProfession(false);
                      setUserProfession(val);
                    }
                  }}
                  className="w-full"
                  options={[
                    { value: 'insurance', label: 'Insurance Agent / Broker' },
                    { value: 'banking', label: 'Bank Relationship Officer' },
                    { value: 'financial', label: 'Financial Advisor / Wealth Manager' },
                    { value: 'real_estate', label: 'Real Estate Agent / Property Consultant' },
                    { value: 'sales', label: 'Sales Representative / Account Executive' },
                    { value: 'consulting', label: 'Independent Consultant' },
                    { value: 'other', label: 'Other Customer-facing Professional' },
                    { value: 'custom', label: '✨ + Add Another / Custom Profession...' },
                  ]}
                />

                {isCustomProfession && (
                  <div className="mt-2.5 p-3 border border-blue-200 dark:border-blue-900/60 rounded bg-white dark:bg-slate-800 space-y-1">
                    <label className="block font-semibold text-xs text-[#1D70F5] dark:text-blue-400">
                      Enter Your Custom Profession / Title:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Architect, Fitness Coach, Lawyer, Photographer, Interior Designer..."
                      value={customProfessionName}
                      onChange={(e) => setCustomProfessionName(e.target.value)}
                      className="w-full p-2 border border-[#1D70F5] rounded text-sm bg-white dark:bg-slate-900 text-[#111827] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                      This custom profession will be used for your account profile and personalized workflow.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1">
                  Adjusting your profession tailors default products, terms, and templates.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#374151] mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={userCompany}
                  onChange={(e) => setUserCompany(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm focus:border-[#1D70F5] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white font-semibold rounded cursor-pointer transition-colors"
                >
                  Save Profile Settings
                </button>
                {profileSaved && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Saved successfully
                  </span>
                )}
              </div>
            </form>

            <div className="pt-6 border-t border-[#E5E7EB]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-700">Demo Data Reset</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Need to start fresh or reload the realistic demonstration dataset?
              </p>
              <button
                onClick={async () => {
                  if (confirm('Reset database to clean initial demonstration state?')) {
                    await resetDatabase();
                    alert('Database reseeded with fresh demo records.');
                  }
                }}
                className="mt-2 px-3 py-1.5 text-xs text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded cursor-pointer transition-colors font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset & Reseed Demo Data</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. EXCEL / CSV IMPORT */}
        {activeTab === 'import' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Import Customers from Excel or CSV</h2>
              <p className="text-xs text-[#6B7280]">
                Migrate your contacts into ClientFlow with column mapping and duplicate prevention.
              </p>
            </div>

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {/* Step 1: File Upload */}
            {!csvHeaders.length ? (
              <div className="border-2 border-dashed border-[#D1D5DB] rounded-lg p-8 text-center bg-[#F9FAFB]">
                <FileSpreadsheet className="w-10 h-10 text-[#9CA3AF] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#111827]">Choose your CSV spreadsheet file</p>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                  Export your contacts or clients from Excel as a .CSV file and upload here.
                </p>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />
                <button
                  onClick={() => csvFileInputRef.current?.click()}
                  className="mt-4 px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select CSV File</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Column Mapping Section */}
                <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#111827]">
                      Map Spreadsheet Columns
                    </h3>
                    <button
                      onClick={() => {
                        setCsvHeaders([]);
                        setCsvRows([]);
                      }}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Clear & Upload Different File
                    </button>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Match your spreadsheet columns to ClientFlow fields ({csvRows.length} rows detected).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Customer Name *</label>
                      <select
                        value={columnMapping.name}
                        onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Phone Number</label>
                      <select
                        value={columnMapping.phone}
                        onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Email</label>
                      <select
                        value={columnMapping.email}
                        onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Company</label>
                      <select
                        value={columnMapping.company}
                        onChange={(e) => setColumnMapping({ ...columnMapping, company: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Main Product / Interest</label>
                      <select
                        value={columnMapping.product}
                        onChange={(e) => setColumnMapping({ ...columnMapping, product: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#374151] mb-1">Location</label>
                      <select
                        value={columnMapping.location}
                        onChange={(e) => setColumnMapping({ ...columnMapping, location: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={runCsvValidation}
                    className="mt-2 px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                  >
                    Validate & Check for Duplicates
                  </button>
                </div>

                {/* Validation Results Summary */}
                {(parsedImportItems.ready.length > 0 || parsedImportItems.duplicates.length > 0) && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                        <span className="block text-base font-bold text-emerald-800">
                          {parsedImportItems.ready.length}
                        </span>
                        <span className="font-semibold text-emerald-700">Ready to Import</span>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                        <span className="block text-base font-bold text-amber-800">
                          {parsedImportItems.duplicates.length}
                        </span>
                        <span className="font-semibold text-amber-700">Duplicates Detected</span>
                      </div>

                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <span className="block text-base font-bold text-red-800">
                          {parsedImportItems.invalid.length}
                        </span>
                        <span className="font-semibold text-red-700">Invalid Records</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleExecuteImport(false)}
                        disabled={isImporting || parsedImportItems.ready.length === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors disabled:opacity-40"
                      >
                        Import {parsedImportItems.ready.length} Clean Records (Skip Duplicates)
                      </button>

                      {parsedImportItems.duplicates.length > 0 && (
                        <button
                          onClick={() => handleExecuteImport(true)}
                          disabled={isImporting}
                          className="px-3 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#374151] text-xs font-semibold rounded cursor-pointer transition-colors"
                        >
                          Import All Anyway (Including Duplicates)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. EXPORT DATA */}
        {activeTab === 'export' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Export Data</h2>
              <p className="text-xs text-[#6B7280]">
                You always own your data. Download your records as native Excel spreadsheets (.xlsx) or CSV files.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Excel Spreadsheet for Customers */}
              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-sm text-[#111827]">Customer Spreadsheet (.xlsx)</h3>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Formatted Microsoft Excel file with customer contact details, cadence, tags, and next action dates.
                  </p>
                </div>
                <button
                  onClick={handleExportCustomersExcel}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors w-full sm:w-auto self-start"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Customers Excel</span>
                </button>
              </div>

              {/* Option 2: Complete CRM Multi-Sheet Excel Workbook */}
              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#1D70F5]" />
                    <h3 className="font-bold text-sm text-[#111827]">Complete CRM Workbook (.xlsx)</h3>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Full Excel spreadsheet workbook containing separate tabs for Customers, Follow-ups, Appointments, Pipeline, and History.
                  </p>
                </div>
                <button
                  onClick={handleExportFullExcelWorkbook}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer transition-colors w-full sm:w-auto self-start"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CRM Workbook</span>
                </button>
              </div>
            </div>

            {/* Option 3: CSV Export */}
            <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-2">
              <h3 className="font-bold text-sm text-[#111827]">Raw Customer Database (CSV)</h3>
              <p className="text-xs text-[#6B7280]">
                Standard comma-separated text file compatible with all database tools and generic spreadsheet programs.
              </p>
              <button
                onClick={handleExportCustomersCsv}
                className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#374151] text-xs font-semibold rounded cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export to CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. BACKUP & RESTORE */}
        {activeTab === 'backup' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Complete Backup & Restore</h2>
              <p className="text-xs text-[#6B7280]">
                Create a full JSON snapshot of your entire CRM history, notes, follow-ups, and calendar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Backup */}
              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-2">
                <h3 className="font-bold text-sm text-[#111827]">Create Backup</h3>
                <p className="text-xs text-[#6B7280]">
                  Downloads a complete offline JSON archive of all tables and notes.
                </p>
                <button
                  onClick={handleExportFullBackup}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup JSON</span>
                </button>
              </div>

              {/* Restore */}
              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-2">
                <h3 className="font-bold text-sm text-[#111827]">Restore from Backup</h3>
                <p className="text-xs text-[#6B7280]">
                  Restore records from a previously exported ClientFlow JSON file.
                </p>
                <input
                  ref={jsonBackupInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreBackupFile}
                />
                <button
                  onClick={() => jsonBackupInputRef.current?.click()}
                  disabled={isRestoring}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#111827] text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select JSON to Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. SYNC CENTER */}
        {activeTab === 'sync' && (
          <div className="bg-white border-y sm:border border-[#E5E7EB] sm:rounded-md rounded-none p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Offline Write Queue & Sync Center</h2>
              <p className="text-xs text-[#6B7280]">
                Every customer interaction is saved locally first. All mutations are queued durably.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
                <span className="text-[11px] font-bold uppercase text-[#6B7280]">Connection</span>
                <p className="text-base font-bold text-[#111827] mt-1 flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-amber-500" />
                      <span>Offline (Device Storage Active)</span>
                    </>
                  )}
                </p>
              </div>

              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
                <span className="text-[11px] font-bold uppercase text-[#6B7280]">Pending Mutations</span>
                <p className="text-base font-bold text-[#111827] mt-1">
                  {pendingCount} item{pendingCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="p-4 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
                <span className="text-[11px] font-bold uppercase text-[#6B7280]">Last Sync</span>
                <p className="text-xs font-semibold text-[#111827] mt-1">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Not yet synced'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => syncNow()}
                disabled={!isOnline || syncStatus === 'syncing'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{syncStatus === 'syncing' ? 'Synchronizing...' : 'Sync Now'}</span>
              </button>

              {syncQueue.length > 0 && (
                <button
                  onClick={clearSyncQueue}
                  className="px-3 py-2 text-xs text-[#6B7280] hover:text-red-600 cursor-pointer"
                >
                  Clear Queue History
                </button>
              )}
            </div>

            {/* Mutation Queue Log Table */}
            <div className="pt-4 border-t border-[#E5E7EB]">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#111827] mb-2">
                Recent Mutation Journal ({syncQueue.length})
              </h3>
              {syncQueue.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">Sync journal is empty. All items settled.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border-y sm:border border-[#E5E7EB] -mx-4 sm:mx-0 rounded-none sm:rounded divide-y divide-[#E5E7EB] text-xs bg-white">
                  {syncQueue.slice(-10).reverse().map((item) => (
                    <div key={item.id} className="p-2.5 px-4 sm:px-3 flex items-center justify-between hover:bg-[#F9FAFB]">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase ${
                          item.action === 'insert' ? 'text-emerald-700' : item.action === 'update' ? 'text-[#1D70F5]' : 'text-red-700'
                        }`}>
                          {item.action}
                        </span>
                        <span className="font-semibold text-[#111827]">{item.table}</span>
                        <span className="text-[#9CA3AF] text-[11px]">({item.recordId})</span>
                      </div>
                      <span className="text-[10px] text-[#6B7280]">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

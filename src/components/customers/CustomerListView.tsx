import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Phone, 
  MessageCircle, 
  Calendar, 
  Star, 
  CheckSquare, 
  Clock, 
  ArrowUpDown, 
  FileText,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, queueMutation } from '../../db';
import type { Customer, CustomerStatus, CustomerPriority, FollowUp } from '../../types';
import { formatDate, getRelativeDateLabel, getWhatsAppUrl, calculateAttentionStatus } from '../../utils';
import { StatusBadge } from '../common/StatusBadge';
import { CustomSelect } from '../common/CustomSelect';

interface CustomerListViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: () => void;
}

export const CustomerListView: React.FC<CustomerListViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<FollowUp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [attentionFilter, setAttentionFilter] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'nextAction' | 'lastContact' | 'name'>('nextAction');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadCustomers = async () => {
    try {
      const all = await db.customers.toArray();
      const flws = await db.followUps.where('status').equals('pending').toArray();
      setCustomers(all);
      setPendingFollowUps(flws);
    } catch (err) {
      console.error('Error loading customer list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    customers.forEach(c => {
      if (c.tags) c.tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet);
  }, [customers]);

  // Toggle favorite
  const handleToggleFavorite = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    const newFav = !customer.isFavorite;
    await db.customers.update(customer.id, { isFavorite: newFav });
    await queueMutation('update', 'customers', customer.id, { isFavorite: newFav });
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, isFavorite: newFav } : c));
  };

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        if (c.isArchived) return false;
        if (onlyFavorites && !c.isFavorite) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.includes(q);
          const matchEmail = (c.email || '').toLowerCase().includes(q);
          const matchCompany = (c.company || '').toLowerCase().includes(q);
          const matchNotes = (c.notes || '').toLowerCase().includes(q);
          const matchInterests = c.interests.some(i => i.toLowerCase().includes(q));
          if (!matchName && !matchPhone && !matchEmail && !matchCompany && !matchNotes && !matchInterests) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;

        // Priority filter
        if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;

        // Tag filter
        if (selectedTag !== 'all' && (!c.tags || !c.tags.includes(selectedTag))) return false;

        // Attention health filter
        if (attentionFilter !== 'all') {
          const health = calculateAttentionStatus(c, pendingFollowUps);
          if (health !== attentionFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nextAction') {
          if (!a.nextActionDate && !b.nextActionDate) return a.name.localeCompare(b.name);
          if (!a.nextActionDate) return 1;
          if (!b.nextActionDate) return -1;
          return a.nextActionDate.localeCompare(b.nextActionDate);
        } else if (sortBy === 'lastContact') {
          if (!a.lastInteractionAt && !b.lastInteractionAt) return 0;
          if (!a.lastInteractionAt) return 1;
          if (!b.lastInteractionAt) return -1;
          return b.lastInteractionAt.localeCompare(a.lastInteractionAt);
        } else {
          return a.name.localeCompare(b.name);
        }
      });
  }, [customers, pendingFollowUps, searchQuery, statusFilter, priorityFilter, attentionFilter, onlyFavorites, selectedTag, sortBy]);

  // Export customers to Excel spreadsheet (.xlsx)
  const handleExportExcel = () => {
    const data = filteredCustomers.map(c => ({
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
    XLSX.writeFile(workbook, `Customers_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA] dark:bg-[#0F172A]">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#1E293B] border-b border-[#E5E7EB] dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-slate-100 tracking-tight">
              Customers ({filteredCustomers.length})
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
              Personal customer base & interaction history
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Export to Excel Spreadsheet Button */}
            <button
              onClick={handleExportExcel}
              title="Export customer list to Excel (.xlsx)"
              className="bg-white dark:bg-slate-800 border border-[#1D70F5] hover:bg-blue-50 dark:hover:bg-slate-700 text-[#1D70F5] dark:text-blue-400 text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#1D70F5] dark:text-blue-400" />
              <span>Export Excel</span>
            </button>

            {/* Add Customer Button */}
            <button
              onClick={onOpenQuickCapture}
              className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-4 py-2 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="max-w-6xl mx-auto mt-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, phone, company, interests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9FAFB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm text-[#111827] dark:text-slate-100 placeholder-[#9CA3AF] pl-9 pr-3 py-2 rounded border border-[#E5E7EB] dark:border-slate-700 focus:border-[#1D70F5] focus:outline-none"
              />
            </div>

            {/* Status dropdown with customized blue & white styling */}
            <CustomSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'prospect', label: 'Prospect' },
                { value: 'active', label: 'Active' },
                { value: 'follow-up', label: 'Follow-up' },
                { value: 'completed', label: 'Completed' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />

            {/* Attention Cadence Filter with customized blue & white styling */}
            <CustomSelect
              value={attentionFilter}
              onChange={(e) => setAttentionFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Attention Health' },
                { value: 'needs_attention', label: 'Needs Attention (Cadence due)' },
                { value: 'overdue', label: 'Overdue Actions' },
                { value: 'healthy', label: 'Healthy' },
              ]}
            />

            {/* Sort order with customized blue & white styling */}
            <CustomSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              options={[
                { value: 'nextAction', label: 'Sort: Next Action Date' },
                { value: 'lastContact', label: 'Sort: Last Contacted' },
                { value: 'name', label: 'Sort: Name (A-Z)' },
              ]}
            />
          </div>

          {/* Quick Tag Pills & Favorite Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                onlyFavorites
                  ? 'bg-amber-500 text-white border-amber-500 font-semibold'
                  : 'bg-white dark:bg-slate-800 text-[#4B5563] dark:text-slate-300 border-[#E5E7EB] dark:border-slate-700 hover:bg-[#F3F4F6] dark:hover:bg-slate-700'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Favorites</span>
            </button>

            <span className="text-[#9CA3AF] px-1">|</span>

            <button
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 rounded border cursor-pointer transition-colors ${
                selectedTag === 'all'
                  ? 'bg-[#1D70F5] text-white border-[#1D70F5] font-semibold'
                  : 'bg-white dark:bg-slate-800 text-[#4B5563] dark:text-slate-300 border-[#E5E7EB] dark:border-slate-700 hover:bg-[#F3F4F6] dark:hover:bg-slate-700'
              }`}
            >
              All Tags
            </button>

            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? 'all' : tag)}
                className={`px-2.5 py-1 rounded border whitespace-nowrap cursor-pointer transition-colors ${
                  selectedTag === tag
                    ? 'bg-[#1D70F5] text-white border-[#1D70F5] font-semibold'
                    : 'bg-white dark:bg-slate-800 text-[#4B5563] dark:text-slate-300 border-[#E5E7EB] dark:border-slate-700 hover:bg-[#F3F4F6] dark:hover:bg-slate-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer List Body */}
      <div className="max-w-6xl mx-auto px-0 sm:px-6 py-3 sm:py-5">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white dark:bg-[#1E293B] border-y sm:border border-[#E5E7EB] dark:border-slate-800 sm:rounded-md rounded-none p-10 text-center">
            <Users className="w-10 h-10 text-[#9CA3AF] mx-auto mb-2" />
            <h3 className="text-base font-semibold text-[#111827] dark:text-slate-100">No customers match your criteria</h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search terms or clearing your filters to see more results.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setAttentionFilter('all');
                setSelectedTag('all');
                setOnlyFavorites(false);
              }}
              className="mt-4 px-3 py-1.5 bg-[#F3F4F6] dark:bg-slate-800 hover:bg-[#E5E7EB] dark:hover:bg-slate-700 text-xs font-semibold text-[#111827] dark:text-slate-200 rounded cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1E293B] border-y sm:border border-[#E5E7EB] dark:border-slate-800 sm:rounded-md rounded-none overflow-hidden shadow-none sm:shadow-xs divide-y divide-[#E5E7EB] dark:divide-slate-800">
            {filteredCustomers.map((cust) => {
              const attention = calculateAttentionStatus(cust, pendingFollowUps);

              return (
                <div
                  key={cust.id}
                  onClick={() => onSelectCustomer(cust.id)}
                  className="p-4 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Favorite button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, cust)}
                        className="p-1 text-[#9CA3AF] hover:text-amber-500 shrink-0 cursor-pointer mt-0.5"
                        title={cust.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={`w-4 h-4 ${cust.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                      </button>

                      {/* Main Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-[#111827] dark:text-slate-100 hover:text-[#1D70F5] dark:hover:text-[#60A5FA]">
                            {cust.name}
                          </span>
                          <span className="text-xs text-[#6B7280] dark:text-slate-400">
                            {cust.phone}
                          </span>
                          {cust.company && (
                            <span className="text-xs text-[#4B5563] dark:text-slate-400 hidden md:inline">
                              • {cust.company}
                            </span>
                          )}

                          {/* Status Badge */}
                          <StatusBadge status={cust.status} />

                          {/* Attention indicator */}
                          {attention === 'overdue' ? (
                            <StatusBadge status="overdue" label="Overdue" />
                          ) : attention === 'needs_attention' ? (
                            <StatusBadge status="needs_attention" label="Needs Attention" />
                          ) : null}
                        </div>

                        {/* Interests & Last Interaction */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4B5563] dark:text-slate-300">
                          {cust.interests.length > 0 && (
                            <span className="text-[#1D70F5] dark:text-blue-400 font-medium">
                              {cust.interests.join(', ')}
                            </span>
                          )}

                          {cust.lastInteractionAt ? (
                            <span className="text-[#6B7280] dark:text-slate-400">
                              Last: {formatDate(cust.lastInteractionAt)}
                              {cust.lastInteractionSummary ? ` (${cust.lastInteractionSummary})` : ''}
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF] italic">No prior contact</span>
                          )}
                        </div>

                        {/* Next action preview */}
                        {cust.nextAction && (
                          <div className="mt-1.5 text-xs text-[#111827] dark:text-slate-200 flex items-center gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                              Next Action:
                            </span>
                            <span className="font-medium">
                              {cust.nextAction}
                            </span>
                            {cust.nextActionDate && (
                              <span className="text-[#1D70F5] dark:text-blue-400 font-semibold">
                                • {getRelativeDateLabel(cust.nextActionDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Quick Row Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {cust.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] bg-white transition-colors"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}

                      {cust.phone && (
                        <a
                          href={getWhatsAppUrl(cust.phone, `Hello ${cust.name}, following up regarding your services.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded text-[#111827] bg-white transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}

                      <button
                        onClick={() => onSelectCustomer(cust.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D70F5] hover:text-[#1B2CC1] hover:bg-[#1D70F5]/5 border border-[#1D70F5]/20 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Activity,
  Phone, 
  Calendar, 
  MessageCircle, 
  Mail, 
  FileText, 
  Filter, 
  Search,
  ChevronRight,
  Plus
} from 'lucide-react';
import { db } from '../../db';
import type { Interaction, Customer } from '../../types';
import { formatDate, formatTime } from '../../utils';

interface ActivityViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture
}) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      try {
        const [allInts, allCusts] = await Promise.all([
          db.interactions.toArray(),
          db.customers.toArray()
        ]);
        const cMap = new Map<string, Customer>();
        allCusts.forEach(c => cMap.set(c.id, c));
        setCustomersMap(cMap);
        setInteractions(allInts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (err) {
        console.error('Error loading activity:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadActivity();
  }, []);

  const filtered = interactions.filter((int) => {
    if (typeFilter !== 'all' && int.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cust = customersMap.get(int.customerId);
      const matchCust = cust?.name.toLowerCase().includes(q) || false;
      const matchSummary = int.summary.toLowerCase().includes(q);
      const matchOutcome = (int.outcome || '').toLowerCase().includes(q);
      if (!matchCust && !matchSummary && !matchOutcome) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA] dark:bg-[#0F172A] dark:text-slate-100">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Activity History ({filtered.length})
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Every touchpoint, call, meeting, and customer note in chronological order
            </p>
          </div>

          <button
            onClick={onOpenQuickCapture}
            className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-3.5 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Log Interaction</span>
          </button>
        </div>

        {/* Filters */}
        <div className="max-w-5xl mx-auto mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search discussion notes, outcomes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F9FAFB] focus:bg-white text-sm text-[#111827] placeholder-[#9CA3AF] pl-9 pr-3 py-2 rounded border border-[#E5E7EB] focus:border-[#1D70F5] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold select-none">
            {['all', 'call', 'meeting', 'whatsapp', 'email', 'note'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 rounded border cursor-pointer transition-colors capitalize whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-[#1D70F5] text-white border-[#1D70F5]'
                    : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                }`}
              >
                {t === 'all' ? 'All Activities' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-md p-10 text-center text-sm text-[#6B7280]">
            No interactions recorded matching the selected filter.
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs divide-y divide-[#E5E7EB]">
            {filtered.map((int) => {
              const customer = customersMap.get(int.customerId);

              return (
                <div key={int.id} className="p-4 hover:bg-[#F9FAFB] transition-colors flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-[#F3F4F6] flex items-center justify-center text-[#1D70F5] font-bold text-xs uppercase shrink-0 mt-0.5">
                    {int.type === 'call' && <Phone className="w-4 h-4 text-emerald-600" />}
                    {int.type === 'meeting' && <Calendar className="w-4 h-4 text-[#1D70F5]" />}
                    {int.type === 'whatsapp' && <MessageCircle className="w-4 h-4 text-emerald-600" />}
                    {int.type === 'email' && <Mail className="w-4 h-4 text-[#1D70F5]" />}
                    {int.type === 'note' && <FileText className="w-4 h-4 text-amber-600" />}
                    {int.type === 'other' && <Activity className="w-4 h-4 text-[#6B7280]" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectCustomer(int.customerId)}
                          className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] cursor-pointer"
                        >
                          {customer?.name || 'Customer'}
                        </button>
                        <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                          • {int.type}
                        </span>
                      </div>
                      <span className="text-xs text-[#9CA3AF] shrink-0">
                        {formatDate(int.date)} {int.time ? `at ${formatTime(int.time)}` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-[#374151] mt-1 leading-relaxed">
                      {int.summary}
                    </p>

                    {int.outcome && (
                      <div className="mt-1.5 p-2 bg-[#F9FAFB] rounded border border-[#E5E7EB] text-xs text-[#4B5563]">
                        <strong className="text-[#111827]">Outcome:</strong> {int.outcome}
                      </div>
                    )}

                    {int.nextActionNotes && (
                      <p className="text-[11px] text-[#1D70F5] font-medium mt-1">
                        Next Action: {int.nextActionNotes}
                      </p>
                    )}
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

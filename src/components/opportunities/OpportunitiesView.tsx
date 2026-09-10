import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  Plus, 
  ChevronRight, 
  Filter, 
  Columns, 
  List, 
  CheckCircle2, 
  XCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { Opportunity, Customer, OpportunityStage } from '../../types';
import { formatDate, formatCurrency } from '../../utils';
import { useAuth } from '../../context/AuthContext';

interface OpportunitiesViewProps {
  onSelectCustomer: (customerId: string) => void;
  onOpenQuickCapture: () => void;
}

const STAGES: { id: OpportunityStage; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { id: 'interested', label: 'Interested', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { id: 'proposal', label: 'Proposal', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'won', label: 'Won', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'lost', label: 'Lost', color: 'bg-red-50 text-red-800 border-red-200' }
];

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  onSelectCustomer,
  onOpenQuickCapture
}) => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [displayMode, setDisplayMode] = useState<'pipeline' | 'list'>('pipeline');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [opps, custs] = await Promise.all([
        db.opportunities.toArray(),
        db.customers.toArray()
      ]);
      const cMap = new Map<string, Customer>();
      custs.forEach(c => cMap.set(c.id, c));
      setCustomersMap(cMap);
      setOpportunities(opps.filter(o => !o.isArchived));
    } catch (err) {
      console.error('Error loading opportunities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Move stage
  const handleMoveStage = async (oppId: string, newStage: OpportunityStage) => {
    await db.opportunities.update(oppId, {
      stage: newStage,
      updatedAt: new Date().toISOString()
    });
    await queueMutation('update', 'opportunities', oppId, { stage: newStage });
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
  };

  // Pipeline total value calculation
  const totalPipelineValue = useMemo(() => {
    return opportunities
      .filter(o => o.stage !== 'lost')
      .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  }, [opportunities]);

  const activeCount = opportunities.filter(o => o.stage !== 'won' && o.stage !== 'lost').length;

  return (
    <div className="flex-1 overflow-y-auto pb-24 md:pb-12 bg-[#F5F7FA]">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Opportunities ({opportunities.length})
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Active Pipeline: <strong className="text-[#111827]">{formatCurrency(totalPipelineValue)}</strong> ({activeCount} active deals)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded text-xs font-semibold border border-[#E5E7EB]">
              <button
                onClick={() => setDisplayMode('pipeline')}
                className={`p-1.5 rounded cursor-pointer transition-colors ${
                  displayMode === 'pipeline' ? 'bg-white text-[#1D70F5] shadow-xs' : 'text-[#6B7280]'
                }`}
                title="Pipeline Kanban View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`p-1.5 rounded cursor-pointer transition-colors ${
                  displayMode === 'list' ? 'bg-white text-[#1D70F5] shadow-xs' : 'text-[#6B7280]'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onOpenQuickCapture}
              className="bg-[#1D70F5] hover:bg-[#1B2CC1] text-white text-xs font-semibold px-3.5 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Opportunity</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        {/* PIPELINE VIEW */}
        {displayMode === 'pipeline' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const stageDeals = opportunities.filter(o => o.stage === stage.id);
              const stageTotal = stageDeals.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

              return (
                <div
                  key={stage.id}
                  className="w-72 shrink-0 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] flex flex-col max-h-[75vh]"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-[#E5E7EB] bg-white rounded-t-md flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-[#111827] uppercase tracking-wider">
                        {stage.label} ({stageDeals.length})
                      </span>
                      <span className="block text-[11px] text-[#6B7280] font-medium mt-0.5">
                        {formatCurrency(stageTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {stageDeals.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#9CA3AF]">
                        No deals in {stage.label}
                      </div>
                    ) : (
                      stageDeals.map((opp) => {
                        const customer = customersMap.get(opp.customerId);
                        return (
                          <div
                            key={opp.id}
                            className="bg-white p-3 rounded border border-[#E5E7EB] shadow-xs hover:border-[#1D70F5] transition-colors space-y-2"
                          >
                            <div>
                              <button
                                onClick={() => onSelectCustomer(opp.customerId)}
                                className="font-bold text-xs text-[#1D70F5] hover:underline block truncate text-left cursor-pointer"
                              >
                                {customer?.name || 'Customer'}
                              </button>
                              <h4 className="font-semibold text-xs text-[#111827] mt-0.5 line-clamp-2">
                                {opp.title}
                              </h4>
                              <p className="text-[11px] text-[#6B7280] mt-0.5">{opp.product}</p>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
                              <span className="text-xs font-bold text-[#111827]">
                                {formatCurrency(opp.estimatedValue)}
                              </span>
                              <span className="text-[10px] text-[#6B7280]">
                                {formatDate(opp.expectedCloseDate)}
                              </span>
                            </div>

                            {/* Quick Stage Mover */}
                            <div className="flex items-center justify-between gap-1 pt-1">
                              <select
                                value={opp.stage}
                                onChange={(e) => handleMoveStage(opp.id, e.target.value as OpportunityStage)}
                                className="text-[10px] font-semibold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-1.5 py-0.5 text-[#4B5563] cursor-pointer"
                              >
                                {STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>

                              {opp.nextAction && (
                                <span className="text-[10px] text-[#6B7280] truncate max-w-[110px]" title={opp.nextAction}>
                                  {opp.nextAction}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE LIST VIEW */
          <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden shadow-xs divide-y divide-[#E5E7EB]">
            {opportunities.map((opp) => {
              const customer = customersMap.get(opp.customerId);
              return (
                <div key={opp.id} className="p-4 hover:bg-[#F9FAFB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => onSelectCustomer(opp.customerId)}
                      className="font-bold text-sm text-[#111827] hover:text-[#1D70F5] cursor-pointer text-left"
                    >
                      {customer?.name || 'Customer'} — {opp.title}
                    </button>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {opp.product} • Close target: {formatDate(opp.expectedCloseDate)}
                    </p>
                    {opp.notes && <p className="text-[11px] text-[#4B5563] mt-0.5">{opp.notes}</p>}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="text-sm font-bold text-[#111827]">
                      {formatCurrency(opp.estimatedValue)}
                    </span>
                    <select
                      value={opp.stage}
                      onChange={(e) => handleMoveStage(opp.id, e.target.value as OpportunityStage)}
                      className="text-xs font-semibold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 text-[#111827] capitalize cursor-pointer"
                    >
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
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

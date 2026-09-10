import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  MessageCircle, 
  Mail, 
  Send, 
  Copy, 
  Check, 
  Smartphone 
} from 'lucide-react';
import { db } from '../../db';
import type { Customer, MessageTemplate, Appointment } from '../../types';
import { renderTemplate, getWhatsAppUrl, getEmailUrl, getSmsUrl, formatDate, formatTime } from '../../utils';
import { useAuth } from '../../context/AuthContext';

interface MessageTemplateModalProps {
  customer: Customer | null;
  appointment?: Appointment | null;
  onClose: () => void;
}

export const MessageTemplateModal: React.FC<MessageTemplateModalProps> = ({
  customer,
  appointment,
  onClose
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      const tmpls = await db.templates.toArray();
      setTemplates(tmpls);
      if (tmpls.length > 0) {
        setSelectedTemplateId(tmpls[0].id);
        fillBody(tmpls[0]);
      }
    }
    loadTemplates();
  }, [customer, appointment]);

  const fillBody = (tmpl: MessageTemplate) => {
    if (!customer) return;
    const filled = renderTemplate(tmpl.content, {
      customer_name: customer.name,
      appointment_date: appointment ? formatDate(appointment.date) : 'our scheduled date',
      appointment_time: appointment ? formatTime(appointment.startTime) : 'scheduled time',
      product: customer.interests[0] || 'service package',
      location: appointment?.locationAddress || appointment?.locationType || 'our office',
      user_name: user?.name || 'Your Advisor'
    });
    setMessageBody(filled);
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) fillBody(tmpl);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-lg overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#1D70F5] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <div>
              <h2 className="font-bold text-base tracking-tight leading-tight">Send Message Template</h2>
              <p className="text-[11px] text-white/80">Personalized for {customer.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-sm">
          {/* Template Selection Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5">
              Select Template
            </label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors border ${
                    selectedTemplateId === t.id
                      ? 'bg-[#1D70F5] text-white border-[#1D70F5]'
                      : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">
                Review / Edit Message
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-[#1D70F5] hover:text-[#1B2CC1] inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy text'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none leading-relaxed"
            />
            <p className="text-[11px] text-[#6B7280] mt-1">
              Preview before launching app. You can modify any text here.
            </p>
          </div>

          {/* Launch Buttons */}
          <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] block">
              Send via Device App
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* WhatsApp */}
              <a
                href={getWhatsAppUrl(customer.phone, messageBody)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Open WhatsApp</span>
              </a>

              {/* Email */}
              <a
                href={customer.email ? getEmailUrl(customer.email, 'ClientFlow Update', messageBody) : '#'}
                onClick={(e) => {
                  if (!customer.email) {
                    e.preventDefault();
                    alert('No email address registered for this customer.');
                  }
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1D70F5] hover:bg-[#1B2CC1] text-white rounded text-xs font-semibold transition-colors ${
                  !customer.email ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Open Email</span>
              </a>

              {/* SMS */}
              <a
                href={getSmsUrl(customer.phone, messageBody)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#374151] hover:bg-[#111827] text-white rounded text-xs font-semibold transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open SMS</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

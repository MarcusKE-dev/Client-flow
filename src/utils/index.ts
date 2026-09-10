import type { Customer, FollowUp, Appointment } from '../types';

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not set';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${m < 10 ? '0' + m : m} ${period}`;
  } catch {
    return timeStr;
  }
}

export function getRelativeDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const target = new Date(dateStr + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const diffDays = Math.round((target.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

  return formatDate(dateStr);
}

export function getDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - target.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateAttentionStatus(
  customer: Customer,
  pendingFollowUps: FollowUp[] = []
): 'healthy' | 'needs_attention' | 'overdue' {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Check if there is an overdue follow-up for this customer
  const hasOverdueFollowUp = pendingFollowUps.some(
    f => f.customerId === customer.id && f.status === 'pending' && f.dueDate < todayStr
  );
  if (hasOverdueFollowUp) return 'overdue';

  if (customer.nextActionDate && customer.nextActionDate < todayStr) {
    return 'overdue';
  }

  // Check cadence
  const daysSince = getDaysSince(customer.lastInteractionAt);
  const cadence = customer.cadenceDays || 30;

  if (daysSince !== null && daysSince > cadence && !customer.nextActionDate) {
    return 'needs_attention';
  }

  if (!customer.nextActionDate && !customer.lastInteractionAt) {
    return 'needs_attention';
  }

  return 'healthy';
}

// Clean phone for tel: and wa.me/
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function getWhatsAppUrl(phone: string, text: string = ''): string {
  let clean = cleanPhoneNumber(phone);
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  } else if (clean.startsWith('0')) {
    // Default Kenyan standard assumption if starts with 07xx
    clean = '254' + clean.substring(1);
  }
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${clean}${text ? '?text=' + encodedText : ''}`;
}

export function getSmsUrl(phone: string, text: string = ''): string {
  const clean = cleanPhoneNumber(phone);
  return `sms:${clean}${text ? '?body=' + encodeURIComponent(text) : ''}`;
}

export function getEmailUrl(email: string, subject: string = '', body: string = ''): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getMapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// iCalendar (.ics) export generator
export function generateIcsFile(appointment: Appointment, customerName: string): string {
  const dateCompact = appointment.date.replace(/-/g, '');
  const startTimeCompact = (appointment.startTime || '09:00').replace(':', '') + '00';
  const endTimeCompact = (appointment.endTime || '10:00').replace(':', '') + '00';
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClientFlow//Personal CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@clientflow.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dateCompact}T${startTimeCompact}`,
    `DTEND:${dateCompact}T${endTimeCompact}`,
    `SUMMARY:${appointment.title} - ${customerName}`,
    `DESCRIPTION:${appointment.purpose || ''}\\n${appointment.notes || ''}`,
    `LOCATION:${appointment.locationAddress || appointment.locationType}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
}

export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Fill message templates
export function renderTemplate(
  content: string,
  variables: {
    customer_name?: string;
    appointment_date?: string;
    appointment_time?: string;
    product?: string;
    location?: string;
    user_name?: string;
  }
): string {
  let result = content;
  result = result.replace(/\{customer_name\}/g, variables.customer_name || 'Customer');
  result = result.replace(/\{appointment_date\}/g, variables.appointment_date || 'our scheduled date');
  result = result.replace(/\{appointment_time\}/g, variables.appointment_time || 'scheduled time');
  result = result.replace(/\{product\}/g, variables.product || 'your service');
  result = result.replace(/\{location\}/g, variables.location || 'our meeting venue');
  result = result.replace(/\{user_name\}/g, variables.user_name || 'Your Advisor');
  return result;
}

// Currency / Number formatting
export function formatCurrency(amount: number, currency: string = 'KES'): string {
  if (!amount && amount !== 0) return 'KES 0';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
}

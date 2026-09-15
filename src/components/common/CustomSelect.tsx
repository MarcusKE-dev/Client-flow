import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: (SelectOption | string)[];
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  selectClassName?: string;
  label?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  className = '',
  selectClassName = '',
  label,
  id,
  disabled,
  ...rest
}) => {
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div className={`relative inline-block ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-[#111827] dark:text-slate-200 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`appearance-none w-full bg-white dark:bg-[#1E293B] text-[#111827] dark:text-[#F8FAFC] border border-[#1D70F5] hover:border-[#1557BF] focus:border-[#1D70F5] focus:ring-2 focus:ring-[#1D70F5]/25 text-xs font-semibold pl-3 pr-8 py-2 rounded-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${selectClassName}`.trim()}
          style={{ colorScheme: 'light dark' }}
          {...rest}
        >
          {normalizedOptions.map((opt) => (
            <option
              key={String(opt.value)}
              value={opt.value}
              className="bg-white dark:bg-[#1E293B] text-[#111827] dark:text-[#F8FAFC] py-1"
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#1D70F5]">
          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
};

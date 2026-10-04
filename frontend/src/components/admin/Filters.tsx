import { useEffect, useState, type ReactNode } from "react";
import { SearchIcon } from "lucide-react";
import { number } from "../../pages/admin/lib/format";
import ui from "./ui.module.css";

interface SearchInputProps { value: string; onChange: (value: string) => void; placeholder: string; label: string }

// Debounced so the API isn't called on every keystroke.
export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  const [text, setText] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    // The value changed from outside (header search, cleared filters): show it.
    setPrevious(value);
    if (value !== text.trim()) setText(value);
  }
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className={ui.search}>
      <SearchIcon aria-hidden="true" />
      <input type="search" className={ui.input} value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

interface SelectProps { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[] }

export function Select({ value, onChange, label, options }: SelectProps) {
  return (
    <select className={ui.select} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

interface TabsProps<T extends string> { value: T; onChange: (value: T) => void; label: string; tabs: { value: T; label: string; count?: number }[] }

export function Tabs<T extends string>({ value, onChange, label, tabs }: TabsProps<T>) {
  return (
    <div className={ui.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={tab.value === value} className={`${ui.tab} ${tab.value === value ? ui.tabActive : ""}`} onClick={() => onChange(tab.value)}>
          {tab.label}
          {tab.count !== undefined && <span className={ui.tabCount}>{number(tab.count)}</span>}
        </button>
      ))}
    </div>
  );
}

interface SegmentedProps<T extends string> { value: T; onChange: (value: T) => void; label: string; options: { value: T; label: string }[] }

export function Segmented<T extends string>({ value, onChange, label, options }: SegmentedProps<T>) {
  return (
    <div className={ui.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} className={`${ui.segment} ${option.value === value ? ui.segmentActive : ""}`} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return <div className={ui.toolbar}>{children}{end && <div className={ui.toolbarEnd}>{end}</div>}</div>;
}

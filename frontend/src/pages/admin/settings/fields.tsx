import { useId, type ReactNode } from "react";
import { CircleCheckIcon, CircleDotIcon, LoaderCircleIcon, SaveIcon } from "lucide-react";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** Suggestions shown as the admin types (links). */
  options?: { value: string; label: string }[];
  className?: string;
}

// A labelled text input with a character count, help text and an error message.
export function TextField({ label, value, onChange, max, hint, error, optional, multiline, placeholder, options, className = "" }: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const shared = {
    id, value, placeholder, maxLength: max,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? noteId : undefined,
  };
  return (
    <div className={`${ui.field} ${className}`}>
      <div className={s.labelRow}>
        <label htmlFor={id} className={ui.label}>{label}{optional && <span className={ui.optional}> (optional)</span>}</label>
        <span className={`${s.counter} ${value.length >= max ? s.counterOver : ""}`} aria-hidden="true">{value.length}/{max}</span>
      </div>
      {multiline
        ? <textarea {...shared} rows={3} className={`${ui.textarea} ${error ? s.invalid : ""}`} style={{ minHeight: 84 }} onChange={(event) => onChange(event.target.value)} />
        : <input {...shared} type="text" list={options ? `${id}-options` : undefined} className={`${ui.input} ${error ? s.invalid : ""}`} onChange={(event) => onChange(event.target.value)} />}
      {options && <datalist id={`${id}-options`}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>}
      {error ? <span id={noteId} className={s.error}>{error}</span> : hint && <span id={noteId} className={ui.hint}>{hint}</span>}
    </div>
  );
}

// "Shown on the store" style on/off switch.
export function SwitchField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={ui.switchRow}>
      <span className={ui.cellStack}>
        <span className={ui.cellPrimary}>{label}</span>
        {hint && <span className={ui.cellSecondary}>{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className={ui.switch} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

// A titled box that groups related fields (e.g. a button's text and link).
export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className={s.group}>
      <legend className="sr-only">{title}</legend>
      <p className={s.groupTitle} aria-hidden="true">{title}</p>
      {children}
    </fieldset>
  );
}

// Ends each section; while there are unsaved changes it stays pinned to the bottom of the screen.
export function SaveBar({ dirty, saving, onSave, onDiscard, label = "Save changes" }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; label?: string }) {
  return (
    <div className={`${s.saveBar} ${dirty || saving ? s.saveBarPinned : ""}`}>
      <span className={`${s.saveState} ${dirty ? s.saveStateDirty : ""}`} role="status">
        {dirty ? <><CircleDotIcon aria-hidden="true" /> Unsaved changes</> : <><CircleCheckIcon aria-hidden="true" /> All changes saved</>}
      </span>
      <div className={s.saveButtons}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onDiscard} disabled={!dirty || saving}>Discard</button>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onSave} disabled={!dirty || saving}>
          {saving ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <SaveIcon aria-hidden="true" />} {saving ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}

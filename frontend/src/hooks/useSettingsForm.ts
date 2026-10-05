import { useEffect } from 'react';
export type FormState = (dirty: boolean, busy: boolean) => void;
export function useFormState(dirty: boolean, busy: boolean, onState: FormState) {
  useEffect(() => onState(dirty, busy), [dirty, busy, onState]);
}

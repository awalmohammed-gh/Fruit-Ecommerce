import { useState } from "react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import { SaveBar, TextField } from "./fields";
import { useContentDraft, type SectionProps } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";

export default function StoreSettings(props: SectionProps) {
  const { draft, setDraft, dirty, saving, save, discard } = useContentDraft("store", ["store"], props);
  const [checked, setChecked] = useState(false);
  const store = draft.store;
  const set = (patch: Partial<typeof store>) => setDraft((previous) => ({ store: { ...previous.store, ...patch } }));
  const emailProblem = store.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email.trim()) ? "Enter a valid email address" : undefined;
  const phoneProblem = store.phone && !/^[+\d\s().-]{7,25}$/.test(store.phone.trim()) ? "Enter a valid phone number" : undefined;

  const onSave = () => {
    setChecked(true);
    if (emailProblem || phoneProblem) return void toast.error("Some fields need attention");
    void save();
  };

  return (
    <>
      <Panel id="store-about" title="About the store" description="Shown in the footer of every store page.">
        <TextField label="Short description" multiline value={store.description} onChange={(description) => set({ description })} max={300} hint="One or two sentences under the GreenFarm name." />
      </Panel>
      <Panel id="store-contact" title="Contact details" description="How shoppers reach you. Shown in the footer's Contact Us column; leave a field empty to hide it.">
        <div className={ui.formGrid}>
          <TextField label="Address" optional value={store.address} onChange={(address) => set({ address })} max={160} placeholder="Spintex Road, Accra, Ghana" className={ui.span2} />
          <TextField label="Phone" optional value={store.phone} onChange={(phone) => set({ phone })} max={25} placeholder="024 152 9904" error={checked ? phoneProblem : undefined} hint="Tapping it on a phone starts a call." />
          <TextField label="Email" optional value={store.email} onChange={(email) => set({ email })} max={254} placeholder="info@greenfarm.com" error={checked ? emailProblem : undefined} hint="Also used for the footer's Help Center link." />
        </div>
      </Panel>
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => { discard(); setChecked(false); }} />
    </>
  );
}

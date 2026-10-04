import { useState } from "react";
import { LeafIcon, MapPinIcon, ShoppingBagIcon, TruckIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import type { SectionHeading } from "../../../frontApisRoute/content";
import { FieldGroup, SaveBar, TextField } from "./fields";
import { useContentDraft, type SectionProps } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

// The four highlights keep their icons (in this order) on the storefront.
const ICONS = [LeafIcon, TruckIcon, ShoppingBagIcon, MapPinIcon];

function HeadingFields({ value, onChange, checked }: { value: SectionHeading; onChange: (patch: Partial<SectionHeading>) => void; checked: boolean }) {
  return (
    <div className={ui.formGrid}>
      <TextField label="Small heading" optional value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} max={60} hint="Orange capitals above the heading." />
      <TextField label="Heading" value={value.heading} onChange={(heading) => onChange({ heading })} max={80} error={checked && !value.heading.trim() ? "Add a heading" : undefined} />
      <TextField label="Description" optional value={value.description} onChange={(description) => onChange({ description })} max={200} className={ui.span2} />
    </div>
  );
}

export default function HomepageSettings(props: SectionProps) {
  const { draft, setDraft, dirty, saving, save, discard } = useContentDraft("homepage", ["sections"], props);
  const [checked, setChecked] = useState(false);
  const { features, categories, popular } = draft.sections;
  const setSections = (patch: Partial<typeof draft.sections>) => setDraft((previous) => ({ sections: { ...previous.sections, ...patch } }));

  const onSave = () => {
    setChecked(true);
    if (features.some((feature) => !feature.title.trim()) || !categories.heading.trim() || !popular.heading.trim()) return void toast.error("Some fields need attention");
    void save();
  };

  return (
    <>
      <Panel id="home-highlights" title="Store highlights" description="The four short points in the white strip under the hero.">
        <div className={s.fields}>
          {features.map((feature, index) => {
            const Icon = ICONS[index]!;
            const update = (patch: Partial<typeof feature>) => setSections({ features: features.map((item, at) => (at === index ? { ...item, ...patch } : item)) });
            return (
              <div key={index} className={s.highlight}>
                <span className={s.highlightIcon} aria-hidden="true"><Icon /></span>
                <TextField label={`Highlight ${index + 1}`} value={feature.title} onChange={(title) => update({ title })} max={40} error={checked && !feature.title.trim() ? "Add a title" : undefined} />
                <TextField label="Short description" optional value={feature.description} onChange={(description) => update({ description })} max={80} />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel id="home-headings" title="Section headings" description="The headings above the product sections on the homepage.">
        <div className={s.fields}>
          <FieldGroup title="Shop by category">
            <HeadingFields value={categories} checked={checked} onChange={(patch) => setSections({ categories: { ...categories, ...patch } })} />
          </FieldGroup>
          <FieldGroup title="Popular products">
            <HeadingFields value={popular} checked={checked} onChange={(patch) => setSections({ popular: { ...popular, ...patch } })} />
          </FieldGroup>
        </div>
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => { discard(); setChecked(false); }} />
    </>
  );
}

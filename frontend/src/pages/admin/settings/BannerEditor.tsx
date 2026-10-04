import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import toast, { errorMessage } from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import ScaledPreview from "../../../components/admin/ScaledPreview";
import { BannerCard } from "../../../components/landing/PromoBanner";
import { contentAdminApi, PLACEMENTS, type AdminBanner, type BannerInput } from "../../../frontApisRoute/content";
import { refreshSiteContent } from "../../../hooks/useSiteContent";
import { useCategories } from "../lib/useCategories";
import { FieldGroup, SwitchField, TextField } from "./fields";
import ImageField from "./ImageField";
import { bannerProblems, hasProblems, LINK_HINT } from "./checks";
import { useLinkOptions } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

const BANNER_SIZE = { width: 800, height: 530 };
const EMPTY: BannerInput = {
  name: "", placement: "home-top", category: "", badge: "", title: "", highlight: "", description: "", image: "",
  buttonText: "", buttonLink: "", active: false, startsAt: null, endsAt: null,
};

// Dates are picked as whole days: a banner starts at the beginning of its start day and ends after its end day.
const dayInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const fromDay = (day: string, end: boolean) => (day ? new Date(`${day}T${end ? "23:59:59" : "00:00:00"}`).toISOString() : null);

// The banner as shoppers would see it, scaled down.
export function BannerPreview({ banner }: { banner: Pick<BannerInput, "badge" | "title" | "highlight" | "description" | "image" | "buttonText" | "buttonLink"> }) {
  return (
    <ScaledPreview width={1200} height={banner.image ? 460 : 340}>
      <div style={{ padding: 24 }}><BannerCard banner={{ ...banner, title: banner.title || "Banner title" }} /></div>
    </ScaledPreview>
  );
}

export default function BannerEditor({ banner, onClose, onSaved }: { banner: AdminBanner | null; onClose: () => void; onSaved: (banner: AdminBanner) => void }) {
  const [form, setForm] = useState<BannerInput>(() => {
    if (!banner) return EMPTY;
    const { _id, createdAt, updatedAt, ...input } = banner;
    void _id; void createdAt; void updatedAt;
    return input;
  });
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories = useCategories();
  const links = useLinkOptions();
  const set = (patch: Partial<BannerInput>) => setForm((previous) => ({ ...previous, ...patch }));
  const problems = checked ? bannerProblems(form) : {};

  const submit = async () => {
    setChecked(true);
    if (hasProblems(bannerProblems(form))) return void toast.error("Some fields need attention");
    setSaving(true);
    try {
      const result = banner ? await contentAdminApi.updateBanner(banner._id, form) : await contentAdminApi.createBanner(form);
      toast.success(result.message);
      refreshSiteContent();
      onSaved(result.banner);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save the banner"));
    } finally {
      setSaving(false);
    }
  };

  const placement = PLACEMENTS.find((item) => item.value === form.placement)!;
  return (
    <Modal open wide busy={saving} onClose={onClose} title={banner ? "Edit banner" : "Add banner"} description="Changes go live when you save, if the banner is active."
      footer={<>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={submit} disabled={saving}>
          {saving && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />}{banner ? "Update banner" : "Save banner"}
        </button>
      </>}>
      <div className={s.fields}>
        <BannerPreview banner={form} />
        <TextField label="Banner name" value={form.name} onChange={(name) => set({ name })} max={80} placeholder="Weekend dairy promo" hint="Only you see this, in the banner list." error={problems.name} />
        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label htmlFor="banner-placement" className={ui.label}>Placement</label>
            <select id="banner-placement" className={ui.select} value={form.placement} onChange={(event) => set({ placement: event.target.value as BannerInput["placement"] })}>
              {PLACEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <span className={ui.hint}>{placement.where}.</span>
          </div>
          {form.placement === "category" && (
            <div className={ui.field}>
              <label htmlFor="banner-category" className={ui.label}>Category</label>
              <select id="banner-category" className={ui.select} value={form.category} onChange={(event) => set({ category: event.target.value })}>
                <option value="">Every category</option>
                {categories.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <ImageField label="Image" optional value={form.image} onChange={(image) => set({ image })} recommended={BANNER_SIZE} fit="contain"
          note="A cut-out PNG with a transparent background suits the green banner best." />
        <div className={ui.formGrid}>
          <TextField label="Badge" optional value={form.badge} onChange={(badge) => set({ badge })} max={40} placeholder="This week only" />
          <TextField label="Title" value={form.title} onChange={(title) => set({ title })} max={90} placeholder="Your weekly shop." error={problems.title} />
          <TextField label="Highlighted text" optional value={form.highlight} onChange={(highlight) => set({ highlight })} max={60} placeholder="Without the trip." hint="Shown in orange on the next line." className={ui.span2} />
          <TextField label="Description" optional multiline value={form.description} onChange={(description) => set({ description })} max={240} className={ui.span2} />
        </div>
        <FieldGroup title="Button">
          <div className={ui.formGrid}>
            <TextField label="Button text" optional value={form.buttonText} onChange={(buttonText) => set({ buttonText })} max={30} placeholder="Start shopping" error={problems.buttonText} />
            <TextField label="Button link" optional value={form.buttonLink} onChange={(buttonLink) => set({ buttonLink })} max={300} placeholder="/products" options={links} hint={LINK_HINT} error={problems.buttonLink} />
          </div>
        </FieldGroup>
        <FieldGroup title="Status and schedule">
          <SwitchField label="Active" hint="Keep it off while you prepare it. Only active banners show on the store." checked={form.active} onChange={(active) => set({ active })} />
          <div className={ui.formGrid}>
            <div className={ui.field}>
              <label htmlFor="banner-start" className={ui.label}>Start date <span className={ui.optional}>(optional)</span></label>
              <input id="banner-start" type="date" className={ui.input} value={dayInput(form.startsAt)} onChange={(event) => set({ startsAt: fromDay(event.target.value, false) })} />
            </div>
            <div className={ui.field}>
              <label htmlFor="banner-end" className={ui.label}>End date <span className={ui.optional}>(optional)</span></label>
              <input id="banner-end" type="date" className={`${ui.input} ${problems.endsAt ? s.invalid : ""}`} value={dayInput(form.endsAt)} min={dayInput(form.startsAt) || undefined}
                onChange={(event) => set({ endsAt: fromDay(event.target.value, true) })} aria-invalid={problems.endsAt ? true : undefined} />
              {problems.endsAt ? <span className={s.error}>{problems.endsAt}</span> : <span className={ui.hint}>Shown until the end of this day.</span>}
            </div>
          </div>
        </FieldGroup>
      </div>
    </Modal>
  );
}

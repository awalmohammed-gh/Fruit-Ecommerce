import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import { SaveBar, TextField } from "./fields";
import ImageField from "./ImageField";
import { useContentDraft, type SectionProps } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

const SHARE_SIZE = { width: 1200, height: 630 };

// Site-wide search and sharing defaults. Products and categories have their own optional SEO fields;
// anything left empty there falls back to these.
export default function SeoSettings(props: SectionProps) {
  const { draft, setDraft, dirty, saving, save, discard } = useContentDraft("seo", ["seo"], props);
  const [checked, setChecked] = useState(false);
  const seo = draft.seo;
  const set = (patch: Partial<typeof seo>) => setDraft((previous) => ({ seo: { ...previous.seo, ...patch } }));
  const missing = (value: string, label: string) => (checked && !value.trim() ? `Add ${label}` : undefined);

  const onSave = () => {
    setChecked(true);
    if (!seo.siteName.trim() || !seo.defaultTitle.trim() || !seo.defaultDescription.trim()) return void toast.error("Some fields need attention");
    void save();
  };

  return (
    <>
      <div className={s.split}>
        <div className={s.stack}>
          <Panel id="seo-defaults" title="Search engines" description="The homepage's title and description on Google, and the name used in every page title.">
            <div className={s.fields}>
              <TextField label="Site name" value={seo.siteName} onChange={(siteName) => set({ siteName })} max={60} placeholder="GreenFarm"
                hint={`Added to page titles, e.g. “Cheese 200g | ${seo.siteName || "GreenFarm"}”.`} error={missing(seo.siteName, "the site name")} />
              <TextField label="Homepage title" value={seo.defaultTitle} onChange={(defaultTitle) => set({ defaultTitle })} max={70} placeholder="GreenFarm | Fresh Groceries Delivered in Accra"
                hint="Around 50–60 characters shows in full on Google." error={missing(seo.defaultTitle, "a title")} />
              <TextField label="Default description" multiline value={seo.defaultDescription} onChange={(defaultDescription) => set({ defaultDescription })} max={160}
                hint="Used on the homepage, and for pages that have no description of their own." error={missing(seo.defaultDescription, "a description")} />
            </div>
          </Panel>
          <Panel id="seo-sharing" title="Sharing image" description="Shown when the homepage, or a page without its own picture, is shared on WhatsApp, Facebook, LinkedIn or X.">
            <ImageField label="Sharing image" optional value={seo.socialImage} onChange={(socialImage) => set({ socialImage })} recommended={SHARE_SIZE}
              note="Products use their own photo and categories their own image when they have one." />
          </Panel>
        </div>

        <div className={s.sticky}>
          <Panel id="seo-preview" title="Preview" description="How the homepage appears in search results and shared links.">
            <div className={s.fields}>
              <div className={s.searchPreview} role="img" aria-label="Search result preview">
                <span className={s.searchUrl}>{window.location.host}</span>
                <span className={s.searchTitle}>{seo.defaultTitle || "Homepage title"}</span>
                <span className={s.searchText}>{seo.defaultDescription || "Default description"}</span>
              </div>
              <div className={s.shareCard} role="img" aria-label="Shared link preview">
                {seo.socialImage ? <img src={seo.socialImage} alt="" className={s.shareImage} /> : <span className={s.shareImage} aria-hidden="true" />}
                <span className={s.shareBody}>
                  <span className={s.shareHost}>{window.location.host}</span>
                  <strong>{seo.defaultTitle || "Homepage title"}</strong>
                  <span>{seo.defaultDescription}</span>
                </span>
              </div>
              <a className={`${ui.button} ${ui.secondary} ${ui.small}`} style={{ alignSelf: "flex-start" }} href="/sitemap.xml" target="_blank" rel="noreferrer">
                View sitemap <ExternalLinkIcon aria-hidden="true" />
              </a>
            </div>
          </Panel>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => { discard(); setChecked(false); }} />
    </>
  );
}

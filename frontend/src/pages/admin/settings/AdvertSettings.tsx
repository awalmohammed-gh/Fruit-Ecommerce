import { useState } from "react";
import { EyeOffIcon, PlusIcon, XIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import Badge from "../../../components/admin/Badge";
import ScaledPreview from "../../../components/admin/ScaledPreview";
import { AnnouncementBar } from "../../../components/common/Banner";
import { PartnerCalloutView } from "../../../components/landing/PartnerCallout";
import { NewsletterView } from "../../../components/landing/Newsletter";
import type { Advert } from "../../../frontApisRoute/content";
import { FieldGroup, SaveBar, SwitchField, TextField } from "./fields";
import ImageField from "./ImageField";
import { advertProblems, hasProblems, LINK_HINT, type Problems } from "./checks";
import { useContentDraft, useLinkOptions, type SectionProps } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

const AD_IMAGE = { width: 600, height: 600 };

function Hidden({ what }: { what: string }) {
  return <p className={s.previewNote}><EyeOffIcon aria-hidden="true" /> {what} is turned off, so shoppers won't see it.</p>;
}

// The editable parts of one advertisement block.
function AdvertForm({ ad, onChange, problems, pointsLabel }: { ad: Advert; onChange: (patch: Partial<Advert>) => void; problems: Problems<Advert>; pointsLabel?: string }) {
  const links = useLinkOptions();
  return (
    <div className={s.fields}>
      <SwitchField label="Show on the homepage" checked={ad.active} onChange={(active) => onChange({ active })} />
      <div className={ui.formGrid}>
        <TextField label="Subtitle" optional value={ad.label} onChange={(label) => onChange({ label })} max={60} hint="The small line above the title." />
        <TextField label="Title" value={ad.title} onChange={(title) => onChange({ title })} max={90} error={problems.title} />
        <TextField label="Description" optional multiline value={ad.description} onChange={(description) => onChange({ description })} max={300} className={ui.span2} />
      </div>
      {pointsLabel && (
        <div className={ui.field}>
          <span className={ui.label}>{pointsLabel} <span className={ui.optional}>(optional, up to 4)</span></span>
          <div className={s.points}>
            {ad.points.map((point, index) => (
              <div key={index} className={s.point}>
                <input className={`${ui.input} ${s.pointInput}`} value={point} maxLength={60} aria-label={`Point ${index + 1}`}
                  onChange={(event) => onChange({ points: ad.points.map((item, at) => (at === index ? event.target.value : item)) })} />
                <button type="button" className={ui.iconButton} aria-label={`Remove point ${index + 1}`} onClick={() => onChange({ points: ad.points.filter((_, at) => at !== index) })}><XIcon aria-hidden="true" /></button>
              </div>
            ))}
            {ad.points.length < 4 && (
              <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} style={{ alignSelf: "flex-start" }} onClick={() => onChange({ points: [...ad.points, ""] })}><PlusIcon aria-hidden="true" /> Add point</button>
            )}
          </div>
        </div>
      )}
      <FieldGroup title="Call to action">
        <div className={ui.formGrid}>
          <TextField label="Button text" optional value={ad.ctaText} onChange={(ctaText) => onChange({ ctaText })} max={30} error={problems.ctaText} />
          <TextField label="Button link" optional value={ad.ctaLink} onChange={(ctaLink) => onChange({ ctaLink })} max={300} options={links} hint={LINK_HINT} error={problems.ctaLink} />
        </div>
      </FieldGroup>
      <ImageField label="Image" optional value={ad.image} onChange={(image) => onChange({ image })} recommended={AD_IMAGE} fit="contain" note="Shown beside the button." />
    </div>
  );
}

export default function AdvertSettings(props: SectionProps) {
  const { draft, setDraft, dirty, saving, save, discard } = useContentDraft("ads", ["announcement", "ads"], props);
  const [checked, setChecked] = useState(false);
  const { announcement, ads } = draft;
  const setAnnouncement = (patch: Partial<typeof announcement>) => setDraft((previous) => ({ ...previous, announcement: { ...previous.announcement, ...patch } }));
  const setAd = (key: "partner" | "newsletter") => (patch: Partial<Advert>) =>
    setDraft((previous) => ({ ...previous, ads: { ...previous.ads, [key]: { ...previous.ads[key], ...patch } } }));

  const announcementProblem = checked && announcement.active && !announcement.message.trim() ? "Add a message" : undefined;
  const partnerProblems = checked ? advertProblems(ads.partner) : {};
  const newsletterProblems = checked ? advertProblems(ads.newsletter) : {};

  const onSave = () => {
    setChecked(true);
    const emptyPoint = [...ads.partner.points, ...ads.newsletter.points].some((point) => !point.trim());
    if ((announcement.active && !announcement.message.trim()) || hasProblems(advertProblems(ads.partner)) || hasProblems(advertProblems(ads.newsletter)))
      return void toast.error("Some fields need attention");
    if (emptyPoint) return void toast.error("Fill in or remove the empty point");
    void save();
  };

  return (
    <>
      <Panel id="ads-announcement" title="Announcement bar" description="The thin green bar above every store page. Shoppers can close it for their visit."
        actions={<Badge tone={announcement.active ? "success" : "neutral"}>{announcement.active ? "Active" : "Off"}</Badge>}>
        <div className={s.fields}>
          {announcement.active
            ? <ScaledPreview height={40}><AnnouncementBar announcement={{ message: announcement.message || "Your message", secondary: announcement.secondary }} /></ScaledPreview>
            : <Hidden what="The announcement bar" />}
          <SwitchField label="Show the announcement bar" checked={announcement.active} onChange={(active) => setAnnouncement({ active })} />
          <div className={ui.formGrid}>
            <TextField label="Message" value={announcement.message} onChange={(message) => setAnnouncement({ message })} max={90} placeholder="Fresh groceries delivered across Accra" error={announcementProblem} />
            <TextField label="Second message" optional value={announcement.secondary} onChange={(secondary) => setAnnouncement({ secondary })} max={90} hint="Shown beside the first on larger screens." />
          </div>
        </div>
      </Panel>

      <div className={s.split}>
        <Panel id="ads-partner" title="Delivery partner section" description="Recruits riders and drivers, on the homepage after the banners."
          actions={<Badge tone={ads.partner.active ? "success" : "neutral"}>{ads.partner.active ? "Active" : "Off"}</Badge>}>
          <AdvertForm ad={ads.partner} onChange={setAd("partner")} problems={partnerProblems} pointsLabel="Points" />
        </Panel>
        <div className={s.sticky}>
          <Panel id="ads-partner-preview" title="Preview" description="Delivery partner section on a computer screen.">
            {ads.partner.active ? <ScaledPreview height={ads.partner.image ? 400 : 300}><div style={{ padding: 24 }}><PartnerCalloutView ad={{ ...ads.partner, title: ads.partner.title || "Title", points: ads.partner.points.filter(Boolean) }} /></div></ScaledPreview> : <Hidden what="This section" />}
          </Panel>
        </div>
      </div>

      <div className={s.split}>
        <Panel id="ads-deals" title="Deals section" description="The strip at the bottom of the homepage, above the footer."
          actions={<Badge tone={ads.newsletter.active ? "success" : "neutral"}>{ads.newsletter.active ? "Active" : "Off"}</Badge>}>
          <AdvertForm ad={ads.newsletter} onChange={setAd("newsletter")} problems={newsletterProblems} />
        </Panel>
        <div className={s.sticky}>
          <Panel id="ads-deals-preview" title="Preview" description="Deals section on a computer screen.">
            {ads.newsletter.active ? <ScaledPreview height={ads.newsletter.image ? 300 : 220}><div style={{ padding: 24 }}><NewsletterView ad={{ ...ads.newsletter, title: ads.newsletter.title || "Title" }} /></div></ScaledPreview> : <Hidden what="This section" />}
          </Panel>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => { discard(); setChecked(false); }} />
    </>
  );
}

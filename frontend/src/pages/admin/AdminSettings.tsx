import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ArrowUpRightIcon, GalleryHorizontalEndIcon, LayoutTemplateIcon, MegaphoneIcon, PanelTopIcon, SearchIcon, SlidersHorizontalIcon, UserRoundIcon, Settings2Icon, StoreIcon, type LucideIcon } from "lucide-react";
import { ErrorState, LoadingState } from "../../components/admin/States";
import Panel from "../../components/admin/Panel";
import { contentAdminApi, type SiteContent } from "../../frontApisRoute/content";
import { useResource } from "../../hooks/useResource";
import GeneralSettings from "./settings/GeneralSettings";
import AccountSettings from "./settings/AccountSettings";
import PreferencesSettings from "./settings/PreferencesSettings";
import StoreSettings from "./settings/StoreSettings";
import HeroSettings from "./settings/HeroSettings";
import BannerSettings from "./settings/BannerSettings";
import AdvertSettings from "./settings/AdvertSettings";
import HomepageSettings from "./settings/HomepageSettings";
import SeoSettings from "./settings/SeoSettings";
import ui from "../../components/admin/ui.module.css";
import s from "./settings/settings.module.css";

interface Section { id: string; label: string; icon: LucideIcon; description: string }

const SECTIONS: Section[] = [
  { id: "general", label: "General", icon: SlidersHorizontalIcon, description: "Inventory alerts and your store connection." },
  { id: "account", label: "Account", icon: UserRoundIcon, description: "Your management profile and account security." },
  { id: "preferences", label: "Preferences", icon: Settings2Icon, description: "Your working preferences, saved to your own account." },
  { id: "store", label: "Store details", icon: StoreIcon, description: "Give shoppers the right information about your store and how to reach you." },
  { id: "hero", label: "Homepage hero", icon: PanelTopIcon, description: "Shape the first thing shoppers see. Edit your hero image, message and links." },
  { id: "banners", label: "Promotions", icon: GalleryHorizontalEndIcon, description: "Create and schedule banners for the homepage and product pages." },
  { id: "ads", label: "Announcements", icon: MegaphoneIcon, description: "Manage your announcement bar, delivery partner invitation and deals section." },
  { id: "homepage", label: "Homepage sections", icon: LayoutTemplateIcon, description: "Refine store highlights and the headings throughout your homepage." },
  { id: "seo", label: "Search & sharing", icon: SearchIcon, description: "Control how your store appears on Google and when links are shared." },
];
const SECTION_GROUPS = [
  { label: "My account", ids: ["account", "preferences"] },
  { label: "System", ids: ["general"] },
  { label: "Storefront", ids: ["store", "hero", "homepage", "seo"] },
  { label: "Campaigns", ids: ["banners", "ads"] },
];
// Sections that edit the storefront content document (Hero, Store, ...). They stay mounted, so unsaved edits survive switching.
const CONTENT_SECTIONS = { store: StoreSettings, hero: HeroSettings, ads: AdvertSettings, homepage: HomepageSettings, seo: SeoSettings };

export default function AdminSettings() {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const requested = params.get("section");
  const active = SECTIONS.find((section) => section.id === (hash === "#account" && !requested ? "account" : requested)) ?? SECTIONS[0]!;
  const content = useResource("admin-content", () => contentAdminApi.get());
  const { update } = content;
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  // The banner list loads the first time its section is opened.
  const [bannersOpened, setBannersOpened] = useState(active.id === "banners");

  const reportDirty = useCallback((section: string, value: boolean) => setDirty((previous) => (previous[section] === value ? previous : { ...previous, [section]: value })), []);
  const onSaved = useCallback((next: SiteContent) => update(() => ({ content: next })), [update]);
  const anyDirty = Object.values(dirty).some(Boolean);

  // The account menu links directly to the personal Account section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  // Warn before closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const open = (id: string) => {
    if (id === "banners") setBannersOpened(true);
    setParams(id === "general" ? {} : { section: id });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className={s.pageHeader}>
        <div><p className={s.eyebrow}>STORE WORKSPACE</p><h1>Settings</h1><p className={s.pageDescription}>Manage your store configuration, account and working preferences.</p></div>
        <a href="/" target="_blank" rel="noreferrer" className={`${ui.button} ${ui.secondary}`}>View store <ArrowUpRightIcon aria-hidden="true" /></a>
      </header>

      <div className={s.layout}>
        <nav aria-label="Settings sections" className={s.nav}>
          {SECTION_GROUPS.map((group) => <div key={group.label} className={s.navGroup}>
            <p className={s.navGroupLabel}>{group.label}</p>
            {SECTIONS.filter((section) => group.ids.includes(section.id)).map((section) => (
            <button key={section.id} type="button" onClick={() => open(section.id)} aria-current={section.id === active.id ? "page" : undefined}
              className={`${s.navItem} ${section.id === active.id ? s.navActive : ""}`}>
              <section.icon aria-hidden="true" />
              {section.label}
              {dirty[section.id] && <><span className={s.navDot} aria-hidden="true" /><span className="sr-only"> (unsaved changes)</span></>}
            </button>
            ))}
          </div>)}
        </nav>
        <div className={s.workspace}>
          <div className={s.sectionHeading}>
            <div><h2>{active.label}</h2><p>{active.description}</p></div>
            {dirty[active.id] && <span className={s.draftLabel} role="status">Unsaved changes</span>}
          </div>
        <div className={s.section} data-settings-section="general" hidden={active.id !== "general"}><GeneralSettings /></div>
        <div id="account" className={s.section} data-settings-section="account" hidden={active.id !== "account"}><AccountSettings onDirty={reportDirty} /></div>
        <div className={s.section} data-settings-section="preferences" hidden={active.id !== "preferences"}><PreferencesSettings onDirty={reportDirty} /></div>
        <div className={s.section} data-settings-section="banners" hidden={active.id !== "banners"}>{bannersOpened && <BannerSettings />}</div>

        {Object.entries(CONTENT_SECTIONS).map(([id, Editor]) => (
          <div key={id} className={s.section} data-settings-section={id} hidden={active.id !== id}>
            {content.data
              ? <Editor content={content.data.content} onSaved={onSaved} onDirty={reportDirty} />
              : <Panel>{content.error ? <ErrorState message={content.error} onRetry={content.reload} /> : <LoadingState label="Loading the store content" />}</Panel>}
          </div>
        ))}
        </div>
      </div>
    </>
  );
}

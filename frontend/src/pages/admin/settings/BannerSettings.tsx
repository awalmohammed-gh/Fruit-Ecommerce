import { useState } from "react";
import { EyeIcon, ImageIcon, ImagePlusIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, Trash2Icon } from "lucide-react";
import toast, { errorMessage } from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import Badge, { type Tone } from "../../../components/admin/Badge";
import DataTable, { type Column } from "../../../components/admin/DataTable";
import ActionMenu from "../../../components/admin/ActionMenu";
import Modal, { ConfirmDialog } from "../../../components/admin/Modal";
import { contentAdminApi, placementLabel, PLACEMENTS, type AdminBanner, type Placement } from "../../../frontApisRoute/content";
import { refreshSiteContent } from "../../../hooks/useSiteContent";
import { useResource } from "../../../hooks/useResource";
import { useCategories } from "../lib/useCategories";
import { date } from "../lib/format";
import BannerEditor, { BannerPreview } from "./BannerEditor";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

// What a shopper sees right now: active and inside its schedule.
function bannerState(banner: AdminBanner, now = Date.now()): { label: string; tone: Tone } {
  if (!banner.active) return { label: "Inactive", tone: "neutral" };
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) return { label: `Starts ${date(banner.startsAt)}`, tone: "info" };
  if (banner.endsAt && new Date(banner.endsAt).getTime() <= now) return { label: "Ended", tone: "warning" };
  return { label: "Live", tone: "success" };
}

type Editing = { banner: AdminBanner | null } | null;

export default function BannerSettings() {
  const list = useResource("admin-banners", () => contentAdminApi.banners());
  const { nameOf } = useCategories();
  const [placement, setPlacement] = useState<Placement | "">("");
  const [editing, setEditing] = useState<Editing>(null);
  const [previewing, setPreviewing] = useState<AdminBanner | null>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);
  const [busy, setBusy] = useState(false);

  const banners = list.data?.banners ?? null;
  const rows = banners && (placement ? banners.filter((banner) => banner.placement === placement) : banners);
  const replace = (banner: AdminBanner) => list.update((data) => ({
    banners: [banner, ...data.banners.filter((item) => item._id !== banner._id)],
  }));

  const toggle = async (banner: AdminBanner) => {
    try {
      const result = await contentAdminApi.setBannerActive(banner._id, !banner.active);
      replace(result.banner);
      refreshSiteContent();
      toast.success(result.message);
    } catch (error) { toast.error(errorMessage(error, "Unable to update the banner")); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const result = await contentAdminApi.removeBanner(deleting._id);
      list.update((data) => ({ banners: data.banners.filter((item) => item._id !== deleting._id) }));
      refreshSiteContent();
      toast.success(result.message);
      setDeleting(null);
    } catch (error) { toast.error(errorMessage(error, "Unable to delete the banner")); }
    finally { setBusy(false); }
  };

  const columns: Column<AdminBanner>[] = [
    {
      key: "banner", header: "Banner", primary: true, render: (banner) => (
        <div className={s.bannerCell}>
          {banner.image ? <img src={banner.image} alt="" className={s.bannerThumb} /> : <span className={`${s.bannerThumb} ${s.bannerThumbEmpty}`} aria-hidden="true"><ImageIcon /></span>}
          <span className={ui.cellStack}><span className={ui.cellPrimary}>{banner.name}</span><span className={ui.cellSecondary}>{banner.title}{banner.highlight ? ` ${banner.highlight}` : ""}</span></span>
        </div>
      ),
    },
    {
      key: "placement", header: "Placement", render: (banner) => (
        <span className={ui.cellStack}><span>{placementLabel(banner.placement)}</span>{banner.placement === "category" && <span className={ui.cellSecondary}>{banner.category ? nameOf(banner.category) : "Every category"}</span>}</span>
      ),
    },
    { key: "status", header: "Status", render: (banner) => { const state = bannerState(banner); return <Badge tone={state.tone}>{state.label}</Badge>; } },
    { key: "updated", header: "Last updated", render: (banner) => <span className={ui.num}>{date(banner.updatedAt, true)}</span> },
    {
      key: "actions", header: "Actions", align: "right", render: (banner) => (
        <div className={ui.actions}>
          <button type="button" className={ui.iconButton} onClick={() => setEditing({ banner })} aria-label={`Edit ${banner.name}`}><PencilIcon aria-hidden="true" /></button>
          <ActionMenu label={`More actions for ${banner.name}`} actions={[
            { label: "Edit", icon: PencilIcon, onSelect: () => setEditing({ banner }) },
            { label: "Preview", icon: EyeIcon, onSelect: () => setPreviewing(banner) },
            { label: banner.active ? "Disable" : "Enable", icon: banner.active ? PowerOffIcon : PowerIcon, onSelect: () => void toggle(banner) },
            { label: "Delete", icon: Trash2Icon, danger: true, separated: true, onSelect: () => setDeleting(banner) },
          ]} />
        </div>
      ),
    },
  ];

  return (
    <>
      <Panel id="banner-list" title="Promotional banners" flush
        description="Banners for the homepage and product pages. Only active banners within their dates show on the store."
        actions={<button type="button" className={`${ui.button} ${ui.primary} ${ui.small}`} onClick={() => setEditing({ banner: null })}><PlusIcon aria-hidden="true" /> Add banner</button>}>
        <div className={ui.toolbar}>
          <label htmlFor="banner-filter" className="sr-only">Placement</label>
          <select id="banner-filter" className={ui.select} value={placement} onChange={(event) => setPlacement(event.target.value as Placement | "")}>
            <option value="">All placements</option>
            {PLACEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {banners && <span className={`${ui.hint} ${ui.toolbarEnd}`}>{banners.filter((banner) => bannerState(banner).label === "Live").length} live · {banners.length} total</span>}
        </div>
        <DataTable label="Promotional banners" columns={columns} rows={rows} rowKey={(banner) => banner._id} loading={list.loading} error={list.error} onRetry={list.reload} skeletonRows={3}
          empty={{ icon: ImagePlusIcon, title: placement ? "No banners in this placement" : "No banners yet", text: "Add a banner to promote offers on the homepage or product pages.",
            action: <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => setEditing({ banner: null })}><PlusIcon aria-hidden="true" /> Add banner</button> }} />
      </Panel>

      {editing && <BannerEditor banner={editing.banner} onClose={() => setEditing(null)} onSaved={(banner) => { replace(banner); setEditing(null); }} />}

      {previewing && (
        <Modal open wide onClose={() => setPreviewing(null)} title={previewing.name} description={`${placementLabel(previewing.placement)} · ${bannerState(previewing).label}`}
          footer={<>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setPreviewing(null)}>Close</button>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => { setEditing({ banner: previewing }); setPreviewing(null); }}><PencilIcon aria-hidden="true" /> Edit banner</button>
          </>}>
          <BannerPreview banner={previewing} />
        </Modal>
      )}

      <ConfirmDialog open={deleting !== null} busy={busy} title="Delete this banner?" confirmLabel="Delete banner" onClose={() => setDeleting(null)} onConfirm={() => void remove()}
        message={<>“{deleting?.name}” is removed from the store and can't be restored. To hide it for now, disable it instead.</>} />
    </>
  );
}

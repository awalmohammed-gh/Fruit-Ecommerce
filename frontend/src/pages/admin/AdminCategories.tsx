import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderTreeIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import toast from "../../components/toast/toast";
import PageHeader from "../../components/admin/PageHeader";
import Panel from "../../components/admin/Panel";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Modal, { ConfirmDialog } from "../../components/admin/Modal";
import SeoFields from "../../components/admin/SeoFields";
import Thumb from "../../components/admin/Thumb";
import Badge from "../../components/admin/Badge";
import { Notice } from "../../components/admin/States";
import { categoriesApi, labelFromSlug, type StoreCategory, type UnlistedCategory } from "../../frontApisRoute/categories";
import { useResource } from "../../hooks/useResource";
import { number, plural, relativeDate } from "./lib/format";
import ui from "../../components/admin/ui.module.css";
import styles from "./pages.module.css";
import CategoryImageField from "./components/CategoryImageField";
import { validCategoryImageUrl } from "./lib/categoryImages";
import { invalidateStoreCategories } from "../../hooks/useStoreCategories";

// Same rule as the server, so the preview matches what gets saved.
const slugify = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

type Editing = { mode: "create"; name: string; slug: string } | { mode: "edit"; category: StoreCategory };

function CategoryModal({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const existing = editing.mode === "edit" ? editing.category : null;
  const [name, setName] = useState(existing?.name ?? (editing.mode === "create" ? editing.name : ""));
  const [slug, setSlug] = useState(existing?.slug ?? (editing.mode === "create" ? editing.slug : ""));
  const [image, setImage] = useState(existing?.image ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [seoTitle, setSeoTitle] = useState(existing?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(existing?.seoDescription ?? "");
  const [seoImage, setSeoImage] = useState(existing?.seoImage ?? "");
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [slugTouched, setSlugTouched] = useState(editing.mode === "create" && !!editing.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const finalSlug = existing ? existing.slug : slugTouched ? slug : slugify(name);
  const valid = name.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug) && validCategoryImageUrl(image) && !previewError && !uploading && (!seoImage.trim() || /^https:\/\/\S+$/i.test(seoImage.trim()));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const fields = { name: name.trim(), image: image.trim(), description: description.trim(), isActive, seoTitle: seoTitle.trim(), seoDescription: seoDescription.trim(), seoImage: seoImage.trim() };
      if (existing) await categoriesApi.update(existing._id, fields);
      else await categoriesApi.create({ ...fields, slug: finalSlug });
      invalidateStoreCategories();
      toast.success(existing ? "Category updated" : `${name.trim()} added`);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save the category");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={saving || uploading} title={existing ? "Edit category" : "Add category"} description="Categories group products in the store's menus and filters."
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={saving || uploading}>Cancel</button>
          <button type="submit" form="category-form" className={`${ui.button} ${ui.primary}`} disabled={!valid || saving}>
            {saving && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />} {existing ? "Save changes" : "Add category"}
          </button>
        </>
      }>
      <form id="category-form" onSubmit={save} className={styles.stack16}>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="category-name">Name</label>
          <input id="category-name" className={ui.input} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Dairy & Eggs" autoFocus />
        </div>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="category-slug">Slug</label>
          <input id="category-slug" className={`${ui.input} ${ui.mono}`} maxLength={60} value={finalSlug} readOnly={!!existing}
            onChange={(event) => { setSlugTouched(true); setSlug(event.target.value.toLowerCase()); }} />
          <span className={ui.hint}>{existing ? "Products are linked by slug, so it can't change after creation." : "Used in links and on products. Lowercase letters, numbers and hyphens."}</span>
        </div>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="category-description">Description <span className={ui.optional}>(optional)</span></label>
          <textarea id="category-description" className={ui.textarea} maxLength={300} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <CategoryImageField value={image} original={existing?.image ?? ""} disabled={saving} onChange={setImage} onBusy={setUploading} onPreviewError={setPreviewError} />
        {previewError && <Notice tone="error">{previewError}</Notice>}
        <label className={ui.switchRow}>
          <span className={ui.cellStack}><span className={ui.cellPrimary}>Active category</span><span className={ui.cellSecondary}>Inactive categories stay here but are hidden from customer navigation.</span></span>
          <input type="checkbox" role="switch" className={ui.switch} checked={isActive} disabled={saving} onChange={(event) => setIsActive(event.target.checked)} />
        </label>
        <SeoFields title={seoTitle} description={seoDescription} onTitle={setSeoTitle} onDescription={setSeoDescription} name={name} disabled={saving}
          fallbackDescription={description || `Shop ${name.trim() || "this category"} online.`} path={`/category/${finalSlug || "…"}`}
          image={{ value: seoImage, onChange: setSeoImage, fallbackNote: "Leave empty to use the category image, or the site’s sharing image if there is none." }} />
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}

export default function AdminCategories() {
  const categories = useResource("categories", () => categoriesApi.manage());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<StoreCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const data = categories.data;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await categoriesApi.remove(deleting._id);
      invalidateStoreCategories();
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      categories.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the category");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<StoreCategory>[] = [
    {
      key: "category", header: "Category", primary: true, render: (category) => (
        <div className={ui.productCell}>
          <Thumb src={category.image} size={40} />
          <div className={ui.cellStack}><span className={ui.cellPrimary}>{category.name}</span><span className={`${ui.cellSecondary} ${ui.mono}`}>{category.slug}</span></div>
        </div>
      ),
    },
    {
      key: "products", header: "Products", align: "right", render: (category) => category.productCount
        ? <Link to={`/admin/products?category=${encodeURIComponent(category.slug)}`} className={styles.textLink}>{plural(category.productCount, "product")}</Link>
        : <span className={ui.cellSecondary}>None</span>,
    },
    { key: "status", header: "Status", render: (category) => <Badge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "created", header: "Created", render: (category) => <span className={ui.cellSecondary}>{relativeDate(category.createdAt)}</span> },
    {
      key: "actions", header: "", align: "right", render: (category) => (
        <div className={ui.actions}>
          <button type="button" className={ui.iconButton} onClick={() => setEditing({ mode: "edit", category })} aria-label={`Edit ${category.name}`} title="Edit"><PencilIcon aria-hidden="true" /></button>
          <button type="button" className={ui.iconButton} onClick={() => setDeleting(category)} disabled={category.productCount > 0}
            aria-label={`Delete ${category.name}`} title={category.productCount > 0 ? "Move or delete its products first" : "Delete"}><Trash2Icon aria-hidden="true" /></button>
        </div>
      ),
    },
  ];

  const unlistedColumns: Column<UnlistedCategory>[] = [
    { key: "slug", header: "Slug used by products", primary: true, render: (row) => <div className={ui.cellStack}><span className={ui.cellPrimary}>{labelFromSlug(row.slug)}</span><span className={`${ui.cellSecondary} ${ui.mono}`}>{row.slug}</span></div> },
    { key: "products", header: "Products", align: "right", render: (row) => <Link to={`/admin/products?category=${encodeURIComponent(row.slug)}`} className={styles.textLink}>{plural(row.productCount, "product")}</Link> },
    { key: "actions", header: "", align: "right", render: (row) => <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => setEditing({ mode: "create", name: labelFromSlug(row.slug), slug: row.slug })}><PlusIcon aria-hidden="true" /> Create</button> },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise products into the groups customers browse."
        count={data ? `${number(data.categories.length)} categories` : undefined}
        actions={<button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setEditing({ mode: "create", name: "", slug: "" })}><PlusIcon aria-hidden="true" /> Add category</button>}
      />

      {!!data?.unlisted.length && (
        <Panel flush title="Used by products, not set up yet" description="These slugs are on products but have no category record, so they have no proper name. Create them to manage them here."
          actions={<Badge tone="warning">{number(data.unlisted.length)} to set up</Badge>}>
          <DataTable label="Category slugs without a record" columns={unlistedColumns} rows={data.unlisted} rowKey={(row) => row.slug} empty={{ title: "" }} />
        </Panel>
      )}

      <Panel flush>
        <DataTable
          label="Categories"
          columns={columns}
          rows={data?.categories ?? null}
          rowKey={(category) => category._id}
          loading={categories.loading}
          error={categories.error}
          onRetry={categories.reload}
          empty={{ icon: FolderTreeIcon, title: "No categories yet", text: "Add categories so products can be grouped and filtered.",
            action: <button type="button" className={`${ui.button} ${ui.primary} ${ui.small}`} onClick={() => setEditing({ mode: "create", name: "", slug: "" })}><PlusIcon aria-hidden="true" /> Add category</button> }}
        />
      </Panel>

      {editing && <CategoryModal editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); categories.reload(); }} />}
      <ConfirmDialog open={!!deleting} busy={busy} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete category?" confirmLabel="Delete category"
        message={<><strong>{deleting?.name}</strong> has no products and will be removed permanently.</>} />
    </>
  );
}

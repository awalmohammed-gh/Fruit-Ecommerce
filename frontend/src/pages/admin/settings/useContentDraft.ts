import { useEffect, useMemo, useState } from "react";
import toast, { errorMessage } from "../../../components/toast/toast";
import { contentAdminApi, type ContentBlock, type SiteContent } from "../../../frontApisRoute/content";
import { refreshSiteContent } from "../../../hooks/useSiteContent";
import { useCategories } from "../lib/useCategories";

export interface SectionProps {
  content: SiteContent;
  onSaved: (content: SiteContent) => void;
  /** Tells the settings page this section has unsaved changes (shown in the section list). */
  onDirty: (section: string, dirty: boolean) => void;
}

/**
 * A Settings section's editable copy of one or more content blocks.
 * Save sends only the blocks that changed; Discard goes back to what is saved.
 */
export function useContentDraft<K extends ContentBlock>(section: string, blocks: K[], { content, onSaved, onDirty }: SectionProps) {
  const pick = (source: SiteContent) => Object.fromEntries(blocks.map((block) => [block, source[block]])) as Pick<SiteContent, K>;
  const [draft, setDraft] = useState(() => pick(content));
  const [saving, setSaving] = useState(false);
  const saved = pick(content);
  const changed = blocks.filter((block) => JSON.stringify(draft[block]) !== JSON.stringify(saved[block]));
  const dirty = changed.length > 0;

  useEffect(() => { onDirty(section, dirty); }, [section, dirty, onDirty]);

  const save = async () => {
    setSaving(true);
    let latest = content;
    try {
      let message = "";
      for (const block of changed) {
        const result = await contentAdminApi.save(block, draft[block]);
        latest = result.content;
        message = result.message;
      }
      setDraft(pick(latest));
      toast.success(changed.length > 1 ? "Changes saved" : message, { description: "The store now shows the update." });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save your changes"));
      return false;
    } finally {
      // Blocks saved before a failure are still saved.
      if (latest !== content) { onSaved(latest); refreshSiteContent(); }
      setSaving(false);
    }
  };

  return { draft, setDraft, dirty, saving, save, discard: () => setDraft(saved) };
}

// Suggestions for button links: the store's main pages and every category.
export function useLinkOptions() {
  const { options } = useCategories();
  return useMemo(() => [
    { value: "/products", label: "All products" },
    { value: "/deals", label: "Flash deals" },
    { value: "#categories", label: "Home page: categories section" },
    { value: "/delivery-partner/apply", label: "Delivery partner application" },
    ...options.map((option) => ({ value: `/category/${option.value}`, label: `Category: ${option.label}` })),
  ], [options]);
}

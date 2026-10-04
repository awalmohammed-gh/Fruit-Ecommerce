import { useId } from "react";
import { SearchIcon } from "lucide-react";
import { useSiteContent } from "../../hooks/useSiteContent";
import ui from "./ui.module.css";
import styles from "./SeoFields.module.css";

// Plain text of at most `max` characters, cut at a word (the same rule the server uses for descriptions).
function summary(text: string, max = 155) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

interface SeoFieldsProps {
  title: string;
  description: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  /** Used when the fields are empty, e.g. the product name and description. */
  name: string;
  fallbackDescription: string;
  /** The page's address, e.g. /products/cheese-200g. */
  path: string;
  disabled?: boolean;
  /** Category only: an image for link previews on WhatsApp, Facebook and so on. */
  image?: { value: string; onChange: (value: string) => void; fallbackNote: string };
}

/**
 * Optional search-engine text for a product or category, with a preview of the search result.
 * Empty fields aren't a problem: the store builds the title and description from the name and description.
 */
export default function SeoFields({ title, description, onTitle, onDescription, name, fallbackDescription, path, disabled, image }: SeoFieldsProps) {
  const id = useId();
  const siteName = useSiteContent().data?.seo?.siteName || "GreenFarm";
  const shownTitle = title.trim() || `${name.trim() || "Name"} | ${siteName}`;
  const shownDescription = description.trim() || summary(fallbackDescription) || "The description appears here.";
  const imageInvalid = image && image.value.trim() !== "" && !/^https:\/\/\S+$/i.test(image.value.trim());

  return (
    <fieldset className={styles.box} disabled={disabled}>
      <legend className={styles.legend}><SearchIcon aria-hidden="true" /> Search engine listing <span className={ui.optional}>(optional)</span></legend>
      <p className={ui.hint}>Leave these empty to use the name and description. Fill them in to choose exactly what Google and link previews show.</p>
      <div className={styles.preview} aria-label="Search result preview" role="img">
        <span className={styles.previewUrl}>{window.location.host}{path}</span>
        <span className={styles.previewTitle}>{shownTitle}</span>
        <span className={styles.previewText}>{shownDescription}</span>
      </div>
      <div className={ui.field}>
        <div className={styles.labelRow}>
          <label className={ui.label} htmlFor={`${id}-title`}>SEO title</label>
          <span className={`${styles.count} ${title.length > 60 ? styles.countLong : ""}`}>{title.length}/70</span>
        </div>
        <input id={`${id}-title`} className={ui.input} maxLength={70} value={title} placeholder={`${name.trim() || "Name"} | ${siteName}`} onChange={(event) => onTitle(event.target.value)} />
        <span className={ui.hint}>Around 50–60 characters shows in full on Google.</span>
      </div>
      <div className={ui.field}>
        <div className={styles.labelRow}>
          <label className={ui.label} htmlFor={`${id}-description`}>SEO description</label>
          <span className={`${styles.count} ${description.length > 155 ? styles.countLong : ""}`}>{description.length}/160</span>
        </div>
        <textarea id={`${id}-description`} className={ui.textarea} style={{ minHeight: 72 }} rows={2} maxLength={160} value={description}
          placeholder={summary(fallbackDescription) || "One or two sentences that make people want to click."} onChange={(event) => onDescription(event.target.value)} />
      </div>
      {image && (
        <div className={ui.field}>
          <label className={ui.label} htmlFor={`${id}-image`}>Sharing image <span className={ui.optional}>(optional)</span></label>
          <input id={`${id}-image`} className={ui.input} type="url" inputMode="url" placeholder="https://…" value={image.value} onChange={(event) => image.onChange(event.target.value)} aria-invalid={imageInvalid || undefined} />
          <span className={imageInvalid ? styles.error : ui.hint}>{imageInvalid ? "Use an image address that starts with https://" : `${image.fallbackNote} Best at 1200 × 630 px.`}</span>
        </div>
      )}
    </fieldset>
  );
}

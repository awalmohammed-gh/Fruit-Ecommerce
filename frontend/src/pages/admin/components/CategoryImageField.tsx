import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { uploadsApi } from "../../../frontApisRoute/customers";
import ui from "../../../components/admin/ui.module.css";
import styles from "./CategoryImageField.module.css";
import { validCategoryImageUrl } from "../lib/categoryImages";

interface Props {
  value: string;
  original: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBusy: (busy: boolean) => void;
  onPreviewError: (message: string) => void;
}

/** The existing upload API returns a hosted URL; categories save that URL like any other image. */
export default function CategoryImageField({ value, original, disabled, onChange, onBusy, onPreviewError }: Props) {
  const [source, setSource] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = localPreview || (validCategoryImageUrl(value) ? value.trim() : "");

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const chooseSource = (next: "upload" | "url") => {
    if (next === source || uploading) return;
    setSource(next);
    setError("");
    onPreviewError("");
    // Discard the unsaved replacement, preserving the existing category image.
    onChange(original);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choose a JPG, PNG or WebP image.");
    if (file.size > 2 * 1024 * 1024) return setError("Images must be 2 MB or smaller.");
    setUploading(true);
    onBusy(true);
    setError("");
    onPreviewError("");
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      setLocalPreview(URL.createObjectURL(file));
      onChange((await uploadsApi.image(file, "content")).url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The image could not be uploaded. Try another file.");
    } finally {
      setLocalPreview("");
      setUploading(false);
      onBusy(false);
    }
  };

  return (
    <fieldset className={styles.field} disabled={disabled || uploading}>
      <legend className={ui.label}>Category image <span className={ui.optional}>(optional)</span></legend>
      <div className={styles.sources} role="radiogroup" aria-label="Category image source">
        {(["upload", "url"] as const).map((option) => (
          <label key={option} className={`${styles.source} ${source === option ? styles.selected : ""}`}>
            <input type="radio" name="category-image-source" checked={source === option} onChange={() => chooseSource(option)} />
            {option === "upload" ? "Upload Image" : "Use Image URL"}
          </label>
        ))}
      </div>
      <div className={styles.editor}>
        <div className={styles.preview}>
          {preview ? <img key={preview} src={preview} alt="Category image preview" onLoad={() => onPreviewError("")} onError={() => onPreviewError("The image could not be loaded. Check the URL or choose another image.")} />
            : <span><ImageIcon size={24} aria-hidden="true" />No image selected</span>}
        </div>
        <div className={styles.controls}>
          {source === "upload" ? <>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => fileInput.current?.click()}>
              {uploading ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <UploadIcon aria-hidden="true" />}
              {uploading ? "Uploading…" : value ? "Replace image" : "Choose image"}
            </button>
            <p className={ui.hint}>JPG, PNG or WebP · Up to 2 MB.<br />Recommended: 400 × 400 px.</p>
          </> : <div className={ui.field}>
            <label htmlFor="category-image-url" className={ui.label}>Image URL</label>
            <input id="category-image-url" className={ui.input} type="url" maxLength={2048} value={value} placeholder="https://example.com/images/fruits.jpg" aria-invalid={!validCategoryImageUrl(value)}
              onChange={(event) => { onPreviewError(""); onChange(event.target.value); }} />
            {!validCategoryImageUrl(value) && <p className={styles.error}>Enter a valid HTTP or HTTPS image URL.</p>}
            <p className={ui.hint}>Use a public image address. The preview updates as you edit.</p>
          </div>}
          {value && <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => { onChange(""); onPreviewError(""); }}>Remove image</button>}
        </div>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </fieldset>
  );
}

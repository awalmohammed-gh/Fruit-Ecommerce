import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react";
import toast, { errorMessage } from "../../../components/toast/toast";
import { uploadsApi, type UploadFolder } from "../../../frontApisRoute/customers";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

/** What a field accepts: MIME types, plus extensions for files the browser may not type (e.g. .ico). */
export interface ImageFormats { types: string[]; extensions?: string[]; label: string }
const PHOTOS: ImageFormats = { types: ["image/jpeg", "image/png", "image/webp"], label: "JPG, PNG or WebP" };
const MAX_BYTES = 2 * 1024 * 1024; // the server's upload limit
const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** The size the storefront shows it at, e.g. 1920 × 840 for the hero. */
  recommended: { width: number; height: number };
  note?: string;
  /** "cover" for photos that fill an area, "contain" for cut-outs like the van. */
  fit?: "cover" | "contain";
  optional?: boolean;
  error?: string | undefined;
  uploadedHint?: string;
  onBusy?: (busy: boolean) => void;
  formats?: ImageFormats;
  /** At most the server's limit for the folder. */
  maxBytes?: number;
  folder?: UploadFolder;
}

async function imageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch { return null; }
}

// Upload, preview, replace or remove a content image. Uses the same upload endpoint as product photos.
export default function ImageField({ label, value, onChange, recommended, note, fit = "cover", optional, error, onBusy, uploadedHint = "Save to publish it on the store.", formats = PHOTOS, maxBytes = MAX_BYTES, folder = "content" }: ImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [broken, setBroken] = useState<string | null>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!formats.types.includes(file.type) && !formats.extensions?.includes(extension)) return void toast.error(`Choose a ${formats.label} image`);
    if (file.size > maxBytes) return void toast.error(`This image is larger than ${megabytes(maxBytes)}`, { description: "Resize or compress it, then try again." });
    const size = await imageSize(file);
    if (size && (size.width < recommended.width * 0.75 || size.height < recommended.height * 0.75)) {
      toast.warning("This image is smaller than recommended", { description: `It is ${size.width} × ${size.height} px. ${recommended.width} × ${recommended.height} px or larger stays sharp.` });
    } else if (size && recommended.width === recommended.height && size.width !== size.height) {
      toast.warning("This image isn't square", { description: `It is ${size.width} × ${size.height} px, so browsers will squeeze it. A square image looks best.` });
    }
    setUploading(true);
    onBusy?.(true);
    try {
      onChange((await uploadsApi.image(file, folder)).url);
      toast.success("Image uploaded", { description: uploadedHint });
    } catch (failure) {
      toast.error(errorMessage(failure, "The image could not be uploaded"));
    } finally {
      setUploading(false);
      onBusy?.(false);
    }
  };

  const applyUrl = () => {
    const next = url.trim();
    if (!/^https:\/\/\S+$/i.test(next)) return void toast.error("Paste an image address that starts with https://");
    onChange(next);
    setUrl("");
  };

  const showImage = value && broken !== value;
  return (
    <div className={ui.field} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className={ui.label}>{label}{optional && <span className={ui.optional}> (optional)</span>}</span>
      <div className={s.image}>
        <div className={s.imageFrame} style={{ aspectRatio: `${recommended.width} / ${recommended.height}` }}>
          {showImage
            ? <img src={value} alt={`${label} preview`} style={{ objectFit: fit }} onError={() => setBroken(value)} />
            : <span className={s.imageEmpty}><ImageIcon aria-hidden="true" />{value ? "Image can't be loaded" : "No image yet"}</span>}
        </div>
        <div className={s.imageSide}>
          <span className={ui.hint}>
            <strong>Recommended: {recommended.width} × {recommended.height} px.</strong> {formats.label}, up to {megabytes(maxBytes)}.{note ? ` ${note}` : ""}
          </span>
          <div className={s.imageButtons}>
            <input ref={input} type="file" accept={[...formats.types, ...(formats.extensions ?? [])].join(",")} className={s.fileInput} onChange={upload} tabIndex={-1} aria-hidden="true" />
            <button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={() => input.current?.click()} disabled={uploading}>
              {uploading ? <LoaderCircleIcon className={ui.spin} aria-hidden="true" /> : <UploadIcon aria-hidden="true" />}
              {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
            </button>
            {value && (
              <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => onChange("")} disabled={uploading}>
                <Trash2Icon aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          <details className={s.details}>
            <summary>Use an image address instead</summary>
            <div className={s.urlRow}>
              <input className={`${ui.input} ${s.urlInput}`} type="url" inputMode="url" placeholder="https://…" value={url} aria-label={`${label} address`}
                onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyUrl(); } }} />
              <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={applyUrl}>Use</button>
            </div>
          </details>
          {error && <span className={s.error} role="alert">{error}</span>}
        </div>
      </div>
    </div>
  );
}

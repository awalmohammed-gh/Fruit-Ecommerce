import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react";
import toast, { errorMessage } from "../../../components/toast/toast";
import { uploadsApi } from "../../../frontApisRoute/customers";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // the server's upload limit

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
export default function ImageField({ label, value, onChange, recommended, note, fit = "cover", optional, error, onBusy, uploadedHint = "Save to publish it on the store." }: ImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [broken, setBroken] = useState<string | null>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return void toast.error("Choose a JPG, PNG or WebP image");
    if (file.size > MAX_BYTES) return void toast.error("This image is larger than 2 MB", { description: "Resize or compress it, then try again." });
    const size = await imageSize(file);
    if (size && (size.width < recommended.width * 0.75 || size.height < recommended.height * 0.75)) {
      toast.warning("This image is smaller than recommended", { description: `It is ${size.width} × ${size.height} px. ${recommended.width} × ${recommended.height} px or larger stays sharp.` });
    }
    setUploading(true);
    onBusy?.(true);
    try {
      onChange((await uploadsApi.image(file, "content")).url);
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
            <strong>Recommended: {recommended.width} × {recommended.height} px.</strong> JPG, PNG or WebP, up to 2 MB.{note ? ` ${note}` : ""}
          </span>
          <div className={s.imageButtons}>
            <input ref={input} type="file" accept={TYPES.join(",")} className={s.fileInput} onChange={upload} tabIndex={-1} aria-hidden="true" />
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

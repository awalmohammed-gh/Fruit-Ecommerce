import { useState } from "react";
import { ImageOffIcon } from "lucide-react";
import ui from "./ui.module.css";

export default function Thumb({ src, alt = "", size = 44 }: { src: string; alt?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) return <span className={`${ui.thumb} ${ui.thumbFallback}`} style={style}><ImageOffIcon aria-hidden="true" /></span>;
  return <img src={src} alt={alt} className={ui.thumb} style={style} loading="lazy" onError={() => setFailed(true)} />;
}

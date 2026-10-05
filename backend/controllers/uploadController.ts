import type { Request, Response } from "express";
import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import { HttpError } from "../middleware/errors.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
// Favicons may also be .ico files, and are small: a tab icon never needs more than 1 MB.
const faviconTypes = new Set([...imageTypes, "image/x-icon", "image/vnd.microsoft.icon"]);
const FAVICON_MAX_BYTES = 1024 * 1024;
// ?folder=content keeps hero and banner pictures apart from product photos; ?folder=favicon is the tab icon.
const FOLDERS = { products: "greenfarm/products", content: "greenfarm/content", favicon: "greenfarm/favicon" } as const;
const folderOf = (value: unknown): keyof typeof FOLDERS => value === "content" || value === "favicon" ? value : "products";

export const uploadController = {
  // Returns a hosted URL; the product (or banner) itself only stores that URL.
  image: async (req: Request, res: Response) => {
    if (!cloudinary.config().cloud_name)
      throw new HttpError(503, "Image uploads aren't configured on the server. Paste an image URL instead.");
    const file = req.file;
    if (!file) throw new HttpError(400, "Choose an image to upload");
    const folder = folderOf(req.query.folder);
    if (folder === "favicon") {
      if (!faviconTypes.has(file.mimetype)) throw new HttpError(400, "Upload a PNG, JPG, WebP or ICO image");
      if (file.size > FAVICON_MAX_BYTES) throw new HttpError(400, "A favicon must be 1 MB or smaller");
    } else if (!imageTypes.has(file.mimetype)) throw new HttpError(400, "Upload a JPG, PNG or WebP image");
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: FOLDERS[folder], resource_type: "image" }, (error, uploaded) =>
            error || !uploaded ? reject(error ?? new Error("Upload failed")) : resolve(uploaded))
          .end(file.buffer);
      });
    } catch {
      throw new HttpError(502, "The image could not be uploaded. Please try again.");
    }
    res.status(201).json({ message: "Image uploaded", url: result.secure_url });
  },
};

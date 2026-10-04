import type { Request, Response } from "express";
import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import { HttpError } from "../middleware/errors.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
// ?folder=content keeps hero and banner pictures apart from product photos.
const FOLDERS = { products: "greenfarm/products", content: "greenfarm/content" } as const;

export const uploadController = {
  // Returns a hosted URL; the product (or banner) itself only stores that URL.
  image: async (req: Request, res: Response) => {
    if (!cloudinary.config().cloud_name)
      throw new HttpError(503, "Image uploads aren't configured on the server. Paste an image URL instead.");
    const file = req.file;
    if (!file) throw new HttpError(400, "Choose an image to upload");
    if (!imageTypes.has(file.mimetype)) throw new HttpError(400, "Upload a JPG, PNG or WebP image");
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: FOLDERS[req.query.folder === "content" ? "content" : "products"], resource_type: "image" }, (error, uploaded) =>
            error || !uploaded ? reject(error ?? new Error("Upload failed")) : resolve(uploaded))
          .end(file.buffer);
      });
    } catch {
      throw new HttpError(502, "The image could not be uploaded. Please try again.");
    }
    res.status(201).json({ message: "Image uploaded", url: result.secure_url });
  },
};

import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import Banner from '../models/Banner.js';
import { CONTENT_BLOCKS, type ContentBlock } from '../models/SiteContent.js';
import * as validate from '../middleware/validateContent.js';
import { HttpError } from '../middleware/errors.js';
import { sharedCache } from '../middleware/cache.js';
import { liveBanners, publicContent, siteContent } from '../services/content.js';

const BLOCK_SAVED: Record<ContentBlock, string> = {
  store: 'Store information updated',
  announcement: 'Announcement bar updated',
  hero: 'Hero section updated successfully',
  sections: 'Homepage content updated',
  ads: 'Advertisement sections updated',
  seo: 'Search and sharing settings updated',
};

async function findBanner(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new HttpError(400, 'Invalid banner ID');
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new HttpError(404, 'Banner not found');
  return banner;
}

export const contentController = {
  // Storefront: everything the shop pages show, active content only.
  site: async (_req: Request, res: Response) => {
    // Content first: on a fresh database reading it also creates the starting banner.
    const content = await siteContent();
    const banners = await liveBanners();
    // The same for every visitor; after an admin save the storefront asks again with a fresh URL (see the frontend).
    sharedCache(res, 60);
    res.json({ ...publicContent(content), banners });
  },

  // Admin → Settings: the full document, inactive parts included.
  get: async (_req: Request, res: Response) => {
    res.json({ content: (await siteContent()).toJSON() });
  },
  // Saves one block (hero, store, ...). Each Settings section saves on its own.
  save: async (req: Request, res: Response) => {
    const block = req.params.block as ContentBlock;
    if (!CONTENT_BLOCKS.includes(block)) throw new HttpError(404, 'Unknown settings section');
    const value = validate[block](req.body);
    const content = await siteContent();
    content.set(block, value);
    await content.save();
    res.json({ message: BLOCK_SAVED[block], content: content.toJSON() });
  },

  banners: async (_req: Request, res: Response) => {
    await siteContent(); // creates the starting banner on a fresh database
    res.json({ banners: await Banner.find().sort({ updatedAt: -1 }).lean() });
  },
  createBanner: async (req: Request, res: Response) => {
    const banner = await Banner.create(validate.banner(req.body));
    res.status(201).json({ message: banner.active ? 'Banner published' : 'Banner saved as inactive', banner });
  },
  updateBanner: async (req: Request, res: Response) => {
    const banner = await findBanner(req);
    banner.set(validate.banner(req.body));
    await banner.save();
    res.json({ message: 'Banner updated', banner });
  },
  setBannerActive: async (req: Request, res: Response) => {
    if (typeof req.body?.active !== 'boolean') throw new HttpError(400, 'active must be true or false');
    const banner = await findBanner(req);
    banner.active = req.body.active;
    await banner.save();
    res.json({ message: banner.active ? 'Banner enabled' : 'Banner disabled', banner });
  },
  removeBanner: async (req: Request, res: Response) => {
    const banner = await findBanner(req);
    await banner.deleteOne();
    res.json({ message: 'Banner deleted' });
  },
};

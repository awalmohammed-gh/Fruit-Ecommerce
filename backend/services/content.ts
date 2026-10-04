import SiteContent from '../models/SiteContent.js';
import Banner from '../models/Banner.js';
import { DEFAULT_BANNERS, DEFAULT_CONTENT } from '../config/siteDefaults.js';

// The single content document. The first read creates it, together with the starting banner,
// so a fresh database shows the original home page. Deleted banners are never re-created.
export async function siteContent() {
  const existing = await SiteContent.findOne({ key: 'site' });
  if (existing) return existing;
  try {
    const created = await SiteContent.create(DEFAULT_CONTENT);
    await Banner.insertMany(DEFAULT_BANNERS);
    return created;
  } catch (error) {
    // Two first requests at once: the other one created it.
    if ((error as { code?: number }).code === 11000) return (await SiteContent.findOne({ key: 'site' }))!;
    throw error;
  }
}

// Active banners whose schedule (if any) includes now.
export function liveBanners(now = new Date()) {
  return Banner.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  }).sort({ updatedAt: -1 }).select('-name -active -startsAt -endsAt -createdAt').lean();
}

type Content = Awaited<ReturnType<typeof siteContent>>;

// What shoppers may see: inactive slides, ads and the announcement are left out.
export function publicContent(content: Content) {
  // Every block always exists (the schema gives each one a default), hence the '!'.
  const { store, announcement, hero, sections, ads, seo } = content;
  const slides = hero!.mode === 'single'
    ? (hero!.single?.active ? [hero!.single] : [])
    : hero!.slides.filter((slide) => slide.active);
  return {
    store,
    announcement: announcement!.active ? announcement : null,
    hero: { autoplaySeconds: hero!.autoplaySeconds, slides },
    sections,
    ads: { partner: ads!.partner?.active ? ads!.partner : null, newsletter: ads!.newsletter?.active ? ads!.newsletter : null },
    seo,
  };
}

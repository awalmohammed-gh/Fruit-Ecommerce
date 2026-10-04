// What the storefront shows before the admin changes anything: the original home page wording.
// Used once, to create the content document and the first banner. After that the database is the only source.
// Image paths starting with "/" are files served by the storefront (frontend/public/content).

const hero = {
  image: '/content/hero-banner.jpg',
  label: 'Welcome to Green Farm',
  heading: 'Fresh Produce,',
  highlight: 'Better Living.',
  description: 'Fill your kitchen with farm-fresh groceries and everyday favourites. Shop in a few clicks, delivered to your doorstep in Accra.',
  primaryText: 'Shop Now',
  primaryLink: '/products',
  secondaryText: 'Browse Categories',
  secondaryLink: '#categories',
  active: true,
};

// Search and sharing defaults. Pages without their own SEO text fall back to these.
export const SEO_DEFAULTS = {
  siteName: 'GreenFarm',
  defaultTitle: 'GreenFarm | Fresh Groceries Delivered in Accra',
  defaultDescription: 'Shop fresh fruit, vegetables, dairy, bakery and pantry staples online. GreenFarm delivers farm-fresh groceries to your door in Accra, Ghana.',
  socialImage: '/content/hero-banner.jpg',
};

export const DEFAULT_CONTENT = {
  key: 'site',
  store: {
    description: "Your trusted source for fresh, organic produce delivered straight from the farm to your doorstep. Quality you can taste, prices you'll love.",
    address: 'Spintex Road, Accra, Ghana',
    phone: '024 152 9904',
    email: 'info@greenfarm.com',
  },
  announcement: { active: true, message: 'Fresh groceries delivered across Accra', secondary: 'Green Farm produce delivery daily' },
  hero: { mode: 'single' as const, autoplaySeconds: 6, single: hero, slides: [hero] },
  sections: {
    features: [
      { title: 'Fresh selection', description: 'Produce and daily essentials' },
      { title: 'Doorstep delivery', description: 'Less carrying, more living' },
      { title: 'Easy shopping', description: 'Your groceries in a few clicks' },
      { title: 'Serving Accra', description: 'Shop from the comfort of home' },
    ],
    categories: { eyebrow: 'Something for every kitchen', heading: 'Shop by category', description: 'From fresh picks to the essentials you reach for every day.' },
    popular: { eyebrow: 'Make room for your favourites', heading: 'Popular picks', description: 'Explore some of our highest-rated groceries.' },
  },
  ads: {
    partner: {
      active: true,
      label: 'Now recruiting riders and drivers',
      title: 'Deliver with Green Farm',
      description: 'Got a motorbike, bicycle, car or van? Bring fresh groceries to homes in your area on a schedule that works for you.',
      points: ['Choose your hours', 'Deliver near home'],
      ctaText: 'Become a delivery partner',
      ctaLink: '/delivery-partner/apply',
      image: '',
    },
    newsletter: {
      active: true,
      label: 'Stay in the loop',
      title: 'Fresh news, fresh finds.',
      description: 'Our newsletter is coming soon. In the meantime, explore the latest offers in our shop.',
      points: [],
      ctaText: 'Explore deals',
      ctaLink: '/deals',
      image: '',
    },
  },
};

export const DEFAULT_BANNERS = [{
  name: 'Weekly shop delivery',
  placement: 'home-middle',
  badge: 'From your screen to your doorstep',
  title: 'Your weekly shop.',
  highlight: 'Without the trip.',
  description: 'More time for the things you love. Browse fresh produce, restock your pantry, and let Green Farm bring your groceries to you.',
  image: '/content/delivery-van.png',
  buttonText: 'Start shopping',
  buttonLink: '/products',
  active: true,
}];

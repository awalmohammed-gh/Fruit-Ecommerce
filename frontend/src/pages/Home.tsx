import Features from "../components/landing/Features"
import Hero from "../components/landing/Hero"
import HomeCategories from "../components/landing/HomeCategories"
import Newsletter from "../components/landing/Newsletter"
import PopularProduct from "../components/landing/PopularProduct"
import PromoBanners from "../components/landing/PromoBanner"
import PartnerCallout from "../components/landing/PartnerCallout"

// Hero, banners and section wording come from Admin → Settings.
const Home = () => {
  return (
    <div>
      <Hero />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 space-y-12 sm:space-y-16">
        <Features />
        <PromoBanners placement="home-top" />
        <HomeCategories />
        <PopularProduct />
        <PromoBanners placement="home-middle" />
        <PartnerCallout />
        <PromoBanners placement="home-bottom" />
        <Newsletter />
      </div>
    </div>
  );
}

export default Home

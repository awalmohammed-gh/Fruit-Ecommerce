import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Leaf, Pause, Play } from "lucide-react";
import ContentLink from "../common/ContentLink";
import { ease, fadeUp, stagger } from "../common/motion";
import { useSiteContent } from "../../hooks/useSiteContent";
import { sizedImage } from "../../utils/links";
import type { HeroSlide } from "../../frontApisRoute/content";

interface HeroViewProps {
  slides: HeroSlide[];
  autoplaySeconds: number;
  /** Admin preview: fills its frame instead of the screen and never slides on its own. */
  preview?: boolean;
  /** The slide shown first (the admin preview opens on the slide being edited). */
  start?: number;
}

const controlClass = "size-10 rounded-full flex-center bg-white/80 text-app-green border border-app-green/15 hover:bg-white transition-colors";

// One slide shows as a plain hero; two or more become a slider with arrows, dots and (optionally) auto-play.
export function HeroView({ slides, autoplaySeconds, preview = false, start = 0 }: HeroViewProps) {
  const section = useRef<HTMLElement>(null);
  // The photo drifts slower than the page while the hero scrolls away.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(start);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const swipeFrom = useRef<number | null>(null);
  // The first picture is the page's largest element, so it gets the bandwidth to itself. The other slides'
  // pictures start once it has arrived (well before the first change), so they still cross-fade smoothly.
  const [othersReady, setOthersReady] = useState(preview || !slides[start]?.image);
  const releaseOthers = () => setOthersReady(true);

  const count = slides.length;
  const current = Math.min(index, count - 1);
  const slide = slides[current]!;
  const isSlider = count > 1;
  const go = (step: number) => setIndex((current + step + count) % count);

  // Auto-play waits while the pointer or keyboard focus is on the hero, and never runs for visitors who ask for less motion.
  const autoplay = isSlider && autoplaySeconds > 0 && !preview && !reduceMotion && !paused && !holding;
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), autoplaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [autoplay, current, count, autoplaySeconds]);

  // Phones: swipe left or right to change slide.
  const swipeStart = (event: PointerEvent) => { if (event.pointerType === "touch") swipeFrom.current = event.clientX; };
  const swipeEnd = (event: PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (from !== null && Math.abs(event.clientX - from) > 50) go(event.clientX < from ? 1 : -1);
  };

  return (
    <section
      ref={section}
      className={`relative ${preview ? "h-full" : "h-svh"} overflow-hidden flex items-center bg-[#e5e5e7]`}
      {...(isSlider
        ? { "aria-roledescription": "carousel", "aria-label": "Featured", onPointerDown: swipeStart, onPointerUp: swipeEnd, style: { touchAction: "pan-y" } }
        : { "aria-labelledby": "hero-heading" })}
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false); }}
    >
      {/* Every slide's picture is stacked here and cross-fades, so changing slide never moves the layout. */}
      <motion.div className="absolute inset-0" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }} style={{ y: preview ? 0 : imageY }}>
        {slides.map((item, position) => item.image && (othersReady || position === current) && (
          <img key={item._id ?? position} src={sizedImage(item.image, 1920)} alt="" fetchPriority={position === start ? "high" : "low"} decoding={position === start ? "sync" : "async"}
            onLoad={othersReady ? undefined : releaseOthers} onError={othersReady ? undefined : releaseOthers}
            className={`absolute inset-0 h-full w-full object-cover object-[65%_center] lg:object-center transition-opacity duration-700 ${position === current ? "opacity-100" : "opacity-0"}`} />
        ))}
      </motion.div>
      <div className="absolute inset-0 bg-linear-to-r from-[#e5e5e7]/95 via-[#e5e5e7]/85 to-[#e5e5e7]/30 lg:via-[#e5e5e7]/20 lg:to-transparent" aria-hidden="true"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 w-full" aria-live={isSlider && !autoplay ? "polite" : "off"}>
        <AnimatePresence mode="wait">
          <motion.div key={current} className="max-w-xl lg:max-w-[46%]" initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }} variants={stagger(0.12, 0.15)}
            {...(isSlider ? { role: "group", "aria-roledescription": "slide", "aria-label": `${current + 1} of ${count}` } : {})}>
            {slide.label && (
              <motion.span variants={fadeUp} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-app-green bg-white/70 rounded-full mb-5">
                <Leaf className="size-4" aria-hidden="true" /> {slide.label}
              </motion.span>
            )}
            <motion.h1 variants={fadeUp} id="hero-heading" className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-app-green leading-[1.08] tracking-tight mb-5 wrap-break-word">
              {slide.heading}{slide.highlight && <>{" "}<span className="block text-app-orange-dark">{slide.highlight}</span></>}
            </motion.h1>
            {slide.description && <motion.p variants={fadeUp} className="text-base lg:text-lg text-gray-700 leading-relaxed mb-8 max-w-md">{slide.description}</motion.p>}
            {(slide.primaryText || slide.secondaryText) && (
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                {slide.primaryText && (
                  <ContentLink to={slide.primaryLink} className="px-6 py-3.5 bg-app-green text-white font-semibold rounded-full hover:bg-app-green-light transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg hover:shadow-xl hover:gap-3 group">
                    {slide.primaryText}
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
                  </ContentLink>
                )}
                {slide.secondaryText && (
                  <ContentLink to={slide.secondaryLink} className="px-6 py-3.5 bg-white/70 text-app-green font-semibold rounded-full hover:bg-white transition-all duration-300 border border-app-green/20 flex items-center justify-center gap-2 hover:border-app-green/40 group">
                    {slide.secondaryText}
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
                  </ContentLink>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isSlider && (
        <div className="absolute inset-x-0 bottom-5 sm:bottom-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center">
              {slides.map((item, position) => (
                <button key={item._id ?? position} type="button" onClick={() => setIndex(position)} aria-label={`Show slide ${position + 1}`} aria-current={position === current ? "true" : undefined} className="px-1 py-3">
                  <span className={`block h-2 rounded-full transition-all duration-300 ${position === current ? "w-6 bg-app-green" : "w-2 bg-app-green/30 hover:bg-app-green/50"}`} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {autoplaySeconds > 0 && !reduceMotion && (
                <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play slides" : "Pause slides"} className={controlClass}>
                  {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                </button>
              )}
              <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className={controlClass}><ChevronLeft className="size-5" aria-hidden="true" /></button>
              <button type="button" onClick={() => go(1)} aria-label="Next slide" className={controlClass}><ChevronRight className="size-5" aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// The home page hero, as set in Admin → Settings → Hero Section.
const Hero = () => {
  const { data, error } = useSiteContent();
  // Same size as the hero while the first copy loads, so the page doesn't jump when it arrives.
  if (!data) return error ? null : <section className="h-svh bg-[#e5e5e7]" aria-busy="true" aria-label="Loading" />;
  // With the hero turned off the page still needs its main heading, for search engines and screen readers.
  if (data.hero.slides.length === 0) return <h1 className="sr-only">{data.seo?.defaultTitle || "GreenFarm"}</h1>;
  return <HeroView slides={data.hero.slides} autoplaySeconds={data.hero.autoplaySeconds} />;
};

export default Hero;

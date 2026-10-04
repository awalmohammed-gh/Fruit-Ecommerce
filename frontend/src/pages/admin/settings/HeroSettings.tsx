import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, GalleryHorizontalIcon, ImageIcon, MonitorIcon, PlusIcon, Trash2Icon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Panel from "../../../components/admin/Panel";
import Badge from "../../../components/admin/Badge";
import ScaledPreview from "../../../components/admin/ScaledPreview";
import { ConfirmDialog } from "../../../components/admin/Modal";
import { Notice } from "../../../components/admin/States";
import { HeroView } from "../../../components/landing/Hero";
import type { HeroSettings as Hero, HeroSlide } from "../../../frontApisRoute/content";
import { FieldGroup, SaveBar, SwitchField, TextField } from "./fields";
import ImageField from "./ImageField";
import { hasProblems, LINK_HINT, slideProblems, type Problems } from "./checks";
import { useContentDraft, useLinkOptions, type SectionProps } from "./useContentDraft";
import ui from "../../../components/admin/ui.module.css";
import s from "./settings.module.css";

const MAX_SLIDES = 6;
const HERO_SIZE = { width: 1920, height: 840 };
const BLANK_SLIDE: HeroSlide = { image: "", label: "", heading: "", highlight: "", description: "", primaryText: "Shop Now", primaryLink: "/products", secondaryText: "", secondaryLink: "", active: true };
const AUTOPLAY = [0, 4, 5, 6, 8, 10, 15];

// The fields of one hero (single mode) or one slide (slider mode).
function SlideForm({ slide, onChange, problems, isSlide }: { slide: HeroSlide; onChange: (patch: Partial<HeroSlide>) => void; problems: Problems<HeroSlide>; isSlide: boolean }) {
  const links = useLinkOptions();
  return (
    <div className={s.fields}>
      <SwitchField label={isSlide ? "Show this slide" : "Show the hero on the homepage"} hint={isSlide ? "Hidden slides stay here for later." : "When off, the homepage starts with the store highlights."}
        checked={slide.active} onChange={(active) => onChange({ active })} />
      <ImageField label="Hero image" value={slide.image} onChange={(image) => onChange({ image })} recommended={HERO_SIZE}
        note="The left side sits behind the text, so keep the main subject on the right." error={problems.image} />
      <div className={ui.formGrid}>
        <TextField label="Small label" optional value={slide.label} onChange={(label) => onChange({ label })} max={60} placeholder="Welcome to Green Farm" hint="The pill above the heading." />
        <TextField label="Heading" value={slide.heading} onChange={(heading) => onChange({ heading })} max={90} placeholder="Fresh groceries delivered to your door" error={problems.heading} />
        <TextField label="Highlighted text" optional value={slide.highlight} onChange={(highlight) => onChange({ highlight })} max={60} placeholder="Better Living." hint="Shown in orange on its own line, after the heading." className={ui.span2} />
        <TextField label="Description" optional multiline value={slide.description} onChange={(description) => onChange({ description })} max={240} className={ui.span2} />
      </div>
      <FieldGroup title="Main button">
        <div className={ui.formGrid}>
          <TextField label="Button text" optional value={slide.primaryText} onChange={(primaryText) => onChange({ primaryText })} max={30} placeholder="Shop Now" error={problems.primaryText} />
          <TextField label="Button link" optional value={slide.primaryLink} onChange={(primaryLink) => onChange({ primaryLink })} max={300} placeholder="/products" options={links} hint={LINK_HINT} error={problems.primaryLink} />
        </div>
      </FieldGroup>
      <FieldGroup title="Second button">
        <div className={ui.formGrid}>
          <TextField label="Button text" optional value={slide.secondaryText} onChange={(secondaryText) => onChange({ secondaryText })} max={30} placeholder="Browse Categories" error={problems.secondaryText} />
          <TextField label="Button link" optional value={slide.secondaryLink} onChange={(secondaryLink) => onChange({ secondaryLink })} max={300} placeholder="#categories" options={links} hint="Leave both empty for a single button." error={problems.secondaryLink} />
        </div>
      </FieldGroup>
    </div>
  );
}

export default function HeroSettings(props: SectionProps) {
  const { draft, setDraft, dirty, saving, save, discard } = useContentDraft("hero", ["hero"], props);
  const hero = draft.hero;
  const [selected, setSelected] = useState(0);
  const [checked, setChecked] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const isSlider = hero.mode === "slider";
  const index = Math.min(selected, Math.max(hero.slides.length - 1, 0));
  const editing = isSlider ? hero.slides[index] : hero.single;
  const setHero = (change: Partial<Hero>) => setDraft((previous) => ({ hero: { ...previous.hero, ...change } }));
  const setSlides = (slides: HeroSlide[]) => setHero({ slides });
  const updateEditing = (patch: Partial<HeroSlide>) => isSlider
    ? setSlides(hero.slides.map((slide, position) => (position === index ? { ...slide, ...patch } : slide)))
    : setHero({ single: { ...hero.single, ...patch } });

  const addSlide = () => {
    setSlides([...hero.slides, { ...BLANK_SLIDE }]);
    setSelected(hero.slides.length);
  };
  const move = (from: number, step: number) => {
    const slides = [...hero.slides];
    const [slide] = slides.splice(from, 1);
    slides.splice(from + step, 0, slide!);
    setSlides(slides);
    if (selected === from) setSelected(from + step);
    else if (selected === from + step) setSelected(from);
  };
  const remove = () => {
    if (removing === null) return;
    setSlides(hero.slides.filter((_, position) => position !== removing));
    setSelected((value) => Math.max(0, value > removing ? value - 1 : value === removing ? removing - 1 : value));
    setRemoving(null);
  };

  const problemsFor = (slide: HeroSlide) => (checked ? slideProblems(slide) : {});
  const onSave = () => {
    // Check what the storefront will use: the single hero, or every slide.
    const list = isSlider ? hero.slides : [hero.single];
    const bad = list.findIndex((slide) => hasProblems(slideProblems(slide)));
    setChecked(true);
    if (bad >= 0) {
      if (isSlider) setSelected(bad);
      toast.error("Some fields need attention", { description: isSlider ? `Slide ${bad + 1}: ${Object.values(slideProblems(list[bad]!))[0]}.` : `${Object.values(slideProblems(list[bad]!))[0]}.` });
      return;
    }
    void save();
  };

  // The preview shows what shoppers would see; a hidden slide is previewed on its own.
  const activeSlides = isSlider ? hero.slides.filter((slide) => slide.active) : [hero.single];
  const previewSlides = editing && !editing.active ? [editing] : activeSlides;
  const previewStart = editing ? Math.max(0, previewSlides.indexOf(editing)) : 0;
  const activeCount = hero.slides.filter((slide) => slide.active).length;

  return (
    <>
      <div className={s.split}>
        <div className={s.stack}>
          <Panel id="hero-type" title="Hero type" description="Choose one hero, or several slides that rotate.">
            <div className={s.choices} role="radiogroup" aria-label="Hero type">
              {([
                { value: "single", title: "Single hero", text: "One picture and message.", icon: ImageIcon },
                { value: "slider", title: "Hero slider", text: "Several slides that rotate.", icon: GalleryHorizontalIcon },
              ] as const).map((choice) => (
                <label key={choice.value} className={`${s.choice} ${hero.mode === choice.value ? s.choiceActive : ""}`}>
                  <input type="radio" name="hero-mode" value={choice.value} checked={hero.mode === choice.value}
                    onChange={() => { setHero({ mode: choice.value }); setSelected(0); }} />
                  <span className={s.choiceIcon}><choice.icon aria-hidden="true" /></span>
                  <span><span className={s.choiceTitle}>{choice.title}</span><span className={s.choiceText}>{choice.text}</span></span>
                </label>
              ))}
            </div>
            {isSlider && (
              <div className={s.inlineField}>
                <label htmlFor="hero-autoplay" className={ui.cellStack}>
                  <span className={ui.cellPrimary}>Change slide automatically</span>
                  <span className={ui.cellSecondary}>Pauses while a shopper points at or uses the slider.</span>
                </label>
                <select id="hero-autoplay" className={`${ui.select} ${s.select}`} value={hero.autoplaySeconds} onChange={(event) => setHero({ autoplaySeconds: Number(event.target.value) })}>
                  {AUTOPLAY.map((seconds) => <option key={seconds} value={seconds}>{seconds ? `Every ${seconds} seconds` : "Off"}</option>)}
                </select>
              </div>
            )}
          </Panel>

          {isSlider && (
            <Panel id="hero-slides" title="Slides" flush description={`Shown in this order. ${hero.slides.length} of ${MAX_SLIDES} slides.`}
              actions={<button type="button" className={`${ui.button} ${ui.secondary} ${ui.small}`} onClick={addSlide} disabled={hero.slides.length >= MAX_SLIDES}><PlusIcon aria-hidden="true" /> Add slide</button>}>
              {hero.slides.length === 0
                ? <div className={ui.panelBody}><p className={ui.hint}>No slides yet. Add one to start the slider.</p></div>
                : (
                  <ol className={s.slides}>
                    {hero.slides.map((slide, position) => {
                      const problems = problemsFor(slide);
                      const name = slide.heading || "Untitled slide";
                      return (
                        <li key={slide._id ?? `new-${position}`} className={`${s.slide} ${position === index ? s.slideSelected : ""}`}>
                          <button type="button" className={s.slideMain} onClick={() => setSelected(position)} aria-current={position === index ? "true" : undefined} aria-label={`Edit slide ${position + 1}: ${name}`}>
                            <span className={s.slideOrder}>{position + 1}</span>
                            {slide.image ? <img src={slide.image} alt="" className={s.slideThumb} /> : <span className={s.slideThumb} aria-hidden="true" />}
                            <span className={s.slideText}><strong>{name}</strong><span>{slide.label || slide.description || "No description"}</span></span>
                          </button>
                          <div className={s.slideTools}>
                            {hasProblems(problems) ? <Badge tone="danger">Needs attention</Badge> : <Badge tone={slide.active ? "success" : "neutral"}>{slide.active ? "Active" : "Hidden"}</Badge>}
                            <input type="checkbox" role="switch" className={ui.switch} checked={slide.active} aria-label={`Show slide ${position + 1}`}
                              onChange={(event) => setSlides(hero.slides.map((item, at) => (at === position ? { ...item, active: event.target.checked } : item)))} />
                            <button type="button" className={ui.iconButton} onClick={() => move(position, -1)} disabled={position === 0} aria-label={`Move slide ${position + 1} up`}><ArrowUpIcon aria-hidden="true" /></button>
                            <button type="button" className={ui.iconButton} onClick={() => move(position, 1)} disabled={position === hero.slides.length - 1} aria-label={`Move slide ${position + 1} down`}><ArrowDownIcon aria-hidden="true" /></button>
                            <button type="button" className={ui.iconButton} onClick={() => setRemoving(position)} aria-label={`Delete slide ${position + 1}`}><Trash2Icon aria-hidden="true" /></button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
            </Panel>
          )}

          {isSlider && activeCount === 0 && <Notice>No slide is active, so the homepage won't show a hero. Turn on at least one slide.</Notice>}

          {editing && (
            <Panel id="hero-editor" title={isSlider ? `Slide ${index + 1}` : "Hero content"} description={isSlider ? "Each slide has its own picture, words and buttons." : "The first thing shoppers see on the homepage."}>
              <SlideForm key={isSlider ? `slide-${index}` : "single"} slide={editing} onChange={updateEditing} problems={problemsFor(editing)} isSlide={isSlider} />
            </Panel>
          )}
        </div>

        <div className={s.sticky}>
          <Panel id="hero-preview" title="Preview" description="Updates as you type. Not live until you save.">
            {previewSlides.length > 0 && editing
              ? (
                <>
                  <ScaledPreview height={720}>
                    <HeroView key={`${hero.mode}-${previewStart}-${previewSlides.length}`} slides={previewSlides} autoplaySeconds={0} preview start={previewStart} />
                  </ScaledPreview>
                  <p className={s.previewNote}>
                    {editing.active ? <><MonitorIcon aria-hidden="true" /> Homepage on a computer screen{isSlider && activeSlides.length > 1 ? ` · slide ${previewStart + 1} of ${activeSlides.length}` : ""}</>
                      : <><EyeOffIcon aria-hidden="true" /> This {isSlider ? "slide" : "hero"} is hidden, so shoppers won't see it.</>}
                  </p>
                </>
              )
              : <div className={s.previewEmpty}>Add a slide to see the preview.</div>}
          </Panel>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={() => { discard(); setChecked(false); }} label="Publish changes" />

      <ConfirmDialog open={removing !== null} title={`Delete slide ${(removing ?? 0) + 1}?`} confirmLabel="Delete slide" onClose={() => setRemoving(null)} onConfirm={remove}
        message={<>“{hero.slides[removing ?? 0]?.heading || "Untitled slide"}” is removed from the slider when you publish. To keep it for later, turn it off instead.</>} />
    </>
  );
}

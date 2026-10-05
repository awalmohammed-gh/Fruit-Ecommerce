import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ClipboardListIcon, ClockIcon, KeyRoundIcon, MapPinIcon, SmartphoneIcon, TruckIcon, UserCheckIcon } from "lucide-react";
import { deliveryApi, type PartnerApplication } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import ApplicationForm from "../../components/Delivery/ApplicationForm";
import ApplicationStatusCard from "../../components/Delivery/ApplicationStatusCard";
import { fadeUp, stagger } from "../../components/common/motion";
import { forgetApplication, saveApplication, savedApplication } from "../../utils/partnerApplication";
import styles from "./DeliveryApply.module.css";

const perks = [
  { icon: ClockIcon, title: "Choose your hours", text: "Full-time, weekends, evenings or on call." },
  { icon: MapPinIcon, title: "Deliver near you", text: "We match deliveries to the area you live in." },
  { icon: SmartphoneIcon, title: "Everything on your phone", text: "See each drop-off and update it in a tap." },
];
const steps = [
  { icon: ClipboardListIcon, title: "Apply", text: "No GreenFarm shopping account needed." },
  { icon: UserCheckIcon, title: "We review", text: "GreenFarm checks your details and approves you." },
  { icon: KeyRoundIcon, title: "Activate", text: "Set your password with your reference code." },
  { icon: TruckIcon, title: "Start delivering", text: "Assigned orders appear in your dashboard." },
];

function Intro() {
  return (
    <motion.section initial="hidden" animate="show" variants={stagger(0.08)} className={`${styles.intro} relative overflow-hidden rounded-3xl bg-app-green text-white`}>
      <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/5" aria-hidden="true" />
      <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider text-green-200 mb-3">GreenFarm delivery partners</motion.p>
      <motion.h1 variants={fadeUp} className={styles.title}>Bring fresh groceries to your neighbours.</motion.h1>
      <motion.p variants={fadeUp} className="text-white/75 mt-4 max-w-xl text-sm sm:text-base leading-relaxed">
        Apply to deliver GreenFarm orders by motorbike, bicycle, car or van. Every application is reviewed by our team before you can take deliveries.
      </motion.p>
      <motion.ul variants={fadeUp} className={styles.perks}>
        {perks.map(({ icon: Icon, title, text }) => (
          <li key={title} className={styles.perk}>
            <Icon className="size-5 text-orange-300 mb-2" aria-hidden="true" />
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-white/70 mt-1">{text}</p>
          </li>
        ))}
      </motion.ul>
    </motion.section>
  );
}

function Steps() {
  return (
    <ol className={styles.steps}>
      {steps.map(({ icon: Icon, title, text }, index) => (
        <li key={title} className={styles.step}>
          <span className="size-10 rounded-xl bg-app-cream text-app-green flex-center shrink-0"><Icon className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="text-sm font-semibold text-app-green"><span className="text-app-text-light font-normal">{index + 1}. </span>{title}</p>
            <p className="text-xs text-app-text-light mt-0.5">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Public: anyone can apply here without a GreenFarm customer account.
export default function DeliveryApply() {
  // An application submitted during this page visit, retained across client-side navigation.
  const [saved, setSaved] = useState(savedApplication);
  // A refresh forgets the email and reference; status can still be checked by entering them again.
  const known = saved?.reference ? saved : null;
  const [submitted, setSubmitted] = useState<{ application: PartnerApplication; reference: string } | null>(null);
  const [reapplying, setReapplying] = useState(false);
  const lookup = useResource(`partner-status:${known?.email ?? ""}:${known?.reference ?? ""}`, () => (known && !submitted ? deliveryApi.status(known.email, known.reference) : Promise.resolve(null)));
  const current = submitted?.application ?? lookup.data?.application ?? null;
  const reference = submitted?.reference ?? saved?.reference ?? "";

  const startOver = () => { forgetApplication(); setSaved(null); setSubmitted(null); setReapplying(false); };
  const showForm = reapplying || (!current && !(known && !lookup.error && !lookup.data));

  let body;
  if (showForm) {
    body = (
      <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-app-green">Delivery partner application</h2>
            <p className="text-sm text-app-text-light">Takes about five minutes. Fields marked optional can be left blank.</p>
          </div>
          <p className="text-sm text-app-text-light">
            Already applied? <Link to="/delivery-partner/status" className="font-semibold text-app-green hover:underline">Check your status</Link>
          </p>
        </div>
        {saved && !known && !reapplying && (
          <p className="mb-4 rounded-xl bg-app-cream border border-app-border p-3 text-sm text-zinc-700">
            You applied before as <strong>{saved.email}</strong>. <Link to="/delivery-partner/status" className="font-semibold text-app-green hover:underline">Check your status</Link> with your reference code.
          </p>
        )}
        {known && lookup.error && !reapplying && (
          <p role="alert" className="mb-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-900">We couldn't load the application saved on this device ({lookup.error}). You can check it from the status page, or apply below.</p>
        )}
        <ApplicationForm
          previous={reapplying ? current : null}
          onSubmitted={(application, code) => {
            saveApplication({ email: application.email, reference: code });
            setSaved({ email: application.email, reference: code });
            setSubmitted({ application, reference: code });
            setReapplying(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </>
    );
  } else if (!current) {
    body = <div role="status" className="bg-white rounded-2xl border border-app-border/60 p-10 text-center text-sm text-app-text-light">Loading your application…</div>;
  } else {
    body = (
      <div className="space-y-3">
        <ApplicationStatusCard application={current} reference={reference} justSubmitted={submitted !== null} onApplyAgain={() => setReapplying(true)} />
        <p className="text-center text-xs text-app-text-light">
          Not your application? <button type="button" onClick={startOver} className="font-semibold text-app-green hover:underline">Start a new one</button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Intro />
      <div className={showForm ? styles.applicationLayout : undefined}>
        {showForm && <aside className={styles.guide} aria-labelledby="application-guide-title">
          <p className={styles.guideEyebrow}>GETTING STARTED</p>
          <h2 id="application-guide-title">Your journey to delivering</h2>
          <Steps />
          <div className={styles.checklist}><h3>Have these ready</h3><ul><li>Your contact and address details</li><li>A valid ID and emergency contact</li><li>Vehicle and licence details, if you drive</li></ul><p>After you submit, save your reference code. You’ll need it to check your status and activate your account.</p></div>
        </aside>}
        <div className={styles.formArea}>{body}</div>
      </div>
      <p className="text-center text-sm text-app-text-light">
        Already a delivery partner? <Link to="/delivery-partner/login" className="font-semibold text-app-green hover:underline">Sign in to your dashboard</Link>
      </p>
    </div>
  );
}

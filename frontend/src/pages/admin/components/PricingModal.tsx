import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import Thumb from "../../../components/admin/Thumb";
import Badge from "../../../components/admin/Badge";
import { Notice } from "../../../components/admin/States";
import { productsApi, type AdminProduct } from "../../../frontApisRoute/products";
import { discountPreview } from "../lib/useCategories";
import { money } from "../lib/format";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface PricingModalProps { product: AdminProduct; onClose: () => void; onSaved: (product: AdminProduct) => void }

// Sets a sale: the "was" price plus the new selling price. The server calculates the discount.
export default function PricingModal({ product, onClose, onSaved }: PricingModalProps) {
  const onSale = product.originalPrice > product.price;
  const [price, setPrice] = useState(String(product.price));
  const [original, setOriginal] = useState(String(onSale ? product.originalPrice : product.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const priceValue = Number(price);
  const originalValue = Number(original);
  const valid = price.trim() !== "" && original.trim() !== "" && priceValue >= 0 && originalValue >= 0;
  const tooLow = valid && originalValue < priceValue;
  const discount = valid ? discountPreview(priceValue, originalValue) : 0;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || tooLow || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await productsApi.update(product._id, { price: priceValue, originalPrice: originalValue });
      toast.success(result.product.discount > 0 ? `${result.product.name} is now ${result.product.discount}% off` : `${result.product.name} price updated`);
      onSaved(result.product);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update pricing");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={saving} title={onSale ? "Edit deal" : "Create deal"} description="Customers see the original price struck through next to the selling price."
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="pricing-form" className={`${ui.button} ${ui.primary}`} disabled={!valid || tooLow || saving}>
            {saving && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />} Save pricing
          </button>
        </>
      }>
      <form id="pricing-form" onSubmit={save} className={styles.stack16}>
        <div className={ui.productCell}>
          <Thumb src={product.image} size={48} />
          <div className={ui.cellStack}>
            <span className={ui.cellPrimary}>{product.name}</span>
            <span className={ui.cellSecondary}>{product.unit} · now {money(product.price)}</span>
          </div>
        </div>
        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="deal-original">Original price</label>
            <div className={ui.affix}><span className={ui.affixText}>GHS</span><input id="deal-original" className={`${ui.input} ${ui.num}`} type="number" min={0} step="0.01" value={original} onChange={(event) => setOriginal(event.target.value)} /></div>
            <span className={ui.hint}>The price before the discount.</span>
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="deal-price">Selling price</label>
            <div className={ui.affix}><span className={ui.affixText}>GHS</span><input id="deal-price" className={`${ui.input} ${ui.num}`} type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} autoFocus /></div>
            <span className={ui.hint}>What customers pay.</span>
          </div>
        </div>
        <div className={styles.inlineStatus}>
          <span className={ui.hint}>Discount</span>
          {discount > 0 ? <Badge tone="deal">{discount}% off · saves {money(originalValue - priceValue)}</Badge> : <Badge tone="neutral">No discount</Badge>}
        </div>
        {tooLow && <Notice tone="error">The original price can't be lower than the selling price.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}

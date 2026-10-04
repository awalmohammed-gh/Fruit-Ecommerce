import { useState, type FormEvent } from "react";
import { LoaderCircleIcon, MinusIcon, PlusIcon } from "lucide-react";
import toast from "../../../components/toast/toast";
import Modal from "../../../components/admin/Modal";
import Thumb from "../../../components/admin/Thumb";
import { StockBadge } from "../../../components/admin/Badge";
import { Notice } from "../../../components/admin/States";
import { productsApi, type AdminProduct } from "../../../frontApisRoute/products";
import { number } from "../lib/format";
import ui from "../../../components/admin/ui.module.css";
import styles from "../pages.module.css";

interface StockModalProps { product: AdminProduct; threshold: number; onClose: () => void; onSaved: (product: AdminProduct) => void }

// Quick stock update used by the products, inventory and dashboard screens.
export default function StockModal({ product, threshold, onClose, onSaved }: StockModalProps) {
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stock = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(stock) && stock >= 0;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await productsApi.update(product._id, { stock });
      toast.success(`Stock for ${result.product.name} set to ${number(result.product.stock)}`);
      onSaved(result.product);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update stock");
      setSaving(false);
    }
  };

  const adjust = (amount: number) => setValue(String(Math.max(0, (Number.isInteger(stock) ? stock : 0) + amount)));

  return (
    <Modal open onClose={onClose} busy={saving} title="Update stock" description="Set the number of units available to sell. Products at 0 stay listed as out of stock."
      footer={
        <>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="stock-form" className={`${ui.button} ${ui.primary}`} disabled={!valid || saving || stock === product.stock}>
            {saving && <LoaderCircleIcon className={ui.spin} aria-hidden="true" />} Save stock
          </button>
        </>
      }>
      <form id="stock-form" onSubmit={save} className={styles.stack16}>
        <div className={ui.productCell}>
          <Thumb src={product.image} size={48} />
          <div className={ui.cellStack}>
            <span className={ui.cellPrimary}>{product.name}</span>
            <span className={ui.cellSecondary}>{product.unit} · currently {number(product.stock)} in stock</span>
          </div>
        </div>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="stock-value">Units in stock</label>
          <div className={styles.stepper}>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => adjust(-1)} aria-label="Remove one unit"><MinusIcon aria-hidden="true" /></button>
            <input id="stock-value" className={`${ui.input} ${ui.num}`} type="number" min={0} step={1} inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => adjust(1)} aria-label="Add one unit"><PlusIcon aria-hidden="true" /></button>
          </div>
          <div className={styles.quickRow}>
            {[10, 25, 50].map((amount) => <button key={amount} type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => adjust(amount)}>+{amount}</button>)}
            <button type="button" className={`${ui.button} ${ui.ghost} ${ui.small}`} onClick={() => setValue("0")}>Mark out of stock</button>
          </div>
          {!valid && <span className={ui.hint} role="alert">Stock must be a whole number of zero or more.</span>}
        </div>
        {valid && <div className={styles.inlineStatus}><span className={ui.hint}>After saving</span><StockBadge stock={stock} threshold={threshold} /></div>}
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}

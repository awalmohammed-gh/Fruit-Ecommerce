import { useId } from "react";
import { Check, Leaf, PackageCheck, ShoppingBasket } from "lucide-react";
import type { Category } from "../../types";

interface FilterPanelProps {
  categories: Category[];
  category: string;
  minPrice: string;
  maxPrice: string;
  organic: boolean;
  inStock: boolean;
  updateFilter: (key: string, value: string) => void;
  clearFilter: () => void;
  hasFilters: boolean;
}
const FilterPanel = ({
  categories,
  category,
  minPrice,
  maxPrice,
  organic,
  inStock,
  updateFilter,
}: FilterPanelProps) => {
  const id = useId();
  return (
    <div className="market-filter-fields">
      <fieldset>
        <legend>Shop a department</legend>
        <p className="market-field-hint">
          A little of everything, or just what you need.
        </p>
        <div className="market-departments">
          <button
            type="button"
            aria-pressed={!category}
            onClick={() => updateFilter("category", "")}
            className={!category ? "selected" : ""}
          >
            <span className="market-all-icon">
              <PackageCheck size={22} />
            </span>
            <span>All groceries</span>
            {!category && <Check size={14} />}
          </button>
          {categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={category === item.slug}
              onClick={() => updateFilter("category", item.slug)}
              className={category === item.slug ? "selected" : ""}
            >
              {/* Categories without a picture yet (no products, no image) show a basket instead of an empty image. */}
              {item.image
                ? <img src={item.image} alt="" loading="lazy" width={40} height={40} />
                : <ShoppingBasket size={22} className="market-collection-placeholder" aria-hidden="true" />}
              <span>{item.name}</span>
              {category === item.slug && <Check size={14} />}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Your budget</legend>
        <p className="market-field-hint">
          Prices per pack or unit, in Ghana cedis.
        </p>
        <div className="market-price-inputs">
          {[
            { key: "minPrice", label: "From", value: minPrice },
            { key: "maxPrice", label: "To", value: maxPrice },
          ].map((field) => (
            <div key={field.key}>
              <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
              <div>
                <span>GHS</span>
                <input
                  id={`${id}-${field.key}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={field.key === "minPrice" ? "0" : "Any"}
                  value={field.value}
                  onChange={(event) =>
                    updateFilter(field.key, event.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
        {minPrice !== "" &&
          maxPrice !== "" &&
          Number(minPrice) > Number(maxPrice) && (
            <p role="status" className="market-price-error">
              Choose a maximum at least as high as your minimum.
            </p>
          )}
      </fieldset>
      <fieldset>
        <legend>A few preferences</legend>
        <label className="market-preference">
          <Leaf size={21} aria-hidden="true" />
          <span>
            <strong>Organic produce</strong>
            <small>Only products marked organic</small>
          </span>
          <input
            type="checkbox"
            checked={organic}
            onChange={(event) =>
              updateFilter("organic", event.target.checked ? "true" : "")
            }
            className="market-switch"
          />
        </label>
        <label className="market-preference">
          <PackageCheck size={21} aria-hidden="true" />
          <span>
            <strong>Ready for your basket</strong>
            <small>Only products currently in stock</small>
          </span>
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) =>
              updateFilter("inStock", event.target.checked ? "true" : "")
            }
            className="market-switch"
          />
        </label>
      </fieldset>
    </div>
  );
};
export default FilterPanel;

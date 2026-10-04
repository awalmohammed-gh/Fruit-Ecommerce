import { CheckIcon, MapPinIcon, PencilIcon, TrashIcon } from "lucide-react";
import type { SavedAddress } from "../../frontApisRoute/addresses";
interface Props {
  addr: SavedAddress;
  onEditHandler: (address: SavedAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  saving: boolean;
}
export default function AddressCard({
  addr,
  onEditHandler,
  onDelete,
  onSetDefault,
  saving,
}: Props) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${addr.isDefault ? "border-app-green/50" : "border-app-border/50 hover:border-app-green/30"}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-1 min-w-0">
          <div className="size-11 rounded-xl bg-app-cream flex-center shrink-0">
            <MapPinIcon className="size-5 text-app-green" />
          </div>
          <div className="flex-1 min-w-0 wrap-break-word">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <p className="text-sm font-semibold text-gray-800">
                {addr.label}
              </p>
              {addr.isDefault && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-app-green text-white rounded-full">
                  <CheckIcon className="size-2.5" />
                  Default
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-800">{addr.fullName}</p>
            <p className="text-sm text-app-text-light">{addr.phone}</p>
            <p className="text-sm text-app-text-light leading-relaxed mt-2">
              {addr.addressLine1}
              {addr.addressLine2 && (
                <>
                  <br />
                  {addr.addressLine2}
                </>
              )}
              <br />
              {addr.city}, {addr.region}
              <br />
              {addr.country}
            </p>
            {addr.digitalAddress && (
              <p className="text-xs text-app-green mt-2">
                Digital address: {addr.digitalAddress}
              </p>
            )}
            {addr.landmark && (
              <p className="text-xs text-app-text-light mt-1">
                Landmark: {addr.landmark}
              </p>
            )}
            {!addr.isDefault && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSetDefault(addr._id)}
                className="mt-3 text-xs font-semibold text-app-green hover:underline disabled:opacity-50"
              >
                Set as Default
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => onEditHandler(addr)}
            aria-label={`Edit ${addr.label} address`}
            className="p-2 text-app-text-light hover:text-app-green hover:bg-app-cream rounded-lg disabled:opacity-50"
          >
            <PencilIcon className="size-4" />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onDelete(addr._id)}
            aria-label={`Delete ${addr.label} address`}
            className="p-2 text-app-text-light hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

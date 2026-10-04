import { ChevronRightIcon, MapPinIcon, PlusIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SavedAddress } from '../../frontApisRoute/addresses';
interface Props {
  user: { addresses: SavedAddress[] }; address: SavedAddress | undefined;
  setAddress: (address: SavedAddress) => void; setStep: (step: string) => void;
  loading: boolean; error: string | null; refresh: () => void;
}
export default function CheckoutAddress({ user, address, setAddress, setStep, loading, error, refresh }: Props) {
  return <div className="bg-white rounded-2xl p-6 animate-fade-in">
    <h2 className="text-lg font-semibold text-app-green mb-5 flex items-center gap-2"><MapPinIcon className="size-5" />Delivery Address</h2>
    {loading ? <p role="status">Loading saved addresses...</p> : error ? <div><p role="alert" className="text-red-700">{error}</p><button onClick={refresh} className="mt-2 text-app-green underline">Try again</button></div> : user.addresses.length ?
      <div className="grid sm:grid-cols-2 gap-3">{user.addresses.map((item) => <button type="button" key={item._id} onClick={() => setAddress(item)} aria-pressed={address?._id === item._id}
        className={`p-4 text-left rounded-xl border transition-colors ${address?._id === item._id ? 'border-app-green bg-app-cream' : 'border-app-border hover:bg-app-cream'}`}>
        <div className="flex items-center gap-2 mb-1"><MapPinIcon className="size-4 text-app-green" /><span className="font-semibold text-zinc-900 text-sm">{item.label}</span>
          {item.isDefault && <span className="text-[10px] font-semibold text-app-orange bg-orange-50 px-2 py-0.5 rounded-full">Default</span>}</div>
        <p className="text-sm text-zinc-900">{item.fullName}</p><p className="text-sm text-zinc-600">{item.addressLine1}</p><p className="text-xs text-zinc-500">{item.city}, {item.region} {item.digitalAddress}</p>
      </button>)}</div> : <p className="text-sm text-app-text-light">Add a delivery address to continue.</p>}
    <Link to="/my-address" className="mt-6 px-6 py-3 border border-gray-600 text-gray-600 rounded-xl flex-center gap-2">Add New Address <PlusIcon className="size-4" /></Link>
    <button onClick={() => { setStep('payment'); window.scrollTo(0, 0); }} disabled={loading || !!error || !address} className="mt-6 px-6 py-3 bg-app-green text-white font-semibold rounded-xl hover:bg-green-800 disabled:opacity-50 flex items-center gap-2">Continue to Payment <ChevronRightIcon className="size-4" /></button>
  </div>;
}

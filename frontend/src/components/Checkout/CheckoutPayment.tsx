import { ChevronRightIcon, CreditCardIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface CheckoutPaymentProps {
    setStep: Dispatch<SetStateAction<string>>;
    paymentMethod: string;
    setPaymentMethod: Dispatch<SetStateAction<string>>;
}

export default function CheckoutPayment({ setStep, paymentMethod, setPaymentMethod }: CheckoutPaymentProps) {
    return (
        <div className="bg-white rounded-2xl p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-app-green mb-5 flex items-center gap-2">
                <CreditCardIcon className="size-5" /> Payment Method
            </h2>
            <div className="space-y-3">
                {/* Card payments need a payment provider, which isn't connected yet. */}
                {[
                    { value: "cash", label: "Cash on Delivery", desc: "Pay when you receive", available: true },
                    { value: "card", label: "Credit / Debit Card", desc: "Coming soon", available: false },
                ].map((method) => (
                    <label key={method.value} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${!method.available ? "opacity-50 cursor-not-allowed border-app-border" : paymentMethod === method.value ? "cursor-pointer border-app-green bg-app-cream" : "cursor-pointer border-app-border hover:border-app-green-lighter"}`}>
                        <input type="radio" name="payment" value={method.value} checked={paymentMethod === method.value} disabled={!method.available} onChange={(e) => setPaymentMethod(e.target.value)} className="size-4 text-app-green" />
                        <div>
                            <p className="text-sm font-semibold text-app-green">{method.label}</p>
                            <p className="text-xs text-app-text-light">{method.desc}</p>
                        </div>
                    </label>
                ))}
            </div>
            <button onClick={() => { setStep("review"); scrollTo(0, 0) }} className="mt-6 px-6 py-3 bg-app-green text-white font-semibold rounded-xl hover:bg-app-green-light transition-colors flex items-center gap-2">
                Review Order <ChevronRightIcon className="size-4" />
            </button>
        </div>
    )
}

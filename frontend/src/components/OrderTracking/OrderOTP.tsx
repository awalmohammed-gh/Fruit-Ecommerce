import { KeyRoundIcon } from 'lucide-react'
import type { Order } from '../../types'

// The server only includes the code while a partner is on the way.
export const OrderOTP = ({ order }: { order: Order }) => {
    if (!order.deliveryOtp) return null;
    return (
        <div className="bg-linear-to-r from-app-green to-app-green-light rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-full bg-white/15 flex-center">
                    <KeyRoundIcon className="size-5" />
                </div>
                <div>
                    <h3 className="font-semibold">Delivery OTP</h3>
                    <p className="text-xs text-white/70">Share this with your delivery partner</p>
                </div>
            </div>
            <div className="flex gap-2 mt-2">
                {order.deliveryOtp.split("").map((digit, i) => (
                    <div key={i} className="w-11 h-13 rounded-xl bg-white/15 flex-center text-2xl font-mono font-bold tracking-wider">
                        {digit}
                    </div>
                ))}
            </div>
        </div>
    )
}

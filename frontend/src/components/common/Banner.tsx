import { TruckIcon, XIcon, ZapIcon } from 'lucide-react'
import { useState } from 'react'
import { useSiteContent } from '../../hooks/useSiteContent'
import type { Announcement } from '../../frontApisRoute/content'

// The announcement bar above every store page, set in Admin → Settings → Advertisements.
// Dismissing it lasts for this browser session, and only for this message: a new message shows again.
const Banner = () => {
    const { data } = useSiteContent()
    const announcement = data?.announcement
    const [dismissed, setDismissed] = useState(() => {
        try { return sessionStorage.getItem('banner_dismissed') ?? '' } catch { return '' }
    })

    if (!announcement || dismissed === announcement.message) return null

    const dismissBanner = () => {
        setDismissed(announcement.message)
        try { sessionStorage.setItem('banner_dismissed', announcement.message) } catch { /* storage unavailable */ }
    }
    return <AnnouncementBar announcement={announcement} onDismiss={dismissBanner} />
}

// The bar itself; the admin preview renders it with unsaved changes.
export const AnnouncementBar = ({ announcement, onDismiss }: { announcement: Pick<Announcement, 'message' | 'secondary'>; onDismiss?: () => void }) => {
  return (
        <div className="bg-linear-to-r from-app-green via-emerald-800 to-app-green text-white text-xs sm:text-sm relative overflow-hidden">
          <div className="flex-center max-w-7xl mx-auto pl-4 pr-9 sm:px-10 lg:px-8 py-2 gap-6">
            <div className="flex-center gap-2 min-w-0">
              <TruckIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className='font-medium truncate'>{announcement.message}</span>
            </div>
            {announcement.secondary && <>
            <span className='hidden sm:inline text-white/40' aria-hidden="true">| </span>
            <div className='hidden sm:flex items-center gap-2 min-w-0'>
                <ZapIcon className='size-3.5 fill-yellow-400 text-yellow shrink-0' aria-hidden="true"/>
                <span className="truncate">{announcement.secondary}</span>
            </div>
            </>}
          </div>
          <button
            aria-label="Dismiss announcement"
            className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-white/10 rounded-full transition-colors p-1"
            onClick={onDismiss}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
  );
}

export default Banner

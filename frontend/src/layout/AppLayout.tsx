import { Suspense } from "react"
import { Outlet } from "react-router-dom"
import { MotionConfig } from "motion/react"
import Banner from "../components/common/Banner"
import Navbar from "./Navbar"
import Footer from "./Footer"
import CartModal from "../components/common/CartModal"
import CartSignInDialog from "../components/auth/CartSignInDialog"
import PageSkeleton from "../components/card/PageSkeleton"

const AppLayout = () => {
  return (
    // Page height = banner + navbar + main + footer. On short pages main grows to fill the visible
    // viewport (dvh, not vh, so mobile URL bars don't add phantom scroll); long pages just scroll.
    // reducedMotion="user": visitors who ask their system for less motion get fades only, no movement.
    <MotionConfig reducedMotion="user">
    <div className="flex min-h-dvh flex-col">
     <Banner/>
      <Navbar/>
      <main className="flex-1">
         {/* The header and footer stay while a page's code downloads the first time. */}
         <Suspense fallback={<PageSkeleton/>}>
           <Outlet/>
         </Suspense>
      </main>
      <Footer/>
      <CartModal/>
      <CartSignInDialog/>
    </div>
    </MotionConfig>
  )
}

export default AppLayout

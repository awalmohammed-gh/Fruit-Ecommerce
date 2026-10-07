import { createRoot } from 'react-dom/client'
// Fonts ship with the app (hashed, cached for a year) instead of a render-blocking Google Fonts @import.
// Each subset (Latin, Latin Extended) is downloaded only when a page uses its characters (unicode-range).
import '@fontsource-variable/outfit/wght.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './context/CartContext.tsx';
import { CustomerAuthProvider } from './context/CustomerAuthContext.tsx';
import { AdminAuthProvider } from './context/AdminAuthContext.tsx';
import { PartnerAuthProvider } from './context/PartnerAuthContext.tsx';
import { AddressProvider } from './context/AddressContext.tsx';
import { clearObsoleteBrowserStorage } from './utils/browserStorage.ts';

clearObsoleteBrowserStorage();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    {/* Three independent sign-ins, each in its own HTTP-only cookie; each restores only its own account. */}
    <CustomerAuthProvider>
    <AdminAuthProvider>
    <PartnerAuthProvider>
      <AddressProvider>
      <CartProvider>
        <App />
      </CartProvider>
      </AddressProvider>
    </PartnerAuthProvider>
    </AdminAuthProvider>
    </CustomerAuthProvider>
  </BrowserRouter>,
);

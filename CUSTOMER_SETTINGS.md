# Customer settings

Open `/account` to manage Profile, Account, Security, Preferences, and Notifications. Desktop uses a compact navigation column; phones use a full-width section selector. GreenFarm's existing typography, colors, avatar fallback, toast system, and dialog component are retained.

Profile edits save full name and optional phone. Email remains read-only, preserving the existing sign-in policy, and delivery addresses remain on their existing page. Account shows readable account details without database IDs. Security includes password visibility controls, inline validation, and the existing password/session-revocation API. Password fields clear after a request and when leaving the section.

Photo selection accepts JPG/JPEG, PNG, and WebP up to 5 MB. The image is previewed through a temporary object URL and can be cancelled before uploading. The server checks MIME type, file signatures, size, authenticated ownership, and CSRF protection, then uses the existing Cloudinary integration to store a 512-pixel profile image. The resulting URL is saved on the User record. Removing the photo restores the existing initial avatar. The authenticated customer context updates all existing avatar displays immediately. Real uploads require the existing `CLOUD_NAME`, `CLOUD_API_KEY`, and `CLOUD_SECRET_KEY` server configuration.

Preferences are saved in MongoDB. Default product sorting uses the market's existing supported sort orders; explicit product-page sorting overrides the preference. Notification switches affect the authenticated customer's feed, unread count, and notification mutations. Order updates include payments. Account, promotion, and system categories can be disabled independently; security notices remain enabled. Muted notices are retained and return when the category is enabled again within the 90-day retention period. Other accounts' feeds are unaffected.

The page provides loading skeletons, inline errors/success messages, disabled processing controls, unchanged-form save disabling, unsaved-section/link discard confirmation, and browser unload protection. Authentication, profile data, images, preferences, and passwords are not written to localStorage or sessionStorage.

## Existing and added APIs

All ownership comes from the verified customer HTTP-only cookie; supplied account IDs are never used as update targets. `X-Profile-Owner` additionally rejects requests queued before a shared-cookie account switch.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/auth/me` | Restore account, photo, and saved preferences |
| PATCH | `/api/auth/profile` | Existing profile edit API |
| PATCH | `/api/auth/profile/avatar` | Upload multipart field `image` |
| DELETE | `/api/auth/profile/avatar` | Remove the current account's photo |
| PATCH | `/api/auth/preferences` | Save `productSort` and/or boolean `notifications` preferences |
| PATCH | `/api/auth/password` | Existing password change API |

## Verification

105 backend tests and 20 frontend tests passed. Both production builds and frontend lint passed. Integration coverage includes ownership/ID manipulation, HTTP-only cookies/CSRF, upload validation and provider errors, persistence across refresh/login, profile validation, and independent notification filtering.

Browser checks used an isolated temporary MongoDB database and a mock Cloudinary response, without contacting the live upload provider or modifying production data. Profile save, password visibility/change/clearing, photo preview/cancel/upload/remove, immediate avatar propagation, refresh persistence, notification preference save, and default/explicit market sorting were verified. Responsive checks covered 1440, 390, and 320 pixels; there was no horizontal overflow after the narrow-navbar fix. The profile and notification settings accessibility audits returned zero violations or incomplete checks, and no browser runtime errors were detected. The test servers and browser session were closed afterward.

Preview screenshots: [Desktop](artifacts/settings/desktop.png) · [Mobile](artifacts/settings/mobile.png).

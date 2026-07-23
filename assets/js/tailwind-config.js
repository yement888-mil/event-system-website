// Extracted from contact.html/booking.html's inline tailwind.config
// block (Sprint 7, Epic L - strict CSP). This was the actual remaining
// blocker to dropping 'unsafe-inline' from script-src on these two
// pages - removing the onclick= handlers alone wasn't enough, since an
// inline <script> block requires the same allowance. Scoped to just
// these two pages deliberately: index.html's config has an extra
// lightgold color and isn't identical, and the other 6 public pages
// weren't part of this epic - touching their CSP wasn't asked for.
tailwind.config = {
    theme: {
        extend: {
            colors: {
                gold: '#C9A84C',
                dark: '#1A1A1A',
            }
        }
    }
}

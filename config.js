const CONFIG = {
    API_URL: 'https://event-system-backend-production.up.railway.app',
    TENANT_SLUG: 'decorby',
    OWNER_WHATSAPP: '60123456789',
    // Cloudflare Turnstile site key (public value, safe to ship in this
    // file - the secret half lives server-side as TURNSTILE_SECRET_KEY).
    // Empty until a real Turnstile widget is created; the inquiry form
    // skips rendering the challenge entirely while this is blank, same
    // graceful-degradation shape as the backend's isConfigured() check.
    TURNSTILE_SITE_KEY: '',
    // GA4 measurement ID (e.g. 'G-XXXXXXXXXX') and Meta Pixel ID. Both
    // public identifiers, safe to ship here. Empty until real accounts
    // exist - assets/js/analytics.js skips loading either snippet while
    // its ID is blank, same pattern as TURNSTILE_SITE_KEY above.
    GA4_MEASUREMENT_ID: '',
    META_PIXEL_ID: ''
};
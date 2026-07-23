// GA4 + Meta Pixel loader (BAU backlog E9). Each snippet is independently
// gated on its own CONFIG id being set (config.js) - skips loading
// entirely otherwise, same graceful-degradation shape used for Turnstile
// in main.js, so this ships safely before either account exists and
// starts working the moment a real GA4_MEASUREMENT_ID/META_PIXEL_ID is
// filled in, no other code changes needed. Loaded from <head>, as early
// as possible per both providers' own install instructions - a script
// at the bottom of <body> would miss pageview data from anyone who
// navigates away before it reaches the bottom, which matters most for
// this site's actual audience (Malaysian mobile users on 4G, decision
// noted in CLAUDE.md's own performance review).
(function () {
    if (typeof CONFIG === 'undefined') return;

    if (CONFIG.GA4_MEASUREMENT_ID) {
        const gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA4_MEASUREMENT_ID;
        document.head.appendChild(gtagScript);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', CONFIG.GA4_MEASUREMENT_ID);
    }

    if (CONFIG.META_PIXEL_ID) {
        /* eslint-disable */
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
            };
            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
            n.queue = []; t = b.createElement(e); t.async = !0;
            t.src = v; s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s)
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        /* eslint-enable */
        window.fbq('init', CONFIG.META_PIXEL_ID);
        window.fbq('track', 'PageView');
    }
})();

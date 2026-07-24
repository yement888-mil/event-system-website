document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile Menu Toggle
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Epic L (strict CSP follow-up) - was onclick="withdrawInquiry()" in
    // contact.html; moved to addEventListener so script-src can drop
    // unsafe-inline on this page. withdrawInquiry() itself is unchanged,
    // still a plain global function (defined below, outside this
    // DOMContentLoaded block).
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', withdrawInquiry);
    }

    // Feature 7 - reveal the catering menu link + preferred-package picker
    // only when Catering is actually checked, so it's not shown/required
    // for customers who don't need it. Guarded like the blocks above
    // since main.js is shared across every public page, not just contact.html.
    const cateringCheckbox = document.querySelector('input[name="services"][value="catering"]');
    const cateringExtraFields = document.getElementById('cateringExtraFields');
    if (cateringCheckbox && cateringExtraFields) {
        cateringCheckbox.addEventListener('change', function() {
            cateringExtraFields.classList.toggle('hidden', !this.checked);
        });
    }

    // FAQ Toggle
    document.querySelectorAll('.faq-item').forEach(item => {
        item.addEventListener('click', function() {
            const answer = this.querySelector('.faq-answer');
            const icon = this.querySelector('.faq-icon');
            const isHidden = answer.classList.contains('hidden');
            
            answer.classList.toggle('hidden');
            icon.textContent = isHidden ? '−' : '+';
            icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    });
    
    // Gallery Filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-[#1A1A1A]', 'text-white');
                b.classList.add('bg-white', 'text-[#1A1A1A]', 'border', 'border-gray-200');
            });
            this.classList.add('bg-[#1A1A1A]', 'text-white');
            this.classList.remove('bg-white', 'border', 'border-gray-200');
            
            const filter = this.dataset.filter;
            document.querySelectorAll('.gallery-item').forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
    
    // BAU backlog #4 - one random key per submit action, sent with the
    // request so the backend can dedup a retry (flaky mobile connection,
    // or a slow response the user gives up on and resubmits) instead of
    // creating a second inquiry. Regenerated after a successful submit;
    // kept the same across a failed attempt so a manual retry click is
    // recognized as the same action, not a new one. Falls back to a
    // Math.random()-based id on very old browsers without
    // crypto.randomUUID (public form, can't assume a modern browser).
    function generateIdempotencyKey() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
    let inquiryIdempotencyKey = generateIdempotencyKey();

    // Inquiry Form Submission
    const form = document.getElementById('inquiryForm');
    if (form) {
        // Set min date to tomorrow
        const dateInput = document.getElementById('event_date');
        if (dateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.min = tomorrow.toISOString().split('T')[0];

            const maxDate = new Date();
            maxDate.setMonth(maxDate.getMonth() + 18);
            dateInput.max = maxDate.toISOString().split('T')[0];
        }

        // BAU backlog #26 - auto-capture "source" from a ?source=Instagram
        // style query param on ad links, so paid channels get tracked
        // without the visitor having to do anything; organic visitors just
        // see the dropdown at its normal blank default and can fill it in
        // (or not - it's optional) themselves. Case-insensitive match
        // against the dropdown's own option values, so a link author
        // doesn't need to get capitalization exactly right.
        const sourceSelect = document.getElementById('source');
        if (sourceSelect) {
            const sourceParam = new URLSearchParams(window.location.search).get('source');
            if (sourceParam) {
                const match = Array.from(sourceSelect.options).find(
                    opt => opt.value && opt.value.toLowerCase() === sourceParam.toLowerCase()
                );
                if (match) sourceSelect.value = match.value;
            }
        }

        // BAU backlog E5 - Cloudflare Turnstile bot protection. Only
        // injected when a real site key is configured (CONFIG.js -
        // TURNSTILE_SITE_KEY is blank until Cloudflare keys exist), same
        // graceful-degradation shape as the backend's isConfigured()
        // check: the widget div goes into the DOM first, then the
        // Turnstile script is appended after it, so its implicit-render
        // scan always finds the div already there instead of racing it.
        const turnstileContainer = document.getElementById('turnstileContainer');
        if (turnstileContainer && typeof CONFIG !== 'undefined' && CONFIG.TURNSTILE_SITE_KEY) {
            const widget = document.createElement('div');
            widget.className = 'cf-turnstile';
            widget.setAttribute('data-sitekey', CONFIG.TURNSTILE_SITE_KEY);
            turnstileContainer.appendChild(widget);

            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            submitBtn.style.opacity = '0.7';
            
            const services = [];
            document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
                services.push(cb.value);
            });
            
            if (services.length === 0) {
                alert('Please select at least one service.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                submitBtn.style.opacity = '1';
                return;
            }
            
            const data = {
                customer_name: document.getElementById('customer_name').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                email: document.getElementById('email')?.value.trim() || '',
                event_type: document.getElementById('event_type').value,
                event_date: document.getElementById('event_date').value,
                guest_count: parseInt(document.getElementById('guest_count').value),
                event_location: document.getElementById('event_location').value.trim(),
                services_requested: services,
                message: document.getElementById('message').value.trim(),
                idempotency_key: inquiryIdempotencyKey,
                source: document.getElementById('source')?.value || '',
                // Only meaningful when Catering was selected - the picker is
                // hidden (and irrelevant) otherwise, even though the select
                // element still technically exists in the DOM.
                catering_package: services.includes('catering')
                    ? (document.getElementById('catering_package')?.value || '')
                    : '',
                // Present only when the Turnstile widget actually rendered
                // (site key configured) - typeof-guarded since window.turnstile
                // doesn't exist at all when the script was never loaded.
                turnstile_token: (typeof turnstile !== 'undefined') ? turnstile.getResponse() : ''
            };

            try {
                const response = await fetch(`${CONFIG.API_URL}/api/inquiry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    document.getElementById('inquiryForm').classList.add('hidden');
                    document.getElementById('successMessage').classList.remove('hidden');
                    window.__lastInquiryWithdrawToken = result.data?.withdraw_token || null;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    inquiryIdempotencyKey = generateIdempotencyKey();
                } else {
                    alert(result.error || 'Failed to submit. Please try again.');
                    if (typeof turnstile !== 'undefined') turnstile.reset();
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    submitBtn.style.opacity = '1';
                }
            } catch (error) {
                alert('Connection error. Please try again or contact us via WhatsApp.');
                if (typeof turnstile !== 'undefined') turnstile.reset();
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                submitBtn.style.opacity = '1';
            }
        });
    }
});

// Lets a customer instantly withdraw an inquiry they just submitted, in
// the same browser session, before any quotation has been created for
// it. Uses the random withdraw_token returned when the inquiry was
// created - never the inquiry's plain numeric id - so it can't be
// guessed or used to withdraw someone else's inquiry.
async function withdrawInquiry() {
    const token = window.__lastInquiryWithdrawToken;
    const btn = document.getElementById('withdrawBtn');
    const resultEl = document.getElementById('withdrawResult');

    if (!token) {
        if (resultEl) {
            resultEl.textContent = 'This can only be used right after submitting. Please contact us via WhatsApp instead.';
            resultEl.classList.remove('hidden');
        }
        return;
    }

    if (!confirm('Withdraw this inquiry? We will no longer follow up on it.')) return;

    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Withdrawing...'; }

        const res = await fetch(`${CONFIG.API_URL}/api/inquiry/withdraw/${token}`, {
            method: 'POST'
        });
        const result = await res.json();

        if (resultEl) {
            resultEl.textContent = result.message || 'Done.';
            resultEl.classList.remove('hidden');
        }
        if (btn) btn.classList.add('hidden');

    } catch (error) {
        if (resultEl) {
            resultEl.textContent = 'Something went wrong. Please contact us via WhatsApp.';
            resultEl.classList.remove('hidden');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Submitted by mistake? Withdraw this inquiry'; }
    }
}(function(){'use strict';const key='event-system-theme',root=document.documentElement;function apply(theme){root.dataset.theme=theme;document.querySelectorAll('[data-theme-toggle]').forEach(button=>{const dark=theme==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');button.textContent=dark?'☀':'☾'})}function mount(){const header=document.querySelector('header');if(!header||document.querySelector('[data-theme-toggle]'))return;header.classList.add('site-header');const button=document.createElement('button');button.type='button';button.className='theme-toggle';button.dataset.themeToggle='';button.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem(key,next);apply(next)});const menu=document.getElementById('menuBtn');if(menu)menu.before(button);else header.querySelector('.max-w-6xl')?.append(button)}const initial=localStorage.getItem(key)||'light';apply(initial);document.addEventListener('DOMContentLoaded',()=>{apply(initial);mount()})}());

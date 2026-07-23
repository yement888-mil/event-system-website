// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.

        // ------------------------------------------------------------
        // GLOBAL ERROR BOUNDARY (BAU backlog #5)
        // ------------------------------------------------------------
        // Registered first, before anything else in this file, so it
        // catches uncaught errors and unhandled promise rejections from
        // any code below - a bug that isn't already wrapped in a local
        // try/catch (most async calls in this file already are and show
        // their own alert()) now surfaces as a toast instead of failing
        // silently or as a raw console error with nothing visible in the
        // UI. Deliberately console + toast only: it never makes a network
        // call from inside the handler itself, since a logging request
        // that itself fails would throw a new error and loop.
        function showErrorToast(message) {
            const container = document.getElementById('errorBoundaryToasts');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = 'pointer-events-auto bg-red-600 text-white text-sm rounded-xl shadow-lg px-4 py-3 flex items-start justify-between gap-3 transition-opacity duration-300';
            toast.innerHTML = `
                <span class="flex-1">${message}</span>
                <button class="text-white/80 hover:text-white font-bold leading-none" aria-label="Dismiss">&times;</button>
            `;
            toast.querySelector('button').addEventListener('click', () => toast.remove());
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 8000);
        }


        // BAU backlog #6 - undo toast for status changes and task
        // completion. Reuses the same toast container/stack as
        // showErrorToast above, styled neutrally rather than as an error.
        // onUndo is expected to itself handle a 409 "already changed"
        // response gracefully (see undoInquiryStatus/undoQuotationStatus/
        // undoTaskDone below) - this function just renders the button and
        // times the toast out after 8s if never clicked.
        function showUndoToast(message, onUndo) {
            const container = document.getElementById('errorBoundaryToasts');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = 'pointer-events-auto bg-dark text-white text-sm rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-3 transition-opacity duration-300';
            toast.innerHTML = `
                <span class="flex-1">${message}</span>
                <button class="text-gold font-semibold hover:underline whitespace-nowrap">Undo</button>
            `;
            toast.querySelector('button').addEventListener('click', async () => {
                toast.remove();
                await onUndo();
            });
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 8000);
        }


        window.addEventListener('error', function(event) {
            console.error('Uncaught error:', event.error || event.message);
            showErrorToast('Something went wrong. If this keeps happening, refresh the page.');
        });


        window.addEventListener('unhandledrejection', function(event) {
            console.error('Unhandled promise rejection:', event.reason);
            showErrorToast('Something went wrong. If this keeps happening, refresh the page.');
        });


        const CONFIG = {
            API_URL: 'https://event-system-backend-production.up.railway.app'
        };


        // ------------------------------------------------------------
        // STATE
        // ------------------------------------------------------------
        let adminToken = localStorage.getItem('adminToken') || '';

        let adminRole = localStorage.getItem('adminRole') || '';

        let editingQuotationId = null;

        let editingQuotationVersion = null;

        let savingQuotation = false;

        let allInquiries = [];

        let allQuotations = [];

        let filteredQuotations = [];

        let filteredInquiries = [];

        // Pagination (BAU backlog #2) - page size is generous on purpose:
        // at this business's current data volume everything still loads
        // in the first request with zero visible change; "Load More" only
        // appears once a table actually exceeds it. inquiriesTotalCount /
        // quotationsTotalCount come straight from the server's COUNT, so
        // the top stats bar stays accurate even before everything is
        // loaded - but per-row aggregates computed client-side (unread,
        // upcoming events, revenue, analytics) only reflect what's been
        // loaded so far until "Load More" is used.
        const LIST_PAGE_SIZE = 100;

        let inquiriesOffset = 0;

        let inquiriesHasMore = false;

        let inquiriesTotalCount = 0;

        let quotationsOffset = 0;

        let quotationsHasMore = false;

        let quotationsTotalCount = 0;

        // BAU backlog #13 - server-side filters, only ever set by the
        // explicit "Apply Filters" button (applyInquiryFilters() /
        // applyQuotationFilters()) - NOT read live from the search boxes
        // on every loadInquiries()/loadQuotations() call, since those
        // functions also get called after routine actions like marking an
        // inquiry read. Reading a live, unapplied search box value there
        // would silently narrow the loaded dataset any time the admin
        // happened to have text sitting in the box.
        let inquiryServerFilters = { search: '', dateFrom: '', dateTo: '' };

        let quotationServerFilters = { search: '', revenueMin: '', revenueMax: '' };

        // BAU backlog #4 - idempotency key for the current "Generate
        // Quotation" attempt, tied to which inquiry it was minted for
        // (see generateQuotation()). Reused across a retry of the same
        // attempt so a dropped response doesn't create a second
        // quotation; regenerated whenever the target inquiry changes, so
        // a stale key from an abandoned attempt is never reused for a
        // genuinely different one.
        let quotationIdempotencyKey = null;

        let quotationIdempotencyKeyInquiryId = null;


        function generateIdempotencyKey() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            return 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        }

        let selectedInquiry = null;

        let servicesCache = [];

        let pricingItemsCache = [];

        let packagesCache = [];

        let propsCache = [];

        let taskTemplatesCache = [];

        let editingServiceId = null;

        let editingPricingItemId = null;

        let editingPackageId = null;

        let editingPropId = null;

        let editingTaskTemplateId = null;

        let galleryCache = [];

        let faqCache = [];

        let editingGalleryItemId = null;

        let editingFaqItemId = null;

        let messageTemplatesCache = [];

        let adminUsernamesCache = [];

        let peakPeriodsCache = [];

        // High-demand weeks (BAU backlog #17) - Set of "YYYY-MM-DD" Monday
        // week-start strings, matching Postgres's date_trunc('week', ...).
        let highDemandWeeksCache = new Set();

        // Frequently-paired services (BAU backlog #18)
        let frequentPairsCache = [];

        // BAU backlog #14 - the admin's own iCal subscription token
        let calendarFeedToken = '';

        let editingPeakPeriodId = null;


        // ------------------------------------------------------------
        // PACKAGE TEMPLATES
        // ------------------------------------------------------------
        // PACKAGES is now loaded from the backend - see loadCatalog() / packagesCache below.

        // ------------------------------------------------------------
        // HELPERS
        // ------------------------------------------------------------
        function escapeHTML(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }


        // Always renders in Malaysia time regardless of the viewing
        // device's own timezone (BAU backlog #15 timezone sanity check) -
        // without an explicit timeZone, toLocaleDateString/toLocaleString
        // use the browser's local zone, which is usually Malaysia for this
        // business's staff but isn't guaranteed (a misconfigured device
        // clock, or anyone ever logging in while traveling).
        function formatDate(dateStr) {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        }


        // Converts a date value from the API into YYYY-MM-DD, the format
        // required by an <input type="date"> value attribute.
        function toDateInputValue(dateStr) {
            if (!dateStr) return '';
            return String(dateStr).split('T')[0];
        }


        function formatDateTime(dateStr) {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        }


        function getStatusBadge(status) {
            const classes = {
                'draft': 'status-draft',
                'sent': 'status-sent',
                'waiting_deposit': 'status-waiting_deposit',
                'deposit_paid': 'status-deposit_paid',
                'completed': 'status-completed',
                'cancelled': 'status-cancelled',
                'expired': 'status-expired'
            };
            return `<span class="status-badge ${classes[status] || 'status-draft'}">${status || 'draft'}</span>`;
        }


        const INQUIRY_STATUSES = ['new', 'contacted', 'quotation_sent', 'waiting_deposit', 'confirmed', 'completed', 'cancel_requested', 'cancelled'];

        const INQUIRY_STATUS_LABELS = {
            'new': 'New',
            'contacted': 'Contacted',
            'quotation_sent': 'Quotation Sent',
            'waiting_deposit': 'Waiting Deposit',
            'confirmed': 'Confirmed',
            'completed': 'Completed',
            'cancel_requested': 'Cancellation Requested',
            'cancelled': 'Cancelled'
        };


        function getInquiryStatusBadge(status) {
            const cls = 'status-' + (status || 'new');
            const label = INQUIRY_STATUS_LABELS[status] || 'New';
            return `<span class="status-badge ${cls}">${label}</span>`;
        }


        // ------------------------------------------------------------
        // TABS
        // ------------------------------------------------------------
        function switchTab(tab) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            const content = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}Content`);
            if (content) content.classList.add('active');
            
            document.querySelectorAll('[id^="tab"][id$="Content"]').forEach(el => {
                const btnId = el.id.replace('Content', '');
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.className = 'pb-3 px-2 text-sm tab-inactive whitespace-nowrap';
                }
            });
            const activeBtn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            if (activeBtn) {
                activeBtn.className = 'pb-3 px-2 text-sm tab-active whitespace-nowrap';
            }

            if (tab === 'calendar') {
                loadAdminCalendar();
                loadUpcomingReminders();
            }
            if (tab === 'today') {
                loadUpcomingReminders();
                loadOpenTasksToday();
                loadExpiringQuotationsToday();
            }
            if (tab === 'account' && adminRole === 'owner') {
                loadStaffAccounts();
            }
            if (tab === 'customers') {
                loadCustomers();
            }
            if (tab === 'health') {
                loadSystemHealth();
            }
        }


        // ------------------------------------------------------------
        // ADMIN CALENDAR
        // ------------------------------------------------------------
        let adminCalYear = new Date().getFullYear();

        let adminCalMonth = new Date().getMonth() + 1;

 // 1-12
        let adminCalEvents = { quotations: [], inquiries_only: [] };


        const ADMIN_CAL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];


        // BAU backlog #12 - in-app notification center. Reuses the exact
        // same data BAU backlog #3 already surfaces (notification_logs
        // failures - only ever real, actionable ones; WhatsApp's
        // permanently-unconfigured state is logged as 'not_configured',
        // not 'failed', see services/whatsapp.js, so this never turns into
        // a 100%-failure banner), now with read/unread tracking so the
        // bell's badge count only reflects genuinely new failures, plus a
        // "since you're here" recap built from data already loaded for the
        // Today tab/stats bar - not a second, separate notification system.
        let notificationCenterCache = { failures: [], unreadCount: 0 };

        let notificationPanelOpen = false;


        // ------------------------------------------------------------
        // AUTH
        // ------------------------------------------------------------
        async function checkPassword() {
            const usernameInput = document.getElementById('toolUsername').value.trim();
            const input = document.getElementById('toolPassword').value;
            const errorEl = document.getElementById('passwordError');
            
            if (!usernameInput || !input) {
                errorEl.textContent = 'Please enter username and password';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                const res = await fetch(`${CONFIG.API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput, password: input })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Login failed');
                }

                const data = await res.json();
                if (data.success) {
                    adminToken = data.token;
                    adminRole = data.role || 'staff';
                    localStorage.setItem('adminToken', adminToken);
                    localStorage.setItem('adminRole', adminRole);
                    document.getElementById('passwordGate').classList.add('hidden');
                    document.getElementById('toolContent').classList.remove('hidden');
                    applyRoleVisibility();
                    
                    const now = new Date();
                    const monthInput = document.getElementById('analyticsMonth');
                    if (monthInput) monthInput.value = now.toISOString().slice(0, 7);
                    
                    loadAllData();
                } else {
                    errorEl.textContent = 'Invalid credentials';
                    errorEl.classList.remove('hidden');
                }
            } catch (err) {
                console.error('Login error:', err);
                errorEl.textContent = err.message || 'Login failed';
                errorEl.classList.remove('hidden');
            }
        }


        // ------------------------------------------------------------
        // LOAD ALL DATA
        // ------------------------------------------------------------
        async function loadAllData() {
            await loadInquiries();
            await loadQuotations();
            await loadCatalog();
            updateAnalytics();
            await loadUpcomingReminders();
            await loadOpenTasksToday();
            await loadExpiringQuotationsToday();
            await loadNotificationCenter();
            await loadChangeRequests();
            await loadDueReminders();
        }


        function closeModal() {
            document.getElementById('inquiryModal').classList.remove('active');
        }


        // BAU backlog #18 - matches the service checkbox codes used on the
        // public inquiry form (see website/contact.html and
        // services/whatsapp.js's formatWhatsAppMessage).
        const SERVICE_CODE_LABELS = { deco: 'Decoration', photo: 'Photography', catering: 'Catering', magic: 'Magic Show' };


        const REFUND_STATUS_LABELS = {
            'not_applicable': 'No deposit was paid - nothing to refund',
            'pending': 'Refund pending',
            'partial': 'Partially refunded',
            'full': 'Fully refunded',
            'denied': 'Refund denied'
        };


        // ------------------------------------------------------------
        // UPDATE STATS
        // ------------------------------------------------------------
        function updateStats() {
            const unread = allInquiries.filter(i => !i.is_read).length;
            const unreadEl = document.getElementById('statUnread');
            const totalEl = document.getElementById('statTotalInquiries');
            const quotesEl = document.getElementById('statQuotations');
            const revenueEl = document.getElementById('statRevenue');
            const upcomingEl = document.getElementById('statUpcoming');
            const growthEl = document.getElementById('statGrowth');
            const conversionEl = document.getElementById('statConversion');

            if (unreadEl) unreadEl.textContent = unread;
            // Use the server's real COUNT (BAU backlog #2) rather than
            // allInquiries.length/allQuotations.length, so these two
            // headline numbers stay correct even before "Load More" has
            // pulled every row into the browser.
            if (totalEl) totalEl.textContent = inquiriesTotalCount || allInquiries.length;
            if (quotesEl) quotesEl.textContent = quotationsTotalCount || allQuotations.length;

            const totalRevenue = allQuotations
                .filter(q => q.status === 'completed' || q.status === 'deposit_paid')
                .reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
            if (revenueEl) revenueEl.textContent = 'RM ' + totalRevenue;

            const now = new Date();
            const upcoming = allInquiries.filter(i => {
                if (!i.event_date) return false;
                const d = new Date(i.event_date);
                return d >= now;
            }).length;
            if (upcomingEl) upcomingEl.textContent = upcoming;

            // BAU backlog #21 - revenue by event_date's calendar month, for
            // deposit-paid/completed quotations only (same status filter as
            // Total Revenue above). Shares the same "computed from what's
            // been loaded so far" caveat as the rest of this stats bar and
            // the Analytics tab - see BAU backlog #2's Load More.
            if (growthEl) {
                const revenueForMonth = (y, m) => allQuotations
                    .filter(q => (q.status === 'completed' || q.status === 'deposit_paid') && q.event_date)
                    .filter(q => {
                        const d = new Date(q.event_date);
                        return d.getFullYear() === y && d.getMonth() === m;
                    })
                    .reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);

                const thisMonthRevenue = revenueForMonth(now.getFullYear(), now.getMonth());
                const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const prevMonthRevenue = revenueForMonth(prevDate.getFullYear(), prevDate.getMonth());

                if (prevMonthRevenue === 0) {
                    growthEl.textContent = 'N/A';
                    growthEl.className = 'text-2xl font-bold text-gray-400';
                } else {
                    const growthPct = ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
                    growthEl.textContent = (growthPct >= 0 ? '+' : '') + growthPct.toFixed(1) + '%';
                    growthEl.className = 'text-2xl font-bold ' + (growthPct >= 0 ? 'text-green-600' : 'text-red-600');
                }
            }

            // BAU backlog #21 - conversion rate defined here as: of every
            // inquiry ever received, what fraction resulted in an actual
            // paid booking (deposit_paid or completed) - a stricter, more
            // meaningful number than "quotation sent" or "marked confirmed",
            // since it tracks money actually received, same standard as
            // Total Revenue and Customer LTV (BAU backlog #28) elsewhere.
            if (conversionEl) {
                const totalInquiriesForConversion = inquiriesTotalCount || allInquiries.length;
                const convertedQuotations = allQuotations.filter(q => q.status === 'completed' || q.status === 'deposit_paid').length;
                conversionEl.textContent = totalInquiriesForConversion === 0
                    ? 'N/A'
                    : ((convertedQuotations / totalInquiriesForConversion) * 100).toFixed(1) + '%';
            }
        }


        // ------------------------------------------------------------
        // RECENTLY DELETED (delete safety net - quotations + inquiries)
        // ------------------------------------------------------------
        let recentlyDeletedLoaded = false;


        // ------------------------------------------------------------
        // CUSTOMERS
        // ------------------------------------------------------------
        let allCustomers = [];


        let currentCustomerDetail = null;


        function logout() {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminRole');
            adminToken = '';
            adminRole = '';
            document.getElementById('toolContent').classList.add('hidden');
            document.getElementById('passwordGate').classList.remove('hidden');
            document.getElementById('quotationForm').classList.add('hidden');
        }


        // Shows/hides UI elements based on the logged-in admin's role.
        // This is a UI convenience only - every staff-management endpoint
        // is also enforced server-side (ownerOnly middleware), so hiding
        // the tab here is not the real security boundary.
        function applyRoleVisibility() {
            const ownerOnlyEls = document.querySelectorAll('.owner-only');
            ownerOnlyEls.forEach(el => {
                el.classList.toggle('hidden', adminRole !== 'owner');
            });
        }

// Availability calendar widget for the inquiry form.
// Shows a month grid, greys out past days, marks days that already have
// a deposit-paid/completed booking as unavailable, and lets the customer
// click any available day to fill in the Event Date field.
document.addEventListener('DOMContentLoaded', function () {
    const grid = document.getElementById('calGrid');
    const monthLabel = document.getElementById('calMonthLabel');
    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');
    const loadingEl = document.getElementById('calLoading');
    const dateInput = document.getElementById('event_date');

    if (!grid || !dateInput) return; // widget not present on this page

    const today = new Date();
    const minSelectable = new Date();
    minSelectable.setDate(today.getDate() + 1);
    const maxSelectable = new Date();
    maxSelectable.setMonth(maxSelectable.getMonth() + 18);

    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth() + 1; // 1-12
    let unavailableDates = [];
    let tentativeDates = []; // Feature 3 - held, not yet deposit-paid
    let selectedDate = null;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function pad(n) { return String(n).padStart(2, '0'); }
    function dateStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

    async function loadMonth() {
        loadingEl.textContent = 'Loading availability...';
        loadingEl.classList.remove('hidden');
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/calendar/availability?month=${viewYear}-${pad(viewMonth)}`);
            const result = await res.json();
            unavailableDates = (result.unavailable_dates || []);
            tentativeDates = (result.tentative_dates || []);
            loadingEl.classList.add('hidden');
        } catch (err) {
            console.error('Failed to load availability:', err);
            loadingEl.textContent = 'Could not load availability. You can still pick a date - we\'ll confirm it with you.';
        }
        renderMonth();
    }

    function renderMonth() {
        monthLabel.textContent = `${monthNames[viewMonth - 1]} ${viewYear}`;

        const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

        let html = '';
        ['S','M','T','W','T','F','S'].forEach(d => {
            html += `<div class="text-gray-400 font-medium py-1">${d}</div>`;
        });

        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const str = dateStr(viewYear, viewMonth, d);
            const dateObj = new Date(viewYear, viewMonth - 1, d);
            const isBeforeMin = dateObj < new Date(minSelectable.getFullYear(), minSelectable.getMonth(), minSelectable.getDate());
            const isAfterMax = dateObj > maxSelectable;
            const isUnavailable = unavailableDates.includes(str);
            const isTentative = tentativeDates.includes(str);
            const isSelected = selectedDate === str;

            let classes = 'rounded-full py-1.5 w-full transition select-none appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1';
            let statusLabel = 'available';
            if (isBeforeMin || isAfterMax) {
                classes += ' bg-transparent text-gray-300 cursor-not-allowed';
                statusLabel = 'not selectable';
            } else if (isUnavailable) {
                classes += ' bg-red-200 text-red-700 cursor-not-allowed';
                statusLabel = 'unavailable';
            } else if (isSelected) {
                // Deliberately a different hue (forest, not gold/amber) from
                // Tentative Hold below - the two used to render as visually
                // interchangeable solid-fill circles.
                classes += ' bg-dark text-white font-semibold cursor-pointer';
                statusLabel = 'selected';
            } else if (isTentative) {
                // Feature 3 - held by another inquiry, not yet confirmed.
                // Still clickable - a tentative hold isn't a guarantee, so
                // this date should stay open to other inquiries too.
                classes += ' bg-amber-200 text-amber-700 cursor-pointer';
                statusLabel = 'tentative hold by another inquiry, still selectable';
            } else {
                classes += ' bg-white border border-gray-200 text-dark hover:border-gold cursor-pointer';
            }

            const clickable = !isBeforeMin && !isAfterMax && !isUnavailable;
            const label = `${d} ${monthNames[viewMonth - 1]} ${viewYear}, ${statusLabel}`;
            html += `<button type="button" class="${classes}" aria-label="${label}" aria-pressed="${isSelected}" ${clickable ? `onclick="window.__selectAvailabilityDate('${str}')"` : 'disabled aria-disabled="true"'}>${isSelected ? '&#10003; ' : ''}${d}</button>`;
        }

        grid.innerHTML = html;

        prevBtn.disabled = (viewYear === minSelectable.getFullYear() && viewMonth === minSelectable.getMonth() + 1) ||
            new Date(viewYear, viewMonth - 1, 1) < new Date(minSelectable.getFullYear(), minSelectable.getMonth(), 1);
        prevBtn.classList.toggle('opacity-30', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);

        nextBtn.disabled = new Date(viewYear, viewMonth - 1, 1) >= new Date(maxSelectable.getFullYear(), maxSelectable.getMonth(), 1);
        nextBtn.classList.toggle('opacity-30', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    }

    window.__selectAvailabilityDate = function (str) {
        selectedDate = str;
        dateInput.value = str;
        dateInput.dispatchEvent(new Event('change'));
        renderMonth();
    };

    prevBtn.addEventListener('click', function () {
        if (prevBtn.disabled) return;
        viewMonth -= 1;
        if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
        loadMonth();
    });

    nextBtn.addEventListener('click', function () {
        if (nextBtn.disabled) return;
        viewMonth += 1;
        if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
        loadMonth();
    });

    // Keep the calendar in sync if the customer types a date manually
    dateInput.addEventListener('change', function () {
        if (!dateInput.value) return;
        const [y, m, d] = dateInput.value.split('-').map(Number);
        selectedDate = dateInput.value;
        if (y !== viewYear || m !== viewMonth) {
            viewYear = y;
            viewMonth = m;
            loadMonth();
        } else {
            renderMonth();
        }
    });

    loadMonth();
});
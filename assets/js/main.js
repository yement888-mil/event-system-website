document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile Menu Toggle
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
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
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menghantar...';
            submitBtn.style.opacity = '0.7';
            
            const services = [];
            document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
                services.push(cb.value);
            });
            
            if (services.length === 0) {
                alert('Sila pilih sekurang-kurangnya satu servis.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                submitBtn.style.opacity = '1';
                return;
            }
            
            const data = {
                customer_name: document.getElementById('customer_name').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                event_type: document.getElementById('event_type').value,
                event_date: document.getElementById('event_date').value,
                guest_count: parseInt(document.getElementById('guest_count').value),
                services_requested: services,
                message: document.getElementById('message').value.trim()
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    alert(result.error || 'Gagal menghantar. Sila cuba lagi.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    submitBtn.style.opacity = '1';
                }
            } catch (error) {
                alert('Ralat sambungan. Sila cuba lagi atau WhatsApp kami terus.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                submitBtn.style.opacity = '1';
            }
        });
    }
});
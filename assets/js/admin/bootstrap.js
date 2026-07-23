// Mechanically extracted from tool.html's single inline <script> block
// (tool.html modularization, Sprint 5). Function bodies preserved byte-for-
// byte; only file location changed - see the extraction record for how.


        // ------------------------------------------------------------
        // INIT
        // ------------------------------------------------------------
        window.onload = function() {
            if (adminToken) {
                document.getElementById('passwordGate').classList.add('hidden');
                document.getElementById('toolContent').classList.remove('hidden');
                applyRoleVisibility();
                
                const now = new Date();
                const monthInput = document.getElementById('analyticsMonth');
                if (monthInput) monthInput.value = now.toISOString().slice(0, 7);
                
                loadAllData();
                if (document.getElementById('serviceRows')?.children.length === 0) addServiceRow('', '');
            }
        };


        // Enter key support for inquiry search
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('inquiryIdSearch');
            if (searchInput) {
                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        searchInquiryById();
                    }
                });
            }
        });

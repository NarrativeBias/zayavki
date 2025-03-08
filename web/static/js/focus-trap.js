// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get all modal elements
    const modals = document.querySelectorAll('.modal');
    if (!modals || modals.length === 0) {
        console.log('No modals found on page');
        return;
    }

    const form = document.getElementById('zayavkiForm');
    const focusableElements = form.querySelectorAll('input, select, textarea, button:not([disabled])');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    function trapFocus(e) {
        // Check if any modal is open
        const modalOpen = document.querySelector('.modal[style*="display: block"]');
        if (modalOpen) {
            return; // Don't trap focus if a modal is open
        }

        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusableElement) {
                    e.preventDefault();
                    lastFocusableElement.focus();
                }
            } else {
                if (document.activeElement === lastFocusableElement) {
                    e.preventDefault();
                    firstFocusableElement.focus();
                }
            }
        }
    }

    form.addEventListener('keydown', trapFocus);

    // Set initial focus
    firstFocusableElement.focus();

    // Prevent focus from leaving the form, but not when modal is open
    document.addEventListener('focus', function(event) {
        const modalOpen = document.querySelector('.modal[style*="display: block"]');
        if (!modalOpen && !form.contains(event.target)) {
            event.preventDefault();
            firstFocusableElement.focus();
        }
    }, true);
});
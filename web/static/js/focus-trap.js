document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('zayavkiForm');
    const focusableElements = form.querySelectorAll('input, select, textarea, button:not([disabled])');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    function trapFocus(e) {
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

    // Prevent focus from leaving the form
    document.addEventListener('focus', function(event) {
        if (!form.contains(event.target)) {
            event.preventDefault();
            firstFocusableElement.focus();
        }
    }, true);
});
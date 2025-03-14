console.log('Loading main.js...');

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    initializeTabs();
    initializeForm();
    initializeModal();
    initializeJsonParser();
    initializeFieldValidation();
});
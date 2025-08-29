// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeForm();
    initializeModal();
    initializeJsonParser();
    initializeFieldValidation();
    
    // Force form to resize to content
    setTimeout(forceFormResize, 100);
    
    // Debug form heights
    setTimeout(debugFormHeights, 200);
});

// Function to force form container to resize to its content
function forceFormResize() {
    const formContainer = document.querySelector('.form-container');
    const activeTab = document.querySelector('.tab-pane.active');
    
    if (formContainer && activeTab) {
        // Force the form container to size to its content
        formContainer.style.height = 'auto';
        formContainer.style.minHeight = 'auto';
        formContainer.style.maxHeight = 'none';
        
        // Force the active tab to size to its content
        activeTab.style.height = 'auto';
        activeTab.style.minHeight = 'auto';
        activeTab.style.maxHeight = 'none';
        
        // Force the form fields container to size to its content
        const fieldsContainer = activeTab.querySelector('.form-fields-container');
        if (fieldsContainer) {
            fieldsContainer.style.height = 'auto';
            fieldsContainer.style.minHeight = 'auto';
            fieldsContainer.style.maxHeight = 'none';
        }
        
        console.log('Form resize forced');
    }
}

// Make the function globally available
window.forceFormResize = forceFormResize;

// Debug function to check form heights
function debugFormHeights() {
    const formContainer = document.querySelector('.form-container');
    const activeTab = document.querySelector('.tab-pane.active');
    const fieldsContainer = activeTab ? activeTab.querySelector('.form-fields-container') : null;
    
    console.log('=== Form Height Debug ===');
    console.log('Form Container:', {
        element: formContainer,
        height: formContainer ? formContainer.style.height : 'N/A',
        computedHeight: formContainer ? window.getComputedStyle(formContainer).height : 'N/A',
        offsetHeight: formContainer ? formContainer.offsetHeight : 'N/A'
    });
    
    if (activeTab) {
        console.log('Active Tab:', {
            element: activeTab,
            height: activeTab.style.height,
            computedHeight: window.getComputedStyle(activeTab).height,
            offsetHeight: activeTab.offsetHeight
        });
    }
    
    if (fieldsContainer) {
        console.log('Fields Container:', {
            element: fieldsContainer,
            height: fieldsContainer.style.height,
            computedHeight: window.getComputedStyle(fieldsContainer).height,
            offsetHeight: fieldsContainer.offsetHeight
        });
    }
    
    console.log('=== End Debug ===');
}

// Make debug function globally available
window.debugFormHeights = debugFormHeights;
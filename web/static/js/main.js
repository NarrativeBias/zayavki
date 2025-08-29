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
    
    // Set up automatic height syncing
    setTimeout(setupHeightSync, 300);
});

// Function to force form container to resize to its content
function forceFormResize() {
    const formContainer = document.querySelector('.form-container');
    const activeTab = document.querySelector('.tab-pane.active');
    const resultsContainer = document.querySelector('.results-container');
    
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
        
        // Ensure results container matches form container height
        if (resultsContainer) {
            const formHeight = formContainer.offsetHeight;
            const maxHeight = window.innerHeight - 100; // Match CSS max-height
            
            // Set min-height to form height, but don't exceed max-height
            const targetHeight = Math.min(formHeight, maxHeight);
            resultsContainer.style.minHeight = targetHeight + 'px';
            
            console.log('Results container min-height set to:', targetHeight + 'px', '(form height:', formHeight + 'px, max height:', maxHeight + 'px)');
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

// Function to sync results container height with form container
function syncResultsHeight() {
    const formContainer = document.querySelector('.form-container');
    const resultsContainer = document.querySelector('.results-container');
    
    if (formContainer && resultsContainer) {
        const formHeight = formContainer.offsetHeight;
        const maxHeight = window.innerHeight - 100; // Match CSS max-height
        
        // Set min-height to form height, but don't exceed max-height
        const targetHeight = Math.min(formHeight, maxHeight);
        resultsContainer.style.minHeight = targetHeight + 'px';
        
        console.log('Results container height synced to:', targetHeight + 'px', '(form height:', formHeight + 'px, max height:', maxHeight + 'px)');
    }
}

// Make sync function globally available
window.syncResultsHeight = syncResultsHeight;

// Set up a resize observer to automatically sync heights
function setupHeightSync() {
    const formContainer = document.querySelector('.form-container');
    const resultsContainer = document.querySelector('.results-container');
    
    if (formContainer && resultsContainer && window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            syncResultsHeight();
        });
        
        resizeObserver.observe(formContainer);
        console.log('Height sync observer set up');
    }
}
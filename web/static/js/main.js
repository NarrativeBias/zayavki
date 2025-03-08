// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    initializeFormSubmission();
    initializeButtons();
    initializeModal();
    initializeEmailValidation();
    initializeTabs();
    initializeJsonImport();
});

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
}

function initializeButtons() {
    const buttons = {
        'pushDbButton': handlePushToDbClick,
        'clearAllButton': clearAllFields
    };

    Object.entries(buttons).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
            if (id === 'clearAllButton') button.disabled = false;
        } else {
            console.error(`${id} not found in the document`);
        }
    });
}

function initializeModal() {
    const modal = document.getElementById('clusterModal');
    if (!modal) {
        console.error('Modal not found in the document');
        return;
    }

    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Add keyboard support
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

function handlePushToDbClick() {
    this.disabled = true;
    document.getElementById('result').textContent = 'Pushing data to DB...';
    handlePushToDb(); // This should be the function from form-handlers.js
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const headerTitle = document.querySelector('.form-container > h1');

    // Define tab titles
    const tabTitles = {
        'search': 'Поиск',
        'new-tenant': 'Новый тенант',
        'tenant-mod': 'Изменение тенанта',
        'user-mod': 'Изменение пользователя',
        'bucket-mod': 'Изменение бакета'
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active');

            // Update header title
            if (headerTitle && tabTitles[tabId]) {
                headerTitle.textContent = tabTitles[tabId];
            }
        });
    });

    // Set initial header title based on active tab
    const initialActiveTab = document.querySelector('.tab-button.active');
    if (initialActiveTab && headerTitle) {
        const initialTabId = initialActiveTab.dataset.tab;
        headerTitle.textContent = tabTitles[initialTabId];
    }
}
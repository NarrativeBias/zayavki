console.log('Loading main.js...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    initializeTabs();
    initializeFormSubmission();
    initializeModal();
    initializeJsonParser();
    initializeFieldValidation();
});

// Store field values for each tab separately
const fieldValues = {
    'search': {},
    'new-tenant': {},
    'tenant-mod': {},
    'user-bucket-del': {},
    'bucket-mod': {}
};

// Remove the hardcoded SHARED_FIELDS array and add a function to find shared fields
function getSharedFields() {
    const allFields = new Set();
    const fieldCounts = {};
    
    // Collect all field IDs and count their occurrences across tabs
    Object.values(TAB_CONFIGS).forEach(tabConfig => {
        const fields = tabConfig.fields.map(field => typeof field === 'string' ? field : field.id);
        fields.forEach(fieldId => {
            // Skip fields that should not be shared
            if (!NON_SHARED_FIELDS.includes(fieldId)) {
                allFields.add(fieldId);
                fieldCounts[fieldId] = (fieldCounts[fieldId] || 0) + 1;
            }
        });
    });

    // Return fields that appear in more than one tab
    return Array.from(allFields).filter(fieldId => fieldCounts[fieldId] > 1);
}

function saveFieldValues() {
    const activeTab = document.querySelector('.tab-pane.active');
    const tabId = activeTab.id;
    const inputs = activeTab.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        // Only save values for fields that should remember their values
        if (!NO_MEMORY_FIELDS.includes(input.id)) {
            fieldValues[tabId][input.id] = input.value;
        }
        // NO_MEMORY_FIELDS values won't be saved but will remain in the form until cleared
    });
}

function restoreFieldValues(tabId) {
    const inputs = document.querySelectorAll(`#${tabId}Fields input, #${tabId}Fields select, #${tabId}Fields textarea`);
    
    inputs.forEach(input => {
        // Restore any saved values
        if (fieldValues[tabId] && fieldValues[tabId][input.id] !== undefined) {
            input.value = fieldValues[tabId][input.id];
        }
    });
}

function createTabContent(tabId) {
    const tabContent = document.createElement('div');
    tabContent.id = tabId;
    tabContent.className = `tab-pane ${tabId === 'search' ? 'active' : ''}`;

    // Add header
    const header = document.createElement('h1');
    header.textContent = getTabTitle(tabId);
    tabContent.appendChild(header);

    // Add content wrapper
    const contentInner = document.createElement('div');
    contentInner.className = 'tab-content-inner';

    // Add import JSON button at the top for new-tenant tab
    if (tabId === 'new-tenant') {
        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.id = 'import-json';
        importButton.className = 'import-json-button';
        importButton.textContent = 'Импорт из JSON';
        importButton.addEventListener('click', () => {
            const modal = document.getElementById('jsonImportModal');
            if (modal) modal.style.display = 'block';
        });
        contentInner.appendChild(importButton);
    }

    // Add fields container
    const fieldsContainer = document.createElement('div');
    fieldsContainer.id = `${tabId}Fields`;
    fieldsContainer.className = 'form-fields';

    // Generate fields based on configuration
    const config = TAB_CONFIGS[tabId];
    config.fields.forEach(field => {
        const fieldElement = createFormField(field, config.required_fields?.includes(field.id));
        fieldsContainer.appendChild(fieldElement);
    });

    // Add buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'button-container';

    // Generate buttons based on configuration
    config.buttons.forEach(button => {
        // Skip import-json button since we've moved it to the top
        if (button.id !== 'import-json') {
            const buttonElement = createButton(button);
            buttonsContainer.appendChild(buttonElement);
        }
    });

    contentInner.appendChild(fieldsContainer);
    contentInner.appendChild(buttonsContainer);
    tabContent.appendChild(contentInner);

    return tabContent;
}

function getTabTitle(tabId) {
    const titles = {
        'search': 'Поиск',
        'new-tenant': 'Создание нового тенанта',
        'tenant-mod': 'Создание пользователя/бакета в существующем тенанте',
        'user-bucket-del': 'Удаление пользователя/бакета в существующем тенанте',
        'bucket-mod': 'Изменение квоты бакета'
    };
    return titles[tabId] || '';
}

function createFormField(fieldConfig, required = false) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'form-field';

    const label = document.createElement('label');
    label.htmlFor = fieldConfig.id;
    label.textContent = fieldConfig.label;
    
    let input;
    if (fieldConfig.type === 'select') {
        input = document.createElement('select');
        if (fieldConfig.options) {
            fieldConfig.options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = typeof option === 'object' ? option.value : option;
                opt.textContent = typeof option === 'object' ? option.label : option;
                input.appendChild(opt);
            });
        }
    } else if (fieldConfig.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 5;
    } else {
        input = document.createElement('input');
        input.type = fieldConfig.type || 'text';
    }

    // Add attributes to disable autofill for all fields except 'segment'
    if (fieldConfig.id !== 'segment') {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
    }

    input.id = fieldConfig.id;
    input.name = fieldConfig.id;
    input.required = required;
    if (fieldConfig.placeholder) {
        input.placeholder = fieldConfig.placeholder;
    }

    fieldWrapper.appendChild(label);
    fieldWrapper.appendChild(input);
    return fieldWrapper;
}

function createButton(buttonConfig) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonConfig.id;
    
    // Use existing button styles from main.css
    switch (buttonConfig.id) {
        case 'searchButton':
            button.className = 'search-button';
            break;
        case 'clearButton':
            button.className = 'clear-search-button';
            break;
        case 'import-json':
            button.className = 'import-json-button';
            break;
        case 'check-form':
        case 'submit-form':
            button.className = 'confirm-button';
            break;
        default:
            button.className = 'button-container button';
    }
    
    button.textContent = buttonConfig.label;
    
    // Add event listeners based on button id
    switch (buttonConfig.id) {
        case 'searchButton':
            button.addEventListener('click', handleSearch);
            break;
        case 'clearButton':
            button.addEventListener('click', clearAllFields);
            break;
        case 'check-form':
            button.addEventListener('click', () => handleFormSubmit(false));
            break;
        case 'submit-form':
            button.addEventListener('click', () => handleFormSubmit(true));
            break;
    }
    
    return button;
}

function initializeTabs() {
    const form = document.getElementById('mainForm');
    if (!form) {
        console.error('Main form not found');
        return;
    }
    
    // Generate tab content for each tab
    Object.keys(TAB_CONFIGS).forEach(tabId => {
        const tabContent = createTabContent(tabId);
        form.appendChild(tabContent);
        // Initialize empty field values for this tab
        fieldValues[tabId] = {};
    });

    // Add tab switching logic
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const currentTab = document.querySelector('.tab-pane.active');
            const newTabId = tab.dataset.tab;
            
            // Save current values before switching
            if (currentTab) {
                saveFieldValues();
            }
            
            // Update active tab button
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active tab content
            const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === newTabId) {
                    pane.classList.add('active');
                }
            });
            
            // Restore values for the new tab
            restoreFieldValues(newTabId);
        });
    });
}

function handleSearch(e) {
    e.preventDefault();
    const formData = new FormData(document.getElementById('mainForm'));
    const searchData = {
        segment: formData.get('segment'),
        env: formData.get('env'),
        ris_number: formData.get('ris_number'),
        ris_name: formData.get('ris_name')?.toLowerCase(),
        tenant: formData.get('tenant'),
        bucket: formData.get('bucket'),
        user: formData.get('user'),
        cluster: formData.get('cluster')
    };
    
    fetch('/zayavki/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
    })
    .then(response => response.json())
    .then(data => {
        displaySearchResults(data.results);
    })
    .catch(error => {
        console.error('Error:', error);
        displayFormResult('Error performing search: ' + error.message);
    });
}

function clearAllFields() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        const inputs = activeTab.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.value = '';
            if (input.id) {
                fieldValues[activeTab.id][input.id] = '';
            }
        });
    }
    document.getElementById('result').textContent = '';
}

function initializeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => modal.style.display = 'none';
        }

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    });
}

function switchTab(tabName) {
    // Save current tab's values before switching
    const currentTab = document.querySelector('.tab-pane.active');
    if (currentTab) {
        saveFieldValues();
    }

    // Update active tab button
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabName) {
            button.classList.add('active');
        }
    });

    // Update active tab content
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === tabName) {
            pane.classList.add('active');
        }
    });

    // Restore values for the new tab
    restoreFieldValues(tabName);
}

function initializeForm() {
    const form = document.getElementById('mainForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Initialize tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });

    // Initialize with the first tab (search)
    switchTab('search');
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeForm);
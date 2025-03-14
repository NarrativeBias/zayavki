// Store field values for each tab separately
const fieldValues = {
    'search': {},
    'new-tenant': {},
    'tenant-mod': {},
    'user-bucket-del': {},
    'bucket-mod': {}
};

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

function switchTab(tabName) {
    // Save current tab's values before switching
    saveFieldValues();

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
            // Restore values for the new tab
            restoreFieldValues(tabName);
        }
    });
}

function initializeFieldSync() {
    document.querySelectorAll('.tab-pane').forEach(tabPane => {
        const tabId = tabPane.id;
        if (!fieldValues[tabId]) {
            fieldValues[tabId] = {};
        }

        const inputs = tabPane.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.id) {
                input.addEventListener('change', () => {
                    if (!NO_MEMORY_FIELDS.includes(input.id)) {
                        if (getSharedFields().includes(input.id)) {
                            // Update shared field in all tabs
                            Object.keys(fieldValues).forEach(tab => {
                                fieldValues[tab][input.id] = input.value;
                            });
                        } else {
                            // Update non-shared field in current tab
                            fieldValues[tabId][input.id] = input.value;
                        }
                    }
                });
            }
        });
    });
}

function getSharedFields() {
    const allFields = new Set();
    const fieldCounts = {};
    
    Object.values(TAB_CONFIGS).forEach(tabConfig => {
        const fields = tabConfig.fields.map(field => typeof field === 'string' ? field : field.id);
        fields.forEach(fieldId => {
            if (!NON_SHARED_FIELDS.includes(fieldId)) {
                allFields.add(fieldId);
                fieldCounts[fieldId] = (fieldCounts[fieldId] || 0) + 1;
            }
        });
    });

    return Array.from(allFields).filter(fieldId => fieldCounts[fieldId] > 1);
}

function saveFieldValues() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) return;
    
    const tabId = activeTab.id;
    if (!fieldValues[tabId]) {
        fieldValues[tabId] = {};
    }

    const inputs = activeTab.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id && !NO_MEMORY_FIELDS.includes(input.id)) {
            const value = input.value;
            
            if (getSharedFields().includes(input.id)) {
                Object.keys(fieldValues).forEach(tab => {
                    fieldValues[tab][input.id] = value;
                });
                
                document.querySelectorAll(`#${input.id}`).forEach(field => {
                    field.value = value;
                });
            } else {
                fieldValues[tabId][input.id] = value;
            }
        }
    });
}

function restoreFieldValues(tabId) {
    const tabPane = document.getElementById(tabId);
    if (!tabPane) return;

    const inputs = tabPane.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id) {
            if (getSharedFields().includes(input.id)) {
                for (const tab in fieldValues) {
                    if (fieldValues[tab][input.id]) {
                        input.value = fieldValues[tab][input.id];
                        break;
                    }
                }
            } else if (fieldValues[tabId] && fieldValues[tabId][input.id] !== undefined) {
                input.value = fieldValues[tabId][input.id];
            }
        }
    });
}

// Export fieldValues and functions
window.fieldValues = fieldValues;
window.initializeTabs = initializeTabs;
window.switchTab = switchTab;
window.initializeFieldSync = initializeFieldSync;
window.getSharedFields = getSharedFields;
window.saveFieldValues = saveFieldValues;
window.restoreFieldValues = restoreFieldValues; 
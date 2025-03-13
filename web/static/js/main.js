console.log('Loading main.js...');

// Add near the top of the file, after other global function declarations
window.handleFormSubmit = handleFormSubmit;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    initializeTabs();
    initializeForm();
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

// Update the getSharedFields function to properly handle field sharing
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

// Update clearAllFields to handle field synchronization properly
function clearAllFields() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) return;

    const inputs = activeTab.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id) {
            input.value = '';
            
            // For shared fields, clear in all tabs
            if (getSharedFields().includes(input.id)) {
                Object.keys(fieldValues).forEach(tab => {
                    fieldValues[tab][input.id] = '';
                });
                
                // Clear value in all tab instances
                document.querySelectorAll(`#${input.id}`).forEach(field => {
                    field.value = '';
                });
            } else {
                // For non-shared fields, just clear in current tab
                fieldValues[activeTab.id][input.id] = '';
            }

            // Trigger change event
            const event = new Event('change', {
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(event);
        }
    });
    
    document.getElementById('result').textContent = '';
}

// Update saveFieldValues to handle shared fields properly
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
            
            // For shared fields, update value in all tabs
            if (getSharedFields().includes(input.id)) {
                Object.keys(fieldValues).forEach(tab => {
                    fieldValues[tab][input.id] = value;
                });
                
                // Update value in all tab instances
                document.querySelectorAll(`#${input.id}`).forEach(field => {
                    field.value = value;
                });
            } else {
                // For non-shared fields, just update in current tab
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
            // Check if it's a shared field
            if (getSharedFields().includes(input.id)) {
                // Get the value from any tab that has it
                for (const tab in fieldValues) {
                    if (fieldValues[tab][input.id]) {
                        input.value = fieldValues[tab][input.id];
                        break;
                    }
                }
            } else if (fieldValues[tabId] && fieldValues[tabId][input.id] !== undefined) {
                // Restore non-shared field value
                input.value = fieldValues[tabId][input.id];
            }
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
        'user-bucket-del': 'Удаление пользователя/бакета из существующего тенанта',
        'bucket-mod': 'Изменение квоты бакета (WIP)'
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
    button.id = buttonConfig.id;
    button.className = buttonConfig.className || 'button-container button';
    button.textContent = buttonConfig.label;
    
    // Add event listeners based on button id
    switch (buttonConfig.id) {
        case 'searchButton':
            button.type = 'button';
            button.addEventListener('click', handleSearch);
            break;
        case 'clearButton':
            button.type = 'button';
            button.addEventListener('click', clearAllFields);
            break;
        case 'check-form':
            button.type = 'button';
            button.addEventListener('click', () => handleFormSubmit(false));
            break;
        case 'submit-form':
            button.type = 'button';
            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFormSubmit(true);
            };
            break;
        case 'import-json':
            button.type = 'button';
            break;
        default:
            button.type = 'button';
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

// Add event listeners for input changes to save values immediately
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

// Update the initialization to include field sync
function initializeForm() {
    let form = document.getElementById('mainForm');
    if (form) {
        // Remove default form action and prevent default submission
        form.action = 'javascript:void(0);';
        form.method = 'post';
        
        // Main form submission handler
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Always prevent default form submission
        });

        // Initialize tabs
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                switchTab(tabName);
            });
        });

        // Initialize field synchronization
        initializeFieldSync();

        // Initialize specific tab handlers
        initializeUserBucketDel();
        initializeTenantMod();
    }

    // Initialize with the first tab (search)
    switchTab('search');
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeForm);

function displayCheckResults(data) {
    let html = '<div class="table-container">';
    
    // Display tenant info
    html += '<h3>Информация о тенанте</h3>';
    html += `<table class="data-table">
        <tr>
            <th>Тенант</th>
            <th>Кластер</th>
            <th>Среда</th>
            <th>Зона безопасности</th>
        </tr>
        <tr>
            <td>${data.tenant.name || '-'}</td>
            <td>${data.tenant.cluster || '-'}</td>
            <td>${data.tenant.env || '-'}</td>
            <td>${data.tenant.segment || '-'}</td>
        </tr>
    </table>`;

    // Display users info if any were requested
    if (data.users && data.users.length > 0) {
        html += '<h3>Пользователи</h3>';
        html += `<table class="data-table">
            <tr>
                <th>Пользователь</th>
                <th>Статус</th>
            </tr>`;
        data.users.forEach(user => {
            html += `<tr>
                <td>${user.name}</td>
                <td>${user.status}</td>
            </tr>`;
        });
        html += '</table>';
    }

    // Display buckets info if any were requested
    if (data.buckets && data.buckets.length > 0) {
        html += '<h3>Бакеты</h3>';
        html += `<table class="data-table">
            <tr>
                <th>Бакет</th>
                <th>Размер</th>
                <th>Статус</th>
            </tr>`;
        data.buckets.forEach(bucket => {
            html += `<tr>
                <td>${bucket.name}</td>
                <td>${bucket.size || '-'}</td>
                <td>${bucket.status}</td>
            </tr>`;
        });
        html += '</table>';
    }

    // Only show deletion commands if there are active resources to delete
    const hasActivesToDelete = (data.users && data.users.some(u => u.status === 'Активный')) ||
                             (data.buckets && data.buckets.some(b => b.status === 'Активный'));

    if (hasActivesToDelete) {
        html += '<h3>Команды для удаления ресурсов</h3>';
        html += '<pre class="command-block">';
        if (data.deletion_commands) {
            html += data.deletion_commands;
        }
        html += '</pre>';
    }

    html += '</div>';
    document.getElementById('result').innerHTML = html;
}

function initializeUserBucketDel() {
    const checkButton = document.querySelector('#user-bucket-del #check-tenant');
    const submitButton = document.querySelector('#user-bucket-del #submit-form');
    const form = document.getElementById('mainForm');

    if (checkButton) {
        checkButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const tabPane = document.querySelector('#user-bucket-del');
            const tenantInput = tabPane.querySelector('#tenant');
            const usersInput = tabPane.querySelector('#users');
            const bucketsInput = tabPane.querySelector('#buckets');

            const tenant = tenantInput ? tenantInput.value.trim() : '';
            const users = usersInput && usersInput.value ? 
                usersInput.value.trim().split('\n').filter(Boolean).map(u => u.trim()) : [];
            const buckets = bucketsInput && bucketsInput.value ? 
                bucketsInput.value.trim().split('\n').filter(Boolean).map(b => b.trim()) : [];

            if (!tenant) {
                displayResult('Ошибка: Необходимо указать имя тенанта');
                return;
            }

            try {
                const response = await fetch('/zayavki/check-tenant-resources', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tenant,
                        users,
                        buckets
                    })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const data = await response.json();
                displayCheckResults(data);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }

    if (submitButton) {
        submitButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const tabPane = document.querySelector('#user-bucket-del');
            const tenantInput = tabPane.querySelector('#tenant');
            const usersInput = tabPane.querySelector('#users');
            const bucketsInput = tabPane.querySelector('#buckets');

            const tenant = tenantInput ? tenantInput.value.trim() : '';
            const users = usersInput && usersInput.value ? 
                usersInput.value.trim().split('\n').filter(Boolean).map(u => u.trim()) : [];
            const buckets = bucketsInput && bucketsInput.value ? 
                bucketsInput.value.trim().split('\n').filter(Boolean).map(b => b.trim()) : [];

            if (!tenant) {
                displayResult('Ошибка: Необходимо указать имя тенанта');
                return;
            }

            if (users.length === 0 && buckets.length === 0) {
                displayResult('Ошибка: Необходимо указать пользователей или бакеты для деактивации');
                return;
            }

            try {
                const response = await fetch('/zayavki/deactivate-resources', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tenant,
                        users,
                        buckets
                    })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const data = await response.json();
                displayDeactivationResults(data);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }

    // Prevent form submission for this tab
    if (form) {
        form.addEventListener('submit', (e) => {
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab && activeTab.id === 'user-bucket-del') {
                e.preventDefault();
                return false;
            }
        });
    }
}

function initializeTenantMod() {
    const checkButton = document.querySelector('#tenant-mod #check-tenant');
    let tenantData = null; // Store tenant data

    if (checkButton) {
        checkButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const tabPane = document.querySelector('#tenant-mod');
            const tenantInput = tabPane.querySelector('#tenant');
            const tenant = tenantInput ? tenantInput.value.trim() : '';

            if (!tenant) {
                displayResult('Ошибка: Необходимо указать имя тенанта');
                return;
            }

            try {
                const response = await fetch('/zayavki/tenant-info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ tenant })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                tenantData = await response.json(); // Store the tenant data
                displayTenantInfo(tenantData);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }

    // Handle submit button
    const submitButton = document.querySelector('#tenant-mod #submit-form');
    if (submitButton) {
        submitButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!tenantData) {
                displayResult('Ошибка: Сначала необходимо проверить тенант');
                return;
            }

            // Get form data
            const tabPane = document.querySelector('#tenant-mod');
            const sdInput = tabPane.querySelector('#request_id_sd');
            const srtInput = tabPane.querySelector('#request_id_srt');
            const usersInput = tabPane.querySelector('#users');
            const bucketsInput = tabPane.querySelector('#buckets');
            const emailInput = tabPane.querySelector('#email_for_credentials');

            // Create form data
            const submitData = new FormData();
            submitData.append('segment', tenantData.net_seg);
            submitData.append('env', tenantData.env);
            submitData.append('tenant_override', tenantData.tenant);
            submitData.append('ris_number', tenantData.ris_id);
            submitData.append('ris_name', tenantData.ris_code);
            submitData.append('resp_group', tenantData.owner_group);
            submitData.append('owner', tenantData.owner_person);
            submitData.append('cluster', tenantData.cls_name);
            submitData.append('realm', tenantData.realm);

            if (sdInput) submitData.append('request_id_sd', sdInput.value);
            if (srtInput) submitData.append('request_id_srt', srtInput.value);
            if (usersInput) submitData.append('users', usersInput.value);
            if (bucketsInput) submitData.append('buckets', bucketsInput.value);
            if (emailInput) submitData.append('email_for_credentials', emailInput.value);

            try {
                const response = await fetch('/zayavki/cluster', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        processedVars: Object.fromEntries([...submitData.entries()].map(([k,v]) => [k,[v]])),
                        selectedCluster: {
                            "Кластер": tenantData.cls_name,
                            "Реалм": tenantData.realm,
                            "ЦОД": tenantData.dc,
                            "Выдача": tenantData.issue,
                            "Среда": tenantData.env,
                            "ЗБ": tenantData.net_seg,
                            "tls_endpoint": tenantData.tls_endpoint,
                            "mtls_endpoint": tenantData.mtls_endpoint
                        },
                        pushToDb: true
                    })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const result = await response.text();
                displayResult(result);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }
}

async function handleFormSubmit(pushToDb = false) {
    try {
        const activeTab = document.querySelector('.tab-pane.active');
        if (!activeTab) return;

        // Get all form data from the active tab
        const formData = new FormData();
        const inputs = activeTab.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.id && input.value) {
                formData.append(input.id, input.value);
            }
        });

        // Add create_tenant=true if we're in the new-tenant tab
        if (activeTab.id === 'new-tenant') {
            formData.append('create_tenant', 'true');
        }

        // Add push_to_db parameter
        formData.append('push_to_db', pushToDb.toString());

        const response = await fetch('/zayavki/submit', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const text = await response.text();
        
        if (text.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusters = JSON.parse(text.substring('CLUSTER_SELECTION_REQUIRED:'.length));
            showClusterModal(clusters, formData, pushToDb);
            return;
        }

        displayResult(text);

    } catch (error) {
        displayResult(`Error: ${error.message}`);
    }
}
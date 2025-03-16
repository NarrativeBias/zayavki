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
    button.type = 'button';

    // Use the passed tabId instead of trying to find it
    const { tabId } = buttonConfig;

    // Add click handlers based on button type/id
    switch (button.id) {
        case 'check-tenant':
            button.className = 'primary-button';
            if (tabId === 'tenant-mod') {
                button.onclick = async (e) => {
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
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenant })
                        });
                        if (!response.ok) throw new Error(await response.text());
                        const data = await response.json();
                        displayTenantInfo(data);
                    } catch (error) {
                        displayResult(`Ошибка: ${error.message}`);
                    }
                };
            } else if (tabId === 'user-bucket-del') {
                button.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabPane = document.querySelector('#user-bucket-del');
                    const resourceData = collectTenantResourcesData(tabPane);
                    if (!resourceData.tenant) {
                        displayResult('Ошибка: Необходимо указать имя тенанта');
                        return;
                    }
                    try {
                        const response = await fetchJson('/zayavki/check-tenant-resources', resourceData);
                        const data = await response.json();
                        displayCheckResults(data);
                    } catch (error) {
                        displayResult(`Ошибка: ${error.message}`);
                    }
                };
            } else if (tabId === 'new-tenant') {
                button.onclick = async (e) => {
                    e.preventDefault();
                    await submitForm(document.getElementById('mainForm'), false);
                };
            }
            break;
        case 'submit-form':
            button.className = 'danger-button';
            if (tabId === 'tenant-mod') {
                button.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // ... tenant-mod submit handler ...
                };
            } else if (tabId === 'user-bucket-del') {
                button.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabPane = document.querySelector('#user-bucket-del');
                    const resourceData = collectTenantResourcesData(tabPane);
                    if (!resourceData.tenant) {
                        displayResult('Ошибка: Необходимо указать имя тенанта');
                        return;
                    }
                    if (resourceData.users.length === 0 && resourceData.buckets.length === 0) {
                        displayResult('Ошибка: Необходимо указать пользователей или бакеты для деактивации');
                        return;
                    }
                    try {
                        const response = await fetchJson('/zayavki/deactivate-resources', resourceData);
                        const data = await response.json();
                        displayDeactivationResults(data);
                    } catch (error) {
                        displayResult(`Ошибка: ${error.message}`);
                    }
                };
            } else if (tabId === 'new-tenant') {
                button.onclick = async (e) => {
                    e.preventDefault();
                    await submitForm(document.getElementById('mainForm'), true);
                };
            }
            break;
        case 'search':
            button.className = 'search-button';
            button.onclick = handleSearch;
            break;
        case 'clear':
            button.className = 'clear-search-button';
            button.onclick = clearAllFields;
            break;
        case 'pushDbButton':
            button.className = 'primary-button';
            button.onclick = handlePushToDb;
            button.disabled = true;
            break;
        case 'importJsonButton':
            button.className = 'import-json-button';
            button.onclick = showJsonImportModal;
            break;
    }

    return button;
}

function createTabContent(tabId) {
    const tabContent = document.createElement('div');
    tabContent.id = tabId;
    tabContent.className = 'tab-pane';
    
    // Add tab title/header
    const header = document.createElement('h2');
    header.textContent = getTabTitle(tabId);
    tabContent.appendChild(header);
    
    // Create container for form fields
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'form-fields-container';
    // Add the fields container to the tab content first
    tabContent.appendChild(fieldsContainer);
    
    const config = TAB_CONFIGS[tabId];
    if (!config) return tabContent;

    // Add fields
    if (config.fields) {
        config.fields.forEach(field => {
            const isRequired = config.required_fields?.includes(
                typeof field === 'string' ? field : field.id
            );
            const fieldElement = createFormField(
                typeof field === 'string' ? { id: field, label: field } : field,
                isRequired
            );
            fieldsContainer.appendChild(fieldElement);
        });
    }

    // Add buttons
    if (config.buttons) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        // Pass the tabId directly to createButton
        config.buttons.forEach(button => {
            const buttonElement = createButton(
                typeof button === 'string' ? { id: button, label: button, tabId } : { ...button, tabId }
            );
            buttonContainer.appendChild(buttonElement);
        });
        fieldsContainer.appendChild(buttonContainer);
    }

    return tabContent;
}

function getTabTitle(tabId) {
    const titles = {
        'search': 'Поиск',
        'new-tenant': 'Создание нового тенанта',
        'tenant-mod': 'Создание пользователя/бакета в существующем тенанте',
        'user-bucket-del': 'Удаление пользователя/бакета из существующего тенанта',
        'bucket-mod': 'Изменение квоты бакета'
    };
    return titles[tabId] || '';
}

// Export functions
window.createFormField = createFormField;
window.createButton = createButton;
window.createTabContent = createTabContent;
window.getTabTitle = getTabTitle; 
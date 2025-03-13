function getEnvCode(env) {
    switch (env) {
        case 'PROD': return 'p0';
        case 'PREPROD': return 'rr';
        case 'IFT': return 'if';
        case 'HOTFIX': return 'hf';
        case 'LT': return 'lt';
        default: return '';
    }
}

function createTableRow(cells, isHeader = false) {
    const row = document.createElement('tr');
    cells.forEach(cell => {
        const el = document.createElement(isHeader ? 'th' : 'td');
        el.textContent = cell || '-';
        row.appendChild(el);
    });
    return row;
}

function createTable(headers, rows, className = 'data-table') {
    const table = document.createElement('table');
    table.className = className;
    
    // Add header
    const thead = document.createElement('thead');
    thead.appendChild(createTableRow(headers, true));
    table.appendChild(thead);
    
    // Add body
    const tbody = document.createElement('tbody');
    rows.forEach(row => tbody.appendChild(createTableRow(row)));
    table.appendChild(tbody);
    
    return table;
}

function createSection(title, content) {
    const section = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    
    if (content instanceof Element) {
        section.appendChild(content);
    } else if (Array.isArray(content)) {
        content.forEach(element => section.appendChild(element));
    }
    
    return section;
}

function collectFormFields(tabPane) {
    const formData = new FormData();
    const inputs = tabPane.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id && input.value) {
            formData.append(input.id, input.value);
        }
    });
    return formData;
}

async function fetchJson(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response;
}

function collectTenantResourcesData(tabPane) {
    const tenantInput = tabPane.querySelector('#tenant');
    const usersInput = tabPane.querySelector('#users');
    const bucketsInput = tabPane.querySelector('#buckets');

    return {
        tenant: tenantInput ? tenantInput.value.trim() : '',
        users: usersInput && usersInput.value ? 
            usersInput.value.trim().split('\n').filter(Boolean).map(u => u.trim()) : [],
        buckets: bucketsInput && bucketsInput.value ? 
            bucketsInput.value.trim().split('\n').filter(Boolean).map(b => b.trim()) : []
    };
}

function trimFormData(formOrData) {
    const formData = formOrData instanceof HTMLFormElement ? new FormData(formOrData) : formOrData;
    const trimmedData = new FormData();

    for (let [key, value] of formData.entries()) {
        if (typeof value === 'string') {
            value = value.trim().split('\n').map(line => line.trim()).filter(Boolean).join('\n');
        }
        trimmedData.append(key, value);
    }

    return trimmedData;
}

function processFormData(formData) {
    const processedVars = Object.fromEntries(
        Array.from(formData.entries()).reduce((acc, [key, value]) => {
            if (!acc.has(key)) acc.set(key, []);
            acc.get(key).push(value);
            return acc;
        }, new Map())
    );

    const envSelect = document.getElementById('env');
    if (envSelect && !processedVars.hasOwnProperty('env_code')) {
        processedVars['env_code'] = [getEnvCode(envSelect.value)];
    }

    return processedVars;
}

function setFieldValue(fieldId, value) {
    const input = document.getElementById(fieldId);
    if (input && value) {
        input.value = value;
        if (input.tagName === 'SELECT') {
            input.dispatchEvent(new Event('change'));
        }
    }
}

// Add these utility functions
function enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = false;
    }
}

function disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
    }
}

// Export functions
window.createTableRow = createTableRow;
window.createTable = createTable;
window.createSection = createSection;
window.collectFormFields = collectFormFields;
window.fetchJson = fetchJson;
window.collectTenantResourcesData = collectTenantResourcesData;
window.trimFormData = trimFormData;
window.processFormData = processFormData;
window.setFieldValue = setFieldValue;
window.enableButton = enableButton;
window.disableButton = disableButton;
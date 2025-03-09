let selectedCluster = null;

function initializeFormSubmissionHandler() {
    const form = document.getElementById('mainForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(form);
        });
    } else {
        console.error('Form not found in the document');
    }
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

async function handleFetchResponse(response) {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }
    
    const text = await response.text();
    console.log('Raw response:', text);

    // Check if it's a cluster selection response
    if (text.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
        return text; // Return the raw text for cluster selection
    }
    
    try {
        // Try to parse as JSON
        return JSON.parse(text);
    } catch (e) {
        // If it's not JSON, return the text as is
        return text;
    }
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

async function handleClusterSelection(clusters, operation, data) {
    if (clusters.length === 1) {
        selectedCluster = clusters[0];
        return operation(selectedCluster, data);
    } else if (clusters.length > 1) {
        return new Promise((resolve) => {
            showClusterSelectionModal(clusters, (chosenCluster) => {
                selectedCluster = chosenCluster;
                resolve(operation(selectedCluster, data));
            });
        });
    } else {
        displayResult('No matching clusters found');
        selectedCluster = null;
        return Promise.reject('No matching clusters found');
    }
}

async function submitForm(form, pushToDb = false) {
    try {
        const trimmedFormData = trimFormData(form);
        trimmedFormData.append('push_to_db', pushToDb.toString());

        const response = await fetch('/zayavki/submit', { method: 'POST', body: trimmedFormData });
        const data = await handleFetchResponse(response);

        // Add debug logging
        console.log('Response data:', data);

        if (typeof data === 'string' && data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusterData = data.slice('CLUSTER_SELECTION_REQUIRED:'.length);
            console.log('Cluster data:', clusterData);
            const clusters = JSON.parse(clusterData);
            await handleClusterSelection(clusters, submitFormWithCluster, { formData: trimmedFormData, pushToDb });
        } else {
            displayResult(data);
            if (!pushToDb) enablePushToDbButton();
            selectedCluster = null;
        }
    } catch (error) {
        handleError(error);
    }
}

async function submitFormWithCluster(cluster, { formData, pushToDb }) {
    try {
        const processedVars = processFormData(formData);
        const requestBody = { processedVars, selectedCluster: cluster, pushToDb };

        const response = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const data = await handleFetchResponse(response);

        displayResult(data);
        if (!pushToDb) enablePushToDbButton();
    } catch (error) {
        handleError(error);
    } finally {
        if (pushToDb) {
            disablePushToDbButton();
            selectedCluster = null;
        }
    }
}

function handleError(error) {
    console.error('Error:', error);
    document.getElementById('result').textContent = `An error occurred: ${error.message}`;
    disablePushToDbButton();
}

function clearAllFields() {
    const form = document.getElementById('mainForm');
    if (form) {
        form.querySelectorAll('input, textarea, select').forEach(input => {
            input.type === 'checkbox' || input.type === 'radio' ? input.checked = false : input.value = '';
        });
        document.getElementById('result').textContent = '';
        selectedCluster = null;
        disablePushToDbButton();
    } else {
        console.error('Form not found when trying to clear fields');
    }
}

function handlePushToDb() {
    disablePushToDbButton();
    const form = document.getElementById('mainForm');
    selectedCluster
        ? submitFormWithCluster(selectedCluster, { formData: new FormData(form), pushToDb: true })
        : submitForm(form, true);
}

function enablePushToDbButton() {
    document.getElementById('pushDbButton').disabled = false;
}

function disablePushToDbButton() {
    document.getElementById('pushDbButton').disabled = true;
}

function showValidationMessage(container, message, type) {
    container.textContent = message;
    container.className = 'validation-message ' + type;
}

function displayResult(text) {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;

    // Clear previous content
    resultDiv.innerHTML = '';

    // Create pre element to preserve formatting
    const pre = document.createElement('pre');
    pre.textContent = text;
    resultDiv.appendChild(pre);
}

function initializeJsonParser() {
    console.log('Initializing JSON parser...');
    const importButton = document.getElementById('importJsonButton');
    const modal = document.getElementById('jsonImportModal');
    
    if (!importButton) {
        console.error('Import JSON button not found');
        return;
    }
    if (!modal) {
        console.error('JSON import modal not found');
        return;
    }

    console.log('Found import button and modal');
    
    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');

    importButton.addEventListener('click', () => {
        console.log('Import button clicked');
        modal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        console.log('Close button clicked');
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            console.log('Clicked outside modal');
            modal.style.display = 'none';
        }
    });

    confirmButton.addEventListener('click', () => {
        console.log('Confirm button clicked');
        const srtJson = document.getElementById('srt_json').value.trim();
        const paramsJson = document.getElementById('params_json').value.trim();

        try {
            if (srtJson) {
                const srtData = JSON.parse(srtJson);
                parseSrtJson(srtData);
            }
            
            if (paramsJson) {
                const paramsData = JSON.parse(paramsJson);
                parseParamsJson(paramsData);
            }

            modal.style.display = 'none';
            displayResult('JSON данные успешно импортированы');
        } catch (error) {
            console.error('Error parsing JSON:', error);
            displayResult(`Ошибка парсинга JSON: ${error.message}`);
        }
    });
}

function parseSrtJson(data) {
    const customFields = {};
    if (data.customFieldsValues && Array.isArray(data.customFieldsValues)) {
        data.customFieldsValues.forEach(field => {
            customFields[field.code] = field.value;
        });
    }

    // Map SRT JSON fields
    setFieldValue('request_id_srt', data.number);
    setFieldValue('request_id_sd', customFields.appealNumber);
    setFieldValue('requester', customFields.applicant);
}

function parseParamsJson(data) {
    // Map parameter JSON fields - add the mappings as needed
    setFieldValue('segment', data.segment);
    setFieldValue('env', data.environment);
    setFieldValue('ris_number', data.risNumber);
    setFieldValue('ris_name', data.risName);
    // Add more field mappings as needed
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

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
    initializeJsonParser();
}

function createResultsTable(results) {
    // Create table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = [
        'Cluster', 'Segment', 'Environment', 'Realm', 'Tenant', 
        'User', 'Bucket', 'Quota', 'SD', 'SRT', 'Date',
        'RIS Code', 'RIS ID', 'Owner Group', 'Owner', 'Applicant'
    ];

    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    if (results && results.length > 0) {
        results.forEach(result => {
            const row = document.createElement('tr');
            [
                result.cluster,
                result.segment,
                result.environment,
                result.realm,
                result.tenant,
                result.user,
                result.bucket,
                result.quota,
                result.sd_num,
                result.srt_num,
                result.done_date,
                result.ris_code,
                result.ris_id,
                result.owner_group,
                result.owner,
                result.applicant
            ].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text || '-';
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = headers.length;
        td.textContent = 'No results found';
        td.className = 'empty-message';
        row.appendChild(td);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    return tableContainer;
}

// For form submission responses
function displayFormResult(data) {
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.textContent = data;
    }
}

// For search results that need table formatting
function displaySearchResults(results) {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;

    if (!results || results.length === 0) {
        resultDiv.innerHTML = '<div class="empty-message">No results found</div>';
        return;
    }

    const table = createResultsTable(results);
    resultDiv.innerHTML = '';
    resultDiv.appendChild(table);
}

function initializeFieldValidation() {
    // SD number validation
    const sdInput = document.getElementById('request_id_sd');
    if (sdInput) {
        sdInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toLowerCase();
            if (value && !value.startsWith('sd-')) {
                showValidationMessage(
                    getOrCreateValidationDiv(sdInput),
                    'Номер должен начинаться с "SD-"',
                    'error'
                );
            } else {
                clearValidationMessage(getOrCreateValidationDiv(sdInput));
            }
        });
    }

    // SRT number validation
    const srtInput = document.getElementById('request_id_srt');
    if (srtInput) {
        srtInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toLowerCase();
            if (value && !value.startsWith('srt-')) {
                showValidationMessage(
                    getOrCreateValidationDiv(srtInput),
                    'Номер должен начинаться с "SRT-"',
                    'error'
                );
            } else {
                clearValidationMessage(getOrCreateValidationDiv(srtInput));
            }
        });
    }

    // Email validation for all email fields
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const emailFields = ['owner', 'zam_owner', 'email_for_credentials'];
    
    emailFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value && !emailPattern.test(value)) {
                    showValidationMessage(
                        getOrCreateValidationDiv(input),
                        'Введите корректный email адрес',
                        'error'
                    );
                } else {
                    clearValidationMessage(getOrCreateValidationDiv(input));
                }
            });
        }
    });
}

function getOrCreateValidationDiv(inputElement) {
    let validationDiv = inputElement.parentNode.querySelector('.validation-message');
    if (!validationDiv) {
        validationDiv = document.createElement('div');
        validationDiv.className = 'validation-message';
        inputElement.parentNode.insertBefore(validationDiv, inputElement.nextSibling);
    }
    return validationDiv;
}

function clearValidationMessage(validationDiv) {
    validationDiv.textContent = '';
    validationDiv.className = 'validation-message';
}

function handleSearch(e) {
    e.preventDefault();
    
    // Get the search tab's fields
    const searchTab = document.getElementById('search');
    if (!searchTab) {
        console.error('Search tab not found');
        return;
    }

    const formData = new FormData();
    const inputs = searchTab.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id && input.value) {
            formData.append(input.id, input.value);
        }
    });

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
    
    // Log the search data for debugging
    console.log('Search data:', searchData);

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

async function handleFormSubmit(pushToDb = false) {
    const form = document.getElementById('mainForm');
    if (!form) {
        console.error('Form element not found');
        return;
    }

    try {
        // Get the active tab
        const activeTab = document.querySelector('.tab-pane.active');
        if (!activeTab) {
            console.error('No active tab found');
            return;
        }

        // Create FormData only from the active tab's fields
        const formData = new FormData();
        
        // Add fields from the active tab
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
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const text = await response.text();
        
        if (text.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusters = JSON.parse(text.substring('CLUSTER_SELECTION_REQUIRED:'.length));
            showClusterModal(clusters, formData, pushToDb);
            return;
        }

        displayResult(text);

    } catch (error) {
        console.error('Error:', error);
        displayResult(`Error: ${error.message}`);
    }
}

async function handleClusterSelection(selectedCluster, formData, pushToDb) {
    try {
        // Convert FormData to an object
        const formDataObj = {};
        for (let [key, value] of formData.entries()) {
            if (key !== 'push_to_db') { // Skip the push_to_db entry
                formDataObj[key] = [value]; // Backend expects array values
            }
        }

        const response = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                processedVars: formDataObj,
                selectedCluster: selectedCluster,
                pushToDb: pushToDb
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        displayResult(text);

    } catch (error) {
        console.error('Error:', error);
        displayResult(`Error: ${error.message}`);
    }
}

// Export functions for use in other files
window.handleFormSubmit = handleFormSubmit;
window.handleClusterSelection = handleClusterSelection;
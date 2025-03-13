let selectedCluster = null;
let lastCheckedTenantInfo = null;

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

        if (typeof data === 'string' && data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusterData = data.slice('CLUSTER_SELECTION_REQUIRED:'.length);
            const clusters = JSON.parse(clusterData);
            await handleClusterSelection(clusters, submitFormWithCluster, { formData: trimmedFormData, pushToDb });
        } else {
            displayResult(data);
            if (!pushToDb) enablePushToDbButton();
            selectedCluster = null;
        }
    } catch (error) {
        displayResult(`Error: ${error.message}`);
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
        displayResult(`Error: ${error.message}`);
    } finally {
        if (pushToDb) {
            disablePushToDbButton();
            selectedCluster = null;
        }
    }
}

function handleError(error) {
    displayResult(`An error occurred: ${error.message}`);
    disablePushToDbButton();
}

function clearAllFields() {
    const form = document.getElementById('mainForm');
    if (form) {
        form.querySelectorAll('input, textarea, select').forEach(input => {
            input.type === 'checkbox' || input.type === 'radio' ? input.checked = false : input.value = '';
        });
        displayResult('');
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

    resultDiv.textContent = text;
}

function initializeJsonParser() {
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

    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');

    importButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    confirmButton.addEventListener('click', () => {
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
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    const table = document.createElement('table');
    table.className = 'data-table';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = [
        'Active', 'Cluster', 'Segment', 'Environment', 'Realm', 'Tenant', 
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

    const tbody = document.createElement('tbody');
    if (results && results.length > 0) {
        results.forEach(result => {
            const row = document.createElement('tr');
            [
                result.active ? '✓' : '✗',  // Add active status with checkmark or X
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
                if (text === '✓') {
                    td.style.color = 'green';
                } else if (text === '✗') {
                    td.style.color = 'red';
                }
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
        resultDiv.textContent = 'No results found';
        return;
    }

    const table = createResultsTable(results);
    resultDiv.textContent = '';
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
        displayResult(`Error performing search: ${error.message}`);
    });
}

async function handleFormSubmit(pushToDb = false) {
    const form = document.getElementById('mainForm');
    const activeTab = document.querySelector('.tab-pane.active');
    if (!form || !activeTab) return;
    
    // Special handling for tenant-mod tab
    if (activeTab.id === 'tenant-mod') {
        if (!pushToDb) {
            // Check button pressed
            await handleTenantModCheck(new FormData(form));
        } else {
            // Submit to DB button pressed
            if (!lastCheckedTenantInfo) {
                displayResult('Ошибка: Сначала нужно проверить тенант');
                return;
            }
            await handleTenantModSubmit(lastCheckedTenantInfo);
        }
        return;
    }

    try {
        // Create new FormData only from the active tab's fields
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
            const errorText = await response.text();
            throw new Error(errorText);
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
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const text = await response.text();
        displayResult(text);

    } catch (error) {
        displayResult(`Error: ${error.message}`);
    }
}

async function handleTenantModCheck(formData) {
    try {
        const activeTab = document.querySelector('.tab-pane.active');
        const tenantInput = activeTab.querySelector('#tenant');
        const tenant = tenantInput ? tenantInput.value : '';

        if (!tenant) {
            displayResult('Ошибка: Имя тенанта не указано');
            return;
        }

        // Get tenant info
        const infoResponse = await fetch('/zayavki/tenant-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tenant: tenant })
        });

        const infoData = await infoResponse.text();
        if (!infoResponse.ok) {
            throw new Error(infoData);
        }

        // Parse the tenant info
        const tenantInfo = JSON.parse(infoData);
        tenantInfo.tenant = tenant;
        lastCheckedTenantInfo = tenantInfo;

        // Get cluster info
        const clusterResponse = await fetch('/zayavki/cluster-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segment: tenantInfo.net_seg,
                env: tenantInfo.env,
                cluster: tenantInfo.cls_name
            })
        });

        const clusterInfo = await clusterResponse.json();

        // Create complete clusters map
        const clustersMap = {
            "Кластер": tenantInfo.cls_name,
            "Реалм": tenantInfo.realm,
            "ЦОД": clusterInfo.ЦОД,
            "Выдача": clusterInfo.Выдача,
            "Среда": clusterInfo.Среда,
            "ЗБ": clusterInfo.ЗБ,
            "tls_endpoint": clusterInfo.tls_endpoint,
            "mtls_endpoint": clusterInfo.mtls_endpoint
        };

        // Create processedVars with all necessary tenant info
        const processedVars = {
            segment: [tenantInfo.net_seg],
            env: [tenantInfo.env],
            tenant_override: [tenant],
            ris_number: [tenantInfo.ris_id],
            ris_name: [tenantInfo.ris_code],
            resp_group: [tenantInfo.owner_group],
            owner: [tenantInfo.owner_person],
            cluster: [tenantInfo.cls_name],
            realm: [tenantInfo.realm]
        };

        // Add form fields to processedVars
        const sdInput = activeTab.querySelector('#request_id_sd');
        const srtInput = activeTab.querySelector('#request_id_srt');
        const usersInput = activeTab.querySelector('#users');
        const bucketsInput = activeTab.querySelector('#buckets');
        const emailInput = activeTab.querySelector('#email_for_credentials');

        if (sdInput?.value) processedVars.request_id_sd = [sdInput.value];
        if (srtInput?.value) processedVars.request_id_srt = [srtInput.value];
        if (usersInput?.value) processedVars.users = usersInput.value.split('\n').filter(Boolean);
        if (bucketsInput?.value) processedVars.buckets = [bucketsInput.value];
        if (emailInput?.value) processedVars.email = [emailInput.value];

        // Send to cluster endpoint
        const endpointResponse = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                processedVars,
                selectedCluster: clustersMap,
                pushToDb: false
            })
        });

        if (!endpointResponse.ok) {
            const errorText = await endpointResponse.text();
            throw new Error(errorText);
        }

        const submitResult = await endpointResponse.text();
        displayCombinedResult(tenantInfo, submitResult);

    } catch (error) {
        displayResult(`Ошибка: ${error.message}`);
        lastCheckedTenantInfo = null;
    }
}

// Helper function to display combined result
function displayCombinedResult(tenantInfo, submitResult) {
    const result = `Информация о тенанте ${tenantInfo.tenant}:
Кластер: ${tenantInfo.cls_name}
Сегмент: ${tenantInfo.net_seg}
Среда: ${tenantInfo.env}
Реалм: ${tenantInfo.realm}
РИС код: ${tenantInfo.ris_code}
РИС номер: ${tenantInfo.ris_id}
Группа владельцев: ${tenantInfo.owner_group}
Владелец: ${tenantInfo.owner_person}

Результат проверки:
${submitResult}`;

    displayResult(result);
}

async function handleTenantModSubmit(tenantInfo) {
    try {
        const activeTab = document.querySelector('.tab-pane.active');
        const tenantInput = activeTab.querySelector('#tenant');
        const tenant = tenantInput ? tenantInput.value : tenantInfo.tenant;
        
        // Get cluster info first
        const clusterResponse = await fetch('/zayavki/cluster-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segment: tenantInfo.net_seg,
                env: tenantInfo.env,
                cluster: tenantInfo.cls_name
            })
        });

        const clusterInfo = await clusterResponse.json();

        // Create complete clusters map with all info
        const clustersMap = {
            "Кластер": tenantInfo.cls_name,
            "Реалм": tenantInfo.realm,
            "ЦОД": clusterInfo.ЦОД,
            "Выдача": clusterInfo.Выдача,
            "Среда": clusterInfo.Среда,
            "ЗБ": clusterInfo.ЗБ,
            "tls_endpoint": clusterInfo.tls_endpoint,
            "mtls_endpoint": clusterInfo.mtls_endpoint
        };

        // Prepare submit data using tenant info
        const submitData = new FormData();
        submitData.append('segment', tenantInfo.net_seg);
        submitData.append('env', tenantInfo.env);
        submitData.append('tenant_override', tenant);
        submitData.append('ris_number', tenantInfo.ris_id);
        submitData.append('ris_name', tenantInfo.ris_code);
        submitData.append('resp_group', tenantInfo.owner_group);
        submitData.append('owner', tenantInfo.owner_person);
        submitData.append('cluster', tenantInfo.cls_name);
        submitData.append('realm', tenantInfo.realm);

        // Get form fields
        const sdInput = activeTab.querySelector('#request_id_sd');
        const srtInput = activeTab.querySelector('#request_id_srt');
        const usersInput = activeTab.querySelector('#users');
        const bucketsInput = activeTab.querySelector('#buckets');
        const emailInput = activeTab.querySelector('#email_for_credentials');

        if (sdInput) submitData.append('request_id_sd', sdInput.value);
        if (srtInput) submitData.append('request_id_srt', srtInput.value);
        if (usersInput) submitData.append('users', usersInput.value);
        if (bucketsInput) submitData.append('buckets', bucketsInput.value);
        if (emailInput) submitData.append('email_for_credentials', emailInput.value);

        // Add push_to_db parameter
        submitData.append('push_to_db', 'true');

        // Send to cluster endpoint
        const response = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                processedVars: Object.fromEntries([...submitData.entries()].map(([k,v]) => [k,[v]])),
                selectedCluster: clustersMap,
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
}

// Export functions for use in other files
window.handleFormSubmit = handleFormSubmit;
window.handleClusterSelection = handleClusterSelection;

function initializeUserBucketDel() {
    const checkButton = document.querySelector('#user-bucket-del .primary-button');
    if (checkButton) {
        // Add click handler
        checkButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Check button clicked');

            // Get the form data from the specific tab
            const tabPane = document.querySelector('#user-bucket-del');
            const tenantInput = tabPane.querySelector('#tenant');
            const usersInput = tabPane.querySelector('#users');
            const bucketsInput = tabPane.querySelector('#buckets');

            console.log('Form elements:', { tenantInput, usersInput, bucketsInput }); // Debug log

            const tenant = tenantInput ? tenantInput.value.trim() : '';
            const users = usersInput && usersInput.value ? 
                usersInput.value.trim().split('\n').filter(Boolean).map(u => u.trim()) : [];
            const buckets = bucketsInput && bucketsInput.value ? 
                bucketsInput.value.trim().split('\n').filter(Boolean).map(b => b.trim()) : [];

            console.log('Values:', { tenant, users, buckets }); // Debug log

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

                console.log('Response:', response);

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const data = await response.json();
                console.log('Data:', data);
                displayCheckResults(data);
            } catch (error) {
                console.error('Error:', error);
                displayResult(`Ошибка: ${error.message}`);
            }
        };

        // Prevent form submission
        const form = checkButton.closest('form');
        if (form) {
            form.onsubmit = (e) => {
                const activeTab = document.querySelector('.tab-pane.active');
                if (activeTab && activeTab.id === 'user-bucket-del') {
                    e.preventDefault();
                    return false;
                }
            };
        }
    }
}

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

    html += '</div>';
    document.getElementById('result').innerHTML = html;
}

// Make sure this initialization is being called
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...
    initializeUserBucketDel();
});
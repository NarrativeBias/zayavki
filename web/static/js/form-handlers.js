let selectedCluster = null;

function initializeFormSubmissionHandler() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(form);
        });
    } else {
        console.error('Form not found in the document');
    }

    // Add search button handler
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', handleCheckButton); // Reuse check functionality
    }

    // Add clear search button handler
    const clearSearchButton = document.getElementById('clearSearchButton');
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', () => {
            // Clear all search fields
            const searchForm = document.getElementById('searchForm');
            if (searchForm) {
                const inputs = searchForm.querySelectorAll('input, select');
                inputs.forEach(input => {
                    if (input.type === 'select-one') {
                        input.selectedIndex = 0;
                    } else {
                        input.value = '';
                    }
                });
            }
            // Clear result area
            displayResult('');
        });
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
    // Parse response as JSON instead of text
    return response.json();
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

        if (data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusters = JSON.parse(data.slice('CLUSTER_SELECTION_REQUIRED:'.length));
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
    const form = document.getElementById('zayavkiForm');
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

function handleCheckButton(e) {
    e.preventDefault();
    
    const form = document.getElementById('searchForm');
    if (!form) {
        console.error('Form not found');
        return;
    }

    const formData = new FormData(form);
    const checkData = {
        segment: formData.get('search_segment'),
        env: formData.get('search_env'),
        ris_number: formData.get('search_ris_number'),
        ris_name: formData.get('search_ris_name')?.toLowerCase(),
        tenant: formData.get('search_tenant'),
        bucket: formData.get('search_bucket'),
        user: formData.get('search_user')
    };

    // Remove empty parameters
    Object.keys(checkData).forEach(key => {
        if (!checkData[key]) {
            delete checkData[key];
        }
    });

    fetch('/zayavki/check', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkData)
    })
    .then(handleFetchResponse)
    .then(data => {
        if (data.clusters) {
            handleClusterSelection(data.clusters, performCheckWithCluster, checkData);
        } else {
            displayResult(data);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        displayResult(`Error: ${error.message}`);
    });
}

async function performCheckWithCluster(cluster, checkData) {
    try {
        const requestBody = { ...checkData, cluster: cluster.Кластер };
        const response = await fetch('/zayavki/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (response.ok) {
            const data = await response.json();
            displayResult(data, requestBody);
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        handleError(error);
    } finally {
        selectedCluster = null;
    }
}

function handlePushToDb() {
    disablePushToDbButton();
    const form = document.getElementById('zayavkiForm');
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

function initializeEmailValidation() {
    const ownerInput = document.getElementById('owner');
    const debounceTimeout = 500; // ms
    let timeoutId;
    let validationDiv;

    if (ownerInput) {
        validationDiv = document.createElement('div');
        validationDiv.classList.add('validation-message');
        ownerInput.parentNode.insertBefore(validationDiv, ownerInput.nextSibling);

        ownerInput.addEventListener('input', (e) => {
            clearTimeout(timeoutId);
            
            timeoutId = setTimeout(() => {
                const value = e.target.value.trim();
                if (!value) {
                    validationDiv.textContent = '';
                    return;
                }

                // First check for incorrect separators
                if (value.includes(',')) {
                    validationDiv.textContent = 'Используйте точку с запятой (;) для разделения email адресов';
                    validationDiv.classList.add('error');
                    return;
                }

                const emails = value.split(';').map(email => email.trim()).filter(Boolean);
                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                const invalidEmails = emails.filter(email => !emailPattern.test(email));

                if (invalidEmails.length > 0) {
                    validationDiv.textContent = `Некорректный формат email: ${invalidEmails.join(', ')}. Используйте формат: email@vtb.ru`;
                    validationDiv.classList.add('error');
                } else {
                    validationDiv.textContent = '';
                    validationDiv.classList.remove('error');
                }
            }, debounceTimeout);
        });
    }
}

function showValidationMessage(container, message, type) {
    container.textContent = message;
    container.className = 'validation-message ' + type;
}

function displayResult(data) {
    const resultElement = document.getElementById('result');
    
    if (typeof data === 'string') {
        resultElement.textContent = data;
        return;
    }

    // Create table for results
    const table = document.createElement('table');
    table.className = 'data-table';

    // Create table header with only needed fields
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = [
        'Cluster', 'Tenant', 'User', 'Bucket', 'Quota', 'SD', 'SRT', 'Date',
        'Owner', 'Group', 'Owner', 'Applicant'
    ];

    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    if (data.results && data.results.length > 0) {
        data.results.forEach(item => {
            const row = document.createElement('tr');
            [
                item.cluster || '-',
                item.tenant || '-',
                item.user || '-',
                item.bucket || '-',
                item.quota || '-',
                item.sd_num || '-',
                item.srt_num || '-',
                item.done_date || '-',
                item.owner || '-',
                item.owner_group || '-',
                item.owner || '-',
                item.applicant || '-'
            ].forEach(cellText => {
                const td = document.createElement('td');
                td.textContent = cellText;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
    } else {
        // If no results, show a message
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = headers.length;
        emptyCell.textContent = 'Нет данных';
        emptyCell.className = 'empty-message';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    }

    table.appendChild(tbody);

    // Clear previous results and add new table
    resultElement.innerHTML = '';
    resultElement.appendChild(table);
}

function initializeJsonParser() {
    const parseButton = document.getElementById('parseJsonButton');
    if (!parseButton) {
        console.error('Parse JSON button not found');
        return;
    }

    parseButton.addEventListener('click', function() {
        const jsonInput = document.getElementById('json_input');
        if (!jsonInput) {
            console.error('JSON input field not found');
            return;
        }

        const jsonText = jsonInput.value.trim();
        if (!jsonText) {
            displayResult('Пожалуйста, введите JSON для парсинга');
            return;
        }

        try {
            const data = JSON.parse(jsonText);
            
            // Extract values from customFieldsValues
            const customFields = {};
            if (data.customFieldsValues && Array.isArray(data.customFieldsValues)) {
                data.customFieldsValues.forEach(field => {
                    customFields[field.code] = field.value;
                });
            }

            // Map the fields to form inputs
            const formMappings = {
                'request_id_srt': data.number,
                'request_id_sd': customFields.appealNumber,
                'requester': customFields.applicant
            };

            // Fill form fields
            for (const [formField, value] of Object.entries(formMappings)) {
                const input = document.getElementById(formField);
                if (input && value) {
                    input.value = value;
                    if (input.tagName === 'SELECT') {
                        input.dispatchEvent(new Event('change'));
                    }
                }
            }

            // Prepare result summary
            const resultSummary = {
                "Номер задания": data.number || 'Не указан',
                "Название задания": data.name || 'Не указано',
                "Описание": data.description || 'Не указано',
                "Номер обращения": customFields.appealNumber || 'Не указан',
                "Заявитель": customFields.applicant || 'Не указан'
            };

            // Format the result summary as a string
            let formattedResult = "=== Данные из JSON ===\n\n";
            for (const [key, value] of Object.entries(resultSummary)) {
                formattedResult += `${key}: ${value}\n`;
            }

            // Display the formatted result
            displayResult(formattedResult);

        } catch (error) {
            console.error('Error parsing JSON:', error);
            displayResult(`Ошибка парсинга JSON: ${error.message}`);
        }
    });
}

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
    initializeJsonParser();
}
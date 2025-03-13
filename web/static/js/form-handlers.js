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
    disableButton('pushDbButton');
    const form = document.getElementById('mainForm');
    selectedCluster
        ? submitFormWithCluster(selectedCluster, { formData: new FormData(form), pushToDb: true })
        : submitForm(form, true);
}

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
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

async function handleTenantModSubmit(e) {
    console.log('handleTenantModSubmit called:', {
        event: e,
        submitter: e.submitter,
        defaultPrevented: e.defaultPrevented
    });

    e.preventDefault();
    const clickedButton = e.submitter;
    console.log('Clicked button:', {
        button: clickedButton,
        id: clickedButton?.id,
        classList: clickedButton?.classList?.toString()
    });

    if (!clickedButton) return;

    const tabPane = document.querySelector('#tenant-mod');
    const tenantInput = tabPane.querySelector('#tenant');
    const tenant = tenantInput ? tenantInput.value.trim() : '';

    console.log('Form data:', {
        tabPane,
        tenantInput,
        tenant
    });

    if (!tenant) {
        displayResult('Ошибка: Необходимо указать имя тенанта');
        return;
    }

    // If check button was clicked
    if (clickedButton.id === 'check-tenant') {
        console.log('Check button clicked, sending request');
        try {
            const response = await fetch('/zayavki/tenant-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tenant })
            });

            console.log('Got response:', {
                ok: response.ok,
                status: response.status
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const data = await response.json();
            console.log('Response data:', data);
            displayTenantInfo(data);
            return;
        } catch (error) {
            console.error('Error in tenant check:', error);
            displayResult(`Ошибка: ${error.message}`);
            return;
        }
    }
}

// Export functions for use in other files
window.handleFormSubmit = handleFormSubmit;
window.handleClusterSelection = handleClusterSelection;
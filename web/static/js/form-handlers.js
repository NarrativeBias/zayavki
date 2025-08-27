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
    console.log('handleClusterSelection called with clusters:', clusters);
    console.log('handleClusterSelection data:', data);
    console.log('handleClusterSelection operation:', operation.name);
    if (clusters.length === 1) {
        selectedCluster = clusters[0];
        return operation(selectedCluster, data);
    } else if (clusters.length > 1) {
        console.log('Multiple clusters found, showing modal');
        return new Promise((resolve, reject) => {
            // Listen for custom event
            document.addEventListener('clusterSelected', function clusterHandler(e) {
                console.log('Cluster selected event received:', e.detail);
                document.removeEventListener('clusterSelected', clusterHandler);
                selectedCluster = e.detail;
                resolve(operation(selectedCluster, data));
            });

            showClusterModal(clusters);
        });
    } else {
        displayResult('No matching clusters found');
        selectedCluster = null;
        return Promise.reject('No matching clusters found');
    }
}

async function submitForm(form, pushToDb = false) {
    try {
        // Check for validation errors before submission
        if (hasValidationErrorsInCurrentTab()) {
            displayResult('Ошибка: Исправьте ошибки валидации перед отправкой формы');
            return;
        }
        
        let formData;
        if (form instanceof FormData) {
            formData = form;
        } else if (form instanceof HTMLFormElement) {
            const activeTab = document.querySelector('.tab-pane.active');
            if (!activeTab) {
                throw new Error('No active tab found');
            }
            formData = new FormData();
            activeTab.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.id && input.value.trim()) {
                    formData.append(input.id, input.value.trim());
                }
            });
        } else {
            console.error('Invalid form type:', form);
            throw new Error('Invalid form data provided');
        }
        
        formData.append('push_to_db', pushToDb.toString());
        
        // Add create_tenant flag for new-tenant tab
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'new-tenant') {
            formData.append('create_tenant', 'true');
        }

        const response = await fetch('/zayavki/submit', {
            method: 'POST',
            body: formData
        });
        
        const responseText = await response.text();
        
        if (responseText.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusterData = responseText.slice('CLUSTER_SELECTION_REQUIRED:'.length);
            const clusters = JSON.parse(clusterData);
            
            const formDataObj = Object.fromEntries(formData.entries());
            
            return new Promise((resolve, reject) => {
                document.addEventListener('clusterSelected', async function handler(e) {
                    document.removeEventListener('clusterSelected', handler);
                    try {
                        const result = await submitFormWithCluster(e.detail, { formData: formDataObj, pushToDb });
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
                
                showClusterModal(clusters);
            });
        } else {
            displayResult(responseText);
            if (!pushToDb) enablePushToDbButton();
        }

    } catch (error) {
        console.error('Error in submitForm:', error);
        displayResult(`Error: ${error.message}`);
    }
}

async function submitFormWithCluster(cluster, { formData, pushToDb }) {
    try {
        // Check for validation errors before proceeding
        if (hasValidationErrorsInCurrentTab()) {
            displayResult('Ошибка: Исправьте ошибки валидации перед отправкой формы');
            return;
        }
        
        const processedVars = {};
        for (let [key, value] of Object.entries(formData)) {
            if (value && !['push_to_db'].includes(key)) {  // Remove 'create_tenant' from excluded keys
                processedVars[key] = [value];
            }
        }

        // Add create_tenant flag for new-tenant tab
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'new-tenant') {
            processedVars['create_tenant'] = ['true'];
        }

        if (processedVars.env) {
            processedVars.env_code = [getEnvCode(processedVars.env[0])];
        }

        const requestBody = {
            processedVars,
            selectedCluster: cluster,
            pushToDb
        };

        const response = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await handleFetchResponse(response);
        displayResult(data);
        if (!pushToDb) enablePushToDbButton();
    } catch (error) {
        console.error('Error in submitFormWithCluster:', error);
        displayResult(`Error: ${error.message}`);
    }
}

function handleError(error) {
    displayResult(`An error occurred: ${error.message}`);
    disablePushToDbButton();
}

function disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
    }
}

function enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = false;
    }
}

function disablePushToDbButton() {
    disableButton('pushDbButton');
}

function enablePushToDbButton() {
    enableButton('pushDbButton');
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
    // Check for validation errors before proceeding
    if (hasValidationErrorsInCurrentTab()) {
        displayResult('Ошибка: Исправьте ошибки валидации перед отправкой в БД');
        return;
    }
    
    disableButton('pushDbButton');
    const form = document.getElementById('mainForm');
    selectedCluster
        ? submitFormWithCluster(selectedCluster, { formData: new FormData(form), pushToDb: true })
        : submitForm(form, true);
}

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
}

async function handleSearch() {
    try {
        // Check for validation errors before proceeding
        if (hasValidationErrorsInCurrentTab()) {
            displayResult('Ошибка: Исправьте ошибки валидации перед поиском');
            return;
        }
    
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
    } catch (error) {
        displayResult(`Error in handleSearch: ${error.message}`);
    }
}

async function handleClusterSelection(selectedCluster, formData, pushToDb) {
    try {
        // Check for validation errors before proceeding
        if (hasValidationErrorsInCurrentTab()) {
            displayResult('Ошибка: Исправьте ошибки валидации перед отправкой формы');
            return;
        }
        
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

async function handleTenantModCheck() {
    // Check for validation errors before proceeding
    if (hasValidationErrorsInCurrentTab()) {
        displayResult('Ошибка: Исправьте ошибки валидации перед проверкой тенанта');
        return;
    }
    
    const tabPane = document.querySelector('#tenant-mod');
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
        const response = await fetchJson('/zayavki/check-tenant-resources', {
            tenant,
            users,
            buckets,
            mode: "create"  // Specify create mode
        });
        
        const data = await response.json();
        // Store tenant info for later use
        lastCheckedTenantInfo = {
            tenant: tenant,
            cls_name: data.tenant.cluster,
            net_seg: data.tenant.segment,
            env: data.tenant.env,
            realm: data.tenant.realm,
            ris_code: data.tenant.ris_code,
            ris_id: data.tenant.ris_id,
            owner_group: data.tenant.owner_group,
            owner_person: data.tenant.owner
        };
        displayCheckResults(data);
        enablePushToDbButton(); // Enable the "Send to DB" button after successful check
    } catch (error) {
        displayResult(`Ошибка: ${error.message}`);
        lastCheckedTenantInfo = null;
        disablePushToDbButton(); // Disable the "Send to DB" button on error
    }
}

function initializeForm() {
    let form = document.getElementById('mainForm');
    if (form) {
        // Remove default form action and prevent default submission
        form.action = 'javascript:void(0);';
        form.method = 'post';
        
        // Main form submission handler
        form.addEventListener('submit', (e) => {
            e.preventDefault();
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
        initializeBucketMod();
    }

    // Initialize with the first tab (search)
    switchTab('search');
}

function initializeUserBucketDel() {
    const checkButton = document.querySelector('#user-bucket-del #check-tenant');
    const submitButton = document.querySelector('#user-bucket-del #submit-form');

    if (checkButton) {
        checkButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Check for validation errors before proceeding
            if (hasValidationErrorsInCurrentTab()) {
                displayResult('Ошибка: Исправьте ошибки валидации перед проверкой тенанта');
                return;
            }
            
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
    }

    if (submitButton) {
        submitButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Check for validation errors before proceeding
            if (hasValidationErrorsInCurrentTab()) {
                displayResult('Ошибка: Исправьте ошибки валидации перед отправкой');
                return;
            }

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
    }
}

function initializeTenantMod() {
    const tabPane = document.querySelector('#tenant-mod');
    if (!tabPane) return;

    const checkButton = tabPane.querySelector('#check-tenant');
    const submitButton = tabPane.querySelector('#submit-form');

    // Handle check button
    if (checkButton) {
        checkButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleTenantModCheck();
        };
    }

    // Handle submit button
            if (submitButton) {
            submitButton.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Check for validation errors before proceeding
                if (hasValidationErrors()) {
                    displayResult('Ошибка: Исправьте ошибки валидации перед отправкой');
                    return;
                }

                if (!lastCheckedTenantInfo) {
                    displayResult('Ошибка: Сначала необходимо проверить тенант');
                    return;
                }

            // First get cluster info to get endpoints
            const clusterResponse = await fetch('/zayavki/cluster-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    segment: lastCheckedTenantInfo.net_seg,
                    env: lastCheckedTenantInfo.env,
                    cluster: lastCheckedTenantInfo.cls_name
                })
            });

            const clusterInfo = await clusterResponse.json();

            // Get form data
            const tabPane = document.querySelector('#tenant-mod');
            const sdInput = tabPane.querySelector('#request_id_sd');
            const srtInput = tabPane.querySelector('#request_id_srt');
            const usersInput = tabPane.querySelector('#users');
            const bucketsInput = tabPane.querySelector('#buckets');
            const emailInput = tabPane.querySelector('#email_for_credentials');

            // Create form data
            const submitData = new FormData();
            submitData.append('segment', lastCheckedTenantInfo.net_seg);
            submitData.append('env', lastCheckedTenantInfo.env);
            submitData.append('tenant_override', lastCheckedTenantInfo.tenant);
            submitData.append('ris_number', lastCheckedTenantInfo.ris_id);
            submitData.append('ris_name', lastCheckedTenantInfo.ris_code);
            submitData.append('resp_group', lastCheckedTenantInfo.owner_group);
            submitData.append('owner', lastCheckedTenantInfo.owner_person);
            submitData.append('cluster', lastCheckedTenantInfo.cls_name);
            submitData.append('realm', lastCheckedTenantInfo.realm);

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
                            "Кластер": lastCheckedTenantInfo.cls_name,
                            "Реалм": lastCheckedTenantInfo.realm,
                            "ЦОД": clusterInfo.ЦОД,
                            "Выдача": clusterInfo.Выдача,
                            "Среда": clusterInfo.Среда,
                            "ЗБ": clusterInfo.ЗБ,
                            "tls_endpoint": clusterInfo.tls_endpoint,
                            "mtls_endpoint": clusterInfo.mtls_endpoint
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

function initializeBucketMod() {
    const tabPane = document.querySelector('#bucket-mod');
    if (!tabPane) {
        console.error('Could not find bucket modification tab');
        return;
    }

    const checkButton = tabPane.querySelector('#check-tenant');
    const submitButton = tabPane.querySelector('#submit-form');

    // Handle check button
        if (checkButton) {
            checkButton.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Check for validation errors before proceeding
                if (hasValidationErrorsInCurrentTab()) {
                    displayResult('Ошибка: Исправьте ошибки валидации перед проверкой тенанта');
                    return;
                }

                const tenantInput = tabPane.querySelector('#tenant');
                const bucketsInput = tabPane.querySelector('#buckets');
            
            const tenant = tenantInput ? tenantInput.value.trim() : '';
            const buckets = bucketsInput && bucketsInput.value ? 
                bucketsInput.value.trim().split('\n').filter(Boolean).map(b => b.trim()) : [];

            if (!tenant) {
                displayResult('Ошибка: Необходимо указать имя тенанта');
                return;
            }

            try {
                const response = await fetchJson('/zayavki/check-tenant-resources', {
                    tenant,
                    buckets,
                    mode: "quota"
                });
                
                const data = await response.json();
                lastCheckedTenantInfo = {
                    tenant: tenant,
                    cls_name: data.tenant.cluster,
                    net_seg: data.tenant.segment,
                    env: data.tenant.env,
                    realm: data.tenant.realm,
                    ris_code: data.tenant.ris_code,
                    ris_id: data.tenant.ris_id,
                    owner_group: data.tenant.owner_group,
                    owner_person: data.tenant.owner
                };
                displayCheckResults(data);
                enablePushToDbButton();
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
                lastCheckedTenantInfo = null;
                disablePushToDbButton();
            }
        };
    }

    // Handle submit button
    if (submitButton) {
        submitButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Check for validation errors before proceeding
            if (hasValidationErrorsInCurrentTab()) {
                displayResult('Ошибка: Исправьте ошибки валидации перед отправкой');
                return;
            }

            if (!lastCheckedTenantInfo) {
                displayResult('Ошибка: Сначала необходимо проверить тенант');
                return;
            }

            const bucketsInput = tabPane.querySelector('#buckets');
            const bucketsText = bucketsInput ? bucketsInput.value.trim() : '';

            if (!bucketsText) {
                displayResult('Ошибка: Необходимо указать бакеты');
                return;
            }

            try {
                const bucketUpdates = bucketsText.split('\n')
                    .filter(Boolean)
                    .map(line => {
                        const [name, size] = line.split('|').map(s => s.trim());
                        return { name, size };
                    });

                const response = await fetchJson('/zayavki/update-bucket-quotas', {
                    tenant: lastCheckedTenantInfo.tenant,
                    buckets: bucketUpdates
                });

                const result = await response.json();
                displayBucketModUpdateResults(result);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }
}



// Export functions for use in other files
window.handleClusterSelection = handleClusterSelection;
window.initializeForm = initializeForm;
window.initializeUserBucketDel = initializeUserBucketDel;
window.initializeTenantMod = initializeTenantMod;
window.clearAllFields = clearAllFields;
window.disablePushToDbButton = disablePushToDbButton;
window.enablePushToDbButton = enablePushToDbButton;
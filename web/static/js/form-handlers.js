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
        formData.append('create_tenant', 'true');

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
        console.log('submitFormWithCluster called with:', { cluster, formData, pushToDb });
        const processedVars = {};
        console.log('Processing form data object...');
        for (let [key, value] of Object.entries(formData)) {
            console.log('Processing field:', { key, value });
            if (value && !['push_to_db', 'create_tenant'].includes(key)) {
                processedVars[key] = [value];
            }
        }

        if (processedVars.env) {
            processedVars.env_code = [getEnvCode(processedVars.env[0])];
        }

        console.log('Processed vars:', processedVars);
        const requestBody = {
            processedVars,
            selectedCluster: cluster,
            pushToDb
        };

        console.log('Submitting to cluster with data:', requestBody);

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
    const checkButton = document.querySelector('#tenant-mod #check-tenant');
    const submitButton = document.querySelector('#tenant-mod #submit-form');
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

                tenantData = await response.json();
                displayTenantInfo(tenantData);
            } catch (error) {
                displayResult(`Ошибка: ${error.message}`);
            }
        };
    }

    // Handle submit button
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

// Export functions for use in other files
window.handleFormSubmit = handleFormSubmit;
window.handleClusterSelection = handleClusterSelection;
window.initializeForm = initializeForm;
window.initializeUserBucketDel = initializeUserBucketDel;
window.initializeTenantMod = initializeTenantMod;
window.clearAllFields = clearAllFields;
window.disablePushToDbButton = disablePushToDbButton;
window.enablePushToDbButton = enablePushToDbButton;
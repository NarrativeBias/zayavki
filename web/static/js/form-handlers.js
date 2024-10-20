let selectedCluster = null;

function initializeFormSubmissionHandler() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm(this);
        });
    } else {
        console.error('Form not found in the document');
    }
}

function trimFormData(formOrData) {
    let formData;
    if (formOrData instanceof HTMLFormElement) {
        formData = new FormData(formOrData);
    } else if (formOrData instanceof FormData) {
        formData = formOrData;
    } else {
        return new FormData();
    }

    const trimmedData = new FormData();

    for (let [key, value] of formData.entries()) {
        if (typeof value === 'string') {
            value = value.trim();
            
            if (value.includes('\n')) {
                value = value.split('\n')
                             .map(line => line.trim())
                             .filter(line => line.length > 0)
                             .join('\n');
            }
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
    return response.text();
}

function processFormData(formData) {
    const processedVars = {};
    for (let [key, value] of formData.entries()) {
        if (!processedVars[key]) {
            processedVars[key] = [];
        }
        processedVars[key].push(value);
    }

    if (!processedVars.hasOwnProperty('env_code')) {
        const envSelect = document.getElementById('env');
        if (envSelect) {
            processedVars['env_code'] = [getEnvCode(envSelect.value)];
        }
    }

    return processedVars;
}

async function handleClusterSelection(clusters, operation, data) {
    if (clusters.length === 1) {
        // If there's only one cluster, use it directly
        selectedCluster = clusters[0];
        return operation(selectedCluster, data);
    } else if (clusters.length > 1) {
        // If there are multiple clusters, show the selection modal
        return new Promise((resolve) => {
            showClusterSelectionModal(clusters, (chosenCluster) => {
                selectedCluster = chosenCluster;
                resolve(operation(selectedCluster, data));
            });
        });
    } else {
        // If no clusters are found, display an error
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
            if (!pushToDb) {
                enablePushToDbButton();
            }
            selectedCluster = null; // Reset selectedCluster if no cluster selection was required
        }
    } catch (error) {
        handleSubmitError(error);
        selectedCluster = null; // Reset selectedCluster on error
    }
}

async function submitFormWithCluster(cluster, { formData, pushToDb }) {
    try {
        const processedVars = processFormData(formData);

        const requestBody = {
            processedVars,
            selectedCluster: cluster,
            pushToDb,
        };

        const response = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const data = await handleFetchResponse(response);

        displayResult(data);
        if (!pushToDb) {
            enablePushToDbButton();
        }
    } catch (error) {
        handleSubmitError(error);
    } finally {
        if (pushToDb) {
            disablePushToDbButton();
            selectedCluster = null; // Reset selectedCluster after push to DB
        }
    }
}

function handleSubmitError(error) {
    console.error('Error:', error);
    document.getElementById('result').textContent = `An error occurred: ${error.message}`;
    disablePushToDbButton();
}

function clearAllFields() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
        
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.textContent = '';
        }
        
        selectedCluster = null;
        disablePushToDbButton();
    } else {
        console.error('Form not found when trying to clear fields');
    }
}

async function handleCheckButton() {
    const form = document.getElementById('zayavkiForm');
    const formData = new FormData(form);
    const checkData = {
        segment: formData.get('segment'),
        env: formData.get('env'),
        ris_number: formData.get('ris_number'),
        ris_name: formData.get('ris_name')
    };

    try {
        const response = await fetch('/zayavki/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkData),
        });

        if (response.ok) {
            const data = await response.json();
            await handleClusterSelection(data.clusters, handleCheckWithCluster, checkData);
        } else {
            throw new Error('Network response was not ok');
        }
    } catch (error) {
        console.error('Error:', error);
        displayResult(`An error occurred: ${error.message}`);
        selectedCluster = null; // Reset selectedCluster on error
    }
}

async function handleCheckWithCluster(cluster, checkData) {
    try {
        const requestBody = {
            ...checkData,
            cluster: cluster
        };

        const response = await fetch('/zayavki/check-with-cluster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (response.ok) {
            const data = await response.text();
            displayResult(data);
        } else {
            throw new Error('Network response was not ok');
        }
    } catch (error) {
        console.error('Error:', error);
        displayResult(`An error occurred: ${error.message}`);
    } finally {
        selectedCluster = null; // Reset selectedCluster after check operation
    }
}

function handlePushToDb() {
    disablePushToDbButton();
    const form = document.getElementById('zayavkiForm');
    if (selectedCluster) {
        submitFormWithCluster(selectedCluster, { formData: new FormData(form), pushToDb: true });
    } else {
        submitForm(form, true);
    }
}

function enablePushToDbButton() {
    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.disabled = false;
    }
}

function disablePushToDbButton() {
    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.disabled = true;
    }
}
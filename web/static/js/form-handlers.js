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

async function submitForm(form, pushToDb = false) {
    try {
        const trimmedFormData = trimFormData(form);
        trimmedFormData.append('push_to_db', pushToDb.toString());

        const data = await fetch('/zayavki/submit', { method: 'POST', body: trimmedFormData })
            .then(handleFetchResponse);

        if (data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusters = JSON.parse(data.slice('CLUSTER_SELECTION_REQUIRED:'.length));
            showClusterSelectionModal(clusters, pushToDb);
        } else {
            displayResult(data);
            if (!pushToDb) {
                enablePushToDbButton();
            }
        }
    } catch (error) {
        handleSubmitError(error);
    }
}

async function submitWithSelectedCluster(cluster, pushToDb) {
    try {
        selectedCluster = cluster;
        const form = document.getElementById('zayavkiForm');
        const trimmedFormData = trimFormData(form);
        const processedVars = processFormData(trimmedFormData);

        const requestBody = {
            processedVars,
            selectedCluster: cluster,
            pushToDb,
        };

        const data = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }).then(handleFetchResponse);

        displayResult(data);
        if (!pushToDb) {
            enablePushToDbButton();
        }
    } catch (error) {
        handleSubmitError(error);
    } finally {
        if (pushToDb) {
            disablePushToDbButton();
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

function handlePushToDb() {
    disablePushToDbButton();
    if (selectedCluster) {
        submitWithSelectedCluster(selectedCluster, true);
    } else {
        submitForm(document.getElementById('zayavkiForm'), true);
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
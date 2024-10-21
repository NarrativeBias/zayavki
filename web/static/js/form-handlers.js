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
    return response.text();
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

async function handleCheckButton() {
    const form = document.getElementById('zayavkiForm');
    const trimmedFormData = trimFormData(form);
    
    const checkData = {
        segment: trimmedFormData.get('segment'),
        env: trimmedFormData.get('env'),
        ris_number: trimmedFormData.get('ris_number'),
        ris_name: trimmedFormData.get('ris_name')
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
            if (data.clusters) {
                await handleClusterSelection(data.clusters, performCheckWithCluster, checkData);
            } else {
                displayResult(data, checkData);
            }
        } else {
            const errorText = await response.text();
            displayResult(`An error occurred: ${errorText}`);
        }
    } catch (error) {
        console.error('Error:', error);
        displayResult(`An error occurred: ${error.message}`);
    }
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

function displayResult(data, checkData = {}) {
    const resultElement = document.getElementById('result');
    let resultText;

    if (typeof data === 'string') {
        resultText = data;
    } else if (data && data.results === null) {
        const { ris_number, env, segment } = checkData;
        const risInfo = ris_number ? `RIS ${ris_number}` : 'specified RIS';
        const envInfo = env ? `in environment ${env}` : '';
        const segmentInfo = segment ? `for segment ${segment}` : '';
        resultText = `No results found for ${risInfo} ${envInfo} ${segmentInfo}.`;
    } else if (data && Array.isArray(data.results)) {
        resultText = data.results.length ? data.results.join('\n') : "No results found.";
    } else {
        resultText = JSON.stringify(data, null, 2);
    }

    resultElement.textContent = resultText;
    resultElement.style.whiteSpace = 'pre-wrap';
}
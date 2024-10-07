document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm(this);
        });
    }
});

function submitForm(form) {
    const formData = new FormData(form);
    sendRequest('/zayavki/submit', formData)
        .then(handleResponse)
        .catch(handleError);
}

function submitWithSelectedCluster(selectedCluster) {
    const form = document.getElementById('zayavkiForm');
    const formData = new FormData(form);
    const pushToDb = document.getElementById('pushDbButton').checked;

    const processedVars = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [key, [value]])
    );

    if (!processedVars.hasOwnProperty('env_code')) {
        const envSelect = document.getElementById('env');
        if (envSelect) {
            processedVars['env_code'] = [getEnvCode(envSelect.value)];
        }
    }

    const requestBody = {
        processedVars,
        selectedCluster,
        pushToDb,
    };

    sendRequest('/zayavki/cluster', JSON.stringify(requestBody), 'POST', {
        'Content-Type': 'application/json',
    })
        .then(handleResponse)
        .catch(handleError);
}

function sendRequest(url, body, method = 'POST', headers = {}) {
    return fetch(url, { method, body, headers })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                });
            }
            return response.text();
        });
}

function handleResponse(data) {
    if (data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
        const clusters = JSON.parse(data.slice('CLUSTER_SELECTION_REQUIRED:'.length));
        showClusterSelectionModal(clusters);
    } else {
        displayResult(data);
    }
}

function handleError(error) {
    document.getElementById('result').textContent = 'An error occurred while processing your request. Please try again.';
    document.getElementById('saveButton').disabled = true;
    document.getElementById('pushDbButton').disabled = true;
}

function showClusterSelectionModal(clusters) {
    const modal = document.getElementById('clusterModal');
    const select = document.getElementById('cluster-select');
    const details = document.getElementById('cluster-details');

    if (!modal || !select || !details) {
        return;
    }

    select.innerHTML = clusters.map((cluster, index) => `
        <option value="${index}" data-cluster='${JSON.stringify(cluster)}'>
            ${cluster.ЦОД} - ${cluster.Среда} - ${cluster.ЗБ}
        </option>
    `).join('');

    updateClusterDetails(clusters[0]);

    select.addEventListener('change', () => {
        const selectedCluster = JSON.parse(select.options[select.selectedIndex].dataset.cluster);
        updateClusterDetails(selectedCluster);
    });

    modal.style.display = 'block';
}

function updateClusterDetails(cluster) {
    const details = document.getElementById('cluster-details');
    if (!details) return;
    
    details.innerHTML = Object.entries(cluster)
        .map(([key, value]) => `<dt>${key}:</dt><dd>${value}</dd>`)
        .join('');
}

document.getElementById('confirm-cluster').addEventListener('click', function() {
    const select = document.getElementById('cluster-select');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.cluster) {
        const selectedCluster = JSON.parse(selectedOption.dataset.cluster);
        document.getElementById('clusterModal').style.display = 'none';
        submitWithSelectedCluster(selectedCluster);
    }
});

function getEnvCode(env) {
    const envCodes = {
        'PROD': 'p0',
        'PREPROD': 'rr',
        'IFT': 'if',
        'HOTFIX': 'hf'
    };
    return envCodes[env] || '';
}

function displayResult(data) {
    document.getElementById('result').textContent = data;
    document.getElementById('saveButton').disabled = false;
    document.getElementById('pushDbButton').disabled = false;
}
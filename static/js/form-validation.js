document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm(this);
        });
    } else {
        console.error('Form not found in the document');
    }

    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.addEventListener('click', function() {
            this.disabled = true;
            document.getElementById('result').textContent = 'Pushing data to DB...';
            submitForm(document.getElementById('zayavkiForm'), true);
        });
    } else {
        console.error('Push DB button not found in the document');
    }
});

function submitForm(form, pushToDb = false) {
    const formData = new FormData(form);
    formData.append('push_to_db', pushToDb.toString());

    fetch('/zayavki/submit', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        if (data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clustersJson = data.slice('CLUSTER_SELECTION_REQUIRED:'.length);
            const clusters = JSON.parse(clustersJson);
            showClusterSelectionModal(clusters, pushToDb);
        } else {
            displayResult(data);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').textContent = 'An error occurred while submitting the form. Please try again.';
        document.getElementById('saveButton').disabled = true;
        document.getElementById('pushDbButton').disabled = false;
    });
}

function showClusterSelectionModal(clusters, pushToDb) {
    console.log('showClusterSelectionModal called with clusters:', clusters);
    const modal = document.getElementById('clusterModal');
    const select = document.getElementById('cluster-select');
    const details = document.getElementById('cluster-details');

    if (!modal || !select || !details) {
        console.error('Required elements not found');
        return;
    }

    // Clear previous options
    select.innerHTML = '';
    
    // Add new options
    clusters.forEach((cluster, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${cluster.ЦОД} - ${cluster.Среда} - ${cluster.ЗБ}`;
        option.dataset.cluster = JSON.stringify(cluster);
        select.appendChild(option);
    });

    // Show initial cluster details
    updateClusterDetails(clusters[0]);

    // Update details when selection changes
    select.addEventListener('change', () => {
        const selectedCluster = JSON.parse(select.options[select.selectedIndex].dataset.cluster);
        updateClusterDetails(selectedCluster);
    });

    // Show the modal
    modal.style.display = 'block';

    // Update confirm button click handler
    document.getElementById('confirm-cluster').onclick = function() {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.dataset.cluster) {
            const selectedCluster = JSON.parse(selectedOption.dataset.cluster);
            modal.style.display = 'none';
            submitWithSelectedCluster(selectedCluster, pushToDb);
        } else {
            console.error('No cluster selected or cluster data missing');
        }
    };
}

function submitWithSelectedCluster(selectedCluster, pushToDb) {
    const form = document.getElementById('zayavkiForm');
    const formData = new FormData(form);

    const processedVars = {};
    for (let [key, value] of formData.entries()) {
        processedVars[key] = [value]; // Wrap each value in an array
    }

    // Manually add env_code if it's not already present
    if (!processedVars.hasOwnProperty('env_code')) {
        const envSelect = document.getElementById('env');
        if (envSelect) {
            const envCode = getEnvCode(envSelect.value);
            processedVars['env_code'] = [envCode];
        }
    }

    const requestBody = {
        processedVars: processedVars,
        selectedCluster: selectedCluster,
        pushToDb: pushToDb,
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    fetch('/zayavki/cluster', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        return response.text();
    })
    .then(data => {
        displayResult(data);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').textContent = 'An error occurred while processing your request. Please try again.';
    })
    .finally(() => {
        document.getElementById('pushDbButton').disabled = false;
    });
}

function displayResult(data) {
    document.getElementById('result').textContent = data;
    document.getElementById('saveButton').disabled = false;
    document.getElementById('pushDbButton').disabled = false;
}

function updateClusterDetails(cluster) {
    console.log('Updating cluster details:', cluster);
    const details = document.getElementById('cluster-details');
    if (!details) {
        console.error('Cluster details element not found');
        return;
    }
    details.innerHTML = `
        <dt>ЦОД:</dt><dd>${cluster.ЦОД}</dd>
        <dt>Среда:</dt><dd>${cluster.Среда}</dd>
        <dt>ЗБ:</dt><dd>${cluster.ЗБ}</dd>
        <dt>Кластер:</dt><dd>${cluster.Кластер}</dd>
        <dt>Реалм:</dt><dd>${cluster.Реалм}</dd>
    `;
}

function getEnvCode(env) {
    switch (env) {
        case 'PROD': return 'p0';
        case 'PREPROD': return 'rr';
        case 'IFT': return 'if';
        case 'HOTFIX': return 'hf';
        default: return '';
    }
}
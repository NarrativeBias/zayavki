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
});

function submitForm(form) {
    const formData = new FormData(form);
    const currentRequestId = formData.get('request_id_sr') || 'execution_result';

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
            showClusterSelectionModal(clusters);
        } else {
            displayResult(data);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').textContent = 'An error occurred while submitting the form. Please try again.';
        document.getElementById('saveButton').disabled = true;
        document.getElementById('pushDbButton').disabled = true;
    });
}

function showClusterSelectionModal(clusters) {
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

document.getElementById('confirm-cluster').addEventListener('click', function() {
    const select = document.getElementById('cluster-select');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.cluster) {
        const selectedCluster = JSON.parse(selectedOption.dataset.cluster);
        document.getElementById('clusterModal').style.display = 'none';
        submitWithSelectedCluster(selectedCluster);
    } else {
        console.error('No cluster selected or cluster data missing');
    }
});

function submitWithSelectedCluster(selectedCluster) {
    const form = document.getElementById('zayavkiForm');
    const formData = new FormData(form);
    const pushToDb = document.getElementById('pushDbButton').checked;

    const processedVars = {};
    for (let [key, value] of formData.entries()) {
        processedVars[key] = value;
    }

    fetch('/zayavki/cluster', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            processedVars: processedVars,
            selectedCluster: selectedCluster,
            pushToDb: pushToDb,
        }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        displayResult(data);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').textContent = 'An error occurred while processing your request. Please try again.';
    });
}

function displayResult(data) {
    document.getElementById('result').textContent = data;
    document.getElementById('saveButton').disabled = false;
    document.getElementById('pushDbButton').disabled = false;
}
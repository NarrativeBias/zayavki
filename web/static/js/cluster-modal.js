function showClusterSelectionModal(clusters, callback) {
    console.log('showClusterSelectionModal called with clusters:', clusters);
    const modal = document.getElementById('clusterSelectionModal');
    if (!modal) {
        console.error('Modal element not found! Looking for element with id "clusterSelectionModal"');
        console.log('Available modals:', document.querySelectorAll('.modal'));
        return;
    }
    const select = document.getElementById('cluster-select');
    const details = document.getElementById('cluster-details');

    if (!select || !details) {
        console.error('Required elements not found:', { select, details });
        return;
    }

    console.log('All required elements found, setting up modal');

    // Clear previous options
    select.innerHTML = '';
    
    clusters.forEach((cluster, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${cluster.ЦОД} - ${cluster.Среда} - ${cluster.ЗБ} - ${cluster.Кластер}`;
        option.dataset.cluster = JSON.stringify(cluster);
        select.appendChild(option);
    });

    console.log('Options added to select');

    // Show initial cluster details
    updateClusterDetails(clusters[0]);

    // Update details when selection changes
    select.addEventListener('change', () => {
        const selectedCluster = JSON.parse(select.options[select.selectedIndex].dataset.cluster);
        updateClusterDetails(selectedCluster);
    });

    // Show the modal
    modal.style.display = 'block';
    console.log('Modal displayed');

    // Update confirm button click handler
    document.getElementById('confirm-cluster').onclick = function() {
        console.log('Confirm cluster clicked');
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.dataset.cluster) {
            const selectedCluster = JSON.parse(selectedOption.dataset.cluster);
            console.log('Selected cluster:', selectedCluster);
            modal.style.display = 'none';
            if (callback) {
                callback(selectedCluster);
            }
        } else {
            console.error('No cluster selected or cluster data missing');
        }
    };
}

function updateClusterDetails(cluster) {
    console.log('Updating cluster details:', cluster);
    const details = document.getElementById('cluster-details');
    if (!details) {
        console.error('Cluster details element not found');
        return;
    }
    details.innerHTML = `
        <div class="cluster-row"><span class="label">Выдача:</span><span class="value">${cluster.Выдача}</span></div>
        <div class="cluster-row"><span class="label">ЦОД:</span><span class="value">${cluster.ЦОД}</span></div>
        <div class="cluster-row"><span class="label">Среда:</span><span class="value">${cluster.Среда}</span></div>
        <div class="cluster-row"><span class="label">ЗБ:</span><span class="value">${cluster.ЗБ}</span></div>
        <div class="cluster-row"><span class="label">Кластер:</span><span class="value">${cluster.Кластер}</span></div>
        <div class="cluster-row"><span class="label">Реалм:</span><span class="value">${cluster.Реалм}</span></div>
    `;
}

function showClusterModal(clusters, formData, pushToDb = false) {
    const modal = document.getElementById('clusterModal');
    const select = document.getElementById('cluster-select');
    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirm-cluster');

    // Clear existing options
    select.innerHTML = '';

    // Add options for each cluster
    clusters.forEach(cluster => {
        const option = document.createElement('option');
        option.value = JSON.stringify(cluster);
        option.textContent = `${cluster['Кластер']} (${cluster['ЦОД']})`;
        select.appendChild(option);
    });

    // Show cluster details for first option
    updateClusterDetails(JSON.parse(select.value));

    // Update details when selection changes
    select.addEventListener('change', () => {
        updateClusterDetails(JSON.parse(select.value));
    });

    // Show the modal
    modal.style.display = 'block';

    // Handle close button
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    // Handle clicking outside modal
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Handle confirm button
    confirmButton.onclick = () => {
        const selectedCluster = JSON.parse(select.value);
        handleClusterSelection(selectedCluster, formData, pushToDb);
        modal.style.display = 'none';
    };
}

function updateClusterDetails(cluster) {
    const details = document.getElementById('cluster-details');
    const rows = details.getElementsByClassName('cluster-row');
    
    for (const row of rows) {
        const label = row.querySelector('.label').textContent.replace(':', '');
        const value = row.querySelector('.value');
        value.textContent = cluster[label] || '-';
    }
}

function initializeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => modal.style.display = 'none';
        }

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    });
}

// Export functions for use in other files
window.showClusterSelectionModal = showClusterSelectionModal;
window.updateClusterDetails = updateClusterDetails;
window.initializeModal = initializeModal;

// Verify export
console.log('Cluster modal functions exported:', {
    showClusterSelectionModal: !!window.showClusterSelectionModal,
    updateClusterDetails: !!window.updateClusterDetails,
    initializeModal: !!window.initializeModal
});
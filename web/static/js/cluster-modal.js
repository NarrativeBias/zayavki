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
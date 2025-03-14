function showClusterModal(clusters) {
    const modal = document.getElementById('clusterModal');

    // Force modal to be visible
    if (modal) {
        modal.style.cssText = `
            display: block !important;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.4);
        `;
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.cssText = `
                background-color: #fefefe;
                margin: 15% auto;
                padding: 20px;
                border: 1px solid #888;
                width: 80%;
                max-width: 600px;
                position: relative;
                display: block !important;
            `;
        }
    } else {
        console.error('Modal element not found!');
        return;
    }

    const select = document.getElementById('cluster-select');
    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirm-cluster');

    // Clear existing options
    select.innerHTML = '';

    // Add options for each cluster
    clusters.forEach((cluster, index) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(cluster);
        option.textContent = `${cluster['Кластер']} (${cluster['ЦОД']})`;
        select.appendChild(option);
    });

    try {
        const firstCluster = JSON.parse(select.value);
        updateClusterDetails(firstCluster);
    } catch (error) {
        console.error('Error parsing first cluster:', error);
    }

    // Update details when selection changes
    select.addEventListener('change', (event) => {
        try {
            const selectedCluster = JSON.parse(event.target.value);
            updateClusterDetails(selectedCluster);
        } catch (error) {
            console.error('Error updating cluster details:', error);
        }
    });

    // Force modal to stay visible
    setTimeout(() => {
        if (modal.style.display !== 'block') {
            modal.style.display = 'block';
        }
    }, 100);

    // Handle close button
    closeButton.onclick = (event) => {
        modal.style.display = 'none';
    };

    // Handle clicking outside modal
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Handle confirm button
    confirmButton.onclick = (event) => {
        try {
            const selectedCluster = JSON.parse(select.value);
            // Dispatch custom event
            const clusterEvent = new CustomEvent('clusterSelected', {
                detail: selectedCluster
            });
            document.dispatchEvent(clusterEvent);

            modal.style.display = 'none';
        } catch (error) {
            console.error('Error in confirm button handler:', error);
        }
    };
}

function updateClusterDetails(cluster) {
    const details = document.getElementById('cluster-details');
    if (!details) {
        console.error('Cluster details element not found');
        return;
    }

    try {
        details.innerHTML = `
            <div class="cluster-row"><span class="label">Выдача:</span><span class="value">${cluster.Выдача}</span></div>
            <div class="cluster-row"><span class="label">ЦОД:</span><span class="value">${cluster.ЦОД}</span></div>
            <div class="cluster-row"><span class="label">Среда:</span><span class="value">${cluster.Среда}</span></div>
            <div class="cluster-row"><span class="label">ЗБ:</span><span class="value">${cluster.ЗБ}</span></div>
            <div class="cluster-row"><span class="label">Кластер:</span><span class="value">${cluster.Кластер}</span></div>
            <div class="cluster-row"><span class="label">Реалм:</span><span class="value">${cluster.Реалм}</span></div>
        `;
    } catch (error) {
        console.error('Error updating cluster details:', error);
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
window.showClusterModal = showClusterModal;
window.updateClusterDetails = updateClusterDetails;
window.initializeModal = initializeModal;

// Verify export
console.log('Cluster modal functions exported:', {
    showClusterModal: !!window.showClusterModal,
    updateClusterDetails: !!window.updateClusterDetails,
    initializeModal: !!window.initializeModal
});
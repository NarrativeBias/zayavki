document.addEventListener('DOMContentLoaded', function() {
    initializeFormSubmission();
    initializeButtons();
    initializeModal();
});

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
}

function initializeButtons() {
    const buttons = {
        'pushDbButton': handlePushToDbClick,
        'clearAllButton': clearAllFields,
        'checkButton': handleCheckButton
    };

    Object.entries(buttons).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
            if (id === 'clearAllButton') button.disabled = false;
        } else {
            console.error(`${id} not found in the document`);
        }
    });
}

function initializeModal() {
    const modal = document.getElementById('clusterModal');
    if (!modal) {
        console.error('Modal not found in the document');
        return;
    }

    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Add keyboard support
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

function handlePushToDbClick() {
    this.disabled = true;
    document.getElementById('result').textContent = 'Pushing data to DB...';
    handlePushToDb(); // This should be the function from form-handlers.js
}
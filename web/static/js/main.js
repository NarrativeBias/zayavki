document.addEventListener('DOMContentLoaded', function() {
    // Set up form submission
    initializeFormSubmissionHandler();

    const pushDbButton = document.getElementById('pushDbButton');
    const clearAllButton = document.getElementById('clearAllButton');


    if (pushDbButton) {
        pushDbButton.addEventListener('click', function() {
            this.disabled = true;
            document.getElementById('result').textContent = 'Pushing data to DB...';
            handlePushToDb();
        });
    } else {
        console.error('Push DB button not found in the document');
    }

    if (clearAllButton) {
        clearAllButton.addEventListener('click', clearAllFields);
        clearAllButton.disabled = false; // Enable the button
    } else {
        console.error('Clear All Button not found in the document');
    }
    // Modal initialization
    const modal = document.getElementById('clusterModal');
    const closeButton = modal.querySelector('.close-button');

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    // Close the modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
});
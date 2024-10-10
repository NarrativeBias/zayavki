document.addEventListener('DOMContentLoaded', function() {
    // Set up form submission
    initializeFormSubmissionHandler();

    const form = document.getElementById('zayavkiForm');
    const pushDbButton = document.getElementById('pushDbButton');
    const clearAllButton = document.getElementById('clearAllButton');


    if (pushDbButton) {
        pushDbButton.addEventListener('click', function() {
            this.disabled = true;
            document.getElementById('result').textContent = 'Pushing data to DB...';
            submitForm(form, true);
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
});
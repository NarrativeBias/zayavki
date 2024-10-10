let selectedCluster = null;

function initializeFormSubmissionHandler() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm(this);
        });
    } else {
        console.error('Form not found in the document');
    }
}

// Helper function to handle fetch errors
async function handleFetchResponse(response) {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }
    return response.text();
}

// Helper function to process form data
function processFormData(form) {
    const formData = new FormData(form);
    const processedVars = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [key, [value]])
    );

    // Add env_code if not present
    if (!processedVars.hasOwnProperty('env_code')) {
        const envSelect = document.getElementById('env');
        if (envSelect) {
            processedVars['env_code'] = [getEnvCode(envSelect.value)];
        }
    }

    return processedVars;
}

// Main submit function
async function submitForm(form, pushToDb = false) {
    try {
        const formData = new FormData(form);
        formData.append('push_to_db', pushToDb.toString());

        const data = await fetch('/zayavki/submit', { method: 'POST', body: formData })
            .then(handleFetchResponse);

        if (data.startsWith('CLUSTER_SELECTION_REQUIRED:')) {
            const clusters = JSON.parse(data.slice('CLUSTER_SELECTION_REQUIRED:'.length));
            showClusterSelectionModal(clusters, pushToDb);
        } else {
            displayResult(data);
            if (!pushToDb) {
                enablePushToDbButton(); // Enable the "Send to DB" button after successful submit
            }
        }
    } catch (error) {
        handleSubmitError(error);
    }
}

// Function to submit with selected cluster
async function submitWithSelectedCluster(cluster, pushToDb) {
    try {
        selectedCluster = cluster;  // Store the selected cluster
        const form = document.getElementById('zayavkiForm');
        const processedVars = processFormData(form);

        const requestBody = {
            processedVars,
            selectedCluster: cluster,
            pushToDb,
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const data = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }).then(handleFetchResponse);

        displayResult(data);
        if (!pushToDb) {
            enablePushToDbButton(); // Enable the "Send to DB" button after successful submit
        }
    } catch (error) {
        handleSubmitError(error);
    } finally {
        if (pushToDb) {
            disablePushToDbButton(); // Disable the button after push to DB operation
        }
    }
}

// Error handling function
function handleSubmitError(error) {
    console.error('Error:', error);
    document.getElementById('result').textContent = `An error occurred: ${error.message}`;
    disablePushToDbButton(); // Disable the button on error
}

// Clear all fields function
function clearAllFields() {
    const form = document.getElementById('zayavkiForm');
    if (form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
        
        // Clear the result div
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.textContent = '';
        }
        
        // Reset the selectedCluster
        selectedCluster = null;
        
        // Disable the "Send to DB" button
        disablePushToDbButton();
        
        console.log('All fields have been cleared');
    } else {
        console.error('Form not found when trying to clear fields');
    }
}

// New function to handle push to DB
function handlePushToDb() {
    disablePushToDbButton(); // Disable the button when starting the push to DB operation
    if (selectedCluster) {
        submitWithSelectedCluster(selectedCluster, true);
    } else {
        submitForm(document.getElementById('zayavkiForm'), true);
    }
}

// Function to enable the "Send to DB" button
function enablePushToDbButton() {
    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.disabled = false;
    }
}

// Function to disable the "Send to DB" button
function disablePushToDbButton() {
    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.disabled = true;
    }
}
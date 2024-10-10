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
        }
    } catch (error) {
        handleSubmitError(error);
    }
}

// Function to submit with selected cluster
async function submitWithSelectedCluster(selectedCluster, pushToDb) {
    try {
        const form = document.getElementById('zayavkiForm');
        const processedVars = processFormData(form);

        const requestBody = {
            processedVars,
            selectedCluster,
            pushToDb,
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const data = await fetch('/zayavki/cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }).then(handleFetchResponse);

        displayResult(data);
    } catch (error) {
        handleSubmitError(error);
    } finally {
        document.getElementById('pushDbButton').disabled = false;
    }
}

// Error handling function
function handleSubmitError(error) {
    console.error('Error:', error);
    document.getElementById('result').textContent = `An error occurred: ${error.message}`;
    document.getElementById('pushDbButton').disabled = false;
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
        
        console.log('All fields have been cleared');
    } else {
        console.error('Form not found when trying to clear fields');
    }
}
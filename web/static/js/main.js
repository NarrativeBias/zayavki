console.log('Loading main.js...');
// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    console.log('ALL_FIELDS available:', !!ALL_FIELDS);
    console.log('TAB_CONFIGS available:', !!TAB_CONFIGS);
    initializeFields();
    initializeFormSubmission();
    initializeButtons();
    initializeModal();
    initializeEmailValidation();
    initializeTabs();
    initializeJsonImport();
});

// Store field values between tab switches
const fieldValues = {};

function saveFieldValues() {
    const inputs = document.querySelectorAll('#formFields input, #formFields select, #formFields textarea');
    inputs.forEach(input => {
        fieldValues[input.id] = input.value;
    });
}

function restoreFieldValues() {
    const inputs = document.querySelectorAll('#formFields input, #formFields select, #formFields textarea');
    inputs.forEach(input => {
        if (fieldValues[input.id] !== undefined) {
            input.value = fieldValues[input.id];
        }
    });
}

function initializeFields() {
    const formFields = document.getElementById('formFields');
    const buttonContainer = document.getElementById('buttonContainer');
    
    // Get initial tab
    const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
    updateFormForTab(activeTab);
}

function updateFormForTab(tabId) {
    const formFields = document.getElementById('formFields');
    const buttonContainer = document.getElementById('buttonContainer');
    const config = TAB_CONFIGS[tabId];
    
    // Save current field values before clearing
    saveFieldValues();
    
    // Clear existing fields and buttons
    formFields.innerHTML = '';
    buttonContainer.innerHTML = '';
    
    // Generate fields
    config.fields.forEach(fieldId => {
        const field = ALL_FIELDS[fieldId];
        const fieldElement = createFieldElement(fieldId, field, config.required_fields.includes(fieldId));
        formFields.appendChild(fieldElement);
    });
    
    // Generate buttons
    config.buttons.forEach(buttonId => {
        const button = ALL_BUTTONS[buttonId];
        const buttonElement = createButtonElement(buttonId, button);
        
        // Add button handlers
        switch(buttonId) {
            case 'search':
                buttonElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    const formData = new FormData(document.getElementById('mainForm'));
                    const searchData = {
                        segment: formData.get('segment'),
                        env: formData.get('env'),
                        ris_number: formData.get('ris_number'),
                        ris_name: formData.get('ris_name')?.toLowerCase(),
                        tenant: formData.get('tenant'),
                        bucket: formData.get('bucket'),
                        user: formData.get('user'),
                        cluster: formData.get('cluster')
                    };
                    
                    fetch('/zayavki/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(searchData)
                    })
                    .then(handleFetchResponse)
                    .then(data => {
                        if (data.clusters) {
                            handleClusterSelection(data.clusters, performCheckWithCluster, searchData);
                        } else {
                            displayResults(data.results);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        document.getElementById('result').textContent = 'Error performing search: ' + error.message;
                    });
                });
                break;
            case 'clear_all':
                buttonElement.addEventListener('click', () => {
                    const inputs = document.querySelectorAll('#formFields input, #formFields select, #formFields textarea');
                    inputs.forEach(input => {
                        input.value = '';
                        fieldValues[input.id] = '';
                    });
                });
                break;
            case 'submit':
                buttonElement.addEventListener('click', (e) => submitForm(document.getElementById('mainForm')));
                break;
            case 'push_db':
                buttonElement.addEventListener('click', handlePushToDbClick);
                buttonElement.disabled = true;
                break;
        }
        
        buttonContainer.appendChild(buttonElement);
    });
    
    // Restore field values
    restoreFieldValues();
}

function createFieldElement(id, field, required) {
    const div = document.createElement('div');
    div.className = 'field-group';
    
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = field.label;
    
    let input;
    if (field.type === 'select') {
        input = document.createElement('select');
        input.innerHTML = '<option value="">Выберите значение</option>';
        field.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            input.appendChild(option);
        });
    } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
    } else {
        input = document.createElement('input');
        input.type = field.type;
    }
    
    input.id = id;
    input.name = id;
    if (required) input.required = true;
    
    div.appendChild(label);
    div.appendChild(input);
    return div;
}

function createButtonElement(id, button) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = button.class;
    btn.textContent = button.label;
    if (id === 'push_db') btn.disabled = true;
    return btn;
}

function initializeFormSubmission() {
    initializeFormSubmissionHandler();
}

function initializeButtons() {
    const buttons = {
        'pushDbButton': handlePushToDbClick,
        'clearAllButton': clearAllFields
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
    handlePushToDb();
}

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Update form for this tab
            updateFormForTab(tabId);
        });
    });
}
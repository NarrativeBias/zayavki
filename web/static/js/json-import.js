function initializeJsonImport() {
    console.log('Initializing JSON import...');
    const importButton = document.getElementById('importJsonButton');
    const modal = document.getElementById('jsonImportModal');
    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');

    if (!importButton || !modal) {
        console.error('Import button or modal not found');
        return;
    }

    // Initialize modal display style
    modal.style.display = 'none';

    importButton.addEventListener('click', () => {
        console.log('Import button clicked');
        modal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Add keyboard support
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });

    // Handle JSON parsing and form filling
    confirmButton.addEventListener('click', () => {
        const srtJson = document.getElementById('srt_json').value.trim();
        const paramsJson = document.getElementById('params_json').value.trim();

        try {
            if (srtJson) {
                const srtData = JSON.parse(srtJson);
                parseSrtJson(srtData);
            }
            
            if (paramsJson) {
                const paramsData = JSON.parse(paramsJson);
                parseParamsJson(paramsData);
            }

            modal.style.display = 'none';
            displayResult('JSON данные успешно импортированы');
        } catch (error) {
            console.error('Error parsing JSON:', error);
            displayResult(`Ошибка парсинга JSON: ${error.message}`);
        }
    });
}

function parseSrtJson(data) {
    const customFields = {};
    if (data.customFieldsValues && Array.isArray(data.customFieldsValues)) {
        data.customFieldsValues.forEach(field => {
            customFields[field.code] = field.value;
        });
    }

    setFieldValue('request_id_srt', data.number);
    setFieldValue('request_id_sd', customFields.appealNumber);
    setFieldValue('requester', customFields.applicant);
}

function parseParamsJson(data) {
    setFieldValue('segment', data.segment);
    setFieldValue('env', data.environment);
    setFieldValue('ris_number', data.risNumber);
    setFieldValue('ris_name', data.risName);
}

function setFieldValue(fieldId, value) {
    const input = document.getElementById(fieldId);
    if (input && value) {
        input.value = value;
        if (input.tagName === 'SELECT') {
            input.dispatchEvent(new Event('change'));
        }
    }
} 
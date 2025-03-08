function initializeJsonImport() {
    const importButton = document.getElementById('importJsonButton');
    const modal = document.getElementById('jsonImportModal');
    const modalContent = modal.querySelector('.modal-content');
    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');
    const srtTextarea = document.getElementById('srt_json');
    const paramsTextarea = document.getElementById('params_json');

    if (!importButton || !modal) {
        console.error('Import button or modal not found');
        return;
    }

    // Initialize modal display style
    modal.style.display = 'none';

    importButton.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'block';
        srtTextarea.focus();
    });

    closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'none';
    });

    // Handle modal backdrop click
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Prevent event bubbling from modal content
    modalContent.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    // Add keyboard support
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });

    // Handle JSON parsing and form filling
    confirmButton.addEventListener('click', (e) => {
        e.preventDefault();
        const srtJson = srtTextarea.value.trim();
        const paramsJson = paramsTextarea.value.trim();

        try {
            let extractedRequestDetails = '';
            
            if (srtJson) {
                const srtData = JSON.parse(srtJson);
                extractedRequestDetails = parseSrtJson(srtData);
            }
            
            if (paramsJson) {
                const paramsData = JSON.parse(paramsJson);
                parseParamsJson(paramsData);
            }

            modal.style.display = 'none';

            // Format the imported values message
            let resultMessage = 'Импортированы:\n';
            resultMessage += `Номер SRT: ${document.getElementById('request_id_srt').value}\n`;
            resultMessage += `Номер SD: ${document.getElementById('request_id_sd').value}\n`;
            resultMessage += `Заявитель: ${document.getElementById('requester').value}\n`;

            // Add requestDetails from the JSON
            if (extractedRequestDetails) {
                resultMessage += '\nrequestDetails:\n';
                resultMessage += extractedRequestDetails;
            }

            displayResult(resultMessage);
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
    
    // Parse buckets and users from requestDetails
    if (data.requestDetails) {
        // Parse buckets section
        const bucketsMatch = data.requestDetails.match(/Список бакетов\s+Имя бакета \| Объём бакет, ГБ\s+([\s\S]+?)(?=\n\s*\n|\n*Список|$)/);
        if (bucketsMatch) {
            const bucketLines = bucketsMatch[1].trim().split('\n');
            const bucketsList = bucketLines
                .map(line => line.trim())
                .filter(line => line && !line.includes('Имя бакета'))
                .map(line => {
                    // Convert "name | size" to "name sizeG"
                    const [name, size] = line.split('|').map(s => s.trim());
                    return `${name} ${size}G`;
                })
                .join('\n');
            setFieldValue('buckets', bucketsList);
        }

        // Parse users section
        const usersMatch = data.requestDetails.match(/Список дополнительных учетных записей\s+Имя дополнительной учетной записи\s+([\s\S]+?)(?=\n\s*\n|$)/);
        if (usersMatch) {
            const userLines = usersMatch[1].trim().split('\n');
            const usersList = userLines
                .map(line => line.trim())
                .filter(line => line && !line.includes('Имя дополнительной'))
                .join('\n');
            setFieldValue('users', usersList);
        }
    }

    return data.requestDetails;
}

function parseParamsJson(data) {
    if (!Array.isArray(data)) {
        console.error('Expected array of parameters');
        return;
    }

    let ownerEmails = [];

    data.forEach(item => {
        // Extract email for credentials
        if (item.label === 'Электронная почта с поддержкой шифрования для отправки учетных данных') {
            setFieldValue('email_for_credentials', item.value);
        }
        
        // Extract segment (any label containing "Зона безопасности")
        if (item.label.includes('Зона безопасности')) {
            setFieldValue('segment', item.value);
        }

        // Extract resp_group
        if (item.label === 'Рабочая группа сопровождения ИС: название') {
            setFieldValue('resp_group', item.value);
        }

        // Extract and map environment
        if (item.label === 'Среда') {
            const envValue = item.value.toUpperCase();
            let mappedEnv = '';
            
            if (envValue.includes('HF') || envValue.includes('ХОТФИКС')) {
                mappedEnv = 'HOTFIX';
            } else if (envValue.includes('PP') || envValue.includes('ПРЕПРОД')) {
                mappedEnv = 'PREPROD';
            } else if (envValue.includes('ИФТ')) {
                mappedEnv = 'IFT';
            } else if (envValue.includes('PROD') || envValue.includes('ПРОД')) {
                mappedEnv = 'PROD';
            }
            
            if (mappedEnv) {
                setFieldValue('env', mappedEnv);
            }
        }

        // Collect owner emails
        if (item.label === 'Основной владелец бакета: email' || 
            item.label === 'Замещающий владелец бакета: email') {
            ownerEmails.push(item.value);
        }

        // Extract RIS number and name
        if (item.label === 'Номер РИС и идентификационный код') {
            const [risNumber, risName] = item.value.split('-').map(s => s.trim());
            if (risNumber) {
                setFieldValue('ris_number', risNumber);
            }
            if (risName) {
                setFieldValue('ris_name', risName);
            }
        }
    });

    // Set owner field with collected emails
    if (ownerEmails.length > 0) {
        setFieldValue('owner', ownerEmails.join('; '));
    }
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
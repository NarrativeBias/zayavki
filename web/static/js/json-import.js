function initializeJsonParser() {
    const modal = document.getElementById('jsonImportModal');
    if (!modal) return;

    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');
    const srtTextarea = document.getElementById('srt_json');
    const paramsTextarea = document.getElementById('params_json');

    if (!confirmButton || !srtTextarea || !paramsTextarea) return;

    if (closeButton) {
        closeButton.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });

    confirmButton.onclick = async () => {
        const srtJson = srtTextarea.value.trim();
        const paramsJson = paramsTextarea.value.trim();

        try {
            let extractedRequestDetails = '';
            let paramsFields = {};
            
            if (srtJson) {
                const srtData = JSON.parse(srtJson);
                extractedRequestDetails = parseSrtJson(srtData);
            }
            
            if (paramsJson) {
                const paramsData = JSON.parse(paramsJson);
                paramsFields = parseParamsJson(paramsData);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            modal.style.display = 'none';

            // Format the imported values message with all fields
            let resultMessage = 'Импортированы:\n\n';
            resultMessage += `Номер SRT: ${document.getElementById('request_id_srt').value}\n`;
            resultMessage += `Номер SD: ${document.getElementById('request_id_sd').value}\n`;
            resultMessage += `Заявитель: ${document.getElementById('requester').value}\n`;
            resultMessage += `Сегмент: ${paramsFields.segment || ''}\n`;
            resultMessage += `Среда: ${paramsFields.env || ''}\n`;
            resultMessage += `РИС номер: ${paramsFields.ris_number || ''}\n`;
            resultMessage += `РИС имя: ${paramsFields.ris_name || ''}\n`;
            resultMessage += `Группа сопровождения: ${paramsFields.resp_group || ''}\n`;
            resultMessage += `Владелец: ${paramsFields.owner || ''}\n`;
            resultMessage += `Зам. владельца: ${paramsFields.zam_owner || ''}\n`;
            resultMessage += `Email для учетных данных: ${paramsFields.email_for_credentials || ''}\n`;

            if (extractedRequestDetails) {
                resultMessage += '\nrequestDetails:\n';
                resultMessage += extractedRequestDetails;
            }

            displayFormResult(resultMessage);
        } catch (error) {
            displayFormResult(`Ошибка парсинга JSON: ${error.message}`);
        }
    };
}

function parseSrtJson(data) {
    const customFields = {};
    if (data.customFieldsValues && Array.isArray(data.customFieldsValues)) {
        data.customFieldsValues.forEach(field => {
            customFields[field.code] = field.value;
        });
    }

    // Set basic fields - ensure we're setting all required fields
    setFieldValue('request_id_srt', data.number);
    setFieldValue('request_id_sd', customFields.appealNumber);
    setFieldValue('requester', customFields.applicant);
    
    // Parse requestDetails for buckets and users
    if (data.requestDetails) {
        // Parse buckets section
        const bucketsMatch = data.requestDetails.match(/Список бакетов\s*\nИмя бакета \| Объём бакет, ГБ\s*([\s\S]+?)(?=\n\s*\n|\n*Список|$)/);
        if (bucketsMatch) {
            const bucketLines = bucketsMatch[1].trim().split('\n');
            const bucketsList = bucketLines
                .map(line => line.trim())
                .filter(line => line && !line.includes('Имя бакета'))
                .map(line => {
                    const [name, size] = line.split('|').map(s => s.trim());
                    return `${name} | ${size}`;
                })
                .join('\n');
            setFieldValue('buckets', bucketsList);
        }

        // Parse users section
        const usersMatch = data.requestDetails.match(/Список дополнительных учетных записей[\s\S]*?Имя дополнительной учетной записи\s*([\s\S]+?)(?=\n\s*\n|$)/i);
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
        return;
    }

    // Switch to new-tenant tab first
    const newTenantButton = document.querySelector('.tab-button[data-tab="new-tenant"]');
    if (newTenantButton) {
        newTenantButton.click();
    }

    const formFields = {};  // Collect all fields first

    data.forEach(item => {
        switch (item.label) {
            case 'Электронная почта с поддержкой шифрования для отправки учетных данных':
                formFields.email_for_credentials = item.value;
                break;
            case 'Зона безопасности (выделенный кластер)':
                formFields.segment = item.value;
                break;
            case 'Рабочая группа сопровождения ИС: название':
                formFields.resp_group = item.value;
                break;
            case 'Основной владелец бакета: email':
                formFields.owner = item.value;
                break;
            case 'Замещающий владелец бакета: email':
                formFields.zam_owner = item.value;
                break;
            case 'Среда':
                const envValue = item.value.toUpperCase();
                if (envValue.includes('ХОТФИКС') || envValue.includes('HF')) {
                    formFields.env = 'HOTFIX';
                } else if (envValue.includes('ПРЕПРОД') || envValue.includes('PP')) {
                    formFields.env = 'PREPROD';
                } else if (envValue.includes('ИФТ')) {
                    formFields.env = 'IFT';
                } else if (envValue.includes('ПРОД') || envValue.includes('PROD')) {
                    formFields.env = 'PROD';
                }
                break;
            case 'Номер РИС и идентификационный код':
                const [risNumber, risName] = item.value.split('-').map(s => s.trim());
                if (risNumber) formFields.ris_number = risNumber;
                if (risName) formFields.ris_name = risName;
                break;
        }
    });

    // Set all fields at once
    Object.entries(formFields).forEach(([id, value]) => {
        setFieldValue(id, value);
    });

    // Return the collected fields for verification
    return formFields;
}

function setFieldValue(fieldId, value) {
    if (!value) return;

    // Switch to new-tenant tab first
    const newTenantButton = document.querySelector('.tab-button[data-tab="new-tenant"]');
    if (newTenantButton) {
        newTenantButton.click();
    }

    // Find all instances of the field across tabs
    const inputs = document.querySelectorAll(`#${fieldId}`);
    if (inputs.length === 0) {
        console.warn(`Field ${fieldId} not found`);
        return;
    }

    // Update all instances of the field
    inputs.forEach(input => {
        input.value = value;
        
        // Save to field values for the appropriate tab
        const tabPane = input.closest('.tab-pane');
        if (tabPane && tabPane.id) {
            if (!fieldValues[tabPane.id]) {
                fieldValues[tabPane.id] = {};
            }
            
            // For shared fields, update in all tabs
            if (getSharedFields().includes(fieldId)) {
                Object.keys(fieldValues).forEach(tab => {
                    fieldValues[tab][fieldId] = value;
                });
            } else {
                fieldValues[tabPane.id][fieldId] = value;
            }
        }

        // Trigger change event
        const event = new Event('change', {
            bubbles: true,
            cancelable: true,
        });
        input.dispatchEvent(event);
    });
} 
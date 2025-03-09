function initializeJsonParser() {
    const modal = document.getElementById('jsonImportModal');
    if (!modal) {
        return;
    }

    const closeButton = modal.querySelector('.close-button');
    const confirmButton = document.getElementById('confirmJsonImport');
    const srtTextarea = document.getElementById('srt_json');
    const paramsTextarea = document.getElementById('params_json');

    if (!confirmButton || !srtTextarea || !paramsTextarea) {
        return;
    }

    // Close button handler
    if (closeButton) {
        closeButton.onclick = () => modal.style.display = 'none';
    }

    // Handle modal backdrop click
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

    // Handle JSON parsing and form filling
    confirmButton.onclick = () => {
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

            console.log('Result message before display:', resultMessage);
            console.log('Result message newlines:', resultMessage.match(/\n/g)?.length || 0);
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

    // Set basic fields
    setFieldValue('request_id_srt', data.number);
    setFieldValue('request_id_sd', customFields.appealNumber);
    setFieldValue('requester', customFields.applicant);
    
    // Parse requestDetails for buckets and users
    if (data.requestDetails) {
        // Parse buckets section - fixed regex and parsing
        const bucketsMatch = data.requestDetails.match(/Список бакетов\s*\nИмя бакета \| Объём бакет, ГБ\s*([\s\S]+?)(?=\n\s*\n|\n*Список|$)/);
        if (bucketsMatch) {
            const bucketLines = bucketsMatch[1].trim().split('\n');
            const bucketsList = bucketLines
                .map(line => line.trim())
                .filter(line => line && !line.includes('Имя бакета'))
                .map(line => {
                    const [name, size] = line.split('|').map(s => s.trim());
                    return `${name} ${size}G`;
                })
                .join('\n');
            setFieldValue('buckets', bucketsList);
        }

        // Parse users section - updated regex
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

    data.forEach(item => {
        switch (item.label) {
            case 'Электронная почта с поддержкой шифрования для отправки учетных данных':
                setFieldValue('email_for_credentials', item.value);
                break;
            case 'Зона безопасности (выделенный кластер)':
                setFieldValue('segment', item.value);
                break;
            case 'Рабочая группа сопровождения ИС: название':
                setFieldValue('resp_group', item.value);
                break;
            case 'Основной владелец бакета: email':
                setFieldValue('owner', item.value);
                break;
            case 'Замещающий владелец бакета: email':
                setFieldValue('zam_owner', item.value);
                break;
            case 'Среда':
                const envValue = item.value.toUpperCase();
                let mappedEnv = '';
                
                if (envValue.includes('ХОТФИКС') || envValue.includes('HF')) {
                    mappedEnv = 'HOTFIX';
                } else if (envValue.includes('ПРЕПРОД') || envValue.includes('PP')) {
                    mappedEnv = 'PREPROD';
                } else if (envValue.includes('ИФТ')) {
                    mappedEnv = 'IFT';
                } else if (envValue.includes('ПРОД') || envValue.includes('PROD')) {
                    mappedEnv = 'PROD';
                }
                
                if (mappedEnv) {
                    setFieldValue('env', mappedEnv);
                }
                break;
            case 'Номер РИС и идентификационный код':
                const [risNumber, risName] = item.value.split('-').map(s => s.trim());
                if (risNumber) setFieldValue('ris_number', risNumber);
                if (risName) setFieldValue('ris_name', risName);
                break;
        }
    });
}

function setFieldValue(fieldId, value) {
    // First try to find the input in the active tab
    let input = document.querySelector('.tab-pane.active').querySelector(`#${fieldId}`);
    
    // If not found in active tab, try to find it in new-tenant tab
    if (!input) {
        const newTenantTab = document.getElementById('new-tenant');
        if (newTenantTab) {
            input = newTenantTab.querySelector(`#${fieldId}`);
        }
    }

    if (input && value) {
        input.value = value;
        if (input.tagName === 'SELECT') {
            input.dispatchEvent(new Event('change'));
        }
    }
} 
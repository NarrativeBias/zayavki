function initializeFieldValidation() {
    validateSDField();
    validateSRTField();
    validateEmailFields();
    validateBucketQuotaFields(); // Add bucket quota validation
}

function validateSDField() {
    // Find SD input in the currently active tab
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        const sdInput = activeTab.querySelector('#request_id_sd');
        if (sdInput) {
            sdInput.addEventListener('input', (e) => {
                validateFieldPrefix(e.target, 'sd-', 'Номер должен начинаться с "SD-"');
            });
        }
    }
}

function validateSRTField() {
    // Find SRT input in the currently active tab
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        const srtInput = activeTab.querySelector('#request_id_srt');
        if (srtInput) {
            srtInput.addEventListener('input', (e) => {
                validateFieldPrefix(e.target, 'srt-', 'Номер должен начинаться с "SRT-"');
            });
        }
    }
}

function validateEmailFields() {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const emailFields = ['owner', 'zam_owner', 'email_for_credentials'];
    
    // Find email fields in the currently active tab
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        emailFields.forEach(fieldId => {
            const input = activeTab.querySelector(`#${fieldId}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    validateEmail(e.target, emailPattern);
                });
            }
        });
    }
}

function validateBucketQuotaFields() {
    // Find all bucket quota textarea fields in the currently active tab
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        const bucketFields = activeTab.querySelectorAll('textarea[id="buckets"]');
        
        bucketFields.forEach(field => {
            // Remove existing event listeners to prevent duplicates
            field.removeEventListener('input', handleBucketQuotaInput);
            field.removeEventListener('blur', handleBucketQuotaBlur);
            
            // Add new event listeners
            field.addEventListener('input', handleBucketQuotaInput);
            field.addEventListener('blur', handleBucketQuotaBlur);
        });
    }
}

// Separate handler functions to prevent duplicate event listeners
function handleBucketQuotaInput(e) {
    validateBucketQuotaFormat(e.target);
}

function handleBucketQuotaBlur(e) {
    validateBucketQuotaFormat(e.target);
}

// Function to reinitialize validation when tabs are switched
function reinitializeValidation() {
    validateSDField();
    validateSRTField();
    validateEmailFields();
    validateBucketQuotaFields();
}

function validateBucketQuotaFormat(textarea) {
    const value = textarea.value.trim();
    if (!value) {
        clearValidationMessage(getOrCreateValidationDiv(textarea));
        return;
    }
    
    const lines = value.split('\n');
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        const parts = line.split('|');
        if (parts.length !== 2) {
            errors.push(`Строка ${i + 1}: Неверный формат. Используйте "имя-бакета | размер"`);
            continue;
        }
        
        const bucketName = parts[0].trim();
        const quota = parts[1].trim();
        
        if (!bucketName) {
            errors.push(`Строка ${i + 1}: Имя бакета не может быть пустым`);
        }
        
        if (!quota) {
            errors.push(`Строка ${i + 1}: Размер квоты не может быть пустым`);
        } else if (!isValidQuota(quota)) {
            errors.push(`Строка ${i + 1}: Размер квоты "${quota}" должен быть положительным целым числом (в GB)`);
        }
    }
    
    if (errors.length > 0) {
        showValidationMessage(
            getOrCreateValidationDiv(textarea),
            errors.join('\n'),
            'error'
        );
    } else {
        showValidationMessage(
            getOrCreateValidationDiv(textarea),
            'Формат корректен',
            'success'
        );
    }
}

function isValidQuota(quota) {
    // Must be a positive integer only (no units, no decimals)
    const pattern = /^[1-9]\d*$/;
    return pattern.test(quota.trim());
}

// Check if there are any validation errors on the page
function hasValidationErrors() {
    const errorMessages = document.querySelectorAll('.validation-message.error');
    return errorMessages.length > 0;
}

function validateFieldPrefix(input, prefix, message) {
    const value = input.value.trim().toLowerCase();
    if (value && !value.startsWith(prefix)) {
        showValidationMessage(
            getOrCreateValidationDiv(input),
            message,
            'error'
        );
    } else {
        clearValidationMessage(getOrCreateValidationDiv(input));
    }
}

function validateEmail(input, pattern) {
    const value = input.value.trim();
    if (value && !pattern.test(value)) {
        showValidationMessage(
            getOrCreateValidationDiv(input),
            'Введите корректный email адрес',
            'error'
        );
    } else {
        clearValidationMessage(getOrCreateValidationDiv(input));
    }
}

function getOrCreateValidationDiv(inputElement) {
    let validationDiv = inputElement.parentNode.querySelector('.validation-message');
    if (!validationDiv) {
        validationDiv = document.createElement('div');
        validationDiv.className = 'validation-message';
        inputElement.parentNode.insertBefore(validationDiv, inputElement.nextSibling);
    }
    return validationDiv;
}

function showValidationMessage(container, message, type) {
    container.textContent = message;
    container.className = 'validation-message ' + type;
}

function clearValidationMessage(validationDiv) {
    validationDiv.textContent = '';
    validationDiv.className = 'validation-message';
}

window.initializeFieldValidation = initializeFieldValidation; 

// Export validation functions for use in other scripts
window.hasValidationErrors = hasValidationErrors;
window.validateBucketQuotaFormat = validateBucketQuotaFormat;
window.isValidQuota = isValidQuota;
window.reinitializeValidation = reinitializeValidation; 
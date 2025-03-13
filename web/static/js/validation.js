function initializeFieldValidation() {
    validateSDField();
    validateSRTField();
    validateEmailFields();
}

function validateSDField() {
    const sdInput = document.getElementById('request_id_sd');
    if (sdInput) {
        sdInput.addEventListener('input', (e) => {
            validateFieldPrefix(e.target, 'sd-', 'Номер должен начинаться с "SD-"');
        });
    }
}

function validateSRTField() {
    const srtInput = document.getElementById('request_id_srt');
    if (srtInput) {
        srtInput.addEventListener('input', (e) => {
            validateFieldPrefix(e.target, 'srt-', 'Номер должен начинаться с "SRT-"');
        });
    }
}

function validateEmailFields() {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const emailFields = ['owner', 'zam_owner', 'email_for_credentials'];
    
    emailFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', (e) => {
                validateEmail(e.target, emailPattern);
            });
        }
    });
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
function initializeFieldValidation() {
    validateSDField();
    validateSRTField();
    validateEmailFields();
    validateBucketQuotaFields(); // Add bucket quota validation
    validateUsernameFields(); // Add username validation
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
            field.removeEventListener('input', handleBucketInput);
            field.removeEventListener('blur', handleBucketBlur);
            
            // Add new event listeners
            field.addEventListener('input', handleBucketInput);
            field.addEventListener('blur', handleBucketBlur);
        });
    }
}

function validateUsernameFields() {
    // Find all username textarea fields in the currently active tab
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) {
        const usernameFields = activeTab.querySelectorAll('textarea[id="users"]');
        
        usernameFields.forEach(field => {
            // Remove existing event listeners to prevent duplicates
            field.removeEventListener('input', handleUsernameInput);
            field.removeEventListener('blur', handleUsernameBlur);
            
            // Add new event listeners
            field.addEventListener('input', handleUsernameInput);
            field.addEventListener('blur', handleUsernameBlur);
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

function handleBucketInput(e) {
    triggerFieldValidation(e.target);
}

function handleBucketBlur(e) {
    triggerFieldValidation(e.target);
}

function handleUsernameInput(e) {
    validateUsernameFormat(e.target);
}

function handleUsernameBlur(e) {
    validateUsernameFormat(e.target);
}

// Function to clear all validation messages in the current tab
function clearAllValidationMessages() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) return;
    
    // Clear all validation messages
    const validationDivs = activeTab.querySelectorAll('.validation-message');
    validationDivs.forEach(div => {
        div.remove();
    });
    
    // Remove error classes from input fields
    const errorFields = activeTab.querySelectorAll('.error');
    errorFields.forEach(field => {
        field.classList.remove('error');
    });
}

// Function to reinitialize validation when tabs are switched
function reinitializeValidation() {
    // Clear existing validation messages first
    clearAllValidationMessages();
    
    validateSDField();
    validateSRTField();
    validateEmailFields();
    validateBucketQuotaFields();
    validateUsernameFields(); // Add username validation
    validateTenantNameField(); // Add tenant name validation
}

// Validate tenant name field for existing tenant operations
function validateTenantNameField() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) return;
    
    // Only validate tenant name in tabs that use existing tenants
    const tenantModTab = activeTab.id === 'tenant-mod';
    const bucketModTab = activeTab.id === 'bucket-mod';
    const userBucketDelTab = activeTab.id === 'user-bucket-del';
    
    if (!tenantModTab && !bucketModTab && !userBucketDelTab) return;
    
    const tenantInput = activeTab.querySelector('#tenant');
    if (!tenantInput) return;
    
    // Remove existing event listeners to prevent duplicates
    tenantInput.removeEventListener('input', handleTenantNameInput);
    tenantInput.removeEventListener('blur', handleTenantNameBlur);
    
    // Add new event listeners
    tenantInput.addEventListener('input', handleTenantNameInput);
    tenantInput.addEventListener('blur', handleTenantNameBlur);
}

// Separate handler functions to prevent duplicate event listeners
function handleTenantNameInput(e) {
    validateTenantNameFormat(e.target);
}

function handleTenantNameBlur(e) {
    validateTenantNameFormat(e.target);
}

function validateTenantNameFormat(input) {
    const value = input.value.trim();
    if (!value) {
        clearValidationMessage(getOrCreateValidationDiv(input));
        return;
    }
    
    const errors = [];
    
    // Tenant name format: env_riscode_restoftenantname
    // Example: if_cosd_mytenant
    const tenantParts = value.split('_');
    if (tenantParts.length < 2) {
        errors.push('Неверный формат имени тенанта. Ожидается: env_riscode_rest');
    } else {
        const envCode = tenantParts[0];
        const risCode = tenantParts[1];
        
        // Validate env_code
        const validEnvCodes = ['p0', 'rr', 'if', 'hf', 'lt'];
        if (!validEnvCodes.includes(envCode)) {
            errors.push(`Неверный код среды "${envCode}". Допустимые значения: ${validEnvCodes.join(', ')}`);
        }
        
        // Validate ris_code (should not be empty)
        if (!risCode || risCode.trim() === '') {
            errors.push('Код РИС не может быть пустым');
        }
        
        // Check if there's a rest part
        if (tenantParts.length < 3 || !tenantParts[2] || tenantParts[2].trim() === '') {
            errors.push('Имя тенанта должно содержать дополнительную часть после env_riscode_');
        }
    }
    
    // Check if tenant name contains only valid characters (alphanumeric and underscores)
    const validCharPattern = /^[a-zA-Z0-9_]+$/;
    if (!validCharPattern.test(value)) {
        errors.push('Имя тенанта содержит недопустимые символы. Разрешены только буквы, цифры и подчеркивания');
    }
    
    if (errors.length > 0) {
        showValidationMessage(
            getOrCreateValidationDiv(input),
            errors.join('\n'),
            'error'
        );
    } else {
        showValidationMessage(
            getOrCreateValidationDiv(input),
            'Формат имени тенанта корректен',
            'success'
        );
    }
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
        } else {
            // Validate bucket name format and characters
            const bucketNameErrors = validateBucketName(bucketName, i + 1);
            errors.push(...bucketNameErrors);
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

function validateBucketNamesOnly(textarea) {
    console.log('validateBucketNamesOnly called with value:', textarea.value);
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
        
        // For bucket deletion, we only expect bucket names (no size)
        const bucketName = line;
        
        if (!bucketName) {
            errors.push(`Строка ${i + 1}: Имя бакета не может быть пустым`);
        } else {
            // Validate bucket name format and characters
            const bucketNameErrors = validateBucketName(bucketName, i + 1);
            errors.push(...bucketNameErrors);
        }
    }
    
    console.log('validateBucketNamesOnly errors:', errors);
    
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

function validateUsernameFormat(textarea) {
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
        
        // Validate username format and characters
        const usernameErrors = validateUsername(line, i + 1);
        errors.push(...usernameErrors);
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

function validateBucketName(bucketName, lineNumber) {
    const errors = [];
    
    // Get environment and RIS name from the current form
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) {
        return [`Строка ${lineNumber}: Не удалось определить активную вкладку`];
    }
    
    let envCode, risCode;
    
    // Check if this is a new tenant creation (has env and ris_name fields)
    const envSelect = activeTab.querySelector('#env');
    const risNameInput = activeTab.querySelector('#ris_name');
    
    if (envSelect && risNameInput && envSelect.value && risNameInput.value.trim()) {
        // New tenant creation - use env and ris_name fields
        const env = envSelect.value;
        const risName = risNameInput.value.trim();
        
        // Convert environment to env_code (same logic as Go backend)
        switch (env) {
            case 'PROD':
                envCode = 'p0';
                break;
            case 'PREPROD':
                envCode = 'rr';
                break;
            case 'IFT':
                envCode = 'if';
                break;
            case 'HOTFIX':
                envCode = 'hf';
                break;
            case 'LT':
                envCode = 'lt';
                break;
            default:
                return [`Строка ${lineNumber}: Неизвестная среда "${env}"`];
        }
        
        // Convert ris_name: replace underscores with hyphens
        risCode = risName.replace(/_/g, '-');
        
    } else {
        // Existing tenant operation - extract from tenant name
        const tenantInput = activeTab.querySelector('#tenant');
        if (!tenantInput || !tenantInput.value.trim()) {
            return [`Строка ${lineNumber}: Заполните поле "Имя тенанта" перед валидацией бакетов`];
        }
        
        const tenantName = tenantInput.value.trim();
        
        // Tenant name format: env_riscode_restoftenantname
        // Example: if_cosd_mytenant
        const tenantParts = tenantName.split('_');
        if (tenantParts.length < 2) {
            return [`Строка ${lineNumber}: Неверный формат имени тенанта "${tenantName}". Ожидается: env_riscode_rest`];
        }
        
        // Extract env_code and ris_code from tenant name
        const tenantEnvCode = tenantParts[0];
        const tenantRisCode = tenantParts[1];
        
        // Validate env_code
        const validEnvCodes = ['p0', 'rr', 'if', 'hf', 'lt'];
        if (!validEnvCodes.includes(tenantEnvCode)) {
            return [`Строка ${lineNumber}: Неверный код среды в имени тенанта "${tenantEnvCode}". Допустимые значения: ${validEnvCodes.join(', ')}`];
        }
        
        envCode = tenantEnvCode;
        risCode = tenantRisCode;
    }
    
    // Expected prefix: envCode-risCode-
    const expectedPrefix = `${envCode}-${risCode}-`;
    
    // Check if bucket name starts with expected prefix
    if (!bucketName.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
        errors.push(`Строка ${lineNumber}: Имя бакета "${bucketName}" должно начинаться с "${expectedPrefix}"`);
    }
    
    // Check if bucket name contains only valid characters (alphanumeric and hyphens)
    const validCharPattern = /^[a-zA-Z0-9-]+$/;
    if (!validCharPattern.test(bucketName)) {
        errors.push(`Строка ${lineNumber}: Имя бакета "${bucketName}" содержит недопустимые символы. Разрешены только буквы, цифры и дефисы`);
    }
    
    // Check if bucket name is not too short (at least prefix + 1 character)
    if (bucketName.length <= expectedPrefix.length) {
        errors.push(`Строка ${lineNumber}: Имя бакета "${bucketName}" слишком короткое. Должно быть длиннее префикса "${expectedPrefix}"`);
    }
    
    return errors;
}

function validateUsername(username, lineNumber) {
    const errors = [];
    
    // Get environment and RIS name from the current form
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) {
        return [`Строка ${lineNumber}: Не удалось определить активную вкладку`];
    }
    
    let envCode, risCode;
    
    // Check if this is a new tenant creation (has env and ris_name fields)
    const envSelect = activeTab.querySelector('#env');
    const risNameInput = activeTab.querySelector('#ris_name');
    
    if (envSelect && risNameInput && envSelect.value && risNameInput.value.trim()) {
        // New tenant creation - use env and ris_name fields
        const env = envSelect.value;
        const risName = risNameInput.value.trim();
        
        // Convert environment to env_code (same logic as Go backend)
        switch (env) {
            case 'PROD':
                envCode = 'p0';
                break;
            case 'PREPROD':
                envCode = 'rr';
                break;
            case 'IFT':
                envCode = 'if';
                break;
            case 'HOTFIX':
                envCode = 'hf';
                break;
            case 'LT':
                envCode = 'lt';
                break;
            default:
                return [`Строка ${lineNumber}: Неизвестная среда "${env}"`];
        }
        
        // For usernames, keep ris_name as is (with underscores)
        risCode = risName;
        
    } else {
        // Existing tenant operation - extract from tenant name
        const tenantInput = activeTab.querySelector('#tenant');
        if (!tenantInput || !tenantInput.value.trim()) {
            return [`Строка ${lineNumber}: Заполните поле "Имя тенанта" перед валидацией пользователей`];
        }
        
        const tenantName = tenantInput.value.trim();
        
        // Tenant name format: env_riscode_restoftenantname
        // Example: if_cosd_mytenant
        const tenantParts = tenantName.split('_');
        if (tenantParts.length < 2) {
            return [`Строка ${lineNumber}: Неверный формат имени тенанта "${tenantName}". Ожидается: env_riscode_rest`];
        }
        
        // Extract env_code and ris_code from tenant name
        const tenantEnvCode = tenantParts[0];
        const tenantRisCode = tenantParts[1];
        
        // Validate env_code
        const validEnvCodes = ['p0', 'rr', 'if', 'hf', 'lt'];
        if (!validEnvCodes.includes(tenantEnvCode)) {
            return [`Строка ${lineNumber}: Неверный код среды в имени тенанта "${tenantEnvCode}". Допустимые значения: ${validEnvCodes.join(', ')}`];
        }
        
        envCode = tenantEnvCode;
        risCode = tenantRisCode;
    }
    
    // Expected prefix: envCode_risCode_ (using underscore for usernames)
    const expectedPrefix = `${envCode}_${risCode}_`;
    
    // Check if username starts with expected prefix
    if (!username.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
        errors.push(`Строка ${lineNumber}: Имя пользователя "${username}" должно начинаться с "${expectedPrefix}"`);
    }
    
    // Check if username contains only valid characters (alphanumeric and underscores)
    const validCharPattern = /^[a-zA-Z0-9_]+$/;
    if (!validCharPattern.test(username)) {
        errors.push(`Строка ${lineNumber}: Имя пользователя "${username}" содержит недопустимые символы. Разрешены только буквы, цифры и подчеркивания`);
    }
    
    // Check if username is not too short (at least prefix + 1 character)
    if (username.length <= expectedPrefix.length) {
        errors.push(`Строка ${lineNumber}: Имя пользователя "${username}" слишком короткое. Должно быть длиннее префикса "${expectedPrefix}"`);
    }
    
    return errors;
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

// Check if there are validation errors ONLY in the current active tab
function hasValidationErrorsInCurrentTab() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (!activeTab) return false;
    
    const errorMessages = activeTab.querySelectorAll('.validation-message.error');
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
    
    // Add error class to the input field for red border styling
    const inputField = container.previousElementSibling;
    if (inputField && (inputField.tagName === 'INPUT' || inputField.tagName === 'SELECT' || inputField.tagName === 'TEXTAREA')) {
        if (type === 'error') {
            inputField.classList.add('error');
        } else {
            inputField.classList.remove('error');
        }
    }
}

function clearValidationMessage(validationDiv) {
    validationDiv.textContent = '';
    validationDiv.className = 'validation-message';
    
    // Remove error class from the input field when clearing validation
    const inputField = validationDiv.previousElementSibling;
    if (inputField && (inputField.tagName === 'INPUT' || inputField.tagName === 'SELECT' || inputField.tagName === 'TEXTAREA')) {
        inputField.classList.remove('error');
    }
}

// Function to trigger validation for a specific field after programmatic value change
function triggerFieldValidation(input) {
    const fieldId = input.id;
    
    if (fieldId === 'request_id_sd') {
        validateFieldPrefix(input, 'sd-', 'Номер должен начинаться с "SD-"');
    } else if (fieldId === 'request_id_srt') {
        validateFieldPrefix(input, 'srt-', 'Номер должен начинаться с "SRT-"');
    } else if (['owner', 'zam_owner', 'email_for_credentials'].includes(fieldId)) {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        validateEmail(input, emailPattern);
    } else if (fieldId === 'buckets') {
        // Use different validation based on the tab
        const activeTab = document.querySelector('.tab-pane.active');
        console.log('Validating buckets field, active tab:', activeTab ? activeTab.id : 'none');
        if (activeTab && activeTab.id === 'user-bucket-del') {
            console.log('Using validateBucketNamesOnly for user-bucket-del tab');
            validateBucketNamesOnly(input);
        } else {
            console.log('Using validateBucketQuotaFormat for other tabs');
            validateBucketQuotaFormat(input);
        }
    } else if (fieldId === 'users') {
        validateUsernameFormat(input);
    } else if (fieldId === 'tenant') {
        validateTenantNameFormat(input);
    }
}

window.initializeFieldValidation = initializeFieldValidation; 

// Export validation functions for use in other scripts
window.hasValidationErrors = hasValidationErrors;
window.hasValidationErrorsInCurrentTab = hasValidationErrorsInCurrentTab;
window.validateBucketQuotaFormat = validateBucketQuotaFormat;
window.validateBucketNamesOnly = validateBucketNamesOnly;
window.isValidQuota = isValidQuota;
window.reinitializeValidation = reinitializeValidation;
window.clearAllValidationMessages = clearAllValidationMessages; 

// Function to reinitialize validation after import with comprehensive validation
function reinitializeValidationAfterImport() {
    // Wait a bit for DOM to update
    setTimeout(() => {
        
        // Reinitialize validation for all fields
        reinitializeValidation();
        
        // Trigger validation for fields with values
        const activeTab = document.querySelector('.tab-pane.active');
        
        if (activeTab) {
            // Validate SD/SRT fields
            const sdInput = activeTab.querySelector('#request_id_sd');
            const srtInput = activeTab.querySelector('#request_id_srt');
            
            if (sdInput && sdInput.value) {
                validateFieldPrefix(sdInput, 'sd-', 'Номер должен начинаться с "SD-"');
            }
            if (srtInput && srtInput.value) {
                validateFieldPrefix(srtInput, 'srt-', 'Номер должен начинаться с "SRT-"');
            }
            
            // Validate email fields
            ['owner', 'zam_owner', 'email_for_credentials'].forEach(fieldId => {
                const input = activeTab.querySelector(`#${fieldId}`);
                if (input && input.value) {
                    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    validateEmail(input, emailPattern);
                }
            });
            
            // Validate bucket/user fields
            const bucketsInput = activeTab.querySelector('textarea[id="buckets"]');
            const usersInput = activeTab.querySelector('textarea[id="users"]');
            
            if (bucketsInput && bucketsInput.value) {
                // Use different validation based on the tab
                if (activeTab.id === 'user-bucket-del') {
                    validateBucketNamesOnly(bucketsInput);
                } else {
                    validateBucketQuotaFormat(bucketsInput);
                }
            }
            if (usersInput && usersInput.value) {
                validateUsernameFormat(usersInput);
            }
            
            // Validate tenant field if it exists
            const tenantInput = activeTab.querySelector('#tenant');
            if (tenantInput && tenantInput.value) {
                validateTenantNameFormat(tenantInput);
            }
        }
    }, 100);
}

// Export the new validation functions
window.triggerFieldValidation = triggerFieldValidation;
window.reinitializeValidationAfterImport = reinitializeValidationAfterImport; 
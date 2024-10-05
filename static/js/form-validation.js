document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(event) {
            validateForm(event, this);
        });
    } else {
        console.error('Form not found in the document');
    }
});

function validateForm(event, form) {
    event.preventDefault();
    
    const requestIdSm = document.getElementById('request_id_sm').value.trim();
    const requestIdSf = document.getElementById('request_id_sf').value.trim();
    const segment = document.getElementById('segment').value.trim();
    const env = document.getElementById('env').value.trim();
    const risCode = document.getElementById('ris_code').value.trim();
    const risName = document.getElementById('ris_name').value.trim();
    const respGroup = document.getElementById('resp_group').value.trim();
    const owner = document.getElementById('owner').value.trim();
    const requester = document.getElementById('requester').value.trim();
    const email = document.getElementById('email_for_credentials').value.trim();
    const buckets = document.getElementById('buckets').value.trim();
    const users = document.getElementById('users').value.trim();

    let isValid = true;
    let errorMessage = '';

    // Determine environment code
    let envCode;
    switch (env.toUpperCase()) {
        case 'PROD': envCode = 'p0'; break;
        case 'PREPROD': envCode = 'rr'; break;
        case 'IFT': envCode = 'if'; break;
        case 'HOTFIX': envCode = 'hf'; break;
        default: 
            isValid = false;
            errorMessage += 'Invalid environment.\n';
    }

    // Validate Request IDs
    if (!requestIdSm || !requestIdSf) {
        isValid = false;
        errorMessage += 'Both Request IDs are required.\n';
    }

    // Validate Segment and Environment
    if (!segment || !env) {
        isValid = false;
        errorMessage += 'Segment and Environment are required.\n';
    }

    // Validate RIS Code and Name
    if (!risCode || !risName) {
        isValid = false;
        errorMessage += 'RIS Code and Name are required.\n';
    }

    // Validate Response Group and Owner
    if (!respGroup || !owner) {
        isValid = false;
        errorMessage += 'Response Group and Owner are required.\n';
    }

    // Validate Requester and Email
    if (!requester || !email) {
        isValid = false;
        errorMessage += 'Requester and Email are required.\n';
    }

    // Validate Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        isValid = false;
        errorMessage += 'Invalid email format.\n';
    } 
    
    // Validate Buckets
    if (buckets) {
        const bucketLines = buckets.split('\n');
        for (let line of bucketLines) {
            line = line.trim();
            if (line === '') continue; // Skip empty lines
            const parts = line.split(/\s+/);
            if (parts.length !== 2) {
                isValid = false;
                errorMessage += `Invalid bucket format: ${line}. Each bucket should have a name and quota.\n`;
                continue;
            }
            const [bucketName, quota] = parts;
            const expectedPrefix = `${envCode}-${risName.toLowerCase()}-`;
            if (!bucketName.toLowerCase().startsWith(expectedPrefix)) {
                isValid = false;
                errorMessage += `Invalid bucket name: ${bucketName}. Should start with ${expectedPrefix}.\n`;
            }
            if (!/^\d+(\.\d+)?[GMTPK]B?$/i.test(quota)) {
                isValid = false;
                errorMessage += `Invalid bucket quota format: ${quota}. Should be like 500MB, 1GB, 2TB, etc.\n`;
            }
        }
    }

    // Validate Users
    if (users) {
        const userLines = users.split(/[\n,]/);
        for (let user of userLines) {
            user = user.trim();
            if (user === '') continue; // Skip empty lines
            const expectedPrefixUnderscore = `${envCode}_${risName.toLowerCase()}_`;
            const expectedPrefixHyphen = `${envCode}-${risName.toLowerCase()}-`;
            if (!user.toLowerCase().startsWith(expectedPrefixUnderscore) && !user.toLowerCase().startsWith(expectedPrefixHyphen)) {
                isValid = false;
                errorMessage += `Invalid username: ${user}. Should start with ${expectedPrefixUnderscore} or ${expectedPrefixHyphen}.\n`;
                continue;
            }
            if (!/^[a-z0-9_-]+$/.test(user)) {
                isValid = false;
                errorMessage += `Invalid characters in username: ${user}. Use only lowercase letters, numbers, underscore, and hyphen.\n`;
            }
        }
    }

    if (!isValid) {
        alert('Validation failed:\n' + errorMessage);
    } else {
        form.submit();
    }
}
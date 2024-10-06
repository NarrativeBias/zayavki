document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            if (validateForm(this)) {
                submitForm(this);
            }
        });
    } else {
        console.error('Form not found in the document');
    }
});

function validateForm(form) {
    const requestIdSd = form.request_id_sd.value.trim();
    const requestIdSr = form.request_id_sr.value.trim();
    const segment = form.segment.value.trim();
    const env = form.env.value.trim();
    const risCode = form.ris_code.value.trim();
    const risName = form.ris_name.value.trim();
    const respGroup = form.resp_group.value.trim();
    const owner = form.owner.value.trim();
    const requester = form.requester.value.trim();
    const email = form.email_for_credentials.value.trim();
    const buckets = form.buckets.value.trim();
    const users = form.users.value.trim();

    let isValid = true;
    let errorMessage = '';

    // Validate required fields
    if (!requestIdSd || !requestIdSr || !segment || !env || !risCode || !risName || !respGroup || !owner || !requester || !email) {
        isValid = false;
        errorMessage += 'All fields except Buckets and Users are required.\n';
    }

    // Validate that at least one of buckets or users is filled
    if (!buckets && !users) {
        isValid = false;
        errorMessage += 'At least one of Buckets or Users must be filled.\n';
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        isValid = false;
        errorMessage += 'Invalid email format.\n';
    }

    // Validate environment
    const validEnvs = ['PROD', 'PREPROD', 'IFT', 'HOTFIX'];
    if (!validEnvs.includes(env.toUpperCase())) {
        isValid = false;
        errorMessage += 'Invalid environment.\n';
    }

    // Determine environment code
    let envCode;
    switch (env.toUpperCase()) {
        case 'PROD': envCode = 'p0'; break;
        case 'PREPROD': envCode = 'rr'; break;
        case 'IFT': envCode = 'if'; break;
        case 'HOTFIX': envCode = 'hf'; break;
    }

    // Validate Buckets if provided
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

    // Validate Users if provided
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
        return false;
    }
    return true;
}

function submitForm(form) {
    const formData = new FormData(form);
    
    fetch('/submit', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        const resultElement = document.getElementById('result');
        resultElement.textContent = data;
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while submitting the form. Please try again.');
    });
}
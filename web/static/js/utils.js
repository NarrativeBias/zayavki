function displayResult(data) {
    const resultElement = document.getElementById('result');
    resultElement.textContent = data;
    resultElement.style.whiteSpace = 'pre-wrap';  // Preserve line breaks
    document.getElementById('pushDbButton').disabled = false;
}

function getEnvCode(env) {
    switch (env) {
        case 'PROD': return 'p0';
        case 'PREPROD': return 'rr';
        case 'IFT': return 'if';
        case 'HOTFIX': return 'hf';
        case 'LT': return 'lt';
        default: return '';
    }
}
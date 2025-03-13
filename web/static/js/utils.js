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

function createTableRow(cells, isHeader = false) {
    const row = document.createElement('tr');
    cells.forEach(cell => {
        const el = document.createElement(isHeader ? 'th' : 'td');
        el.textContent = cell || '-';
        row.appendChild(el);
    });
    return row;
}

function createTable(headers, rows, className = 'data-table') {
    const table = document.createElement('table');
    table.className = className;
    
    // Add header
    const thead = document.createElement('thead');
    thead.appendChild(createTableRow(headers, true));
    table.appendChild(thead);
    
    // Add body
    const tbody = document.createElement('tbody');
    rows.forEach(row => tbody.appendChild(createTableRow(row)));
    table.appendChild(tbody);
    
    return table;
}

// Export functions
window.createTableRow = createTableRow;
window.createTable = createTable;
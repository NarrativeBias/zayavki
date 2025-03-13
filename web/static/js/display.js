function displayResult(data) {
    const resultElement = document.getElementById('result');
    if (resultElement) {
        resultElement.textContent = data;
        resultElement.style.whiteSpace = 'pre-wrap';  // Preserve line breaks
    }

    // Only try to disable button if it exists
    const pushDbButton = document.getElementById('pushDbButton');
    if (pushDbButton) {
        pushDbButton.disabled = false;
    }
}

function displayTenantInfo(data) {
    const container = document.createElement('div');
    container.className = 'table-container';

    container.appendChild(createSection('Информация о тенанте',
        createTable(
            ['Тенант', 'Кластер', 'Среда', 'Зона безопасности', 'РИС код', 'РИС номер', 'Группа владельцев', 'Владелец'],
            [[
                data.tenant,
                data.cls_name,
                data.env,
                data.net_seg,
                data.ris_code,
                data.ris_id,
                data.owner_group,
                data.owner_person
            ]]
        )
    ));

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    resultDiv.appendChild(container);
}

function displayCheckResults(data) {
    const container = document.createElement('div');
    container.className = 'table-container';
    
    // Tenant info section
    container.appendChild(createSection('Информация о тенанте',
        createTable(
            ['Тенант', 'Кластер', 'Среда', 'Зона безопасности'],
            [[
                data.tenant.name,
                data.tenant.cluster,
                data.tenant.env,
                data.tenant.segment
            ]]
        )
    ));

    // Users section
    if (data.users && data.users.length > 0) {
        container.appendChild(createSection('Пользователи',
            createTable(
                ['Пользователь', 'Статус'],
                data.users.map(user => [user.name, user.status])
            )
        ));
    }

    // Buckets section
    if (data.buckets && data.buckets.length > 0) {
        container.appendChild(createSection('Бакеты',
            createTable(
                ['Бакет', 'Размер', 'Статус'],
                data.buckets.map(bucket => [bucket.name, bucket.size, bucket.status])
            )
        ));
    }

    // Deletion commands section
    const hasActivesToDelete = (data.users && data.users.some(u => u.status === 'Активен')) ||
                             (data.buckets && data.buckets.some(b => b.status === 'Активен'));

    if (hasActivesToDelete && data.deletion_commands) {
        const pre = document.createElement('pre');
        pre.className = 'command-block';
        pre.textContent = data.deletion_commands;
        container.appendChild(createSection('Команды для удаления ресурсов', pre));
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    resultDiv.appendChild(container);
}

function displayDeactivationResults(data) {
    const container = document.createElement('div');
    container.className = 'table-container';

    // Users section
    if (data.deactivated_users && data.deactivated_users.length > 0) {
        container.appendChild(createSection('Деактивированные пользователи',
            createTable(
                ['Пользователь'],
                data.deactivated_users.map(user => [user])
            )
        ));
    }

    // Buckets section
    if (data.deactivated_buckets && data.deactivated_buckets.length > 0) {
        container.appendChild(createSection('Деактивированные бакеты',
            createTable(
                ['Бакет'],
                data.deactivated_buckets.map(bucket => [bucket])
            )
        ));
    }

    // No resources message
    if ((!data.deactivated_users || data.deactivated_users.length === 0) && 
        (!data.deactivated_buckets || data.deactivated_buckets.length === 0)) {
        const message = document.createElement('p');
        message.textContent = 'Не найдено активных ресурсов для деактивации';
        container.appendChild(message);
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    resultDiv.appendChild(container);
}

function displaySearchResults(results) {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;

    if (!results || results.length === 0) {
        resultDiv.textContent = 'No results found';
        return;
    }

    const table = createTable(
        ['Active', 'Cluster', 'Segment', 'Environment', 'Realm', 'Tenant', 
         'User', 'Bucket', 'Quota', 'SD', 'SRT', 'Date',
         'RIS Code', 'RIS ID', 'Owner Group', 'Owner', 'Applicant'],
        results.map(result => [
            result.active ? '✓' : '✗',
            result.cluster,
            result.segment,
            result.environment,
            result.realm,
            result.tenant,
            result.user,
            result.bucket,
            result.quota,
            result.sd_num,
            result.srt_num,
            result.done_date,
            result.ris_code,
            result.ris_id,
            result.owner_group,
            result.owner,
            result.applicant
        ])
    );

    resultDiv.textContent = '';
    resultDiv.appendChild(table);
}

function displayFormResult(data) {
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.textContent = data;
    }
}

function displayCombinedResult(tenantInfo, submitResult) {
    const result = `Информация о тенанте ${tenantInfo.tenant}:
Кластер: ${tenantInfo.cls_name}
Сегмент: ${tenantInfo.net_seg}
Среда: ${tenantInfo.env}
Реалм: ${tenantInfo.realm}
РИС код: ${tenantInfo.ris_code}
РИС номер: ${tenantInfo.ris_id}
Группа владельцев: ${tenantInfo.owner_group}
Владелец: ${tenantInfo.owner_person}

Результат проверки:
${submitResult}`;

    displayResult(result);
}

// Export functions
window.displayResult = displayResult;
window.displayTenantInfo = displayTenantInfo;
window.displayCheckResults = displayCheckResults;
window.displayDeactivationResults = displayDeactivationResults;
window.displaySearchResults = displaySearchResults;
window.displayFormResult = displayFormResult;
window.displayCombinedResult = displayCombinedResult; 
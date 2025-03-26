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

function displayCheckResults(data) {
    const container = document.createElement('div');
    container.className = 'table-container';
    
    // Tenant info section
    container.appendChild(createSection('Информация о тенанте',
        createTable(
            ['Тенант', 'Кластер', 'Среда', 'Зона безопасности', 'РИС код', 'РИС номер', 'Группа владельцев', 'Владелец'],
            [[
                data.tenant.name,
                data.tenant.cluster,
                data.tenant.env,
                data.tenant.segment,
                data.tenant.ris_code,
                data.tenant.ris_id,
                data.tenant.owner_group,
                data.tenant.owner
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

    // Commands section - handle both creation and deletion commands
    if (data.creation_commands || data.deletion_commands || data.commands) {
        const commandsTitle = data.creation_commands ? 'Команды для создания' :
                            data.deletion_commands ? 'Команды для удаления' :
                            'Команды';
        const commands = data.creation_commands || data.deletion_commands || data.commands;
        
        const pre = document.createElement('pre');
        pre.className = 'command-block';
        pre.textContent = commands;
        container.appendChild(createSection(commandsTitle, pre));
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    resultDiv.appendChild(container);
}

function displayDeactivationResults(result) {
    const container = document.createElement('div');
    container.className = 'table-container';

    // Show deactivated users
    if (result.deactivated_users && result.deactivated_users.length > 0) {
        container.appendChild(createSection('Деактивированные пользователи',
            createTable(
                ['Пользователь'],
                result.deactivated_users.map(user => [user])
            )
        ));
    }

    // Show deactivated buckets
    if (result.deactivated_buckets && result.deactivated_buckets.length > 0) {
        container.appendChild(createSection('Деактивированные бакеты',
            createTable(
                ['Бакет'],
                result.deactivated_buckets.map(bucket => [bucket])
            )
        ));

        // Add warning message about bucket status
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        warningDiv.style.cssText = `
            background-color: #fff3cd;
            color: #664d03;
            padding: 1.25rem;
            margin-top: 1.5rem;
            border-radius: 8px;
            border-left: 5px solid #ffc107;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            font-size: 1.1em;
            line-height: 1.5;
        `;
        
        const warningIcon = document.createElement('span');
        warningIcon.style.cssText = `
            font-size: 1.4em;
            margin-right: 0.5rem;
            vertical-align: middle;
        `;
        warningIcon.textContent = '⚠️';

        const warningTitle = document.createElement('strong');
        warningTitle.style.cssText = `
            display: block;
            margin-bottom: 0.5rem;
            font-size: 1.2em;
            font-weight: 600;
        `;
        warningTitle.appendChild(warningIcon);
        warningTitle.appendChild(document.createTextNode('Важно!'));

        const warningText = document.createElement('span');
        warningText.style.cssText = `
            display: block;
            padding-left: 2.4rem;
        `;
        warningText.textContent = 'Не забудьте изменить статус КЕ бакета на "Вывод из эксплуатации" в Сфера.Конфигурации.';

        warningDiv.appendChild(warningTitle);
        warningDiv.appendChild(warningText);
        container.appendChild(createSection('Напоминание', warningDiv));
    }

    // Show errors if any
    if (result.errors && result.errors.length > 0) {
        const errorList = document.createElement('div');
        errorList.className = 'error-list';
        result.errors.forEach(error => {
            const errorItem = document.createElement('p');
            errorItem.className = 'error-message';
            errorItem.textContent = error;
            errorList.appendChild(errorItem);
        });
        container.appendChild(createSection('Ошибки', errorList));
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

function displayBucketModUpdateResults(result) {
    const container = document.createElement('div');
    container.className = 'table-container';

    // Show updated buckets
    if (result.updated_buckets && result.updated_buckets.length > 0) {
        container.appendChild(createSection('Успешно обновленные квоты бакетов',
            createTable(
                ['Бакет', 'Новая квота'],
                result.updated_buckets.map(bucket => [
                    bucket.name,
                    bucket.size + 'G'
                ])
            )
        ));
    } else {
        const noUpdatesMsg = document.createElement('p');
        noUpdatesMsg.textContent = 'Ни один бакет не был обновлен';
        container.appendChild(createSection('Результат', noUpdatesMsg));
    }

    // Show errors if any
    if (result.errors && result.errors.length > 0) {
        const errorList = document.createElement('div');
        errorList.className = 'error-list';
        result.errors.forEach(error => {
            const errorItem = document.createElement('p');
            errorItem.className = 'error-message';
            errorItem.textContent = error;
            errorList.appendChild(errorItem);
        });
        container.appendChild(createSection('Ошибки', errorList));
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    resultDiv.appendChild(container);
}

// Export functions
window.displayResult = displayResult;
window.displayCheckResults = displayCheckResults;
window.displayDeactivationResults = displayDeactivationResults;
window.displaySearchResults = displaySearchResults;
window.displayFormResult = displayFormResult;
window.displayCombinedResult = displayCombinedResult;
window.displayBucketModUpdateResults = displayBucketModUpdateResults; 
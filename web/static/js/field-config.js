console.log('Loading field-config.js...');
// All possible fields
const ALL_FIELDS = {
    // Common fields
    segment: { label: "Зона безопасности", type: "text" },
    env: { 
        label: "Среда", 
        type: "select",
        options: ["PROD", "PREPROD", "IFT", "HOTFIX"]
    },
    ris_number: { label: "РИС номер", type: "text" },
    ris_name: { label: "РИС имя", type: "text" },
    cluster: { label: "Кластер", type: "text" },
    
    // Tenant related
    tenant: { label: "Имя тенанта", type: "text" },
    tenant_override: { label: "Имя тенанта (override)", type: "text" },
    
    // User/Bucket related
    user: { label: "Пользователь", type: "text" },
    bucket: { label: "Бакет", type: "text" },
    users: { label: "Пользователи (один в строке)", type: "textarea" },
    buckets: { label: "Бакеты (один в строке + объем)", type: "textarea" }
};

// All possible buttons
const ALL_BUTTONS = {
    search: { label: "Поиск", class: "search-button" },
    submit: { label: "Отправить", class: "submit-button" },
    push_db: { label: "Отправить в БД", class: "push-db-button" },
    clear_all: { label: "Очистить все поля", class: "clear-fields-button" }
};

// Tab configurations
const TAB_CONFIGS = {
    'search': {
        fields: [
            { id: 'segment', label: 'Зона безопасности', type: 'text', placeholder: 'INET-DEVTEST-SYNT' },
            { 
                id: 'env', 
                label: 'Среда', 
                type: 'select',
                options: [
                    { value: '', label: 'Выберите среду' },
                    { value: 'PROD', label: 'PROD' },
                    { value: 'PREPROD', label: 'PREPROD' },
                    { value: 'IFT', label: 'IFT' },
                    { value: 'HOTFIX', label: 'HOTFIX' }
                ]
            },
            { id: 'ris_number', label: 'РИС номер', type: 'text', placeholder: '1763' },
            { id: 'ris_name', label: 'РИС имя', type: 'text', placeholder: 'cosd' },
            { id: 'cluster', label: 'Кластер', type: 'text' },
            { id: 'tenant', label: 'Тенант', type: 'text' },
            { id: 'bucket', label: 'Бакет', type: 'text' },
            { id: 'user', label: 'Пользователь', type: 'text' }
        ],
        buttons: [
            { id: 'searchButton', label: 'Поиск', className: 'search-button' },
            { id: 'clearButton', label: 'Очистить', className: 'clear-search-button' }
        ],
        required_fields: ['segment', 'env']
    },
    'new-tenant': {
        fields: [
            {
                id: 'request_id_sd',
                label: 'Номер обращения SD',
                type: 'text',
                required: true,
                placeholder: 'SD-XXXXXXX'
            },
            {
                id: 'request_id_srt',
                label: 'Номер задания SRT',
                type: 'text',
                required: true,
                placeholder: 'SRT-XXXXXXX'
            },
            {
                id: 'segment',
                label: 'Зона безопасности',
                type: 'text',
                required: true,
                placeholder: 'INET-DEVTEST-SYNT'
            },
            {
                id: 'env',
                label: 'Среда',
                type: 'select',
                required: true,
                options: [
                    { value: '', label: 'Выберите среду' },
                    { value: 'PROD', label: 'PROD' },
                    { value: 'PREPROD', label: 'PREPROD' },
                    { value: 'IFT', label: 'IFT' },
                    { value: 'HOTFIX', label: 'HOTFIX' },
                    { value: 'LT', label: 'LT' }
                ]
            },
            {
                id: 'ris_number',
                label: 'РИС номер',
                type: 'text',
                required: true,
                placeholder: '1763'
            },
            {
                id: 'ris_name',
                label: 'РИС имя',
                type: 'text',
                required: true,
                placeholder: 'cosd'
            },
            {
                id: 'resp_group',
                label: 'Группа сопровождения',
                type: 'text',
                required: true,
                placeholder: 'Ответственная РГ'
            },
            {
                id: 'owner',
                label: 'Владелец',
                type: 'email',
                required: true,
                placeholder: 'email владельца'
            },
            {
                id: 'zam_owner',
                label: 'Зам.владелец',
                type: 'email',
                required: true,
                placeholder: 'email зам.владельца'
            },
            {
                id: 'requester',
                label: 'Заявитель',
                type: 'text',
                required: true,
                placeholder: 'ФИО заявителя'
            },
            {
                id: 'email_for_credentials',
                label: 'Email для отправки данных УЗ',
                type: 'email',
                required: true,
                placeholder: 'email@vtb.ru'
            },
            {
                id: 'tenant_override',
                label: 'Имя тенанта (override)',
                type: 'text',
                required: false,
                placeholder: 'Оставьте пустым для автогенерации'
            },
            {
                id: 'users',
                label: 'Дополнительные пользователи (по одному на строку)',
                type: 'textarea',
                required: false,
                placeholder: 'if_cosd_user1\nif_cosd_user2'
            },
            {
                id: 'buckets',
                label: 'Бакеты с указанием квоты (формат: имя-бакета | размер)',
                type: 'textarea',
                required: false,
                placeholder: 'if-cosd-bucket1 | 100\nif-cosd-bucket2 | 200'
            }
        ],
        buttons: [
            { id: 'import-json', label: 'Импорт из JSON', className: 'import-json-button' },
            { id: 'check-form', label: 'Проверить', className: 'primary-button' },
            { id: 'submit-form', label: 'Отправить в БД', className: 'danger-button' },
            { id: 'clearButton', label: 'Очистить', className: 'clear-search-button' }
        ],
        required_fields: ['segment', 'env', 'request_id_sd', 'request_id_srt', 'ris_number', 'ris_name', 'resp_group', 'owner', 'requester', 'email_for_credentials']
    },
    'tenant-mod': {
        fields: [
            { id: 'tenant', label: 'Имя тенанта', type: 'text', required: true, placeholder: 'Введите имя тенанта' },
            {
                id: 'request_id_sd',
                label: 'Номер обращения SD',
                type: 'text',
                required: true,
                placeholder: 'SD-XXXXXXX'
            },
            {
                id: 'request_id_srt',
                label: 'Номер задания SRT',
                type: 'text',
                required: true,
                placeholder: 'SRT-XXXXXXX'
            },
            {
                id: 'email_for_credentials',
                label: 'Email для отправки данных УЗ',
                type: 'text',
                required: false,
                placeholder: 'example@vtb.ru'
            },
            {
                id: 'users',
                label: 'Дополнительные пользователи (по одному на строку)',
                type: 'textarea',
                required: false,
                placeholder: 'if_cosd_user1\nif_cosd_user2'
            },
            {
                id: 'buckets',
                label: 'Бакеты с указанием квоты (формат: имя-бакета | размер)',
                type: 'textarea',
                required: false,
                placeholder: 'if-cosd-bucket1 | 100\nif-cosd-bucket2 | 200'
            }
        ],
        buttons: [
            { id: 'check-form', label: 'Проверить', className: 'primary-button' },
            { id: 'submit-form', label: 'Отправить в БД', className: 'danger-button' },
            { id: 'clearButton', label: 'Очистить', className: 'clear-search-button' }
        ],
        required_fields: ['tenant', 'request_id_sd', 'request_id_srt']
    },
    'user-bucket-del': {
        fields: [
            {
                id: 'tenant',
                label: 'Имя тенанта',
                type: 'text',
                required: true,
                placeholder: 'Введите имя тенанта'
            },
            {
                id: 'users',
                label: 'Пользователи (один в строке)',
                type: 'textarea',
                placeholder: 'if_cosd_user1\nif_cosd_user2',
                required: false
            },
            {
                id: 'buckets',
                label: 'Бакеты (один в строке)',
                type: 'textarea',
                placeholder: 'if-cosd-bucket1\nif-cosd-bucket2',
                required: false
            }
        ],
        buttons: [
            { 
                id: 'check-form',
                label: 'Проверить',
                className: 'primary-button',
                type: 'button',
                preventSubmit: true
            },
            { 
                id: 'submit-form',
                label: 'Отправить в БД',
                className: 'danger-button',
                type: 'button',
                preventSubmit: true
            },
            { 
                id: 'clearButton',
                label: 'Очистить',
                className: 'clear-search-button',
                type: 'button',
                preventSubmit: true
            }
        ],
        required_fields: ['tenant']
    },
    'bucket-mod': {
        fields: ['segment', 'env', 'tenant', 'bucket'],
        buttons: ['submit', 'push_db', 'clear_all'],
        required_fields: ['segment', 'env', 'tenant', 'bucket']
    }
};

// Fields that should not be shared between tabs
const NON_SHARED_FIELDS = [
    'request_id_sd',    // SD number
    'request_id_srt',   // SRT number
    'tenant_override',  // Tenant override name
    'users',           // Users list
    'buckets',         // Buckets list
    'user',            // Single user
    'bucket',          // Single bucket
    'requester',       // Applicant
    'email_for_credentials', // Email for credentials
    'resp_group',      // Owner group
    'owner',           // Owner email
    'zam_owner'        // Deputy owner email
];

// Fields that should not persist between page reloads
const NO_MEMORY_FIELDS = [
    'request_id_sd',    // SD number
    'request_id_srt',   // SR number
    'owner',            // Owner email
    'zam_owner',        // Deputy owner email
    'resp_group',       // Owner group
    'requester',        // Applicant
    'email_for_credentials', // Email
    'tenant_override',  // Tenant name
    'users',            // Users list
    'buckets'          // Buckets list
]; 
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
        fields: ['segment', 'env', 'ris_number', 'ris_name', 'cluster', 'tenant', 'bucket', 'user'],
        buttons: ['search', 'clear_all'],
        required_fields: ['segment', 'env']
    },
    'new-tenant': {
        fields: ['segment', 'env', 'ris_number', 'ris_name', 'tenant_override', 'buckets', 'users'],
        buttons: ['submit', 'push_db', 'clear_all'],
        required_fields: ['segment', 'env', 'ris_number', 'ris_name']
    },
    'tenant-mod': {
        fields: ['segment', 'env', 'ris_number', 'ris_name', 'tenant', 'buckets', 'users'],
        buttons: ['submit', 'push_db', 'clear_all'],
        required_fields: ['segment', 'env', 'ris_number', 'ris_name', 'tenant']
    },
    'user-bucket-del': {
        fields: ['segment', 'env', 'tenant', 'bucket', 'user'],
        buttons: ['submit', 'push_db', 'clear_all'],
        required_fields: ['segment', 'env', 'tenant']
    },
    'bucket-mod': {
        fields: ['segment', 'env', 'tenant', 'bucket'],
        buttons: ['submit', 'push_db', 'clear_all'],
        required_fields: ['segment', 'env', 'tenant', 'bucket']
    }
}; 
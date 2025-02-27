const DatabaseCheckResults = ({ results, loading, error }) => {
    // Helper function to safely get value from potentially null fields
    const getValue = (field) => {
        if (!field) return '-';
        // Handle sql.NullString objects
        if (typeof field === 'object' && 'String' in field) {
            return field.String || '-';
        }
        return field;
    };

    if (loading) {
        return React.createElement('div', { className: 'loading' }, 'Loading...');
    }

    if (error) {
        return React.createElement('div', { className: 'error' }, `Error: ${error}`);
    }

    if (!results || results.length === 0) {
        return React.createElement('div', { className: 'no-results' }, 'No results found');
    }

    // Define only the columns we want to show
    const columnConfig = [
        { key: 'cluster', label: 'Cluster' },
        { key: 'tenant', label: 'Tenant' },
        { key: 'user', label: 'User' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'quota', label: 'Quota' },
        { key: 'sd_num', label: 'SD' },
        { key: 'srt_num', label: 'SRT' },
        { key: 'done_date', label: 'Date' },
        { key: 'owner_group', label: 'Owner Group' },
        { key: 'owner', label: 'Owner' },
        { key: 'applicant', label: 'Applicant' }
    ];

    // Create header cells
    const headerCells = columnConfig.map(column =>
        React.createElement('th', { 
            key: column.key, 
            className: 'p-2 bg-gray-100 border-b'
        }, column.label)
    );

    // Create table rows
    const rows = results.map((result, rowIndex) => {
        const cells = columnConfig.map(column =>
            React.createElement('td', {
                key: column.key,
                className: 'p-2 border-b'
            }, getValue(result[column.key]))
        );

        return React.createElement('tr', {
            key: rowIndex,
            className: rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
        }, cells);
    });

    // Create table structure
    return React.createElement('div', { className: 'overflow-x-auto' },
        React.createElement('table', { className: 'min-w-full divide-y divide-gray-200' },
            React.createElement('thead', null,
                React.createElement('tr', null, headerCells)
            ),
            React.createElement('tbody', { className: 'divide-y divide-gray-200' }, rows)
        )
    );
};
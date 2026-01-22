/**
 * Resource Field Schemas
 * Defines the fields that should be collected for each resource type
 */
export const RESOURCE_SCHEMAS = {
    appointment: {
        fields: [
            { name: 'title', required: true, type: 'string', prompt: 'What\'s the appointment title?', placeholder: 'e.g., Doctor Visit, Team Meeting' },
            { name: 'date', required: true, type: 'date', prompt: 'When is it? (e.g., tomorrow, Jan 25, next Monday)', placeholder: 'tomorrow' },
            { name: 'time', required: true, type: 'time', prompt: 'What time? (e.g., 3pm, 15:00, 2:30 PM)', placeholder: '3pm' },
            { name: 'place', required: false, type: 'string', prompt: 'Where? (or type "skip")', placeholder: 'City Hospital' },
            { name: 'description', required: false, type: 'string', prompt: 'Any notes? (or type "skip")', placeholder: 'Bring insurance card' }
        ]
    },
    expense: {
        fields: [
            { name: 'title', required: true, type: 'string', prompt: 'What\'s this expense for?', placeholder: 'e.g., Lunch, Office Supplies' },
            { name: 'amount', required: true, type: 'currency', prompt: 'How much? (e.g., $100, 50.25)', placeholder: '$25.50' },
            { name: 'date', required: true, type: 'date', prompt: 'When was it? (e.g., today, yesterday, Jan 20)', placeholder: 'today' },
            { name: 'category', required: false, type: 'string', prompt: 'Category? (e.g., Food, Travel, Office) or type "skip"', placeholder: 'Food' },
            { name: 'description', required: false, type: 'string', prompt: 'Any notes? (or type "skip")', placeholder: 'Team lunch' }
        ]
    },
    project: {
        fields: [
            { name: 'title', required: true, type: 'string', prompt: 'What\'s the project name?', placeholder: 'e.g., Website Redesign' },
            { name: 'deadline', required: false, type: 'date', prompt: 'Deadline? (e.g., next Friday, Feb 1) or type "skip"', placeholder: 'next Friday' },
            { name: 'status', required: false, type: 'string', prompt: 'Status? (e.g., Planning, In Progress, Completed) or type "skip"', placeholder: 'Planning' },
            { name: 'description', required: false, type: 'string', prompt: 'Description? (or type "skip")', placeholder: 'Redesign company website' }
        ]
    },
    task: {
        fields: [
            { name: 'title', required: true, type: 'string', prompt: 'What\'s the task?', placeholder: 'e.g., Review budget report' },
            { name: 'dueDate', required: false, type: 'date', prompt: 'Due date? (e.g., tomorrow, next week) or type "skip"', placeholder: 'tomorrow' },
            { name: 'priority', required: false, type: 'string', prompt: 'Priority? (High, Medium, Low) or type "skip"', placeholder: 'High' },
            { name: 'assignee', required: false, type: 'string', prompt: 'Assigned to? (username) or type "skip"', placeholder: 'john' },
            { name: 'description', required: false, type: 'string', prompt: 'Details? (or type "skip")', placeholder: 'Review Q1 numbers' }
        ]
    },
    customer: {
        fields: [
            { name: 'name', required: true, type: 'string', prompt: 'Customer name?', placeholder: 'e.g., John Smith, Acme Corp' },
            { name: 'email', required: false, type: 'email', prompt: 'Email? (or type "skip")', placeholder: 'john@example.com' },
            { name: 'phone', required: false, type: 'phone', prompt: 'Phone? (or type "skip")', placeholder: '555-1234' },
            { name: 'company', required: false, type: 'string', prompt: 'Company? (or type "skip")', placeholder: 'Acme Corp' },
            { name: 'notes', required: false, type: 'string', prompt: 'Notes? (or type "skip")', placeholder: 'VIP customer' }
        ]
    },
    file: {
        fields: [
            { name: 'name', required: true, type: 'string', prompt: 'File name?', placeholder: 'e.g., Budget_Report.xlsx' },
            { name: 'description', required: false, type: 'string', prompt: 'Description? (or type "skip")', placeholder: 'Q1 2026 budget' }
        ]
    },
    misc: {
        fields: [
            { name: 'title', required: true, type: 'string', prompt: 'What should I call this?', placeholder: 'e.g., Important Note' },
            { name: 'description', required: false, type: 'string', prompt: 'Description? (or type "skip")', placeholder: 'Additional details' }
        ]
    }
};
/**
 * Get the schema for a resource type
 */
export function getResourceSchema(resourceType) {
    return RESOURCE_SCHEMAS[resourceType] || null;
}
/**
 * Get the next field to collect for a resource
 */
export function getNextField(resourceType, collectedFields) {
    const schema = getResourceSchema(resourceType);
    if (!schema)
        return null;
    // Find the first field that hasn't been collected yet
    for (const field of schema.fields) {
        if (!(field.name in collectedFields)) {
            return field;
        }
    }
    return null; // All fields collected
}
/**
 * Check if all required fields have been collected
 */
export function hasAllRequiredFields(resourceType, collectedFields) {
    const schema = getResourceSchema(resourceType);
    if (!schema)
        return false;
    // Check if all required fields are present
    for (const field of schema.fields) {
        if (field.required && !(field.name in collectedFields)) {
            return false;
        }
    }
    return true;
}

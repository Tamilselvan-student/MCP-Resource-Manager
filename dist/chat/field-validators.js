/**
 * Field Validators
 * Validates and parses user input for different field types
 */
/**
 * Validate and parse email
 */
export function validateEmail(input) {
    const trimmed = input.trim();
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return {
            valid: false,
            error: `"${input}" doesn't look like a valid email address. Please use format: user@example.com`
        };
    }
    return { valid: true, value: trimmed };
}
/**
 * Validate and parse phone number
 */
export function validatePhone(input) {
    const trimmed = input.trim();
    // Remove common phone number characters
    const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
    // Check if it's a reasonable phone number (7-15 digits)
    if (!/^\d{7,15}$/.test(cleaned)) {
        return {
            valid: false,
            error: `"${input}" doesn't look like a valid phone number. Please use format: 555-1234 or (555) 123-4567`
        };
    }
    return { valid: true, value: trimmed };
}
/**
 * Validate and parse currency amount
 */
export function validateCurrency(input) {
    const trimmed = input.trim();
    // Remove currency symbols and commas
    const cleaned = trimmed.replace(/[$,]/g, '');
    // Try to parse as number
    const amount = parseFloat(cleaned);
    if (isNaN(amount) || amount < 0) {
        return {
            valid: false,
            error: `"${input}" doesn't look like a valid amount. Please use format: $100, 50.25, or 1000`
        };
    }
    return {
        valid: true,
        value: amount,
        formatted: `$${amount.toFixed(2)}`
    };
}
/**
 * Validate and parse number
 */
export function validateNumber(input) {
    const trimmed = input.trim();
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
        return {
            valid: false,
            error: `"${input}" is not a valid number`
        };
    }
    return { valid: true, value: num };
}
/**
 * Validate and parse date
 * Supports: today, tomorrow, yesterday, next Monday, Jan 25, 2026-01-25
 */
export function validateDate(input) {
    const trimmed = input.trim().toLowerCase();
    const now = new Date();
    let targetDate = null;
    // Handle relative dates
    if (trimmed === 'today') {
        targetDate = now;
    }
    else if (trimmed === 'tomorrow') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
    }
    else if (trimmed === 'yesterday') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - 1);
    }
    else if (trimmed.startsWith('next ')) {
        // Handle "next Monday", "next week", etc.
        const dayName = trimmed.substring(5);
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = days.indexOf(dayName);
        if (dayIndex !== -1) {
            targetDate = new Date(now);
            const currentDay = targetDate.getDay();
            const daysUntilTarget = (dayIndex - currentDay + 7) % 7 || 7;
            targetDate.setDate(targetDate.getDate() + daysUntilTarget);
        }
        else if (dayName === 'week') {
            targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + 7);
        }
        else if (dayName === 'month') {
            targetDate = new Date(now);
            targetDate.setMonth(targetDate.getMonth() + 1);
        }
    }
    else {
        // Try to parse as date string
        targetDate = new Date(input);
        // Check if valid date
        if (isNaN(targetDate.getTime())) {
            targetDate = null;
        }
    }
    if (!targetDate) {
        return {
            valid: false,
            error: `I don't recognize "${input}" as a date. Try: today, tomorrow, next Monday, Jan 25, or 2026-01-25`
        };
    }
    return {
        valid: true,
        value: targetDate,
        formatted: targetDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    };
}
/**
 * Validate and parse time
 * Supports: 3pm, 15:00, 3:30 PM, 1530
 */
export function validateTime(input) {
    const trimmed = input.trim().toLowerCase();
    // Try to parse various time formats
    let hours = 0;
    let minutes = 0;
    // Format: 3pm, 3:30pm
    const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (ampmMatch) {
        hours = parseInt(ampmMatch[1]);
        minutes = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
        if (ampmMatch[3] === 'pm' && hours !== 12) {
            hours += 12;
        }
        else if (ampmMatch[3] === 'am' && hours === 12) {
            hours = 0;
        }
    }
    else {
        // Format: 15:00, 1530
        const militaryMatch = trimmed.match(/^(\d{1,2}):?(\d{2})$/);
        if (militaryMatch) {
            hours = parseInt(militaryMatch[1]);
            minutes = parseInt(militaryMatch[2]);
        }
    }
    // Validate hours and minutes
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return {
            valid: false,
            error: `"${input}" doesn't look like a valid time. Try: 3pm, 15:00, or 3:30 PM`
        };
    }
    // Format as HH:MM
    const formatted24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    // Format as 12-hour with AM/PM
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formatted12 = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    return {
        valid: true,
        value: formatted24,
        formatted: formatted12
    };
}
/**
 * Check if input is a skip command
 */
export function isSkipCommand(input) {
    const trimmed = input.trim().toLowerCase();
    const skipKeywords = ['skip', 'pass', 'none', 'no', 'n/a', 'na', 'not needed', 'not required'];
    return skipKeywords.includes(trimmed);
}
/**
 * Validate field based on type
 */
export function validateField(fieldType, input) {
    // Check for skip command first
    if (isSkipCommand(input)) {
        return { valid: true, value: null, formatted: '(skipped)' };
    }
    switch (fieldType) {
        case 'email':
            return validateEmail(input);
        case 'phone':
            return validatePhone(input);
        case 'currency':
            return validateCurrency(input);
        case 'number':
            return validateNumber(input);
        case 'date':
            return validateDate(input);
        case 'time':
            return validateTime(input);
        case 'string':
        default:
            // String fields just need to not be empty
            const trimmed = input.trim();
            if (trimmed.length === 0) {
                return { valid: false, error: 'Please provide a value' };
            }
            return { valid: true, value: trimmed };
    }
}

import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function parseCommandWithAI(message: string) {
    try {
        console.log('🤖 Groq parsing:', message);

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a command parser for a resource management system. Parse user commands and return ONLY valid JSON.

**AVAILABLE INTENTS:**

SOCIAL/SYSTEM:
- greeting: Hi, hello, hey, what's up
- goodbye: Bye, see you later
- gratitude: Thanks, thank you
- help: Help, what can you do, commands
- who_am_i: Who am I, my profile, what's my role

USER MANAGEMENT:
- create_user: Create/add new user account
- delete_user: Delete/remove user (MUST have "user" keyword)
- change_role: Change user role, promote/demote
- list_users: List/show users, show all viewers/admins/etc
- get_user_info: Who is X, user details, user info
- find_user: Find/search for user

RESOURCE MANAGEMENT:
- create_resource: Create file/appointment/project/task/expense/customer
- delete_resource: Delete file/resource (DEFAULT for delete without "user")
- rename_resource: Rename a resource
- change_category: Move resource to different category
- list_resources: List/show resources/files
- list_categories: Show/list categories/options
- check_access: Who has access, what files does X access
- update_visibility: Make file visible/hidden to role
- bulk_visibility: Make all files in category visible to role
- category_stats: How many files in category

SYSTEM INFORMATION:
- system_stats: Show system statistics (user counts, resource counts)
- who_am_i: Get current user info
- help: Show help

OTHER:
- unknown: Unrecognized command

**CRITICAL DELETE RULES:**
1. "delete file X.pdf" → delete_resource
2. "delete X.pdf" (has extension) → delete_resource
3. "delete user john" (has "user") → delete_user
4. "delete john" (no "user", no extension) → delete_resource (PREFER resource)
5. If ambiguous and no "user" keyword → ALWAYS prefer delete_resource

**ENTITY EXTRACTION:**
1. Extract clean names WITHOUT command words
   - "delete file test.pdf" → resource="test.pdf"
   - "delete user john" → user="john"
   - Remove: "the", "a", "an", "file", "user", etc.

2. File extensions → ALWAYS delete_resource
   - .pdf, .xlsx, .docx, .txt, .csv, .jpg, .png, etc.

3. Roles normalization:
   - viewer/viewers → "viewer"
   - editor/editors → "editor"  
   - admin/admins/administrator → "admin"
   - owner/owners → "owner"

4. Categories (use EXACT capitalization):
   - Files
   - Appointments
   - Projects
   - Customers
   - Expenses
   - Tasks
   - Miscellaneous

5. For change_role commands:
   - Extract user into "user" field
   - Extract new role into "newRole" field
   - "make john editor" → user="john", newRole="editor"

**OUTPUT FORMAT:**
{
  "intent": "<intent_name>",
  "entities": {
    "user": "<username>",
    "resource": "<filename>",
    "newName": "<new filename for rename_resource>",
    "email": "<email>",
    "role": "<role for filtering>",
    "newRole": "<new role for change_role>",
    "category": "<Files|Appointments|Projects|etc>",
    "oldCategory": "<source category for change_category>",
    "newCategory": "<target category for change_category>",
    "query": "<query string>",
    "visibility": {
      "role": "<viewer|editor|admin|owner>",
      "access": true/false
    }
  },
  "confidence": 0.95
}

**EXAMPLES:**

"delete file TEST2.pdf"
→ {"intent":"delete_resource","entities":{"resource":"TEST2.pdf"},"confidence":0.95}

"delete TEST2.pdf"
→ {"intent":"delete_resource","entities":{"resource":"TEST2.pdf"},"confidence":0.95}

"delete user john"
→ {"intent":"delete_user","entities":{"user":"john"},"confidence":0.95}

"delete john"
→ {"intent":"delete_resource","entities":{"resource":"john"},"confidence":0.80}

"create a new user"
→ {"intent":"create_user","entities":{},"confidence":0.95}

"add user bob"
→ {"intent":"create_user","entities":{"user":"bob"},"confidence":0.90}

"create file expenses.xlsx"
→ {"intent":"create_resource","entities":{"resource":"expenses.xlsx"},"confidence":0.95}

"create appointment meeting"
→ {"intent":"create_resource","entities":{"resource":"meeting","category":"Appointments"},"confidence":0.90}

"show all viewers"
→ {"intent":"list_users","entities":{"role":"viewer"},"confidence":0.95}

"who is sarah"
→ {"intent":"get_user_info","entities":{"user":"sarah"},"confidence":0.95}

"make john editor"
→ {"intent":"change_role","entities":{"user":"john","newRole":"editor"},"confidence":0.95}

"change sarah to admin"
→ {"intent":"change_role","entities":{"user":"sarah","newRole":"admin"},"confidence":0.95}

"hi"
→ {"intent":"greeting","entities":{},"confidence":1.0}

"display all categories"
→ {"intent":"list_categories","entities":{},"confidence":0.95}

"move file report.pdf from Files to Projects"
→ {"intent":"change_category","entities":{"resource":"report.pdf","oldCategory":"Files","newCategory":"Projects"},"confidence":0.95}

"change category of meeting.txt to Appointments"
→ {"intent":"change_category","entities":{"resource":"meeting.txt","newCategory":"Appointments"},"confidence":0.90}

"move budget.xlsx to Projects"
→ {"intent":"change_category","entities":{"resource":"budget.xlsx","newCategory":"Projects"},"confidence":0.90}

"rename file report.pdf to budget.pdf"
→ {"intent":"rename_resource","entities":{"resource":"report.pdf","newName":"budget.pdf"},"confidence":0.95}

"change name of meeting.txt to notes.txt"
→ {"intent":"rename_resource","entities":{"resource":"meeting.txt","newName":"notes.txt"},"confidence":0.90}

"show system stats"
→ {"intent":"system_stats","entities":{},"confidence":0.95}

"how many users"
→ {"intent":"system_stats","entities":{},"confidence":0.90}

**RULES:**
- Only include entities that exist in the command
- Omit empty/null entities from JSON
- Use exact category capitalization: Files, Appointments, Projects, Customers, Expenses, Tasks, Miscellaneous
- When in doubt between delete_user and delete_resource → choose delete_resource
- Respond ONLY with valid JSON, no markdown, no explanations`
                },
                {
                    role: "user",
                    content: `Parse: "${message}"`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error('No response from Groq');
        }

        const parsed = JSON.parse(response);
        console.log('✅ Groq result:', JSON.stringify(parsed, null, 2));

        return {
            intent: parsed.intent || 'unknown',
            entities: parsed.entities || {},
            confidence: parsed.confidence || 0.5,
            raw: message
        };

    } catch (error: any) {
        console.error('❌ Groq error:', error.message);
        // Fallback to unknown intent on error
        return {
            intent: 'unknown',
            entities: {},
            confidence: 0.0,
            raw: message
        };
    }
}
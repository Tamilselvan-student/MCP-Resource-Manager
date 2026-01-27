# Architecture Overview: MCP Resource Manager

This project is a secure, intelligent Resource Manager built on three core pillars: **PostgreSQL**, **OpenFGA**, and **MCP (Model Context Protocol)**. 

It demonstrates how to build an application where "Identity" and "Authorization" are decoupled from the business logic.

## 1. The Core Components

### 🐘 PostgreSQL (The "Truth")
**Role**: Persistent Storage & Identity Provider
- Stores the *content* of resources (files, appointments, projects).
- Stores the *users* (email, password hash, role metadata).
- **Key Concept**: The database knows *what* exists and *who* exists, but it delegates the complex decision of *"who can see what"* to OpenFGA (mostly).
- **Tables**: `users`, `resources`.

### 🛡️ OpenFGA (The "Gatekeeper")
**Role**: Fine-Grained Authorization Engine
- Stores *relationships* (Tuples), not data.
- **Tuples**: Facts like `user:tharsan` is `owner` of `resource:file_123`.
- **Model**: Defines the rules. Example:
    - *If you are an `owner` of a file, you can `view` it.*
    - *If you are an `admin`, you can `view` everything (via wildcard or logic).*
- **Why it matters**: Instead of writing complex SQL checks (`WHERE owner_id = ? OR role = 'admin' OR id IN (...)`), the app simply asks OpenFGA: *"Can User X view Resource Y?"* -> `TRUE/FALSE`.

### 🤖 MCP (The "Interface")
**Role**: Model Context Protocol (Internal implementation)
- Acts as the "Brain" or "Handler" for the AI Assistant.
- **Flow**:
    1.  User sends a chat message: *"Show me my files"*
    2.  **NLP/LLM**: Parses intent into a structured **MCP Request** (`{ action: 'list', resourceType: 'file' }`).
    3.  **MCP Handler**: Executes the request.
        -   It calls OpenFGA: *"Can this user list files?"*
        -   It queries PostgreSQL: *"Select * FROM resources..."*
        -   It filters results based on permissions.
- **Significance**: This creates a standardized way for AI agents to interact with the system securely. The AI doesn't run SQL; it sends MCP requests which are strictly policed by the Handler.

## 2. How It Works Together (The Flow)

**Scenario**: A User tries to view a file.

1.  **Request**: User clicks "file.pdf" (Frontend) OR asks "Read file.pdf" (Chat).
2.  **Authentication**: Server confirms user is valid (via `DB:users` table check).
3.  **Authorization (The Critical Step)**:
    -   The server constructs an OpenFGA Check:
        `Check(user:123, relation:can_view, object:resource:file_999)`
    -   **OpenFGA** evaluates its graph of tuples.
        -   *Is user:123 the owner? Yes -> Allow.*
    -   **Result**: `ALLOWED`.
4.  **Data Retrieval**:
    -   Server queries **PostgreSQL**: `SELECT * FROM resources WHERE id=999`.
5.  **Response**: Data is sent to the user.

## 3. The "Granular" Redesign (Current State)
We recently shifted from a "Category-based" model to a "Granular" model.
-   **Old Way**: "You are a Viewer, so you see ALL files." (Too broad).
-   **New Way**: "You are a Viewer. You see NOTHING by default. You only see files you created (Owner) or files shared with you."
-   **Admin Exception**: Admins are "Super Users" handled by application logic (skipping OpenFGA checks or using a special wildcard permission).

## Summary
-   **PostgreSQL**: Holds the Data.
-   **OpenFGA**: Holds the Permissions.
-   **MCP**: Orchestrates the Logic.

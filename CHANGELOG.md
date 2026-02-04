# Changelog

All notable changes to the MCP Resource Manager project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added
- Initial public release of MCP Resource Manager
- PostgreSQL database integration for user and resource storage
- OpenFGA integration for fine-grained authorization
- Multi-adapter architecture (HTTP API, Chat Interface, Admin Dashboard)
- AI-powered natural language processing with Groq integration
- Pattern matching fallback for NLP when AI is unavailable
- Conversation memory system for context-aware chat interactions
- User management system with role-based access control (Owner, Admin, Editor, Viewer)
- Resource management with category-based organization
- Automatic group membership management for viewers and editors
- File-level permission control with OpenFGA tuples
- JWT-based authentication with cookie support
- Password hashing with bcrypt
- Admin dashboard web interface
- Chat interface for conversational resource management
- Comprehensive API endpoints for user and resource operations
- Database migrations system
- Utility scripts for maintenance and diagnostics
- OpenFGA authorization model with group-based permissions
- Automatic cleanup of orphaned FGA tuples on user deletion

### Security
- Implemented bcrypt password hashing
- JWT token-based authentication
- Cookie-based session management
- OpenFGA-first authorization (zero auth logic in UI)
- Protection against deleting default admin users
- Secure password change functionality

### Documentation
- Comprehensive README.md with quick start guide
- Detailed ARCHITECTURE.md explaining system design
- API documentation and usage examples
- Environment configuration guide
- Database schema documentation
- OpenFGA model documentation

## [0.9.0] - 2026-02-02

### Fixed
- Fixed admin access strategy to ensure admins see all resources
- Corrected resource visibility for editors (was checking 'viewer' instead of 'editor')
- Fixed login endpoint to return correct error messages
- Resolved database restoration issues
- Fixed role change persistence in database
- Eliminated duplicate tuple generation in role changes

### Changed
- Migrated from wildcard-based permissions to file-level permissions
- Updated OpenFGA model to support granular resource access
- Improved error handling in authentication endpoints
- Enhanced tuple cleanup on user deletion

## [0.8.0] - 2026-01-28

### Added
- Batch permission checks for improved performance
- File-level permission tuples for each resource
- Miscellaneous category for uncategorized resources

### Fixed
- Resolved orphaned tuples from deleted users
- Fixed access problems for specific user roles
- Cleaned up old wildcard permission data

### Changed
- Transitioned from category-based to granular permission model
- Optimized OpenFGA queries with batch operations

## [0.7.0] - 2026-01-23

### Fixed
- Fixed role change bug causing duplicate tuples
- Resolved database transaction rollback issues
- Fixed tuple deduplication logic

### Added
- Improved error messages for OpenFGA operations
- Enhanced logging for debugging permission issues

## [0.6.0] - 2026-01-21

### Added
- Conversational multi-step workflows for resource creation
- Conversational multi-step workflows for user creation
- Entity extraction from natural language
- Fuzzy matching for user and resource names
- Input validation for chat commands
- Context persistence and expiry for conversations

### Fixed
- Fixed `create_user` intent matching in NLP parser
- Improved prompt handling for missing information

## [0.5.0] - 2026-01-20

### Added
- Groq AI integration for intelligent intent parsing
- Natural language command processing
- Conversation history tracking
- Smart response generation with AI
- Fallback to pattern matching when AI unavailable

### Changed
- Enhanced chat interface with AI capabilities
- Improved user experience with natural language understanding

## [0.4.0] - 2026-01-17

### Added
- Admin dashboard UI with retro aesthetic
- User management interface
- Role assignment functionality
- Visual feedback for operations

### Changed
- Refined dashboard styling
- Improved button and badge aesthetics
- Consistent font weights across UI

## [0.3.0] - 2026-01-15

### Added
- Resource management API endpoints
- Category-based resource organization
- Resource creation and deletion
- Owner-based access control

### Changed
- Enhanced database schema for resources
- Improved error handling in API routes

## [0.2.0] - 2026-01-10

### Added
- User authentication system
- Login and registration endpoints
- Password change functionality
- JWT token generation
- Cookie-based session management

### Security
- Implemented secure password hashing
- Added authentication middleware
- Protected API endpoints with auth checks

## [0.1.0] - 2026-01-05

### Added
- Initial project setup
- PostgreSQL database integration
- OpenFGA server integration
- Basic user management
- Database initialization and seeding
- Express server with CORS support
- Environment configuration with dotenv
- Basic API structure

### Infrastructure
- TypeScript configuration
- Build and development scripts
- Database migration system
- OpenFGA model definition

---

## Release Notes

### Version 1.0.0 - Public Release

This is the first public release of MCP Resource Manager, a production-ready system for managing resources with fine-grained authorization. The system demonstrates modern authorization architecture using OpenFGA (inspired by Google's Zanzibar) and includes an AI-powered chat interface for natural language resource management.

**Key Highlights:**
- ✅ Production-ready authorization with OpenFGA
- ✅ AI-powered natural language interface
- ✅ Multiple access methods (API, Chat, Admin UI)
- ✅ Comprehensive security features
- ✅ Clean, maintainable codebase
- ✅ Full documentation

**Upgrade Notes:**
- This is the initial public release
- No upgrade path from previous versions

**Breaking Changes:**
- None (initial release)

---

[1.0.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v1.0.0
[0.9.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.9.0
[0.8.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.8.0
[0.7.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.7.0
[0.6.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.6.0
[0.5.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.5.0
[0.4.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.4.0
[0.3.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.3.0
[0.2.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-repo/MCP-Resource-Manager/releases/tag/v0.1.0

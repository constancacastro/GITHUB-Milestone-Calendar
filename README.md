# Project Overview
This project is a web application that integrates GitHub Milestones with the Google Calendar API, allowing authenticated users to create calendar events from repository milestones.

## Key Features
### Authentication: 
- Users must authenticate via google OpenID Connect, except on the authentication route.
### RBAC Access Control: Implemented with Casbin, supporting three roles:
- Free: Can only view GitHub Milestones;
- Premium: Can view Milestones and create Google Calendar events from them;
- Admin: Inherits all permissions from other roles
### Role Visibility: The active role is displayed in the application's UI.
### Session Management: Authentication state between browser and server is maintained via cookies.
### In Memory Storage: No datatbase is required - user info is kept in memory only.

## Technical Notes:
- The application interacts directly with the Google OAuth2 and GitHub API endpoints, without using official SDKs;
- PEPs
- HTML, CSS, JAVA, JAVASCRIPT

#### Project done in Cybersecurity Course at Instituto Superior de Engenharia de Lisboa (ISEL), with a group mate
  

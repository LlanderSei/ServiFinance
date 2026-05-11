Project Overview
This project is developed in partial fulfillment of the requirements for IT 16/L – Information Security 1.
This documentation presents the design, implementation, and security considerations of the proposed system.
Prepared by: [Your Name]
Submitted to: [Prof Name]
System Description
Provide a concise overview of the system, including its purpose and core functionality.
Example:
The system is designed to manage and monitor [insert system purpose, e.g., inventory, user data, transactions]. It enables users to perform core operations such as data entry, record management, and reporting, while ensuring data security through implemented policies and access control mechanisms.

Platform and Technologies Used
• Programming Language: (e.g., Java, Python, PHP, JavaScript, Lua)
• Framework / Environment: (e.g., Node.js, Django, Laravel, Roblox Studio)
• Database: (e.g., MySQL, PostgreSQL, MongoDB)
• Platform: (Web / Desktop / Mobile)

Security Policies
• Password Policy:
o Enforces strong passwords (minimum length, uppercase, lowercase, numbers, symbols).
o Requires periodic password updates.

• Login Attempt Policy:
o Limits failed login attempts (e.g., 3–5 attempts).
o Temporarily locks accounts after exceeding the limit.

• Data Handling Policy:
o Sensitive data is encrypted (e.g., passwords hashed).
o Access to data is restricted to authorized users only.

• Access Control Policy:
o System configuration is restricted to authorized roles (e.g., administrators).
o All access attempts are logged.

• Logging and Monitoring Policy:
o System activities (logins, changes, errors) are recorded.
o Logs are regularly reviewed for suspicious activity.

---

Incident Response Plan
• Detection:
Security incidents are identified through system logs, alerts, and monitoring tools.
• Reporting:
Incidents are reported to the system administrator or responsible authority immediately.
• Response:
Immediate actions are taken to contain and mitigate the issue (e.g., account suspension, system isolation).
• Recovery:
Restore system functionality and ensure data integrity.
• Review:
Conduct post-incident analysis to improve future security measures.

Code Auditing and Security Review
• Tool Used: State the auditing tool (e.g., SonarQube, built-in analyzer).
• Usage: Briefly explain how it was used to scan the code.
• Findings: List key issues or vulnerabilities detected.
• Fixes: Describe how issues were resolved (or why not).
• Proof: Include screenshots of the audit results.

Access Control (RBAC / ACL)
Intended Users
The system is designed for the following users:
• Administrators – Manage system settings, users, and overall configuration.
• Cashiers – Handle transactions and input operational data.
• Inventory Managers – Monitor and manage stock levels and records.
• Quality Assurance Testers – Evaluate system performance and ensure functionality.

Access Control Matrix
System Feature / Resource Guest User Administrator
View Homepage Allowed Allowed Allowed
User Registration Allowed Denied Denied
Login Allowed Allowed Allowed
User Dashboard Denied Allowed Allowed
Edit Profile Denied Allowed Allowed
Submit Data Denied Allowed Allowed
View Own Records Denied Allowed Allowed
View All Records Denied Denied Allowed
Manage Users Denied Denied Allowed
System Configuration Denied Denied Allowed
View Logs Denied Denied Allowed
Delete Records Denied Denied Allowed

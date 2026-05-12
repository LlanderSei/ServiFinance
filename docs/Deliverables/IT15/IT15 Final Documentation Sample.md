FINAL PROJECT DOCUMENTATION
NAME:
PROJECT TITLE: ServiFinance: A Multi-Tenant SaaS Service Management System with Embedded Micro-Lending
SUBJECT: IT15/L Integrative Programming and Technologies
CODE: 8466
TIME: 1:30 – 3:30 PM	
 
TOPIC (Type of Business Process):	#33 Service Management System
Products/Services:	SaaS platform for Service-Oriented MSMEs
Website/Deployed (Link):	https://servifinance.runasp.net

API/ALGO/MODEL: *Ex. SAP, PayMongo API, K-Nearest Neighbors (KNN)- ML Algo, etc. 

Security Features:  *Ex. Authentication and Authorization, Input Validation, Logging and Monitoring etc.
Target user/s:	Super Admins, Tenant Admins, Technicians/Dispatchers, Customers

Subs System / Management Transaction/Modules:
1. Service Request Handling
2. Scheduling & Dispatching
3. Service Tracking
4. Customer Feedback
5. Service Reporting

LOGO [has logo already]

Project Objectives:	
1.	Centralize Operations: To provide MSMEs with a single cloud-based platform to manage all service-related activities and customer interactions. 
2.	Ensure Data Privacy: To implement a robust multi-tenant architecture that strictly isolates business data between different subscribers. 
3.	Enhance Customer Trust: To improve service transparency through real-time tracking and a formal feedback loop. 
4.	Streamline Payments: To integrate secure digital payment workflows for completed service requests.


Project Description:
```
-Discuss the potential impact of the application on its users, organizations, or the broader community.

-Provide an overview of the technology stack or tools that will be used to develop the system application. This may include programming languages, frameworks, databases, and other software components.

-Briefly explain why these technologies were chosen and how they align with the project requirements.
```

ServiFinance targets Philippine MSMEs that operate on a service-request model. This includes computer repair shops, appliance centers, and specialty bakeries. These users require a system that eliminates manual scheduling errors and provides a professional web presence for their clients to track job progress. 

The application empowers small businesses by giving them "Enterprise-level" tools at a SaaS price point. It reduces operational overhead, minimizes paper-based tracking, and allows owners to make data-driven decisions based on automated service reports. 

The system is built on the .NET 10 ecosystem using Hybrid Web for a reactive web interface. Stripe was chosen for its reliability in handling both one-time service payments and recurring SaaS subscriptions. ImgBB is utilized to keep the database light by offloading image storage to a specialized CDN. These technologies were selected to ensure the system is scalable, secure, and maintainable. 

Type of Users/ Role-Based Access	servifinance.runasp.net:
1. System Administrator (Admin)
Username: superadmin@servifinance.com
Password: SuperAdmin123!

servifinance.runasp.net/t/exampledomain/:
2. Manager / Supervisor
Username: admin@example.com
Password: Admin123!
3. Employee
Username: staff@example.com
Password: All123123123!

Use Case Diagram: @docs/Use Cases/Use Case IT15 ServiFinance.png
Data Dictionary: @docs/Data Dic & ERD/data-dictionary.md

Entity Relational Diagram (ERD): @docs\Data Dict & ERD\servifinance-erd.sql

Prototype (Frontend):	SCREENSHOTS AND DESCRIPTION
•	Each prototype screen must include a clear screenshot – ALL Transactions.
•	Add a label name to each image.
Provide a brief description for each screen to guide users on its functionality and how to interact with it.

Prototype (Backend):
SCREENSHOTS AND DESCRIPTION (Source Code)
•	Each prototype screen must include a clear screenshot.
•	Add a label name to each image.
API/Algo Usage: Mention the APIs/Algos used and their specific role in the showcased functionality.

API FUNCTIONS/FEATURES:
SCREENSHOTS AND DESCRIPTION (Source Code)
•	Each prototype screen must include a clear screenshot.
•	Add a label name to each image.
Discuss the process on how it works.
	
SECURITY FEATURES:
SCREENSHOTS AND DESCRIPTION (Source Code)
•	Each prototype screen must include a clear screenshot.
•	Add a label name to each image.
Discuss the process on how it works.	



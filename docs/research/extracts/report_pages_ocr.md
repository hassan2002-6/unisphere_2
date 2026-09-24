########## FILE: ocr_pdfpage_029.txt ##########
﻿Figure 4.
• DATA FLOW DIAGRAM (DFD LEVEL 0)
DATA FLOW DIAGRAM (DFD LEVEL 0)
LEGEND
Intelligent Integrated Students SupFX)rt & Management System
Data
External Entity
STUDENT
TEACHER
• Data
Reistration Data
Login Credentia Is
Query Request
Info
Results / Marks
Chatbot Response
Login Credentia IS
Attmdm n put
Muks / Data
Pe Repo rts
Not i fi
ATTENDANCE
0
INTELLIGENT INTEGRATED
STUDENTS SUPPORT &
MANAGEMENT SYSTEM
Read / Write
RESULTS
• Marks Grades
• Pawn
DATA STORES
Login C redentiab
Data
Syste m Settings
An ts
Wes
Relevant Response
NOTIFICATIONS
ADMIN
A1 CHATBOT
(RAG SYSTEM)
BASE
(txxuMENT STORE)
15

########## FILE: ocr_pdfpage_030.txt ##########
﻿Figure 5: ITERATIVE AGILE CYCLE DIAGRAM
ITERATIVE AGILE DEVELOPMENT DIAGRAM
Intelligent Integrated Students Support & Management System
ITERATIVE SPRINT CYCLE
1 — 4 WQks
SPRINT
PLA NN NG
REVIEW
04
SPRINT
o
CONTINuous
3.4SUMMARY
Methodology used in Intelligent Integrated Students Support and Management System ensures
organized and flexible approach to software development. The combination
of agile and SDLC facilitates constant progress, user involvement, and successful
implementation of artificial intelligence-based features such as RAG Chabot system.
16

########## FILE: ocr_pdfpage_031.txt ##########
﻿CHAPTER 4
SOFTWARE REQUIREMENT SPECIFICATION (SRS)
An Intelligent Integrated Students Support & Management System
4.1 INTRODUCTION
The following Software Requirement Specification (SRS) document outlines
the Functional and Non-Functional Requirements of the Intelligent Integrated Students
Support & Management System. The purpose of the intelligent integrated students support &
management system is to have an integrated
system for managing academics and providing services as well as using A1 through various
technological advancements like web applications and Chabot.
4.2 PURPOSE OF THE SYSTEM
4.3 SCOPE OF THE SYSTEM
Components of the System include:
• Students' Information Management
• Student Attendance Management System
• Monitoring Student's Performance
• Chatbot (using RAG) •
• Notification & Alert System
• Administration Dashboard
• Teacher's Dashboard
17

########## FILE: ocr_pdfpage_032.txt ##########
﻿4.4 OVERALL DESCRIPTION
4.4.1 Product Perspective
This system will be implemented using either the web or even mobile technologies, which
integrate A1 services into a conventional student management system
4.4.2 Product Functions
• Student registration/profile creation
• Attendance recording and tracking
• Calculation of students' exam marks and GPAs
• Students' A1 Chatbot •
• Notification (via email/SMS/App)
4.4.3 User Classes
User Type
Students
Teachers
Admin
Description
Access academic records, attendance, chatbot support
Manage attendance, marks, and student performance
Full system control and reporting
4.4.4 Operating Environment
4.4.5 Constraints
• Requires internet connection
• Secure login will be required for all users.
• Restricted access according to user roles• Web browser (Chrome, Firefox, Edge)
• Server: Cloud or Local server
• Back end: Python / Node.js
• Database: MySQL / PostgreSQL
• A1 Model: Integrating RAG-based models
8

########## FILE: ocr_pdfpage_033.txt ##########
﻿4.4.6 Assumptions
• Needs internet connectivity
• Secure sign-in will be needed by all users
• Limited access depending on user roles
• Data Privacy
4.5 Functional Requirements
4.5.1 Student Module
• Login/Register • Attendance View
• Check marks/Results
• Chat with the A1 Chatbot
• Receive notifications
4.5.2 Teacher Module
• Login/Register • Attendance View
• Check marks/Results
• Chat with the A1 Chatbot
• Receive notifications
4.5.3 A1 Chatbot Module (RAG System)
Responding to students' queries using stored academic information
• Offer instant assistance
• Gather important documentation
• Machine learning from dataset for better responses
4.6 Non-Functional Requirements
4.6.1 Performance• The system must reply within 2—3 seconds • Multiple user requests to be
handled simultaneously
4.6.2 Security
• Role-based authentication
• Passwords should be kept encrypted
19

########## FILE: ocr_pdfpage_042.txt ##########
﻿Field
Date
status
Table: Results
Type
DATE
VARCHAR
Field
Result ld
Student ld
subject
marks
Type
INT
INT
VARCHAR
INT
Description
Attendance Date
Present/Absent
Description
Primary Key
Foreign Key
Subject Name
Obtained Marks
Table: Chatbot Queries
Field
Query ld
Student ld
Question
response
Type
INT
INT
TEXT
TEXT
Description
Primary Key
Foreign Key
User Query
A1 Response
28

########## FILE: ocr_pdfpage_043.txt ##########
﻿5.5 Class Diagram
CLASS DIAGRAM
Intelligent Students Support & Management System
29

########## FILE: ocr_pdfpage_047.txt ##########
﻿5.10 Summary 5.10.1
Software Design Specification (SDS) of Intelligent Integrated Students Software Design
Specification (SDS) of Intelligent Integrated Students Support & Management System
represents the overall structure of the system, from its architecture to its database, modules,
and process flow. It makes the system scalable and highly secure and efficient with
excellent integration of A1 powered support through RAG model.
33

########## FILE: ocr_pdfpage_048.txt ##########
﻿CHAPTER 6
DISCUSSION AND CONCLUSION
An Intelligent Integrated Students Support & Management System
6.1 Discussion
The development of the Intelligent Integrated Students Support and Management System is
a good example of how new technologies such as web application, database, and Artificial
Intelligence (A1) have been used efficiently for improving educational management. The
integration of several academic roles on the same platform helps avoid inefficiency
associated with the use of manual systems. The introduction of an A1-powered RAG chatbot
makes this system much more efficient because the chatbot provides intelligent answers to
student questions.
6.1.1 Key Findings
• The system of manually managing students is inefficient and time-consuming.
• Quick reaction times through better management of students through A1
• Better data management ensures that there are fewer errors and that data access is easier
• Fewer efforts required from teachers due to automation
• Accessing academic data in real-time leads to better academic performance of the students
6.1.2 System Strengths
• Integrated platform to assist students
• Artificial Intelligence chatbot for instant academic assistance
• Role-based access control (Student, Teacher, Administrator)
• Modular design which can be scaled
• Real time alerting and reporting system
6.1.3 Limitations
• Reliable internet connection is essential
• Depends on data set quality for chatbot effectiveness
• Maintenance and upgrades necessary
34

########## FILE: ocr_pdfpage_049.txt ##########
﻿6.1.4 Challenges Faced
• Creating an efficient artificial intelligence system that provides answers (RAG model)
• Integrating all modules to form one unit
• Ensuring data security and privacy
• Optimizing the efficiency of multi-users system
6.2 Conclusion
In conclusion, the Intelligent Integrated Students Support & Management System is
effective because it successfully achieves its objective of ensuring that there is an
intelligent and efficient academic management system through automation of all processes.
Instead of using old manual processes, the new software ensures there is better
communication between the students, tutors, and management of the institutions.
Overall, the project provides a demonstration on how artificial intelligence can be used
together with software engineering in education to enhance efficiency.
6.3 Future Enhancements
Other features that may further improve the efficiency of the system include the following:
• Mobile application for Android and iOS devices
• Predictive A1 analysis of students' results
• Attendance through biometrics
• Voice-enabled A1 chatbot assistance
• LMS integration
• Scalability on the cloud platform
35

########## FILE: ocr_pdfpage_057.txt ##########
﻿Appendix E: Testing Sample
E.I Unit Testing
Validation of login
Checking for test attendance
Calculation of exam grades
E.2 Integration Test
Database and backend integration
Chatbot and database responses comparison
E.3 System Test
Workflow of system tested end to end
Multi-user test
Appendix F: Example Input and Output
F.l Example of Input
ID = 101 • Question = "What marks did I score in my recent exam?"
F.2 Example of Output • Mathematics — 85 • Physics — 78
Computer Science — 90Appendix G: Summary of Appendices
43

########## FILE: ocr_pdfpage_058.txt ##########
﻿Appendix
c
D
Final Note
Description
System Flow Diagram
Database Schema (ER Diagram)
User Interface Overview
A1 Chatbot Workflow
Testing Procedures
Sample Inputs & Outputs
The appendices contain technical information related to the Intelligent Integrated Students Support & Management System
such as the system flow, database schema, A1 chatbot model, and test reports. All these parts contribute to understanding
and implementing the project in general.
44

########## FILE: ocr_pdfpage_059.txt ##########
﻿SURVEY FEEDBACK
1. What is your current semester?
74 responses
108%
2. What is your department?
71 responses
10.0
7.5
50
3 (4.2%)
2.5
14.9%
13.5%
A1
Bachelor In Software.
Bscs
01
02
04
05
06
07
08
9 (12
2 (2.8%) 2
2 (2.8%)
Department of Enginv.. Pharmacy 9th Semster
BS Supply Chain Ma.
Bs security Computer Science Management science
Software engi...
45

########## FILE: ocr_pdfpage_060.txt ##########
﻿Academic Challenges
3.Do you face difficulties in course selection and understanding prerequisites?
74 responses
3506
366%
4. Have you ever faced timetable or exam clashes?
74 responses
54
44.6%
Yes
No
O Sometimes
yes
Yes
yes

########## FILE: ocr2/ocr_pdfpage_026.txt ##########
﻿3.3 DIAGRAMS
Figure 1: AGILE DEVELOPMENT WORKFLOW DIAGRAM
AGILE DEVELOPMENT WORKFLOW
Iterative •
DEPLOYMENT
Deploy nn i n g
PRODUCT
o' features
req
REVIEW & FEEDBACK
Incremental • Collatx•rative
REQUIREMENT
ANALYSIS
the
AGILE
ITERATION
(SPRINT)
0
SPRINT
PLANNING
man tasks,
effort and define
SYSTEM DESIGN
TESTING
mplæt
COLLABORATION & COMMUNICATION
between
RELEASE / DELIVERY
ttw
approved i
4
.11
MAINTENANCE &
CONTINUOUS IMPROVWENT
Monitor fix issues
and
for next sp rint_
12

########## FILE: ocr2/ocr_pdfpage_027.txt ##########
﻿Figure 2:
SDLC MODEL DIAGRAM
SDLC MODEL DIAGRAM
Software Development Life Cycle
REQUIREMENT
ANALYSIS
Gather and
EVALUATION
Evaluate the system
performance and
plan
MAINTENANCE
Maintain the system,
nx issues and inprove
.11
06
SDLC
Software Development
Life Cycle
05
DEPLOYMENT
Deploy the
the
SYSTEM DESIGN
Design system
a rchitect
interfaces and modules.
IMPLEMENTATION
Write a
to the
Test the system
errors, functionality
and performa•re.
SDLC an iterative process used by teams to
and maintain high quality software systems.
13

########## FILE: ocr2/ocr_pdfpage_028.txt ##########
﻿Figure 3.
• SYSTEM ARCHITECTURE DIAGRAM
Ma rug—t
n t portal
we / Mobile
CLIENT LAYER
Portal
HTTPS/REST AP'
API GATEWAY
Ad min portal
web
EXTERNAL
Authentkatim (JM) • (RBAC) • Rate
APPLICATION / MICROSE
Result
DATA A1 LAYER
•
INFRASTRUCTURE LAYER
• Request R«.ting
•
• LLN
Data
/ Response
14

########## FILE: ocr2/ocr_pdfpage_039.txt ##########
﻿Figure 5.1: System Architecture Diagram
SYSTEM ARCHITECTURE DIAGRAM
Intelligent Integrated Students Support & Management System
STUDENT PORTAL
Mobil.
CLIENT LAYER
TEACHER RJRTAL
HTTPS/REST AP'
AP' GATEWAY & SECURITY LAYER
SERVICE LAYER
DATA ACCESS LAYER
DATA LAYER (DATABASES STORAGE)
RE LAYER
ADMIN PORTAL
EXTERNAL SERVICES
LLM
25

########## FILE: ocr2/ocr_pdfpage_040.txt ##########
﻿5.3 Module Design
The system is divided into several functional modules:
5.3.1 Student Module
Students Sign Up & Sign In
• Can view attendance logs
• marks and results will be verified
.AI Chat Bot
•Notifications
5.3.2 Teacher Module
• Handling Attendance
• Uploading Examination Results
• Evaluating students' performance
• Interaction with students
5.3.3 Admin Module
5.3.4 A1 Support Module (RAG System)
• Management of users for students and teachers
• Configuration of the system
• Generating reports
• Security management of data
5.4 Database Design
Answering questions posed by students regarding their academics
• Retrieving necessary documentation
• Making intelligent suggestions
• Enhancing answers through knowledge database
26

########## FILE: ocr2/ocr_pdfpage_041.txt ##########
﻿5.4.1 Main Tables
Table: Students
Field
Studentld
name
email
password
department
Type
INT
VARCHAR
VARCHAR
VARCHAR
VARCHAR
Table: Teachers
Field
Teacher ld
name
email
department
Type
INT
VARCHAR
VARCHAR
VARCHAR
Table: Attendance
Field
Attendance ld
Student ld
Type
INT
INT
Description
Primary Key
Student Name
Login Email
Encrypted Password
Department
Description
Primary Key
Teacher Name
Login Email
Department
Description
Primary Key
Foreign Key
27

########## FILE: ocr2/ocr_pdfpage_044.txt ##########
﻿5.6 Sequence Diagram (Student Interaction with A1 Chatbot)
Figure 5.4: Sequence Diagram
SEQUENCE DIAGRAM
(Student Interaction with A1 Chatbox)
w.b Mobil.
/ FAISS)
0K
(Top K)
10.
LEGEND
4 , • to
30

########## FILE: ocr2/ocr_pdfpage_045.txt ##########
﻿5.7 Data Flow Diagram (DFD Level 1)
Figure 5.5: DFD Level 1
TEACHER
ADMIN
DATA FLOW DIAGRAM (DFD) - LEVEL 1
Intelligent Integrated Students Support & Management System With A1 Chatbot (RAG)
(RAG)
/ Logs
DATA STORES
31

########## FILE: ocr2/ocr_pdfpage_046.txt ##########
﻿5.8 User Interface Design
The Support and Management System is an application that provides a complete framework
with the following interfaces:
• Login Form
• Student Dashboard
• Teachers' Dashboard
• Admin Dashboard
• A1 Chatbot Interface
These interfaces should be:
• User friendly
• Responsive (Desktop + Mobile)
• Based on roles
5.9 Design of System Security
• Password hashing (encryption)
• Role-based Access Control (RBAC)
• Security for API access (JSON web tokens/OAuth)
• Data backup and restoration
32

########## FILE: ocr2/ocr_pdfpage_061.txt ##########
﻿5. Do you clearly understand university academic policies?
74 responses
Yes
No
Partially
NO
-1 (14%)
-15 (200%)
20
-25 (33.8%)
30
Frequently
Sometimes
Rarely
O Never
34 (45.9%)
40
10
6. How often do you face academic confusion?
71 responses
592%
254%
14.1%
47

########## FILE: ocr2/ocr_pdfpage_062.txt ##########
﻿7. What problem affects you the most?
71 responses
Course selection
Timetable clashes
Faculty information
Failed course management
Audemic
System Features Feedback
-19 (268%)
-17 (23.9%)
20
-29 (40.8%)
-35 (49.3%)
32 (45.1%)
10
30
8. Do you think students should have a say in elective course selection (via
voting/polling)?
74 responses
Yes
O No
yes
108%
8T8%
40
48

########## FILE: ocr2/ocr_pdfpage_063.txt ##########
﻿9. Do you currently use multiple platforms for university services?
71 responses
437%
56.3%
O Yes
10. Do you think a centralized system would improve efficiency?
71 responses
451%
127%
42.3%
Strongly Agree
O Agree
Neutral
Disagree
O Strongly Disagree
49

########## FILE: ocr2/ocr_pdfpage_064.txt ##########
﻿Feature Usefulness Rating
11. How useful do you find the following features?
40
20
Course planning
Alumni Mentorship
Tmetable clash
detection
Faculty reviews
Carge system
Complaint system
A1 chattN)t
12. Would you use our platform that connects you directly with alumni mentors?
71 responses
23.9%
18.3%
7%
7%
Very Likely
Likely
Unlikely
Very Unlikely
Yes
Sometimes
No
50

########## FILE: ocr2/ocr_pdfpage_065.txt ##########
﻿13. Do you believe alumni mentorship can help in internships or job preparation?
71 responses
21.1%
183%
9.9%
45 MYO
Events & Activities
14. Do you feel university events are properly communicated?
71 responses
366%
Sometimes
28.2%
O Strongly Agree
Agree
Disagree
Strongly Disagree
Yes
O No
Sometimes
51

########## FILE: ocr2/ocr_pdfpage_066.txt ##########
﻿15. Would you prefer a centralized event registration system?
71 responses
127%
87.3%
Overall Feedback
16. Would you use this platform if implemented?
74 responses
243%
716%
Yes
O No
Yes
52

########## FILE: ocr2/ocr_pdfpage_067.txt ##########
﻿17. Rate this project idea:
74 responses
30
20
10
3 (41%)
1 (1.4%)
2
18 (24.3%)
3
29 (39.2%)
4
23 (31%)
5
18. Which feature do you like most?
74 responses
None
Idk
Ai chatbot
Timetable clash
Check and balance questions
Faculty review detection, A1 chatbot

########## FILE: ocr2/ocr_pdfpage_068.txt ##########
﻿19. Any suggestions?
74 responses
no
Administration should be improved.
The issue is that the I-MS lacks a notification system, which has caused me to miss several deadlines.
Could you please consider adding a reminder or notification function to the platform's features? This would
greatly help students stay on track
To improve, it could add more personalization features and enhance performance, security, and real-time
interaction for better user engagement.
A separate module pf alumni can be added where they can help current students to find internships and
jobs and another module can be added where student who face difficulty in any course can take help from
another student fellow by paying them fee and can also rent out notes and books or any hardware
equipment and also they can find their fyp partner through this portal.
54

########## FILE: ocr_pdfpage_035.txt ##########
﻿4.8 System Architecture Overview
SYSTEM ARCHITECTURE OVERVIEW
Intelligent Integrated Students Support & Management System
• Kith
• & Login
CLIENT LAYER
Tea Cher
HTTPS / REST Apt
API GATEWAY & SECURITY LAYER
APPLICATION SERVICE LAYER
00 DATA ACCESS LAYER ORM)
DATA LAYER
INFRASTRUCTURE LAYER
• Input
Admin
• CORS &
EXTERNAL SERVICES
LEGEND
21

########## FILE: ocr_pdfpage_036.txt ##########
﻿4.9 Data Flow Overview (DFD Level 0)
DATA FLOW DIAGRAM (DFD LEVEL 0)
Intelligent Integrated Students Support & Management System
STUDENT
• with AJ
TEACHER
Login
nag—t Dat.
System
/ Amtytiø
Atterdance nfo
/ MUks
/ Rw_'lts
ATTENDANCE DB
0
INTELLIGENT INTEGRATED
STUDENTS SUPPORT &
MANAGEMENT SYSTEM
RESULTS DB
A1 CHATBOT
(RAG SYSTEM)
BASE
Note: The system data from Students. Teachers prxesses it and stores&etrÉves it
from data N Chatbot the Base to provi&
Extemal Entity
Data
LLM /
22

########## FILE: ocr_pdfpage_053.txt ##########
﻿APPENDICES
An Intelligent Integrated Students Support & Management System
Appendix A: System Flow Overview
The system functions based on a well-defined process.
OVERALL SYSTEM FLOW DIAGRAM
Intelligent Students Support & Management System with A1 Chatbot (RAG)
Student
(VI— data,
ask
Admin
• Hi stMy
DATA SERVICES LAYER
EXTERNAL SERVICES
ONTEGRAT'ONS)
(AWS / GCP)
Login Failed
Module
• GPA / CGPA
• AttendÄ.
START
cation
Login / Reg istration
Aut cation
Role d
(Role
• Details
• R„ipts
LLU / A1 Model
(Ope.AI / L etc.)
A1
(With Relevant Context)
Sm Ciut Hist«y & Logs
(Chat History
Respon Se
to user
END
• Get A
•
End
Main
Data /
39

########## FILE: ocr_pdfpage_054.txt ##########
﻿Appendix B: Sample Database Schema
Figure A.2: Database Relationship Overview
SAMPLE DATABASE SCHEMA
Intelligent Integrated Students Support & Management System with A1 (RAG)
40

########## FILE: ocr_pdfpage_055.txt ##########
﻿Appendix C: Sample User Interfaces
C.I Login page • Login page is secured for students, teachers and admins
• Login is done using role-based authentication
C.2 Student Dashboard:
Attendance view
Result checking
Access to Chatbots
Notification regarding Shading
C.3 Teacher's Dashboard
Attendance Management
Mark entry Of students
C.4 Users Management Of Admin Panel
System Reports
Admin Panel Database
41

########## FILE: ocr_pdfpage_056.txt ##########
﻿Appendix D: A1 Chatbot Overview (RAG System)
The A1 chatbot is the brain behind the system.
Features :
Answers students' academic questions
Retrieves information from the database
Contextually Relevant answers
Accurate responses using the RAG approach
Figure A.3: A1 Chatbot Flow
A1 CHATBOX FLOW
(RAG Based Intelligent Assistant)
1. user (Student)
Stu
C hatbo
2. Aut
& Authoriz at-ion
9. Send Response
in
3. Query
8. Response Post-
FLOW SUMMARY
Em bedding
qwy
7. LLM (A1 Model)
LLM
5. Vector Seuch
(Similarity
reh
6.
11. &
10
Dat
(Embed s)
Main
42


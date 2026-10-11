/**
 * UniSphere seed — idempotent (upsert by natural keys). Plan §11 M1 + §6.1.
 * Run from packages/db:  bun run seed
 *
 * Seeds: 5-role demo users, BSCS degree plan, courses/timetable with one
 * deliberate clash pair, exams (incl. a clash demo), labs, GPU inventory,
 * form templates, internships, knowledge corpus, mentors, and sample flows.
 */
import { prisma, type Prisma } from "../src/index";

const SEED_PREFIX = "seed:";

async function upsertUser(data: {
  email: string;
  name: string;
  role: "STUDENT" | "FACULTY" | "COORDINATOR" | "FYP_HEAD" | "MENTOR" | "ADMIN";
  department?: string;
  registrationNo?: string;
  employeeId?: string;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    // IDs are part of the identity — re-seeding must correct stale ones too.
    update: { name: data.name, role: data.role, registrationNo: data.registrationNo, employeeId: data.employeeId },
    create: { ...data, clerkId: `${SEED_PREFIX}${data.email}` },
  });
}

async function main() {
  console.log("── UniSphere seed ─────────────────────────────");

  // ── Users (5 roles; demo logins for the FYP-II defence) ────────────────
  const student = await upsertUser({
    email: "student@shu.edu.pk",
    name: "Ali Raza",
    role: "STUDENT",
    department: "Computer Science",
    registrationNo: "S22CSC001",
  });
  const student2 = await upsertUser({
    email: "student2@shu.edu.pk",
    name: "Sara Khan",
    role: "STUDENT",
    department: "Computer Science",
    registrationNo: "S22CSC002",
  });
  const faculty = await upsertUser({
    email: "faculty@shu.edu.pk",
    name: "Dr. Ateeque Rahman",
    role: "FACULTY",
    department: "Computer Science",
    employeeId: "FAC001",
  });
  const faculty2 = await upsertUser({
    email: "faculty2@shu.edu.pk",
    name: "Dr. Sana Tariq",
    role: "FACULTY",
    department: "Computer Science",
    employeeId: "FAC002",
  });
  await upsertUser({
    email: "coordinator@shu.edu.pk",
    name: "Ms. Hina Qureshi",
    role: "COORDINATOR",
    department: "Examinations & Coordination",
    employeeId: "COORD001",
  });
  const fypHead = await upsertUser({
    email: "fyphead@shu.edu.pk",
    name: "Prof. Kamran Ali",
    role: "FYP_HEAD",
    department: "Computer Science",
    employeeId: "FYP001",
  });
  const mentorUsers = await Promise.all(
    [
      ["mentor@shu.edu.pk", "Engr. Danish Iqbal", "ALU001"],
      ["mentor2@shu.edu.pk", "Ms. Ayesha Noor", "ALU002"],
      ["mentor3@shu.edu.pk", "Mr. Bilal Ahmed", "ALU003"],
    ].map(([email, name, employeeId]) =>
      upsertUser({ email, name, role: "MENTOR", department: "Alumni — Software Engineering", employeeId }),
    ),
  );

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: { section: "A" },
    create: { userId: student.id, semester: 7, batch: "BSCS-2023", section: "A", program: "BSCS" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: student2.id },
    update: { section: "A" },
    create: { userId: student2.id, semester: 7, batch: "BSCS-2023", section: "A", program: "BSCS" },
  });
  await prisma.facultyProfile.upsert({
    where: { userId: faculty.id },
    update: {},
    create: { userId: faculty.id, designation: "Assistant Professor", office: "F-214" },
  });
  await prisma.facultyProfile.upsert({
    where: { userId: faculty2.id },
    update: {},
    create: { userId: faculty2.id, designation: "Lecturer", office: "F-210" },
  });

  const mentorProfiles: [string, string, string[], string][] = [
    ["mentor@shu.edu.pk", "Senior Software Engineer @ Systems Ltd", ["Backend", "Node.js", "System Design"], "8 years building fintech backends; mentors final-year projects."],
    ["mentor2@shu.edu.pk", "Data Scientist @ Afiniti", ["Machine Learning", "Python", "NLP"], "Works on customer-intent models; loves teaching MLOps basics."],
    ["mentor3@shu.edu.pk", "Product Manager @ 10Pearls", ["Product", "Agile", "Career Growth"], "Helps students convert internships into full-time offers."],
  ];
  for (let i = 0; i < mentorUsers.length; i++) {
    const [email, headline, expertise, bio] = mentorProfiles[i];
    await prisma.mentorProfile.upsert({
      where: { userId: mentorUsers[i].id },
      update: { headline, expertise, bio, isApproved: true },
      create: {
        userId: mentorUsers[i].id,
        headline,
        expertise,
        bio,
        company: email.includes("afiniti") ? "Afiniti" : email.includes("10pearls") ? "10Pearls" : "Systems Ltd",
        isApproved: true,
      },
    });
  }

  // ── Degree plan (BSCS, 8 semesters) ────────────────────────────────────
  const plan: [number, string, string, number, string][] = [
    [1, "CS-101", "Introduction to Computing", 3, "Core"],
    [1, "MA-101", "Calculus & Analytical Geometry", 3, "Math"],
    [1, "SS-101", "English Composition", 3, "General"],
    [1, "CS-102", "Programming Fundamentals", 4, "Core"],
    [1, "PH-101", "Applied Physics", 3, "Science"],
    [2, "CS-201", "Object Oriented Programming", 4, "Core"],
    [2, "MA-201", "Linear Algebra", 3, "Math"],
    [2, "CS-202", "Digital Logic Design", 3, "Core"],
    [2, "SS-201", "Communication Skills", 3, "General"],
    [2, "MA-202", "Discrete Structures", 3, "Math"],
    [3, "CS-301", "Data Structures & Algorithms", 4, "Core"],
    [3, "CS-302", "Database Systems", 4, "Core"],
    [3, "CS-303", "Computer Organization & Assembly", 3, "Core"],
    [3, "MA-301", "Probability & Statistics", 3, "Math"],
    [3, "SS-301", "Technical Writing", 3, "General"],
    [4, "CS-401", "Operating Systems", 4, "Core"],
    [4, "CS-402", "Computer Networks", 4, "Core"],
    [4, "CS-403", "Software Engineering", 3, "Core"],
    [4, "CS-404", "Theory of Automata", 3, "Core"],
    [4, "SS-401", "Professional Ethics", 3, "General"],
    [5, "CS-501", "Artificial Intelligence", 4, "Core"],
    [5, "CS-502", "Web Technologies", 3, "Core"],
    [5, "CS-503", "Design & Analysis of Algorithms", 3, "Core"],
    [5, "CS-504", "HCI", 3, "Elective"],
    [5, "CS-505", "Mobile App Development", 3, "Elective"],
    [6, "CS-601", "Machine Learning", 4, "Core"],
    [6, "CS-602", "Compiler Construction", 3, "Core"],
    [6, "CS-603", "Cloud Computing", 3, "Elective"],
    [6, "CS-604", "Information Security", 3, "Core"],
    [6, "CS-605", "Data Visualization", 3, "Elective"],
    [7, "CS-701", "Deep Learning", 4, "Elective"],
    [7, "CS-702", "Distributed Systems", 3, "Elective"],
    [7, "CS-703", "FYP-I", 3, "Project"],
    [7, "CS-704", "Entrepreneurship", 3, "General"],
    [7, "CS-705", "Natural Language Processing", 3, "Elective"],
    [8, "CS-801", "FYP-II", 3, "Project"],
    [8, "CS-802", "DevOps & Site Reliability", 3, "Elective"],
    [8, "CS-803", "Blockchain Technologies", 3, "Elective"],
    [8, "CS-804", "Professional Practices", 3, "General"],
    [8, "CS-805", "Internship Report", 2, "Project"],
  ];
  for (const [semester, courseCode, title, credits, category] of plan) {
    await prisma.degreePlanCourse.upsert({
      where: { program_semester_courseCode: { program: "BSCS", semester, courseCode } },
      update: { title, credits, category },
      create: { program: "BSCS", semester, courseCode, title, credits, category },
    });
  }
  console.log(`✓ degree plan: ${plan.length} courses`);

  // ── Courses + timetable (with ONE deliberate clash pair) ───────────────
  // Clash: CS-305 (Mon 10:00–11:30, Lab 3) vs CS-401 (Mon 10:30–12:00, Lab 3)
  //        → room clash (same room, overlapping time) for the coordinator view.
  const courses: {
    courseCode: string;
    title: string;
    section: string;
    department: string;
    semester: string;
    credits: number;
    facultyId?: string;
    slots: { day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"; startMin: number; endMin: number; room?: string; labNumber?: string }[];
    exams: { courseTitle: string; date: string; startMin: number; endMin: number; hall: string }[];
  }[] = [
    {
      courseCode: "CS-301",
      title: "Data Structures & Algorithms",
      section: "A",
      department: "CS",
      semester: "Fall 2026",
      credits: 4,
      facultyId: faculty.id,
      slots: [
        { day: "MON", startMin: 540, endMin: 660, room: "A-201" },
        { day: "WED", startMin: 540, endMin: 660, room: "A-201" },
      ],
      exams: [{ courseTitle: "DSA — Final", date: "2026-12-15", startMin: 540, endMin: 660, hall: "Hall A" }],
    },
    {
      courseCode: "CS-302",
      title: "Database Systems",
      section: "A",
      department: "CS",
      semester: "Fall 2026",
      credits: 4,
      facultyId: faculty2.id,
      slots: [
        { day: "TUE", startMin: 540, endMin: 660, room: "A-105" },
        { day: "THU", startMin: 540, endMin: 660, room: "A-105" },
      ],
      exams: [{ courseTitle: "DB Systems — Final", date: "2026-12-17", startMin: 540, endMin: 660, hall: "Hall B" }],
    },
    {
      courseCode: "CS-305",
      title: "Advanced Web Engineering",
      section: "A",
      department: "CS",
      semester: "Fall 2026",
      credits: 3,
      facultyId: faculty.id,
      slots: [{ day: "MON", startMin: 600, endMin: 690, labNumber: "3" }],
      exams: [{ courseTitle: "Web Engineering — Final", date: "2026-12-21", startMin: 540, endMin: 660, hall: "Hall A" }],
    },
    {
      courseCode: "CS-401",
      title: "Operating Systems",
      section: "A",
      department: "CS",
      semester: "Fall 2026",
      credits: 4,
      facultyId: faculty2.id,
      slots: [
        { day: "MON", startMin: 630, endMin: 750, labNumber: "3" },
        { day: "FRI", startMin: 540, endMin: 660, room: "A-201" },
      ],
      exams: [{ courseTitle: "OS — Final", date: "2026-12-23", startMin: 540, endMin: 660, hall: "Hall B" }],
    },
    {
      courseCode: "CS-402",
      title: "Computer Networks",
      section: "A",
      department: "CS",
      semester: "Fall 2026",
      credits: 4,
      facultyId: faculty.id,
      slots: [{ day: "WED", startMin: 660, endMin: 780, room: "A-105" }],
      exams: [{ courseTitle: "Networks — Final", date: "2026-12-28", startMin: 540, endMin: 660, hall: "Hall A" }],
    },
    {
      courseCode: "SE-310",
      title: "Software Engineering",
      section: "A",
      department: "SE",
      semester: "Fall 2026",
      credits: 3,
      facultyId: faculty2.id,
      slots: [{ day: "THU", startMin: 660, endMin: 780, room: "A-301" }],
      exams: [{ courseTitle: "Software Engineering — Final", date: "2027-01-05", startMin: 540, endMin: 660, hall: "Hall C" }],
    },
  ];

  const labDefs: [string, string, number, string][] = [
    ["Programming Lab", "1", 40, "Computing"],
    ["Networks Lab", "2", 30, "Networking"],
    ["AI/ML Lab", "3", 25, "GPU"],
    ["Database Lab", "4", 35, "Computing"],
  ];
  const labs = await Promise.all(
    labDefs.map(([name, number, capacity, type]) =>
      prisma.lab.upsert({
        where: { id: `lab-${number}` },
        update: { name, capacity, type },
        create: { id: `lab-${number}`, name, number, capacity, type },
      }),
    ),
  );
  const labByNumber = new Map(labs.map((l) => [l.number, l]));

  for (const c of courses) {
    const existing = await prisma.courseClass.findFirst({
      where: { courseCode: c.courseCode, section: c.section, semester: c.semester },
    });
    const cls =
      existing ??
      (await prisma.courseClass.create({
        data: {
          courseCode: c.courseCode,
          title: c.title,
          section: c.section,
          department: c.department,
          semester: c.semester,
          credits: c.credits,
          facultyId: c.facultyId,
        },
      }));
    if (!existing) {
      for (const s of c.slots) {
        await prisma.timetableSlot.create({
          data: {
            classId: cls.id,
            day: s.day,
            startMin: s.startMin,
            endMin: s.endMin,
            room: s.room ?? (s.labNumber ? `Lab ${s.labNumber}` : null),
            labId: s.labNumber ? labByNumber.get(s.labNumber)?.id : null,
          },
        });
      }
      for (const e of c.exams) {
        await prisma.examSchedule.create({
          data: {
            classId: cls.id,
            courseTitle: e.courseTitle,
            date: new Date(e.date + "T00:00:00Z"),
            startMin: e.startMin,
            endMin: e.endMin,
            hall: e.hall,
          },
        });
      }
    }
  }
  console.log(`✓ courses: ${courses.length} (incl. 1 deliberate room clash pair on Monday)`);

  // ── GPU / resource inventory (as prototyped) ───────────────────────────
  const gpus: [string, string, "GPU" | "WORKSTATION", string, number, number][] = [
    ["NVIDIA GeForce RTX 4090", "RTX 4090", "GPU", "24 GB GDDR6X · CUDA 8.9 · 16384 cores", 2, 2],
    ["NVIDIA GeForce RTX 4080", "RTX 4080", "GPU", "16 GB GDDR6X · CUDA 8.9", 2, 2],
    ["NVIDIA GeForce RTX 3090", "RTX 3090", "GPU", "24 GB GDDR6X · CUDA 8.6", 4, 3],
    ["NVIDIA A100", "A100", "GPU", "40 GB HBM2 · data-center class", 1, 1],
    ["NVIDIA H100", "H100", "GPU", "80 GB HBM3 · flagship (reserved for FYP-II demos)", 1, 1],
    ["AI Workstation WS-1", "WS-1", "WORKSTATION", "Threadripper + RTX 4090 + 128 GB RAM", 2, 2],
  ];
  const resources = [];
  for (const [name, model, type, specs, quantity, available] of gpus) {
    const existing = await prisma.resource.findFirst({ where: { model } });
    resources.push(
      existing
        ? await prisma.resource.update({ where: { id: existing.id }, data: { name, specs, quantity, available } })
        : await prisma.resource.create({ data: { name, model, type, specs, quantity, available } }),
    );
  }
  console.log(`✓ resources: ${resources.length} (GPU inventory)`);

  // ── Form templates (student + faculty sets) ────────────────────────────
  const templates: Prisma.FormTemplateCreateInput[] = [
    {
      key: "course-withdrawal",
      title: "Course Withdrawal Request",
      description: "Withdraw from a course within the allowed window.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 3,
      fields: [
        { name: "courseCode", label: "Course code", type: "text", required: true },
        { name: "reason", label: "Reason", type: "textarea", required: true },
      ],
    },
    {
      key: "transcript-request",
      title: "Transcript Request",
      description: "Request an official or unofficial transcript.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Examination Cell",
      slaDays: 5,
      fields: [
        { name: "purpose", label: "Purpose", type: "text", required: true },
        { name: "type", label: "Transcript type", type: "select", options: ["Official", "Unofficial"], required: true },
      ],
    },
    {
      key: "leave-application",
      title: "Leave Application",
      description: "Apply for medical or personal leave.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 2,
      fields: [
        { name: "fromDate", label: "From", type: "date", required: true },
        { name: "toDate", label: "To", type: "date", required: true },
        { name: "reason", label: "Reason", type: "textarea", required: true },
      ],
    },
    {
      key: "internship-noc",
      title: "Internship NOC Request",
      description: "Apply for a No Objection Certificate for an internship.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 3,
      fields: [
        { name: "company", label: "Company", type: "text", required: true },
        { name: "startDate", label: "Start date", type: "date", required: true },
        { name: "durationWeeks", label: "Duration (weeks)", type: "number", required: true },
      ],
    },
    {
      key: "faculty-room-booking",
      title: "Room / Lab Booking",
      description: "Book a room or lab for a class activity or event.",
      audienceRole: "FACULTY",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 2,
      fields: [
        { name: "room", label: "Room / Lab", type: "text", required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "time", label: "Time", type: "text", required: true },
        { name: "purpose", label: "Purpose", type: "textarea", required: true },
      ],
    },
    {
      key: "faculty-grade-change",
      title: "Grade Correction Request",
      description: "Request a grade correction with justification.",
      audienceRole: "FACULTY",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Examination Cell",
      slaDays: 5,
      fields: [
        { name: "studentRegNo", label: "Student registration no.", type: "text", required: true },
        { name: "courseCode", label: "Course code", type: "text", required: true },
        { name: "justification", label: "Justification", type: "textarea", required: true },
      ],
    },
    // ── Common university forms (spec §11) ────────────────────────────────
    {
      key: "bonafide-certificate",
      title: "Bonafide / Student Status Certificate",
      description: "Certificate confirming you are a current enrolled student.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 3,
      fields: [
        { name: "purpose", label: "Purpose (bank, visa, employer…)", type: "text", required: true },
        { name: "copies", label: "Copies required", type: "number", required: false },
      ],
    },
    {
      key: "enrollment-verification",
      title: "Enrollment / Student Verification Certificate",
      description: "Verified enrollment letter for external authorities.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 4,
      fields: [
        { name: "addressee", label: "Addressed to", type: "text", required: true },
        { name: "purpose", label: "Purpose", type: "textarea", required: true },
      ],
    },
    {
      key: "provisional-certificate",
      title: "Provisional Certificate / Degree Request",
      description: "Provisional certificate or degree issuance request (final year).",
      audienceRole: "STUDENT",
      reviewerRole: "ADMIN",
      recipientLabel: "Registrar Office",
      slaDays: 7,
      fields: [
        { name: "program", label: "Program", type: "text", required: true },
        { name: "graduationTerm", label: "Graduation term", type: "text", required: true, placeholder: "Fall 2026" },
        { name: "notes", label: "Notes", type: "textarea", required: false },
      ],
    },
    {
      key: "semester-registration",
      title: "Semester Registration",
      description: "Register for the upcoming semester and confirm your load.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 5,
      fields: [
        { name: "semester", label: "Semester", type: "text", required: true, placeholder: "Spring 2027" },
        { name: "courseCodes", label: "Course codes (comma separated)", type: "textarea", required: true },
        { name: "creditHours", label: "Total credit hours", type: "number", required: true },
      ],
    },
    {
      key: "course-add-drop",
      title: "Course Add / Drop",
      description: "Add or drop a course during the adjustment window.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 3,
      fields: [
        { name: "action", label: "Action", type: "select", options: ["Add", "Drop"], required: true },
        { name: "courseCode", label: "Course code", type: "text", required: true },
        { name: "section", label: "Section", type: "text", required: false },
        { name: "reason", label: "Reason", type: "textarea", required: true },
      ],
    },
    {
      key: "exam-request",
      title: "Examination Request (Recheck / Re-sit)",
      description: "Request a paper recheck or a re-sit examination.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Examination Cell",
      slaDays: 5,
      fields: [
        { name: "courseCode", label: "Course code", type: "text", required: true },
        { name: "examTerm", label: "Exam term", type: "text", required: true, placeholder: "Final — Fall 2026" },
        { name: "requestType", label: "Request type", type: "select", options: ["Recheck", "Re-sit"], required: true },
        { name: "reason", label: "Reason", type: "textarea", required: true },
      ],
    },
    {
      key: "fee-dues",
      title: "Fee / Dues Request",
      description: "Fee voucher issue, instalment plan, or dues clarification.",
      audienceRole: "STUDENT",
      reviewerRole: "ADMIN",
      recipientLabel: "Accounts Office",
      slaDays: 4,
      fields: [
        { name: "requestType", label: "Request type", type: "select", options: ["Voucher", "Instalment plan", "Clarification"], required: true },
        { name: "amount", label: "Amount (PKR, if relevant)", type: "number", required: false },
        { name: "details", label: "Details", type: "textarea", required: true },
      ],
    },
    {
      key: "info-correction",
      title: "Student Information Correction",
      description: "Correct your registered details (name, CNIC, contact, program).",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 3,
      fields: [
        { name: "field", label: "Field to correct", type: "text", required: true, placeholder: "CNIC / phone / name" },
        { name: "currentValue", label: "Current value", type: "text", required: true },
        { name: "newValue", label: "Corrected value", type: "text", required: true },
        { name: "evidence", label: "Supporting document (description)", type: "textarea", required: false },
      ],
    },
    {
      key: "general-application",
      title: "General Application (Faculty / Administration)",
      description: "Any other request addressed to faculty or administration.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Coordination Office",
      slaDays: 5,
      fields: [
        { name: "addressedTo", label: "Addressed to", type: "text", required: true, placeholder: "FYP Head / Faculty / Admin" },
        { name: "subject", label: "Subject", type: "text", required: true },
        { name: "details", label: "Details", type: "textarea", required: true },
      ],
    },
    {
      key: "faculty-lab-request",
      title: "Lab / Equipment Request",
      description: "Faculty request for lab equipment or a software licence for teaching.",
      audienceRole: "FACULTY",
      reviewerRole: "ADMIN",
      recipientLabel: "Lab Administration",
      slaDays: 4,
      fields: [
        { name: "item", label: "Item / equipment", type: "text", required: true },
        { name: "courseCode", label: "For course (optional)", type: "text", required: false },
        { name: "justification", label: "Justification", type: "textarea", required: true },
      ],
    },
  ];
  for (const t of templates) {
    await prisma.formTemplate.upsert({ where: { key: t.key }, update: { ...t }, create: t });
  }
  console.log(`✓ form templates: ${templates.length}`);

  // ── Internships ────────────────────────────────────────────────────────
  const internships: [string, string, string, string, string, string][] = [
    ["Frontend Developer Intern", "Systems Ltd", "React + Next.js work on a fintech dashboard.", "Lahore", "Hybrid", "2026-11-15"],
    ["Machine Learning Intern", "Afiniti", "Assist the intent-detection team with model evaluation.", "Karachi", "On-site", "2026-11-30"],
    ["Backend Engineering Intern", "10Pearls", "Node.js services + PostgreSQL optimization.", "Karachi", "On-site", "2026-12-05"],
    ["Data Analyst Intern", "Engro", "Dashboards and reporting for the supply-chain team.", "Karachi", "Hybrid", "2026-11-20"],
    ["QA Automation Intern", "Netsol", "Playwright test suites for banking products.", "Lahore", "Remote", "2026-12-10"],
    ["IoT Engineering Intern", "Siemens Pakistan", "Sensor pipelines + edge deployment basics.", "Karachi", "On-site", "2026-12-20"],
  ];
  for (const [title, company, description, location, mode, deadline] of internships) {
    const existing = await prisma.internship.findFirst({ where: { title, company } });
    if (!existing) {
      await prisma.internship.create({
        data: {
          title,
          company,
          description,
          location,
          mode,
          deadline: new Date(deadline + "T00:00:00Z"),
          tags: [company, mode],
          postedById: fypHead.id,
        },
      });
    }
  }
  console.log(`✓ internships: ${internships.length}`);

  // ── Knowledge corpus (AI assistant seed — supervisor to review) ────────
  const docs: [string, string, string][] = [
    ["Academic Calendar 2026-2027", "SHU Academic Office", "Fall 2026 classes begin on 14 September 2026. Mid-term examinations run 9–14 November 2026. Final examinations run 15 December 2026 – 8 January 2027. Spring 2027 classes begin 1 February 2027."],
    ["Add / Drop Policy", "SHU Academic Office", "Students may add or drop courses during the first two weeks of a semester using the Course Withdrawal form. After week two, withdrawal requires coordinator approval and appears as 'W' on the transcript. No adds are allowed after week two."],
    ["Examination Rules", "SHU Examination Cell", "Students must carry their university ID to every examination. Mobile phones are not permitted in examination halls. A student arriving more than 20 minutes late will not be admitted. Re-checks must be requested within 7 days of result publication."],
    ["Attendance Policy", "SHU Academic Office", "A minimum of 75% attendance is required in every course to sit the final examination. Medical leave must be supported by documents submitted within 3 working days of return."],
    ["FYP Guidelines (FYP-I & FYP-II)", "SHU FYP Committee", "FYP is a two-semester sequence. FYP-I produces the proposal and feasibility study; FYP-II delivers the working implementation, evaluation, and final defence. Groups are 2–4 students. A supervisor must be assigned before the FYP application is approved. GPU/lab resources can be requested through the Resources module."],
    ["Internship & NOC Policy", "SHU Placement Office", "Students seeking an internship during a semester must obtain an NOC via the Internship NOC form at least one week before the start date. The NOC requires the company name, start date and duration. Internships during examination weeks are not permitted."],
    ["Scholarship Policy", "SHU Finance Office", "Merit scholarships require a CGPA of 3.5 or above and no failed courses in the previous semester. Need-based scholarships require an annual income declaration. Applications open in week 3 of each semester."],
    ["Library Rules", "SHU Library", "Undergraduate students may borrow up to 3 books for 14 days. Reference material is reading-room only. Overdue fines are Rs. 20 per day per book."],
    ["GPU / High-Performance Resource Usage Policy", "SHU CS Department", "GPU resources (RTX 4090, A100, H100) are allocated per FYP/project need through the Resource Request workflow. Requests must state the project, supervisor, configuration and time slot. Allocations are time-boxed; released resources return to the pool automatically on expiry. Priority goes to FYP-II projects with supervisor recommendation."],
    ["Mentorship Programme Overview", "SHU Alumni Office", "The alumni mentorship programme connects students with industry mentors. Students may request up to one active mentor at a time. Mentors accept or decline requests, and sessions are scheduled through the Mentorship module. Mentors are approved by the FYP Head."],
    ["Academic Integrity Policy", "SHU Academic Office", "Plagiarism, including copying code without attribution, is a serious offence. First offences receive a zero on the assessment; repeat offences may lead to course failure and disciplinary review."],
    ["Fee & Refund Policy", "SHU Finance Office", "Semester fees are payable within the first two weeks. A 100% refund is available until the end of week 1, 50% until week 3, and no refund after week 4. Fee schedules are published on the student portal."],
    ["Campus IT Services", "SHU IT Department", "Campus Wi-Fi requires SHU portal credentials. Lab machines are re-imaged each semester; students must keep their code in Git. For account issues, raise a complaint in the Complaint Box with category 'IT'."],
    ["Course Registration FAQ", "SHU Academic Office", "Registration is done through the Academic Planning view. A normal load is 15–18 credit hours. Overloads above 18 credits require a CGPA of 3.0+ and coordinator approval. Prerequisite overrides need the course instructor's consent."],
    ["UniSphere Platform Overview", "SHU CS Department", "UniSphere is the unified student portal for Salim Habib University. It brings together the timetable and exam schedule, the Forms Center, the Complaint Box, notifications, internships, alumni mentorship, FYP applications, and the GPU/lab resource request workflow in one place. Students, faculty, coordinators, the FYP Head, and mentors each get a role-specific dashboard. The AI assistant answers questions grounded in this knowledge base and your own UniSphere records."],
    ["Timetable Clash Detection & Resolution", "SHU Coordination Office", "UniSphere detects timetable clashes automatically: two classes clash when they share a room, a faculty member, a lab, or the same cohort (section), and an exam clashes with a class when their times overlap. Clashing slots are flagged with a red badge on the Timetable view and appear in the coordinator's Clash Resolution queue. If you spot a clash, report it within 48 hours through the Complaint Box (category 'Timetable') or tell the coordination office; acknowledged clashes are tracked until resolved."],
    ["Coordination Office & Student Support", "SHU Coordination Office", "The coordination office (Block A, ground floor) is open Monday–Friday 09:00–17:00 and handles timetables, registration issues, complaints, room bookings and general student queries. Email coordination@shu.edu.pk or file a complaint in the Complaint Box — category 'Faculty' complaints are routed to both the faculty member and the office."],
    ["Student Card & ID Services", "SHU Student Affairs", "To get a new student card, visit Student Affairs with your registration number; a replacement card costs Rs. 500 and is issued within 3 working days. Your university ID card must be carried to every examination — a lost card should be replaced before exams. Digital registration details are also available on your dashboard."],
    ["Document Attestation & Stamping", "SHU Academic Office", "Bonafide certificates, transcripts, degree verification and other stamped documents are requested through the Forms Center. Select the form, submit it, and the Academic Office reviews it — most stamped documents are ready within 3 working days after approval. You can track the status and download details from My Submissions."],
    ["Notifications & Alerts", "SHU IT Department", "UniSphere notifies you in-app: the bell in the top bar shows unread notifications, and each notification links to the relevant page. Notifications are generated automatically when your forms are approved or rejected, complaints move, FYP or resource decisions are made, internship applications change status, and mentorship sessions are proposed. Coordinators and the FYP Head can also broadcast announcements to a role."],
    ["AI Assistant Help & Limits", "SHU CS Department", "The UniSphere AI assistant answers questions about timetables, forms, complaints, FYP, GPU requests, internships, mentorship and university policies. It is grounded in the knowledge base and your own records, and cites its sources. It never invents deadlines or policy — when something is not covered it says so and points you to the coordination office. Set an API key to enable full answers; without one it still answers from the knowledge base."],
    ["Data Protection & Privacy", "SHU IT Department", "Your UniSphere data is stored in a managed PostgreSQL database with encrypted connections. Access is role-based: students see their own records, faculty see their courses and assigned complaints, coordinators see operational queues, and the FYP Head sees FYP and resource workflows. Personal data is never shared with third parties, and every authorization decision is re-checked on the server, not in the browser."],
    ["Examination Timetable & Schedule Release", "SHU Examination Cell", "The exam schedule is published in the Exams view approximately three weeks before the examination period begins. UniSphere also flags exam clashes — an exam scheduled at the same time as another exam or a class — so they can be resolved before the date sheet is finalised. For corrections, contact the examination cell with your course and section details."],
    ["Laboratory Access & Workstations", "SHU CS Department", "Computer labs are open 09:00–20:00 on weekdays. GPU workstations and specialised lab machines are requested through the Resource Request workflow (type GPU or Workstation). Include the software or CUDA version you need; allocations are time-boxed and released automatically when the window expires. General lab seats are first-come, first-served outside timetabled hours."],
    ["Form Submission, Review & Withdrawal", "SHU Academic Office", "Every form follows the same lifecycle: you submit it, the reviewer (faculty or coordinator) reviews it, and it is approved or rejected with remarks. While a submission is still in 'Submitted' state you can withdraw it yourself from My Submissions; once a reviewer starts, withdrawal is disabled. You receive a notification at every step, and the submission timeline shows each event with its timestamp."],
    ["Resource Request Lifecycle (GPU/Lab)", "SHU CS Department", "A resource request moves through: Pending (submitted) → Recommended (FYP Head approves) → Allocated (a specific unit is assigned) — or Rejected with remarks. You can cancel a request while it is Pending or Recommended. Allocations are concurrency-safe: the last available unit can only be allocated once, and revoking an allocation returns the unit to the pool."],
    ["Class Missing or Wrong Section in Timetable", "SHU Coordination Office", "If a class is missing from your timetable, first check that your section and department match the course registration. If the class still does not appear, file a Complaint Box entry with category 'Timetable' or visit the coordination office — registration corrections are processed within two working days. Wrong-section entries are fixed by the coordinator from the Faculty & Courses view."],
  ];
  for (const [title, source, content] of docs) {
    const existing = await prisma.knowledgeDoc.findFirst({ where: { title } });
    if (existing) {
      await prisma.knowledgeDoc.update({ where: { id: existing.id }, data: { source, content } });
    } else {
      await prisma.knowledgeDoc.create({
        data: { title, source, content, tags: ["policy", "shu"] },
      });
    }
  }
  console.log(`✓ knowledge docs: ${docs.length}`);

  // ── Sample flows (complaints, FYP, resources, mentorship) ──────────────
  const complaint1 = await prisma.complaint.findFirst({ where: { subject: "Lab 2 AC not working" } });
  if (!complaint1) {
    await prisma.complaint.create({
      data: {
        submittedById: student.id,
        subject: "Lab 2 AC not working",
        category: "Facilities",
        description: "The air conditioning in Networks Lab (Lab 2) has been broken for two weeks, making afternoon labs very uncomfortable.",
        status: "OPEN",
        events: { create: { actorId: student.id, status: "OPEN", comment: "Submitted" } },
      },
    });
  }
  const complaint2 = await prisma.complaint.findFirst({ where: { subject: "Incorrect grade posted for CS-302" } });
  if (!complaint2) {
    await prisma.complaint.create({
      data: {
        submittedById: student2.id,
        subject: "Incorrect grade posted for CS-302",
        category: "Faculty",
        description: "My quiz 2 marks for Database Systems look swapped with my partner's. Requesting a review.",
        status: "IN_REVIEW",
        assignedToId: faculty2.id,
        events: {
          create: [
            { actorId: student2.id, status: "OPEN", comment: "Submitted" },
            { actorId: faculty2.id, status: "IN_REVIEW", comment: "Checking the marking sheet." },
          ],
        },
      },
    });
  }

  const fyp1 = await prisma.fypApplication.findFirst({ where: { title: "UniSphere — Unified University Portal" } });
  if (!fyp1) {
    await prisma.fypApplication.create({
      data: {
        applicantId: student.id,
        title: "UniSphere — Unified University Portal",
        domain: "Web Engineering / EdTech",
        description: "A unified portal consolidating timetable, forms, complaints, internships, mentorship and resource allocation with an AI assistant.",
        technologies: "Next.js, TypeScript, PostgreSQL, Prisma, Clerk, Tailwind",
        groupName: "Team UniSphere",
        members: "Ali Raza, Ishan Rajwani, Carol Swan",
        registrationNos: "S22CSC001, S22CSC008, S22CSC012",
        supervisorPref: "Dr. Ateeque Rahman",
        department: "Computer Science",
        semester: "Fall 2026",
        status: "PENDING",
      },
    });
  }
  const fyp2 = await prisma.fypApplication.findFirst({ where: { title: "Smart Attendance via Face Recognition" } });
  if (!fyp2) {
    await prisma.fypApplication.create({
      data: {
        applicantId: student2.id,
        title: "Smart Attendance via Face Recognition",
        domain: "Computer Vision",
        description: "Classroom attendance automation using on-premise face recognition with privacy safeguards.",
        technologies: "Python, OpenCV, FastAPI, PostgreSQL",
        groupName: "Team Vision",
        members: "Sara Khan, Hamza Tariq",
        registrationNos: "S22CSC002, S22CSC031",
        supervisorPref: "Ms. Saadia Karim",
        department: "Computer Science",
        semester: "Fall 2026",
        status: "APPROVED",
        remarks: "Approved — ensure privacy policy compliance.",
        decidedById: fypHead.id,
        decidedAt: new Date(),
      },
    });
  }

  const req1 = await prisma.resourceRequest.findFirst({ where: { projectName: "UniSphere — GPU inference demos" } });
  if (!req1) {
    await prisma.resourceRequest.create({
      data: {
        applicantId: student.id,
        projectName: "UniSphere — GPU inference demos",
        groupName: "Team UniSphere",
        members: "Ali Raza, Ishan Rajwani",
        supervisor: "Dr. Ateeque Rahman",
        resourceType: "GPU",
        config: "RTX 4090 — 24 GB",
        purpose: "Run local LLM inference for the AI assistant demo and benchmark latency vs hosted APIs.",
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-31T00:00:00Z"),
        timeSlot: "Evenings 18:00–22:00",
        status: "PENDING",
      },
    });
  }
  const req2 = await prisma.resourceRequest.findFirst({ where: { projectName: "Vision training — face recognition" } });
  if (!req2) {
    const created = await prisma.resourceRequest.create({
      data: {
        applicantId: student2.id,
        projectName: "Vision training — face recognition",
        groupName: "Team Vision",
        members: "Sara Khan, Hamza Tariq",
        supervisor: "Ms. Saadia Karim",
        resourceType: "GPU",
        config: "RTX 3090 ×2",
        purpose: "Fine-tune recognition models for the classroom prototype.",
        startDate: new Date("2026-09-25T00:00:00Z"),
        endDate: new Date("2026-12-20T00:00:00Z"),
        timeSlot: "Weekends 10:00–18:00",
        status: "RECOMMENDED",
        remarks: "Recommended by Dr. Saadia Karim.",
        decidedById: fypHead.id,
        decidedAt: new Date(),
      },
    });
    const gpu3090 = resources.find((r) => r.model === "RTX 3090");
    if (gpu3090) {
      await prisma.allocation.create({
        data: {
          requestId: created.id,
          resourceId: gpu3090.id,
          labId: labByNumber.get("3")?.id,
          startDate: new Date("2026-09-25T00:00:00Z"),
          endDate: new Date("2026-12-20T00:00:00Z"),
          timeSlot: "Weekends 10:00–18:00",
          status: "ACTIVE",
          allocatedById: fypHead.id,
          notes: "Time-boxed allocation; release on expiry.",
        },
      });
    }
  }

  const mentReq = await prisma.mentorshipRequest.findFirst({
    where: { studentId: student.id, mentorId: mentorUsers[0].id },
  });
  if (!mentReq) {
    const created = await prisma.mentorshipRequest.create({
      data: {
        studentId: student.id,
        mentorId: mentorUsers[0].id,
        message: "Hi! I'm building UniSphere for my FYP and would love guidance on backend architecture and the job market for backend roles.",
        status: "ACCEPTED",
      },
    });
    await prisma.mentorshipSession.create({
      data: {
        requestId: created.id,
        proposedById: mentorUsers[0].id,
        scheduledAt: new Date("2026-09-28T17:00:00Z"),
        mode: "Online",
        location: "Google Meet",
        notes: "First session: project architecture + internship prep.",
        status: "CONFIRMED",
      },
    });
  }

  // ── Sample form submissions + internship applications ──────────────────
  const coordinator = await prisma.user.findUnique({ where: { email: "coordinator@shu.edu.pk" } });
  const reviewerFor = (role: string | null | undefined) =>
    role === "FACULTY" ? faculty.id : role === "FYP_HEAD" ? fypHead.id : (coordinator?.id ?? faculty.id);
  const tplSample = await prisma.formTemplate.findMany({ orderBy: { key: "asc" }, take: 3 });

  const sampleSubs: { i: number; by: string; status: "SUBMITTED" | "APPROVED" | "REJECTED"; payload: Prisma.JsonObject; trail: string[] }[] = [
    {
      i: 0, by: student.id, status: "SUBMITTED",
      payload: { courseCode: "CS-302", reason: "Medical emergency during quiz week", duration: "3 days" },
      trail: ["Submitted for review"],
    },
    {
      i: 1, by: student2.id, status: "APPROVED",
      payload: { purpose: "Bank account opening at university branch", copies: 2, deliveryMode: "Collect from office" },
      trail: ["Submitted for review", "Documents verified with registrar", "Approved — collect from the Academic Office"],
    },
    {
      i: 2, by: student.id, status: "REJECTED",
      payload: { eventName: "IEEE Student Congress", dates: "Oct 12–14", fundingRequired: "Rs. 8,000", justification: "Presenting our FYP poster" },
      trail: ["Submitted for review", "Missing advisor recommendation letter", "Rejected — resubmit with the advisor's letter"],
    },
  ];

  for (const s of sampleSubs) {
    const tpl = tplSample[s.i];
    if (!tpl) continue;
    const exists = await prisma.formSubmission.findFirst({ where: { templateId: tpl.id, submittedById: s.by } });
    if (exists) continue;
    const reviewerId = reviewerFor(tpl.reviewerRole);
    const chain: ("SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED")[] =
      s.status === "SUBMITTED" ? ["SUBMITTED"] : ["SUBMITTED", "UNDER_REVIEW", s.status];
    await prisma.formSubmission.create({
      data: {
        templateId: tpl.id,
        submittedById: s.by,
        payload: s.payload,
        status: s.status,
        reviewerId: s.status === "SUBMITTED" ? null : reviewerId,
        events: {
          create: chain.map((to, idx) => ({
            actorId: idx === 0 ? s.by : reviewerId,
            toStatus: to,
            comment: s.trail[Math.min(idx, s.trail.length - 1)],
          })),
        },
      },
    });
  }

  const internshipRows = await prisma.internship.findMany({ orderBy: { createdAt: "asc" }, take: 3 });
  const sampleApps: { i: number; studentId: string; status: "APPLIED" | "SHORTLISTED" | "ACCEPTED"; note: string }[] = [
    { i: 0, studentId: student.id, status: "APPLIED", note: "React + Next.js portfolio attached; available from December." },
    { i: 1, studentId: student2.id, status: "SHORTLISTED", note: "Shortlisted — technical interview scheduled next week." },
    { i: 2, studentId: student.id, status: "ACCEPTED", note: "Offer accepted; onboarding starts after finals." },
  ];
  for (const a of sampleApps) {
    const intern = internshipRows[a.i];
    if (!intern) continue;
    await prisma.internshipApplication.upsert({
      where: { internshipId_studentId: { internshipId: intern.id, studentId: a.studentId } },
      update: {},
      create: { internshipId: intern.id, studentId: a.studentId, status: a.status, note: a.note },
    });
  }
  console.log("✓ sample form submissions + internship applications");

  // ── Notifications (a few for the demo student) ─────────────────────────
  const notifCount = await prisma.notification.count({ where: { userId: student.id } });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        { userId: student.id, type: "MENTORSHIP", title: "Mentorship request accepted", body: "Engr. Danish Iqbal accepted your mentorship request.", link: "/mentorship" },
        { userId: student.id, type: "RESOURCE", title: "Resource request received", body: "Your GPU request is pending review by the FYP Head.", link: "/resources/my" },
        { userId: student.id, type: "ANNOUNCEMENT", title: "Welcome to UniSphere", body: "Your unified campus portal is live. Explore your timetable and forms.", link: "/dashboard" },
      ],
    });
  }

  // ── FYP-II demo fleet ──────────────────────────────────────────────────
  // 10 students (S22CSC001–S22CSC010), 3 faculty, coordinator, FYP Head, Saadia
  // Karim (co-supervisor, FYP-related), and a system administrator — plus
  // enrollments, attendance, assessments/scores, archived results (CGPA),
  // messages and audit entries.
  const studentFleet: [string, string, string][] = [
    ["student@shu.edu.pk", "Ali Raza", "S22CSC001"],
    ["student2@shu.edu.pk", "Sara Khan", "S22CSC002"],
    ["student3@shu.edu.pk", "Ahmed Malik", "S22CSC003"],
    ["student4@shu.edu.pk", "Fatima Noor", "S22CSC004"],
    ["student5@shu.edu.pk", "Bilal Ahmed", "S22CSC005"],
    ["student6@shu.edu.pk", "Ayesha Siddiqui", "S22CSC006"],
    ["student7@shu.edu.pk", "Hamza Iqbal", "S22CSC007"],
    ["student8@shu.edu.pk", "Zainab Ali", "S22CSC008"],
    ["student9@shu.edu.pk", "Usman Tariq", "S22CSC009"],
    ["student10@shu.edu.pk", "Maryam Sheikh", "S22CSC010"],
  ];
  const students: Awaited<ReturnType<typeof upsertUser>>[] = [];
  for (const [email, name, reg] of studentFleet) {
    const u = await upsertUser({ email, name, role: "STUDENT", department: "Computer Science", registrationNo: reg });
    await prisma.studentProfile.upsert({
      where: { userId: u.id },
      update: { section: "A" },
      create: { userId: u.id, semester: 7, batch: "BSCS-2023", section: "A", program: "BSCS" },
    });
    students.push(u);
  }
  const faculty3 = await upsertUser({
    email: "faculty3@shu.edu.pk",
    name: "Dr. Kamran Shah",
    role: "FACULTY",
    department: "Computer Science",
    employeeId: "FAC003",
  });
  await prisma.facultyProfile.upsert({
    where: { userId: faculty3.id },
    update: {},
    create: { userId: faculty3.id, designation: "Assistant Professor", office: "F-216" },
  });
  // Ms. Saadia Karim is the project co-supervisor (report front matter) — she
  // gets a faculty profile flagged for FYP supervision, not admin rights.
  await upsertUser({
    email: "saadia.karim@shu.edu.pk",
    name: "Ms. Saadia Karim",
    role: "FACULTY",
    department: "Computer Science",
    employeeId: "FAC004",
  });
  const saadia = await prisma.user.findUnique({ where: { email: "saadia.karim@shu.edu.pk" } });
  if (saadia) {
    await prisma.facultyProfile.upsert({
      where: { userId: saadia.id },
      update: { designation: "Lecturer / FYP Co-Supervisor", office: "F-210" },
      create: { userId: saadia.id, designation: "Lecturer / FYP Co-Supervisor", office: "F-210" },
    });
    // Saadia supervises the already-approved demo FYP group (she is the
    // documented co-supervisor) — the assignment shows on the group's /fyp
    // page, the FYP Head console and her own record.
    await prisma.fypApplication.updateMany({
      where: { title: "Smart Attendance via Face Recognition", supervisorId: null },
      data: { supervisorId: saadia.id },
    });
  }
  const admin = await upsertUser({
    email: "admin@shu.edu.pk",
    name: "UniSphere Administrator",
    role: "ADMIN",
    department: "IT Services",
    employeeId: "ADMIN001",
  });
  console.log(`✓ demo fleet: ${students.length} students · 3 faculty · coordinator · FYP Head · co-supervisor · admin`);

  // Enrollments: everyone in the six active Fall 2026 classes …
  const activeClasses = await prisma.courseClass.findMany({ where: { semester: "Fall 2026" } });
  const activeByCode = new Map(activeClasses.map((c) => [c.courseCode, c]));
  for (const s of students) {
    for (const code of ["CS-301", "CS-302", "CS-305", "CS-401", "CS-402", "SE-310"]) {
      const cls = activeByCode.get(code);
      if (!cls) continue;
      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId: s.id, classId: cls.id } },
        update: { status: "ACTIVE" },
        create: { studentId: s.id, classId: cls.id, status: "ACTIVE" },
      });
    }
  }

  // … and archived Spring 2026 classes with published results (for the CGPA).
  const archivedDefs: [string, string, number][] = [
    ["CS-501", "Artificial Intelligence", 4],
    ["CS-502", "Web Technologies", 3],
    ["CS-503", "Design & Analysis of Algorithms", 3],
    ["CS-504", "HCI", 3],
    ["CS-505", "Mobile App Development", 3],
  ];
  const archived: { id: string; credits: number }[] = [];
  for (const [code, title, credits] of archivedDefs) {
    let cls = await prisma.courseClass.findFirst({ where: { courseCode: code, section: "A", semester: "Spring 2026" } });
    if (!cls) {
      cls = await prisma.courseClass.create({
        data: {
          courseCode: code, title, section: "A", department: "CS", semester: "Spring 2026", credits,
          facultyId: faculty.id,
        },
      });
    }
    archived.push({ id: cls.id, credits });
  }
  const seededScores = (i: number, salt: number) => {
    const h = Math.abs(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1;
    return 66 + Math.round(h * 28); // 66–94 %
  };
  const seedRand = (i: number, salt: number) => Math.abs(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1;
  const gradeFor = (pct: number): [string, number] =>
    pct >= 90 ? ["A+", 4.0] : pct >= 85 ? ["A", 3.75] : pct >= 80 ? ["B+", 3.5] : pct >= 75 ? ["B", 3.0] : pct >= 70 ? ["C+", 2.5] : pct >= 65 ? ["C", 2.0] : pct >= 50 ? ["D", 1.0] : ["F", 0.0];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    for (let j = 0; j < archived.length; j++) {
      const cls = archived[j];
      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId: s.id, classId: cls.id } },
        update: { status: "COMPLETED" },
        create: { studentId: s.id, classId: cls.id, status: "COMPLETED" },
      });
      const pct = seededScores(i, j + 7);
      const [grade, points] = gradeFor(pct);
      await prisma.courseResult.upsert({
        where: { studentId_classId: { studentId: s.id, classId: cls.id } },
        update: { totalMarks: pct, grade, gradePoints: points },
        create: {
          studentId: s.id, classId: cls.id, totalMarks: pct, grade, gradePoints: points,
          published: true, publishedAt: new Date("2026-07-15T00:00:00Z"), publishedById: fypHead.id,
        },
      });
    }
  }

  // Attendance: the past six weeks on each class's slots (deterministic mix).
  const dayOffset: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dateFor = (day: string, weeksAgo: number) => {
    const d = new Date(startOfToday);
    const delta = (d.getDay() - dayOffset[day] + 7) % 7;
    d.setDate(d.getDate() - delta - weeksAgo * 7);
    return d;
  };
  let attendanceRows = 0;
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    for (let j = 0; j < activeClasses.length; j++) {
      const cls = activeClasses[j];
      const slots = await prisma.timetableSlot.findMany({ where: { classId: cls.id } });
      const rows: { studentId: string; classId: string; date: Date; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; markedById: string | null }[] = [];
      for (let w = 0; w < 6; w++) {
        for (const slot of slots) {
          const r = seedRand(i * 7 + w, j * 13 + slot.startMin);
          const status = r > 0.93 ? "ABSENT" : r > 0.89 ? "LATE" : r > 0.87 ? "EXCUSED" : "PRESENT";
          rows.push({ studentId: s.id, classId: cls.id, date: dateFor(slot.day, w), status, markedById: cls.facultyId });
        }
      }
      if (rows.length) {
        await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
        attendanceRows += rows.length;
      }
    }
  }
  console.log(`✓ attendance: ${attendanceRows} records across ${students.length} students`);

  // Assessments + midterm scores for the active classes.
  const assessmentPlan: { kind: "QUIZ" | "ASSIGNMENT" | "MIDTERM"; title: string; maxMarks: number }[] = [
    { kind: "QUIZ", title: "Quiz 1", maxMarks: 10 },
    { kind: "ASSIGNMENT", title: "Assignment 1", maxMarks: 20 },
    { kind: "MIDTERM", title: "Midterm", maxMarks: 30 },
  ];
  let scoreRows = 0;
  for (let j = 0; j < activeClasses.length; j++) {
    const cls = activeClasses[j];
    for (let k = 0; k < assessmentPlan.length; k++) {
      const plan = assessmentPlan[k];
      let assessment = await prisma.assessment.findFirst({ where: { classId: cls.id, title: plan.title } });
      if (!assessment) {
        assessment = await prisma.assessment.create({
          data: {
            classId: cls.id, kind: plan.kind, title: plan.title, maxMarks: plan.maxMarks,
            date: new Date(startOfToday.getTime() - (k + 1) * 7 * 86400000),
            createdById: cls.facultyId,
          },
        });
      }
      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const pct = seededScores(i, j + k * 5 + 21) / 100;
        const marks = Math.max(0, Math.min(plan.maxMarks, Math.round(plan.maxMarks * pct)));
        await prisma.score.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: s.id } },
          update: { marks, enteredById: cls.facultyId },
          create: { assessmentId: assessment.id, studentId: s.id, marks, enteredById: cls.facultyId },
        });
        scoreRows++;
      }
    }
  }
  console.log(`✓ marks: ${scoreRows} scores across ${assessmentPlan.length} assessments/class`);

  // Messages (inbox/sent demo) + audit trail.
  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        { senderId: fypHead.id, recipientId: students[0].id, subject: "FYP-II checkpoint", body: "Your FYP-II application is under review — please upload the progress log before Friday.", readAt: null },
        { senderId: students[0].id, recipientId: fypHead.id, subject: "Re: FYP-II checkpoint", body: "Noted sir — uploading the progress log today.", readAt: new Date() },
        { senderId: faculty.id, recipientId: students[1].id, subject: "Midterm performance", body: "Good showing in the DSA midterm. Keep attending the lab sessions.", readAt: null },
        { senderId: students[2].id, recipientId: coordinator?.id ?? admin.id, subject: "Elective registration", body: "Requesting permission to switch my elective to Cloud Computing.", readAt: null },
      ],
    });
  }
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        { actorId: fypHead.id, action: "resource.allocate", entity: "ResourceRequest", summary: "RTX 3090 allocated for FYP-II training window", meta: { resource: "RTX 3090" } },
        { actorId: faculty.id, action: "marks.enter", entity: "Assessment", summary: "Midterm marks entered for CS-301", meta: { class: "CS-301" } },
        { actorId: admin.id, action: "user.provision", entity: "User", summary: "Demo fleet provisioned (10 students, 3 faculty)", meta: { students: 10 } },
      ],
    });
  }

  // A welcome notification for every student in the fleet.
  for (const s of students) {
    const n = await prisma.notification.count({ where: { userId: s.id } });
    if (n === 0) {
      await prisma.notification.create({
        data: {
          userId: s.id, type: "ANNOUNCEMENT", title: "Welcome to UniSphere",
          body: "Your timetable, attendance, marks and requests are all in one place. Explore your dashboard to get started.",
          link: "/dashboard",
        },
      });
    }
  }

  console.log("✓ sample complaints / FYP / resource / mentorship flows");
  console.log("── seed complete ──────────────────────────────");
  console.log("Demo logins (one per role):");
  console.log("  student@shu.edu.pk (S22CSC001) · faculty@shu.edu.pk (FAC001) · coordinator@shu.edu.pk (COORD001)");
  console.log("  fyphead@shu.edu.pk · mentor@shu.edu.pk · admin@shu.edu.pk");
  console.log("  + students student2..10@shu.edu.pk · faculty2/3@shu.edu.pk · saadia.karim@shu.edu.pk");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

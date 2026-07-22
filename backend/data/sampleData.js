// Hardcoded sample data for RPConnect (no database)

const users = [
  { user_id: 1, full_name: "John Doe", email: "john.doe@rp.edu.sg" },
  { user_id: 2, full_name: "Aisha Rahman", email: "aisha.rahman@rp.edu.sg" },
  { user_id: 3, full_name: "Wei Ming Tan", email: "weiming.tan@rp.edu.sg" },
  { user_id: 4, full_name: "Sophia Lim", email: "sophia.lim@rp.edu.sg" },
  { user_id: 5, full_name: "Marcus Ong", email: "marcus.ong@rp.edu.sg" },
  { user_id: 6, full_name: "Priya Nair", email: "priya.nair@rp.edu.sg" }
];

const profiles = [
  {
    user_id: 1,
    display_name: "JohnD",
    bio: "Computer Science student passionate about web development and AI. Always down to pair-program or swap notes.",
    diploma: "Diploma in Information Technology",
    class_code: "IT-01",
    year_of_study: 2,
    interests: "Web Development, Gaming, AI, Machine Learning"
  },
  {
    user_id: 2,
    display_name: "AishaR",
    bio: "Design-minded engineer. I like clean UI, bubble tea, and hackathons.",
    diploma: "Diploma in Information Technology",
    class_code: "IT-02",
    year_of_study: 3,
    interests: "UI/UX Design, Hackathons, Photography, Product Management"
  },
  {
    user_id: 3,
    display_name: "WeiMingT",
    bio: "Robotics club exec. Building autonomous bots one semester at a time.",
    diploma: "Diploma in Mechatronics Engineering",
    class_code: "MT-03",
    year_of_study: 3,
    interests: "Robotics, Electronics, Robotics Club, 3D Printing"
  },
  {
    user_id: 4,
    display_name: "SophiaL",
    bio: "Business analytics student who loves spreadsheets a little too much.",
    diploma: "Diploma in Business Studies",
    class_code: "BZ-01",
    year_of_study: 1,
    interests: "Finance, Data Analytics, Entrepreneurship, Debate"
  },
  {
    user_id: 5,
    display_name: "MarcusO",
    bio: "Aspiring game developer. Currently building a 2D platformer in Godot.",
    diploma: "Diploma in Information Technology",
    class_code: "IT-01",
    year_of_study: 2,
    interests: "Game Development, Gaming, Web Development, Music Production"
  },
  {
    user_id: 6,
    display_name: "PriyaN",
    bio: "Biomedical science student, part-time volunteer, full-time coffee drinker.",
    diploma: "Diploma in Biomedical Science",
    class_code: "BM-02",
    year_of_study: 4,
    interests: "Healthcare, Volunteering, Research, Reading"
  }
];

const questions = [
  {
    question_id: 1,
    user_id: 1,
    title: "How to learn React effectively?",
    content: "Looking for resources and study groups for React. Any recommendations for a structured roadmap?",
    category: "Technology",
    created_at: "2026-07-20T10:30:00",
    author_name: "JohnD",
    upvotes: 24,
    comments: 8
  },
  {
    question_id: 2,
    user_id: 2,
    title: "Best tools for UI wireframing as a student?",
    content: "I want something free or with a student license. Figma vs Adobe XD vs Penpot - thoughts?",
    category: "Design",
    created_at: "2026-07-19T15:12:00",
    author_name: "AishaR",
    upvotes: 17,
    comments: 5
  },
  {
    question_id: 3,
    user_id: 3,
    title: "Anyone else's Arduino refusing to upload sketches?",
    content: "Getting a 'programmer not responding' error on my Uno. Tried different cables and ports already.",
    category: "Technology",
    created_at: "2026-07-19T09:45:00",
    author_name: "WeiMingT",
    upvotes: 9,
    comments: 12
  },
  {
    question_id: 4,
    user_id: 4,
    title: "Tips for balancing CCA and internship applications?",
    content: "Final year is approaching and I'm juggling debate club with internship apps. How do you all manage time?",
    category: "Student Life",
    created_at: "2026-07-18T18:20:00",
    author_name: "SophiaL",
    upvotes: 31,
    comments: 14
  },
  {
    question_id: 5,
    user_id: 5,
    title: "Godot vs Unity for a first solo game project?",
    content: "Want to build a small 2D platformer for my portfolio. Which engine is friendlier for a first-timer?",
    category: "Technology",
    created_at: "2026-07-17T20:05:00",
    author_name: "MarcusO",
    upvotes: 21,
    comments: 10
  }
];

const groups = [
  {
    group_id: 1,
    group_name: "Web Developers Club",
    description: "A group for students interested in web development, frameworks, and side projects.",
    creator_name: "John Doe",
    created_at: "2026-07-18T11:00:00",
    member_count: 15,
    members: [1, 2, 5]
  },
  {
    group_id: 2,
    group_name: "UI/UX Design Circle",
    description: "Weekly critiques, Figma jams, and portfolio reviews for design-minded students.",
    creator_name: "Aisha Rahman",
    created_at: "2026-07-16T14:30:00",
    member_count: 22,
    members: [2, 4]
  },
  {
    group_id: 3,
    group_name: "Robotics Builders",
    description: "For students tinkering with Arduino, Raspberry Pi, and competition robots.",
    creator_name: "Wei Ming Tan",
    created_at: "2026-07-14T09:15:00",
    member_count: 12,
    members: [3]
  },
  {
    group_id: 4,
    group_name: "Case Study & Debate Prep",
    description: "Practice group for business case competitions and debate tournaments.",
    creator_name: "Sophia Lim",
    created_at: "2026-07-12T16:45:00",
    member_count: 9,
    members: [4, 6]
  }
];

const ccas = [
  {
    cca_id: 1,
    cca_name: "Robotics Club",
    description: "Build and program robots for regional and national competitions.",
    category: "Technology",
    created_at: "2026-07-15T13:00:00",
    training_day: "Wednesday",
    training_time: "14:00 – 16:30",
    location: "Engineering Lab B1-03",
    contact_information: "Dr. Tan Wei Ming — tan_weiming@rp.edu.sg",
    image: "https://www.kuochuanpresbyteriansec.moe.edu.sg/images/The%20Kuo%20Chuan%20Experience/CCA/Robotics%20Club/CCA%201.jpeg"
  },
  {
    cca_id: 2,
    cca_name: "Debate Society",
    description: "Sharpen your argumentation and public speaking skills through inter-school debates.",
    category: "Student Life",
    created_at: "2026-07-10T10:00:00",
    training_day: "Friday",
    training_time: "15:00 – 17:00",
    location: "Library Seminar Room 2A",
    contact_information: "Ms. Priya Nair — priya_nair@rp.edu.sg",
    image: "https://www.peicaisec.moe.edu.sg/images/CCA/Debates_Society_2.jpg"
  },
  {
    cca_id: 3,
    cca_name: "Photography Guild",
    description: "Weekly photowalks, gear talks, and portfolio building sessions.",
    category: "Arts",
    created_at: "2026-07-08T17:30:00",
    training_day: "Saturday",
    training_time: "09:00 – 11:00",
    location: "Media Studio C2-01 / Outdoor locations",
    contact_information: "Mr. Alex Koh — alex_koh@rp.edu.sg",
    image: "https://isomer-user-content.by.gov.sg/397/ff2522db-c11d-46f9-bb1e-151b5c9e44d2/photo-republic.jpg"
  },
  {
    cca_id: 4,
    cca_name: "Game Dev Collective",
    description: "Collaborate on game jams and share progress on personal game projects.",
    category: "Technology",
    created_at: "2026-07-05T19:00:00",
    training_day: "Thursday",
    training_time: "14:00 – 17:00",
    location: "Computer Lab A3-07",
    contact_information: "Mr. Marcus Ong — marcus_ong@rp.edu.sg",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQx8vZMYrMQT56r7gq9F7pZx6qMRvFIqptvvPtLvZ032U4h4AShpkvyrow&s=10"
  },
  {
    cca_id: 5,
    cca_name: "Music Ensemble",
    description: "A community for musicians to jam, perform at school events, and improve together.",
    category: "Arts",
    created_at: "2026-07-20T09:00:00",
    training_day: "Monday & Wednesday",
    training_time: "16:00 – 18:00",
    location: "Music Room D1-05",
    contact_information: "Ms. Sarah Lim — sarah_lim@rp.edu.sg",
    image: "https://www.northvistasec.moe.edu.sg/images/CCA/String%20Ensemble/String_Ensemble_2025_1.jpg"
  },
  {
    cca_id: 6,
    cca_name: "Community Service Club",
    description: "Organise volunteer initiatives and make a positive impact in the local community.",
    category: "Student Life",
    created_at: "2026-07-18T11:30:00",
    training_day: "Tuesday",
    training_time: "15:00 – 16:30",
    location: "Student Hub E1-02",
    contact_information: "Mr. Ravi Sundaram — ravi_sundaram@rp.edu.sg",
    image: "https://www.sp.edu.sg/images/default-source/student-life/student-life-(sd)/ccas/service-learning/sd-wsc-v01.jpg?sfvrsn=f2239b52_1"
  },
  {
    cca_id: 7,
    cca_name: "Sports & Recreation",
    description: "Weekly sports activities including football, basketball, and badminton for all skill levels.",
    category: "Sports",
    created_at: "2026-07-22T14:00:00",
    training_day: "Monday & Friday",
    training_time: "17:00 – 19:00",
    location: "Sports Complex Field A",
    contact_information: "Coach Ahmad Faiz — ahmad_faiz@rp.edu.sg",
    image: "https://www.smu.edu.sg/sites/default/files/inline-images/sports-adventure-lg.jpg"
  }
];

const timetables = [
  {
    timetable_id: 1,
    user_id: 2,
    owner_name: "AishaR",
    title: "IT-02 Y3S1 Timetable",
    diploma: "Diploma in Information Technology",
    class_code: "IT-02",
    shared_at: "2026-07-19T08:00:00"
  },
  {
    timetable_id: 2,
    user_id: 3,
    owner_name: "WeiMingT",
    title: "MT-03 Y3S1 Timetable",
    diploma: "Diploma in Mechatronics Engineering",
    class_code: "MT-03",
    shared_at: "2026-07-18T12:00:00"
  },
  {
    timetable_id: 3,
    user_id: 5,
    owner_name: "MarcusO",
    title: "IT-01 Y2S1 Timetable",
    diploma: "Diploma in Information Technology",
    class_code: "IT-01",
    shared_at: "2026-07-17T09:30:00"
  }
];

// Helper: current logged-in demo user
const CURRENT_USER_ID = 1;

module.exports = {
  users,
  profiles,
  questions,
  groups,
  ccas,
  timetables,
  CURRENT_USER_ID
};

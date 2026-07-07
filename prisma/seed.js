const { PrismaClient } = require("@prisma/client");
require("dotenv/config");
const crypto = require("crypto");

const prisma = new PrismaClient();

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

const sources = [
  "Pronunciation Practice",
  "MCQ Bank",
  "Guided Cloze Collection",
  "Open Cloze Collection",
  "Word Formation Bank",
  "Sentence Transformation Bank",
  "Error Identification Bank",
  "Reading Collection",
  "Writing Prompts",
  "1000 Trios Inspired Practice",
  "Collocations Practice",
  "Phrasal Verbs Practice",
  "Transitions Practice",
  "Conditionals and Inversions",
];

const topics = [
  ["Inversion", "inversion", "Các cấu trúc đảo ngữ thường gặp trong đề chuyên."],
  ["Conditionals", "conditionals", "Câu điều kiện, mixed conditionals và biến thể nâng cao."],
  ["Negative Prefixes", "negative-prefixes", "Tiền tố phủ định như un-, in-, im-, dis-, non-."],
  ["Suffixes", "suffixes", "Hậu tố tạo danh từ, tính từ, trạng từ và động từ."],
  ["Collocations", "collocations", "Cụm từ kết hợp tự nhiên trong văn cảnh học thuật."],
  ["Phrasal Verbs", "phrasal-verbs", "Cụm động từ và sắc thái nghĩa trong câu."],
  ["Discourse Markers", "discourse-markers", "Từ nối, liên kết ý và chuyển đoạn."],
  ["Pronunciation of -ed", "pronunciation-of-ed", "Ba cách đọc đuôi -ed."],
  ["Vowel Sounds", "vowel-sounds", "Nguyên âm dễ nhầm trong bài phát âm."],
  ["Register", "register", "Sắc thái trang trọng, trung tính và thân mật."],
  ["Reading Inference", "reading-inference", "Suy luận từ thông tin ngầm trong đoạn văn."],
  ["Word Class", "word-class", "Xác định loại từ cần điền theo cấu trúc câu."],
  ["Idiomatic Transformations", "idiomatic-transformations", "Biến đổi câu bằng cụm cố định và cấu trúc đặc biệt."],
];

const theoryNotes = [
  ["Cách làm Pronunciation", "PRONUNCIATION", "Gạch chân âm cần xét, phân nhóm theo quy tắc trước, rồi kiểm tra ngoại lệ. Với -ed, nhớ /t/ sau âm vô thanh, /d/ sau âm hữu thanh, /ɪd/ sau /t/ hoặc /d/."],
  ["Cách làm Multiple Choice nâng cao", "MULTIPLE_CHOICE", "Đọc cả câu trước khi nhìn đáp án. Xác định vai trò ngữ pháp của chỗ trống, sau đó loại đáp án sai về collocation, register hoặc logic."],
  ["Cách làm Word Formation", "WORD_FORMATION", "Nhìn từ đứng trước và sau chỗ trống để xác định loại từ. Kiểm tra số ít/số nhiều, phủ định, tiền tố và hậu tố trước khi nộp."],
  ["Cách làm Sentence Transformation", "SENTENCE_TRANSFORMATION", "Giữ nguyên nghĩa gốc, không thêm thông tin mới. Nếu có keyword, không đổi dạng keyword trừ khi đề cho phép. Ưu tiên cấu trúc cố định."],
  ["Cách làm Guided Cloze", "GUIDED_CLOZE", "Đọc toàn đoạn để nắm mạch ý. Với mỗi chỗ trống, kiểm tra ngữ pháp cục bộ và liên kết với câu trước/sau."],
  ["Cách làm Open Cloze", "OPEN_CLOZE", "Dự đoán loại từ và chức năng trước khi viết. Đáp án thường là giới từ, mạo từ, đại từ, trợ động từ hoặc từ nối ngắn."],
  ["Cách làm Error Identification", "ERROR_IDENTIFICATION", "Đọc câu như một hệ thống: chủ-vị, thì, song song, đại từ quy chiếu, mạo từ, giới từ. Sau khi chọn lỗi, viết bản sửa rõ ràng."],
  ["Cách làm Reading", "READING", "Phân biệt thông tin trực tiếp và suy luận. Với câu hỏi inference, tìm bằng chứng gần nhất rồi chọn đáp án không đi quá xa đoạn văn."],
  ["Cách làm Writing", "WRITING", "Lập thesis rõ, mỗi đoạn một vai trò. Ưu tiên lập luận chính xác, liên kết mạch lạc và từ vựng học thuật vừa đủ thay vì câu quá dài."],
  ["Cách học collocations/phrasal verbs", "COLLOCATIONS", "Học theo cụm trong câu hoàn chỉnh. Ghi lại động từ trung tâm, danh từ đi kèm và register của cụm."],
  ["Cách xử lý trios/gapped sentences", "TRIOS", "Tìm một từ có thể đổi sắc thái nghĩa giữa ba câu. Thử collocation ở từng câu, sau đó kiểm tra xem cùng một dạng từ có đứng được cả ba vị trí không."],
];

function mcq(prompt, options, correctOptionId, explanation, orderIndex = 0) {
  return {
    prompt,
    options: options.map(([id, text]) => ({ id, text })),
    answer: { correctOptionId },
    explanation,
    orderIndex,
  };
}

function textQuestion(prompt, acceptedAnswers, explanation, extra = {}, orderIndex = 0) {
  return {
    prompt,
    answer: { acceptedAnswers, ...extra },
    explanation,
    orderIndex,
  };
}

const problemSeeds = [
  {
    title: "Inversion after negative adverbials",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "CHUYEN",
    source: "MCQ Bank",
    topics: ["Inversion", "Idiomatic Transformations"],
    statement: "Chọn đáp án đúng để hoàn thành câu với cấu trúc đảo ngữ.",
    instructions: "Tập trung vào vị trí trợ động từ sau cụm phủ định.",
    estimatedMinutes: 6,
    questions: [
      mcq("Hardly ____ the announcement when the room fell silent.", [["A", "the principal had made"], ["B", "had the principal made"], ["C", "did the principal made"], ["D", "was the principal make"]], "B", "Sau hardly ở đầu câu, dùng đảo ngữ: had + S + V3.", 0),
      mcq("Not until the final paragraph ____ the writer's real attitude.", [["A", "we understand"], ["B", "we understood"], ["C", "did we understand"], ["D", "had understood we"]], "C", "Not until đặt đầu câu kéo theo đảo ngữ ở mệnh đề chính.", 1),
    ],
  },
  {
    title: "Register and precise word choice",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "C1",
    source: "MCQ Bank",
    topics: ["Register", "Collocations"],
    statement: "Chọn từ phù hợp nhất với sắc thái trang trọng của câu.",
    estimatedMinutes: 5,
    questions: [
      mcq("The committee decided to ____ the proposal until more evidence was available.", [["A", "put off"], ["B", "defer"], ["C", "hang on"], ["D", "slow up"]], "B", "Defer trang trọng hơn và phù hợp với văn cảnh committee/proposal.", 0),
      mcq("Her explanation was clear, but it failed to ____ the central objection.", [["A", "address"], ["B", "chat"], ["C", "repair"], ["D", "tell"]], "A", "Address an objection là collocation học thuật.", 1),
    ],
  },
  {
    title: "Pronunciation of regular past tense",
    skillType: "PRONUNCIATION",
    questionType: "PRONUNCIATION_ODD_ONE_OUT",
    difficulty: "B2",
    source: "Pronunciation Practice",
    topics: ["Pronunciation of -ed"],
    statement: "Chọn từ có phần gạch chân phát âm khác các từ còn lại.",
    instructions: "Xét âm cuối của động từ gốc trước khi thêm -ed.",
    estimatedMinutes: 4,
    questions: [
      mcq("Chọn từ có đuôi -ed phát âm khác.", [["A", "watched"], ["B", "laughed"], ["C", "washed"], ["D", "wanted"]], "D", "Wanted kết thúc bằng /t/ nên -ed đọc /ɪd/; các từ còn lại đọc /t/.", 0),
      mcq("Chọn từ có đuôi -ed phát âm khác.", [["A", "played"], ["B", "opened"], ["C", "decided"], ["D", "called"]], "C", "Decided kết thúc bằng /d/ nên -ed đọc /ɪd/; các từ còn lại đọc /d/.", 1),
    ],
  },
  {
    title: "Contrasting vowel sounds",
    skillType: "PRONUNCIATION",
    questionType: "PRONUNCIATION_ODD_ONE_OUT",
    difficulty: "C1",
    source: "Pronunciation Practice",
    topics: ["Vowel Sounds"],
    statement: "Chọn từ có nguyên âm chính khác nhóm.",
    estimatedMinutes: 4,
    questions: [
      mcq("Chọn từ có âm gạch chân khác.", [["A", "heat"], ["B", "seat"], ["C", "bread"], ["D", "leave"]], "C", "Bread có /e/, các từ còn lại có /iː/.", 0),
      mcq("Chọn từ có âm gạch chân khác.", [["A", "flood"], ["B", "blood"], ["C", "wood"], ["D", "enough"]], "C", "Wood có /ʊ/; flood, blood, enough thường có /ʌ/.", 1),
    ],
  },
  {
    title: "Negative prefixes in context",
    skillType: "WORD_FORMATION",
    questionType: "WORD_FORMATION",
    difficulty: "CHUYEN",
    source: "Word Formation Bank",
    topics: ["Negative Prefixes", "Word Class"],
    statement: "Điền dạng đúng của từ trong ngoặc.",
    estimatedMinutes: 6,
    questions: [
      textQuestion("The plan sounded attractive, but it was completely ____ in a school with limited staff. (PRACTICE)", ["impractical"], "Cần tính từ phủ định sau was completely.", { rootWord: "PRACTICE", correctForm: "impractical", wordClass: "adjective", note: "im- + practical tạo nghĩa không thực tế." }, 0),
      textQuestion("His argument was persuasive but not entirely ____. (LOGIC)", ["logical"], "Sau not entirely cần tính từ; câu không yêu cầu phủ định bằng tiền tố.", { rootWord: "LOGIC", correctForm: "logical", wordClass: "adjective", note: "Logic → logical." }, 1),
    ],
  },
  {
    title: "Suffixes and word class control",
    skillType: "WORD_FORMATION",
    questionType: "WORD_FORMATION",
    difficulty: "C1",
    source: "Word Formation Bank",
    topics: ["Suffixes", "Word Class"],
    statement: "Hoàn thành câu bằng dạng từ phù hợp.",
    estimatedMinutes: 6,
    questions: [
      textQuestion("The judges praised the ____ of her argument. (CLEAR)", ["clarity"], "Sau the và trước of cần danh từ.", { rootWord: "CLEAR", correctForm: "clarity", wordClass: "noun", note: "Clear → clarity." }, 0),
      textQuestion("The speaker answered each question with impressive ____. (PRECISE)", ["precision"], "With + danh từ; precise đổi thành precision.", { rootWord: "PRECISE", correctForm: "precision", wordClass: "noun", note: "Precise → precision." }, 1),
    ],
  },
  {
    title: "Sentence transformation with inversion",
    skillType: "SENTENCE_TRANSFORMATION",
    questionType: "SENTENCE_TRANSFORMATION",
    difficulty: "HSG",
    source: "Sentence Transformation Bank",
    topics: ["Inversion", "Idiomatic Transformations"],
    statement: "Viết lại câu sao cho nghĩa không đổi.",
    estimatedMinutes: 8,
    questions: [
      textQuestion("She had just entered the room when everyone started clapping. Begin with: No sooner", ["no sooner had she entered the room than everyone started clapping"], "Exact match được chấm tự động; biến thể khác cần giáo viên kiểm tra.", { modelAnswer: "No sooner had she entered the room than everyone started clapping.", note: "No sooner + had + S + V3 + than + clause." }, 0),
      textQuestion("I only realised the mistake after reading the final line. Begin with: Only after", ["only after reading the final line did i realise the mistake"], "Only after ở đầu câu kéo theo đảo ngữ ở mệnh đề chính.", { modelAnswer: "Only after reading the final line did I realise the mistake.", note: "Only after + V-ing/noun phrase + auxiliary + subject + verb." }, 1),
    ],
  },
  {
    title: "Conditionals without if",
    skillType: "SENTENCE_TRANSFORMATION",
    questionType: "SENTENCE_TRANSFORMATION",
    difficulty: "CHUYEN",
    source: "Sentence Transformation Bank",
    topics: ["Conditionals", "Idiomatic Transformations"],
    statement: "Dùng cấu trúc đảo ngữ điều kiện để viết lại câu.",
    estimatedMinutes: 8,
    questions: [
      textQuestion("If I had known about the deadline, I would have submitted the essay earlier. Begin with: Had", ["had i known about the deadline i would have submitted the essay earlier"], "Exact match bỏ qua viết hoa và dấu câu.", { modelAnswer: "Had I known about the deadline, I would have submitted the essay earlier.", note: "Had + S + V3 thay cho if trong câu điều kiện loại 3." }, 0),
      textQuestion("If the instructions are unclear, ask your teacher before you start. Begin with: Should", ["should the instructions be unclear ask your teacher before you start"], "Đảo ngữ với should dùng cho điều kiện có khả năng xảy ra.", { modelAnswer: "Should the instructions be unclear, ask your teacher before you start.", note: "Should + S + be/adjective, imperative clause." }, 1),
    ],
  },
  {
    title: "Guided cloze: discourse in a study group",
    skillType: "GUIDED_CLOZE",
    questionType: "GUIDED_CLOZE",
    difficulty: "C1",
    source: "Guided Cloze Collection",
    topics: ["Discourse Markers", "Register"],
    statement: "Chọn đáp án đúng cho từng chỗ trống trong đoạn văn.",
    instructions: "Đọc toàn đoạn trước khi chọn.",
    estimatedMinutes: 8,
    passage: "A productive study group is not simply a meeting where everyone brings notes. It works best when members explain ideas to one another. (1) ___, weaker members can ask questions immediately. (2) ___, stronger members also benefit because explaining a concept reveals gaps in their own understanding. (3) ___, the group should keep a clear agenda. Without one, discussion may become friendly but unfocused.",
    questions: [
      mcq("Blank 1", [["A", "As a result"], ["B", "Even so"], ["C", "Instead"], ["D", "Otherwise"]], "A", "Câu sau là hệ quả tích cực của việc giải thích cho nhau.", 0),
      mcq("Blank 2", [["A", "In contrast"], ["B", "Moreover"], ["C", "Nevertheless"], ["D", "For instance"]], "B", "Thêm một lợi ích khác nên dùng moreover.", 1),
      mcq("Blank 3", [["A", "However"], ["B", "For example"], ["C", "Similarly"], ["D", "In short"]], "A", "Chuyển sang điều kiện/cảnh báo nên dùng however.", 2),
    ],
  },
  {
    title: "Guided cloze: formal recommendation",
    skillType: "GUIDED_CLOZE",
    questionType: "GUIDED_CLOZE",
    difficulty: "CHUYEN",
    source: "Guided Cloze Collection",
    topics: ["Discourse Markers", "Register"],
    statement: "Hoàn thành đoạn văn bằng lựa chọn phù hợp.",
    estimatedMinutes: 8,
    passage: "The library should extend its opening hours during exam season. Many students revise after school activities, (1) ___ the current closing time leaves them with little quiet space. (2) ___, the change need not be expensive if volunteers support the evening desk. (3) ___, a short trial period would allow the school to measure real demand.",
    questions: [
      mcq("Blank 1", [["A", "so"], ["B", "although"], ["C", "unless"], ["D", "whereas"]], "A", "Vế sau là kết quả trực tiếp.", 0),
      mcq("Blank 2", [["A", "By contrast"], ["B", "Furthermore"], ["C", "Even though"], ["D", "Such as"]], "B", "Thêm luận điểm hỗ trợ đề xuất.", 1),
      mcq("Blank 3", [["A", "Finally"], ["B", "Despite"], ["C", "Because"], ["D", "Likewise"]], "A", "Đưa giải pháp cuối cùng trong chuỗi lập luận.", 2),
    ],
  },
  {
    title: "Open cloze: independent learning",
    skillType: "OPEN_CLOZE",
    questionType: "OPEN_CLOZE",
    difficulty: "C1",
    source: "Open Cloze Collection",
    topics: ["Discourse Markers", "Word Class"],
    statement: "Điền một từ vào mỗi chỗ trống.",
    estimatedMinutes: 8,
    passage: "Independent learning does not mean studying alone all the time. It means knowing (1) ___ to ask for help and how to evaluate advice. A learner who keeps a record of mistakes is more likely (2) ___ notice patterns. Over time, this habit turns correction (3) ___ progress.",
    questions: [
      textQuestion("Blank 1", ["when"], "Cấu trúc knowing when to ask.", {}, 0),
      textQuestion("Blank 2", ["to"], "Be likely to do something.", {}, 1),
      textQuestion("Blank 3", ["into"], "Turn something into something.", {}, 2),
    ],
  },
  {
    title: "Open cloze: classroom debate",
    skillType: "OPEN_CLOZE",
    questionType: "OPEN_CLOZE",
    difficulty: "CHUYEN",
    source: "Open Cloze Collection",
    topics: ["Discourse Markers", "Register"],
    statement: "Điền từ còn thiếu trong đoạn văn.",
    estimatedMinutes: 8,
    passage: "In a classroom debate, a strong speaker listens as carefully (1) ___ they speak. If an opponent makes a valid point, it is better to acknowledge it (2) ___ ignore it. This shows confidence and makes the final argument (3) ___ persuasive.",
    questions: [
      textQuestion("Blank 1", ["as"], "So sánh cân bằng: as carefully as.", {}, 0),
      textQuestion("Blank 2", ["than"], "Better to do X than do Y.", {}, 1),
      textQuestion("Blank 3", ["more"], "More persuasive là so sánh hơn.", {}, 2),
    ],
  },
  {
    title: "Error identification: agreement and reference",
    skillType: "ERROR_IDENTIFICATION",
    questionType: "ERROR_IDENTIFICATION",
    difficulty: "C1",
    source: "Error Identification Bank",
    topics: ["Word Class", "Register"],
    statement: "Chọn phần sai và viết phần sửa.",
    estimatedMinutes: 7,
    questions: [
      {
        prompt: "The list of recommended books (A) were (B) updated after the teacher (C) reviewed (D) the new syllabus.",
        options: [{ id: "A", text: "The list of recommended books" }, { id: "B", text: "were" }, { id: "C", text: "reviewed" }, { id: "D", text: "the new syllabus" }],
        answer: { correctPart: "B", correction: "was" },
        explanation: "Chủ ngữ chính là The list, số ít, nên dùng was.",
        orderIndex: 0,
      },
      {
        prompt: "Each student (A) must submit (B) their essay (C) before the bell (D) rings.",
        options: [{ id: "A", text: "Each student" }, { id: "B", text: "must submit" }, { id: "C", text: "their essay" }, { id: "D", text: "rings" }],
        answer: { correctPart: "C", correction: "his or her essay / their essay accepted in modern usage" },
        explanation: "Trong văn phong thi truyền thống, each student thường đi với his or her; modern singular they có thể được chấp nhận tùy quy định.",
        orderIndex: 1,
      },
    ],
  },
  {
    title: "Error identification: parallel structure",
    skillType: "ERROR_IDENTIFICATION",
    questionType: "ERROR_IDENTIFICATION",
    difficulty: "CHUYEN",
    source: "Error Identification Bank",
    topics: ["Word Class", "Idiomatic Transformations"],
    statement: "Xác định lỗi sai trong câu.",
    estimatedMinutes: 7,
    questions: [
      {
        prompt: "The course aims (A) to improve accuracy, (B) expanding vocabulary, and (C) developing confidence (D) in speaking.",
        options: [{ id: "A", text: "to improve accuracy" }, { id: "B", text: "expanding vocabulary" }, { id: "C", text: "developing confidence" }, { id: "D", text: "in speaking" }],
        answer: { correctPart: "B", correction: "to expand vocabulary" },
        explanation: "Danh sách cần song song: to improve, to expand, and to develop.",
        orderIndex: 0,
      },
      {
        prompt: "Rarely (A) a student can (B) master transformations (C) without reviewing (D) fixed phrases.",
        options: [{ id: "A", text: "Rarely" }, { id: "B", text: "a student can" }, { id: "C", text: "master transformations" }, { id: "D", text: "without reviewing" }],
        answer: { correctPart: "B", correction: "can a student" },
        explanation: "Rarely đầu câu cần đảo ngữ: can a student.",
        orderIndex: 1,
      },
    ],
  },
  {
    title: "Reading inference: quiet confidence",
    skillType: "READING",
    questionType: "READING_MCQ",
    difficulty: "C1",
    source: "Reading Collection",
    topics: ["Reading Inference"],
    statement: "Đọc đoạn văn và trả lời câu hỏi.",
    estimatedMinutes: 10,
    passage: "Mina rarely spoke first in class discussions, but her notes were unusually detailed. When the teacher asked a difficult question, she would look down for a few seconds, underline something, and then offer a concise answer. Her classmates sometimes mistook this pause for uncertainty. In fact, it was the moment when she checked whether her evidence matched her claim.",
    questions: [
      mcq("What can be inferred about Mina's pauses?", [["A", "They show she has not prepared."], ["B", "They help her connect answers with evidence."], ["C", "They make her classmates more confident."], ["D", "They are required by the teacher."]], "B", "Đoạn cuối nói cô ấy kiểm tra evidence có khớp claim không.", 0),
      mcq("The writer presents Mina as ____.", [["A", "careless but fluent"], ["B", "quiet but thoughtful"], ["C", "popular but impatient"], ["D", "uncertain and passive"]], "B", "Mina ít nói nhưng câu trả lời ngắn gọn và dựa trên ghi chú.", 1),
    ],
  },
  {
    title: "Reading MCQ: a school library proposal",
    skillType: "READING",
    questionType: "READING_MCQ",
    difficulty: "CHUYEN",
    source: "Reading Collection",
    topics: ["Reading Inference", "Register"],
    statement: "Chọn đáp án đúng dựa trên đoạn văn.",
    estimatedMinutes: 10,
    passage: "The new reading corner was not designed to be silent. Instead, it offered a place where students could recommend books, compare translations, and prepare short talks. Teachers noticed that reluctant readers visited more often when they could enter through conversation rather than formal assignments.",
    questions: [
      mcq("Why did reluctant readers visit more often?", [["A", "They were promised higher marks."], ["B", "They preferred conversation as a way into reading."], ["C", "The corner banned formal assignments."], ["D", "Teachers stopped checking their work."]], "B", "Câu cuối nêu entering through conversation rather than formal assignments.", 0),
      mcq("The reading corner is best described as ____.", [["A", "social and purposeful"], ["B", "silent and strict"], ["C", "temporary and unpopular"], ["D", "competitive and private"]], "A", "Không im lặng tuyệt đối; có hoạt động trao đổi và chuẩn bị talk.", 1),
    ],
  },
  {
    title: "Writing prompt: school policy essay",
    skillType: "WRITING",
    questionType: "WRITING_PROMPT",
    difficulty: "HSG",
    source: "Writing Prompts",
    topics: ["Register"],
    statement: "Viết bài luận 180-220 từ.",
    instructions: "Bài viết sẽ được đánh dấu Cần giáo viên chấm trong MVP.",
    estimatedMinutes: 30,
    questions: [
      {
        prompt: "Some schools require students to join at least one academic club. Do you think this policy should be compulsory?",
        answer: { needsReview: true, rubric: ["Task response", "Coherence", "Lexical resource", "Grammar range and accuracy", "Academic sophistication"] },
        explanation: "Bài viết cần giáo viên chấm vì có nhiều đáp án hợp lệ.",
        orderIndex: 0,
      },
    ],
  },
  {
    title: "Trios: one word, three meanings",
    skillType: "TRIOS",
    questionType: "TRIOS_GAPPED_SENTENCES",
    difficulty: "CHUYEN",
    source: "1000 Trios Inspired Practice",
    topics: ["Collocations", "Idiomatic Transformations"],
    statement: "Điền một từ duy nhất phù hợp cả ba câu.",
    estimatedMinutes: 5,
    questions: [
      textQuestion("1. The hotel will ____ an extra fee for late checkout.\n2. She took ____ of the debate team after the captain moved away.\n3. The phone needs a full ____ before the trip.", ["charge"], "Charge collocates with fee, take charge of, and battery charge.", { note: "charge a fee / take charge of / a full charge" }, 0),
    ],
  },
  {
    title: "Trios: shared academic word",
    skillType: "TRIOS",
    questionType: "TRIOS_GAPPED_SENTENCES",
    difficulty: "C1",
    source: "1000 Trios Inspired Practice",
    topics: ["Collocations"],
    statement: "Tìm từ chung cho ba câu.",
    estimatedMinutes: 5,
    questions: [
      textQuestion("1. Draw a clear ____ between fact and opinion.\n2. Please stand in ____ while waiting for your turn.\n3. The poet repeats the final ____ for emphasis.", ["line"], "Line works in draw a line, stand in line, and line of a poem.", { note: "draw a line / stand in line / final line" }, 0),
    ],
  },
  {
    title: "Collocations for academic writing",
    skillType: "COLLOCATIONS",
    questionType: "MCQ",
    difficulty: "C1",
    source: "Collocations Practice",
    topics: ["Collocations", "Register"],
    statement: "Chọn collocation tự nhiên nhất.",
    estimatedMinutes: 5,
    questions: [
      mcq("The evidence ____ serious doubt on the witness's account.", [["A", "throws"], ["B", "puts"], ["C", "casts"], ["D", "makes"]], "C", "Cast doubt on là collocation cố định.", 0),
      mcq("The report ____ attention to a growing problem in rural schools.", [["A", "draws"], ["B", "pulls"], ["C", "catches"], ["D", "takes"]], "A", "Draw attention to something.", 1),
    ],
  },
  {
    title: "Phrasal verbs in formal contexts",
    skillType: "PHRASAL_VERBS",
    questionType: "MCQ",
    difficulty: "C1",
    source: "Phrasal Verbs Practice",
    topics: ["Phrasal Verbs", "Register"],
    statement: "Chọn cụm động từ phù hợp với nghĩa của câu.",
    estimatedMinutes: 5,
    questions: [
      mcq("The plan was ____ because the budget had been cut.", [["A", "called off"], ["B", "looked into"], ["C", "brought up"], ["D", "put through"]], "A", "Call off = cancel.", 0),
      mcq("The committee promised to ____ the complaint carefully.", [["A", "take after"], ["B", "look into"], ["C", "get over"], ["D", "turn down"]], "B", "Look into = investigate.", 1),
    ],
  },
  {
    title: "Transitions between arguments",
    skillType: "TRANSITIONS",
    questionType: "MCQ",
    difficulty: "B2",
    source: "Transitions Practice",
    topics: ["Discourse Markers"],
    statement: "Chọn từ nối phù hợp nhất.",
    estimatedMinutes: 5,
    questions: [
      mcq("The new rule may reduce noise. ____, it could make group work more difficult.", [["A", "However"], ["B", "For example"], ["C", "Therefore"], ["D", "Likewise"]], "A", "Hai ý tương phản.", 0),
      mcq("Many students revise late at night. ____, the library should stay open longer during exam week.", [["A", "In contrast"], ["B", "As a result"], ["C", "Instead"], ["D", "Although"]], "B", "Ý sau là hệ quả/đề xuất từ thực tế trước.", 1),
    ],
  },
  {
    title: "Grammar focus: conditionals and inversion",
    skillType: "GRAMMAR_FOCUS",
    questionType: "MCQ",
    difficulty: "HSG",
    source: "Conditionals and Inversions",
    topics: ["Conditionals", "Inversion"],
    statement: "Chọn cấu trúc ngữ pháp chính xác.",
    estimatedMinutes: 6,
    questions: [
      mcq("____ the weather improve, the speaking test will be held outside.", [["A", "Should"], ["B", "Were"], ["C", "Had"], ["D", "Unless"]], "A", "Should + S + V dùng cho điều kiện tương lai có khả năng.", 0),
      mcq("Were he ____ more carefully, he would notice the hidden contrast.", [["A", "read"], ["B", "to read"], ["C", "reading"], ["D", "reads"]], "B", "Were + S + to V dùng cho điều kiện giả định.", 1),
    ],
  },
];

async function main() {
  await prisma.assignmentProblemSubmission.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignmentProblem.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.classroomMember.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.manualGrade.deleteMany();
  await prisma.submissionAnswer.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.userProblemStatus.deleteMany();
  await prisma.contentAuditLog.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.contentPack.deleteMany();
  await prisma.problemTopic.deleteMany();
  await prisma.question.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.theoryNote.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.sourceCollection.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const student = await prisma.user.create({
    data: {
      email: "student@example.com",
      passwordHash: hashPassword("password123"),
      displayName: "Học viên Demo",
      role: "STUDENT",
      profile: {
        create: {
          targetExam: "Chuyên Anh",
          schoolTarget: "Trường THPT chuyên",
          level: "C1",
        },
      },
    },
  });

  const teacher = await prisma.user.create({
    data: {
      email: "teacher@example.com",
      passwordHash: hashPassword("password123"),
      displayName: "Giáo viên Demo",
      role: "TEACHER",
      profile: {
        create: {
          targetExam: "HSG/Chuyên Anh",
          schoolTarget: "Nhiều trường",
          level: "Teacher",
        },
      },
    },
  });

  const sourceMap = new Map();
  for (const name of sources) {
    const source = await prisma.sourceCollection.create({
      data: {
        name,
        description: `${name} - bộ mẫu thủ công cho MVP Englishphile.`,
        sourceType: "MANUAL",
        copyrightNote: "Original seed content written for the MVP. No worksheet passages copied.",
      },
    });
    sourceMap.set(name, source);
  }

  const topicMap = new Map();
  for (const [name, slug, description] of topics) {
    const topic = await prisma.topic.create({ data: { name, slug, description } });
    topicMap.set(name, topic);
  }

  for (const [index, [title, skillType, content]] of theoryNotes.entries()) {
    await prisma.theoryNote.create({
      data: {
        title,
        slug: slugify(title),
        skillType,
        content,
        orderIndex: index,
      },
    });
  }

  for (const [index, seed] of problemSeeds.entries()) {
    const problem = await prisma.problem.create({
      data: {
        title: seed.title,
        slug: slugify(seed.title),
        skillType: seed.skillType,
        questionType: seed.questionType,
        difficulty: seed.difficulty,
        sourceCollectionId: sourceMap.get(seed.source)?.id,
        statement: seed.statement,
        instructions: seed.instructions,
        estimatedMinutes: seed.estimatedMinutes,
        acceptanceRate: 0.58 + ((index % 7) * 0.04),
        contentStatus: "PUBLISHED",
        publishedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: teacher.id,
        orderIndex: index,
        problemTopics: {
          create: seed.topics.map((topicName) => ({ topicId: topicMap.get(topicName).id })),
        },
      },
    });

    for (const question of seed.questions) {
      await prisma.question.create({
        data: {
          problemId: problem.id,
          type: seed.questionType,
          skillType: seed.skillType,
          difficulty: seed.difficulty,
          prompt: question.prompt,
          passage: question.passage ?? seed.passage ?? null,
          options: question.options ?? null,
          answer: question.answer,
          explanation: question.explanation,
          rootWord: question.answer?.rootWord ?? question.answer?.rootWord,
          keyword: question.keyword ?? null,
          targetSentence: question.answer?.modelAnswer ?? null,
          lineNumber: question.lineNumber ?? null,
          metadata: question.answer?.note ? { note: question.answer.note } : null,
          contentStatus: "PUBLISHED",
          reviewedAt: new Date(),
          reviewedById: teacher.id,
          orderIndex: question.orderIndex ?? 0,
        },
      });
    }
  }

  const firstProblem = await prisma.problem.findFirst({
    where: { slug: "inversion-after-negative-adverbials" },
  });

  if (firstProblem) {
    await prisma.userProblemStatus.create({
      data: {
        userId: student.id,
        problemId: firstProblem.id,
        status: "ATTEMPTED",
        bestScore: 1,
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    });
  }

  const firstDemoProblems = await prisma.problem.findMany({
    where: { contentStatus: "PUBLISHED" },
    orderBy: { orderIndex: "asc" },
    take: 3,
  });
  const [transformationDemoProblem, writingDemoProblem] = await Promise.all([
    prisma.problem.findFirst({ where: { contentStatus: "PUBLISHED", skillType: "SENTENCE_TRANSFORMATION" }, orderBy: { orderIndex: "asc" } }),
    prisma.problem.findFirst({ where: { contentStatus: "PUBLISHED", skillType: "WRITING" }, orderBy: { orderIndex: "asc" } }),
  ]);
  const demoProblems = [];
  for (const problem of [...firstDemoProblems, transformationDemoProblem, writingDemoProblem]) {
    if (problem && !demoProblems.some((item) => item.id === problem.id)) {
      demoProblems.push(problem);
    }
  }

  const classroom = await prisma.classroom.create({
    data: {
      name: "Chuyên Anh 9A",
      description: "Lớp demo cho Phase 4 classroom và assignments.",
      teacherId: teacher.id,
      joinCode: "ANH9A",
      members: {
        create: [
          { userId: teacher.id, role: "TEACHER" },
          { userId: student.id, role: "STUDENT" },
        ],
      },
    },
  });

  if (demoProblems.length >= 3) {
    const demoAssignment = await prisma.assignment.create({
      data: {
        title: "Bài giao demo: Use of English nền tảng",
        description: "Bài giao mẫu dùng nội dung seed đã xuất bản.",
        classroomId: classroom.id,
        createdById: teacher.id,
        assignmentType: "HOMEWORK",
        status: "PUBLISHED",
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        timeLimitMinutes: 45,
        showAnswersAfterSubmit: true,
        problems: {
          create: demoProblems.slice(0, 4).map((problem, index) => ({
            problemId: problem.id,
            orderIndex: index,
            points: 1,
          })),
        },
      },
    });

    await prisma.assignment.create({
      data: {
        title: "Mock test draft: Chuyên Anh 45 phút",
        description: "Đề mock mẫu ở trạng thái nháp để giáo viên chỉnh trước khi giao.",
        classroomId: classroom.id,
        createdById: teacher.id,
        assignmentType: "MOCK_TEST",
        status: "DRAFT",
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        timeLimitMinutes: 45,
        showAnswersAfterSubmit: true,
        problems: {
          create: demoProblems.map((problem, index) => ({
            problemId: problem.id,
            orderIndex: index,
            points: 1,
          })),
        },
      },
    });

    const assignmentSubmission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: demoAssignment.id,
        userId: student.id,
        status: "NEEDS_REVIEW",
        startedAt: new Date(Date.now() - 1000 * 60 * 38),
        submittedAt: new Date(Date.now() - 1000 * 60 * 4),
        score: 0,
        total: 0,
        timeSpentSeconds: 34 * 60,
        answers: {},
        resultJson: {},
      },
    });

    let assignmentScore = 0;
    let assignmentTotal = 0;
    const problemResultJson = [];

    function firstAccepted(answer) {
      if (!answer || typeof answer !== "object") return "";
      if (Array.isArray(answer.accepted)) return answer.accepted[0] ?? "";
      if (Array.isArray(answer.acceptedAnswers)) return answer.acceptedAnswers[0] ?? "";
      if (typeof answer.correctForm === "string") return answer.correctForm;
      if (typeof answer.modelAnswer === "string") return answer.modelAnswer;
      return "";
    }

    function demoAnswer(question, makeWrong) {
      const answer = question.answer || {};
      if (question.type === "WRITING_PROMPT") {
        return {
          studentAnswer: {
            thesis: "Practice makes exam preparation more effective.",
            mainIdea1: "Students can identify repeated weaknesses.",
            mainIdea2: "Teachers can give focused feedback.",
            essay: "A structured practice platform helps students prepare more deliberately, but feedback remains important for writing.",
          },
          isCorrect: null,
          feedback: "Bài viết cần giáo viên chấm theo rubric.",
        };
      }
      if (question.type === "SENTENCE_TRANSFORMATION") {
        return {
          studentAnswer: makeWrong ? "No sooner I arrived than the test started." : firstAccepted(answer),
          isCorrect: makeWrong ? null : true,
          feedback: makeWrong ? "Cần giáo viên kiểm tra biến thể câu viết lại." : "Chính xác.",
        };
      }
      if (question.type === "ERROR_IDENTIFICATION") {
        return {
          studentAnswer: makeWrong ? { part: "A", correction: "wrong" } : { part: answer.correctPart, correction: answer.correction },
          isCorrect: makeWrong ? false : true,
          feedback: makeWrong ? "Chưa đúng." : "Chính xác.",
        };
      }
      if (["MCQ", "GUIDED_CLOZE", "PRONUNCIATION_ODD_ONE_OUT", "READING_MCQ"].includes(question.type)) {
        return {
          studentAnswer: makeWrong ? "A" : answer.correctOptionId,
          isCorrect: makeWrong ? String(answer.correctOptionId).toUpperCase() === "A" : true,
          feedback: makeWrong ? "Cần xem lại lựa chọn đáp án." : "Chính xác.",
        };
      }
      return {
        studentAnswer: makeWrong ? "incorrect" : firstAccepted(answer),
        isCorrect: makeWrong ? false : true,
        feedback: makeWrong ? "Chưa đúng." : "Chính xác.",
      };
    }

    for (const [problemIndex, problem] of demoProblems.entries()) {
      const questions = await prisma.question.findMany({
        where: { problemId: problem.id, contentStatus: "PUBLISHED" },
        orderBy: { orderIndex: "asc" },
      });
      const questionResults = questions.map((question, questionIndex) => demoAnswer(question, (problemIndex + questionIndex) % 3 === 1));
      const total = questionResults.filter((result) => result.isCorrect !== null).length;
      const score = questionResults.filter((result) => result.isCorrect === true).length;
      const needsReview = questionResults.some((result) => result.isCorrect === null);
      const status = needsReview ? "NEEDS_REVIEW" : score === total ? "ACCEPTED" : score === 0 ? "WRONG_ANSWER" : "PARTIAL";

      const submission = await prisma.submission.create({
        data: {
          userId: student.id,
          problemId: problem.id,
          mode: "SINGLE_PROBLEM",
          status,
          score,
          total,
          answers: Object.fromEntries(questions.map((question, index) => [question.id, questionResults[index].studentAnswer])),
          submissionAnswers: {
            create: questions.map((question, index) => ({
              questionId: question.id,
              studentAnswer: questionResults[index].studentAnswer,
              isCorrect: questionResults[index].isCorrect,
              feedback: questionResults[index].feedback,
            })),
          },
        },
      });

      await prisma.assignmentProblemSubmission.create({
        data: {
          assignmentSubmissionId: assignmentSubmission.id,
          problemId: problem.id,
          submissionId: submission.id,
          score,
          total,
          status,
        },
      });

      await prisma.userProblemStatus.upsert({
        where: { userId_problemId: { userId: student.id, problemId: problem.id } },
        create: {
          userId: student.id,
          problemId: problem.id,
          status: status === "ACCEPTED" ? "SOLVED" : status === "WRONG_ANSWER" ? "WRONG" : status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "ATTEMPTED",
          bestScore: total > 0 ? score / total : null,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
        update: {
          status: status === "ACCEPTED" ? "SOLVED" : status === "WRONG_ANSWER" ? "WRONG" : status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "ATTEMPTED",
          bestScore: total > 0 ? score / total : null,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      assignmentScore += score;
      assignmentTotal += total;
      problemResultJson.push({ problemId: problem.id, score, total, status });
    }

    await prisma.assignmentSubmission.update({
      where: { id: assignmentSubmission.id },
      data: {
        score: assignmentScore,
        total: assignmentTotal,
        resultJson: { problems: problemResultJson },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

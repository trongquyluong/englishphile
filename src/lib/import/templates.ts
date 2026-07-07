export type ImportTemplate = {
  title: string;
  description: string;
  content: string;
};

function jsonTemplate(problem: object) {
  return JSON.stringify(
    {
      sourceCollection: {
        name: "Admin Import Demo",
        description: "Nguồn mẫu tự viết để thử import.",
        originalFileName: "admin-demo.json",
        sourceType: "JSON",
        copyrightNote: "Original sample content.",
      },
      problems: [problem],
    },
    null,
    2,
  );
}

export const importTemplates: ImportTemplate[] = [
  {
    title: "Multiple Choice JSON",
    description: "Một problem trắc nghiệm ngữ pháp/từ vựng.",
    content: jsonTemplate({
      title: "Precise academic verbs",
      slug: "precise-academic-verbs-import-demo",
      skillType: "MULTIPLE_CHOICE",
      questionType: "MCQ",
      difficulty: "C1",
      statement: "Chọn động từ học thuật phù hợp nhất.",
      instructions: "Đọc collocation trước khi chọn.",
      estimatedMinutes: 5,
      topics: ["Collocations", "Register"],
      questions: [
        {
          type: "MCQ",
          skillType: "MULTIPLE_CHOICE",
          difficulty: "C1",
          prompt: "The data ____ a steady rise in applications.",
          options: [
            { id: "A", text: "indicate" },
            { id: "B", text: "tell" },
            { id: "C", text: "speak" },
            { id: "D", text: "make" },
          ],
          answer: { correctOptionId: "A", display: "A" },
          explanation: "Data indicate a trend là collocation học thuật.",
          metadata: { note: "academic verb" },
        },
      ],
    }),
  },
  {
    title: "Pronunciation JSON",
    description: "Odd-one-out phát âm.",
    content: jsonTemplate({
      title: "Vowel contrast import demo",
      slug: "vowel-contrast-import-demo",
      skillType: "PRONUNCIATION",
      questionType: "PRONUNCIATION_ODD_ONE_OUT",
      difficulty: "B2",
      statement: "Chọn từ có nguyên âm khác nhóm.",
      topics: ["Vowel Sounds"],
      questions: [
        {
          type: "PRONUNCIATION_ODD_ONE_OUT",
          skillType: "PRONUNCIATION",
          difficulty: "B2",
          prompt: "Chọn từ có âm chính khác.",
          options: [
            { id: "A", text: "seat" },
            { id: "B", text: "leaf" },
            { id: "C", text: "bread" },
            { id: "D", text: "team" },
          ],
          answer: { correctOptionId: "C", display: "C" },
          explanation: "Bread có /e/, các từ còn lại có /iː/.",
        },
      ],
    }),
  },
  {
    title: "Word Formation JSON",
    description: "Điền dạng từ đúng.",
    content: jsonTemplate({
      title: "Suffix control import demo",
      slug: "suffix-control-import-demo",
      skillType: "WORD_FORMATION",
      questionType: "WORD_FORMATION",
      difficulty: "CHUYEN",
      statement: "Điền dạng đúng của từ trong ngoặc.",
      topics: ["Suffixes", "Word Class"],
      questions: [
        {
          type: "WORD_FORMATION",
          skillType: "WORD_FORMATION",
          difficulty: "CHUYEN",
          prompt: "Her answer showed unusual ____. (MATURE)",
          options: null,
          answer: { accepted: ["maturity"], display: "maturity" },
          explanation: "Sau showed unusual cần danh từ.",
          rootWord: "MATURE",
          metadata: { wordClass: "noun", note: "mature → maturity" },
        },
      ],
    }),
  },
  {
    title: "Sentence Transformation JSON",
    description: "Viết lại câu có đáp án mẫu.",
    content: jsonTemplate({
      title: "Only after transformation import demo",
      slug: "only-after-transformation-import-demo",
      skillType: "SENTENCE_TRANSFORMATION",
      questionType: "SENTENCE_TRANSFORMATION",
      difficulty: "HSG",
      statement: "Viết lại câu sao cho nghĩa không đổi.",
      topics: ["Inversion"],
      questions: [
        {
          type: "SENTENCE_TRANSFORMATION",
          skillType: "SENTENCE_TRANSFORMATION",
          difficulty: "HSG",
          prompt: "I understood the problem after checking the diagram. Begin with: Only after",
          answer: {
            accepted: ["only after checking the diagram did i understand the problem"],
            display: "Only after checking the diagram did I understand the problem.",
          },
          explanation: "Only after ở đầu câu kéo theo đảo ngữ.",
          metadata: { note: "Only after + V-ing + auxiliary + subject + verb" },
        },
      ],
    }),
  },
  {
    title: "Guided Cloze JSON",
    description: "Mỗi blank là một question MCQ trong cùng problem.",
    content: jsonTemplate({
      title: "Guided cloze import demo",
      slug: "guided-cloze-import-demo",
      skillType: "GUIDED_CLOZE",
      questionType: "GUIDED_CLOZE",
      difficulty: "C1",
      statement: "Chọn đáp án đúng cho đoạn văn.",
      topics: ["Discourse Markers"],
      questions: [
        {
          type: "GUIDED_CLOZE",
          skillType: "GUIDED_CLOZE",
          difficulty: "C1",
          prompt: "Blank 1",
          passage: "Good feedback is specific. (1) ___, students know exactly what to revise.",
          options: [
            { id: "A", text: "As a result" },
            { id: "B", text: "However" },
            { id: "C", text: "Instead" },
            { id: "D", text: "Although" },
          ],
          answer: { correctOptionId: "A", display: "A" },
          explanation: "Câu sau là kết quả.",
        },
      ],
    }),
  },
  {
    title: "Open Cloze JSON",
    description: "Mỗi blank là một accepted answer.",
    content: jsonTemplate({
      title: "Open cloze import demo",
      slug: "open-cloze-import-demo",
      skillType: "OPEN_CLOZE",
      questionType: "OPEN_CLOZE",
      difficulty: "C1",
      statement: "Điền một từ vào mỗi chỗ trống.",
      topics: ["Discourse Markers"],
      questions: [
        {
          type: "OPEN_CLOZE",
          skillType: "OPEN_CLOZE",
          difficulty: "C1",
          prompt: "Blank 1",
          passage: "A good essay depends not only on ideas but also (1) ___ organisation.",
          answer: { accepted: ["on"], display: "on" },
          explanation: "Depend on.",
        },
      ],
    }),
  },
  {
    title: "Error Identification JSON",
    description: "Chọn phần lỗi và correction.",
    content: jsonTemplate({
      title: "Agreement error import demo",
      slug: "agreement-error-import-demo",
      skillType: "ERROR_IDENTIFICATION",
      questionType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      statement: "Chọn phần sai và sửa.",
      topics: ["Grammar Focus"],
      questions: [
        {
          type: "ERROR_IDENTIFICATION",
          skillType: "ERROR_IDENTIFICATION",
          difficulty: "C1",
          prompt: "The group of students (A) were (B) ready (C) before the bell rang (D).",
          options: [
            { id: "A", text: "The group of students" },
            { id: "B", text: "were" },
            { id: "C", text: "ready" },
            { id: "D", text: "rang" },
          ],
          answer: { correctPart: "B", correction: "was" },
          explanation: "Chủ ngữ chính là group, số ít.",
        },
      ],
    }),
  },
  {
    title: "Trios / Gapped Sentences JSON",
    description: "Một shared word cho ba câu.",
    content: jsonTemplate({
      title: "Trios import demo",
      slug: "trios-import-demo",
      skillType: "TRIOS",
      questionType: "TRIOS_GAPPED_SENTENCES",
      difficulty: "CHUYEN",
      statement: "Điền một từ phù hợp cả ba câu.",
      topics: ["Collocations"],
      questions: [
        {
          type: "TRIOS_GAPPED_SENTENCES",
          skillType: "TRIOS",
          difficulty: "CHUYEN",
          prompt: "1. Please ____ attention to the final paragraph.\n2. The job does not ____ well.\n3. They had to ____ a fine.",
          answer: { accepted: ["pay"], display: "pay" },
          explanation: "pay attention / pay well / pay a fine.",
        },
      ],
    }),
  },
  {
    title: "Reading MCQ JSON",
    description: "Passage ngắn và câu hỏi MCQ.",
    content: jsonTemplate({
      title: "Reading inference import demo",
      slug: "reading-inference-import-demo",
      skillType: "READING",
      questionType: "READING_MCQ",
      difficulty: "C1",
      statement: "Đọc đoạn văn và chọn đáp án.",
      topics: ["Reading Inference"],
      questions: [
        {
          type: "READING_MCQ",
          skillType: "READING",
          difficulty: "C1",
          prompt: "What can be inferred about Linh?",
          passage: "Linh revised her notes after every mock test. She did not rewrite everything; she marked only the mistakes that appeared twice.",
          options: [
            { id: "A", text: "She revised selectively." },
            { id: "B", text: "She avoided mock tests." },
            { id: "C", text: "She copied all notes." },
            { id: "D", text: "She ignored repeated mistakes." },
          ],
          answer: { correctOptionId: "A", display: "A" },
          explanation: "She marked only repeated mistakes.",
        },
      ],
    }),
  },
  {
    title: "Writing Prompt JSON",
    description: "Writing luôn cần chấm thủ công.",
    content: jsonTemplate({
      title: "Writing prompt import demo",
      slug: "writing-prompt-import-demo",
      skillType: "WRITING",
      questionType: "WRITING_PROMPT",
      difficulty: "HSG",
      statement: "Viết bài luận 180-220 từ.",
      topics: ["Register"],
      questions: [
        {
          type: "WRITING_PROMPT",
          skillType: "WRITING",
          difficulty: "HSG",
          prompt: "Should schools require students to keep a weekly reading journal?",
          answer: {
            needsReview: true,
            rubric: ["Task response", "Coherence", "Lexical resource", "Grammar range and accuracy", "Academic sophistication"],
          },
          explanation: "Bài viết cần chấm thủ công.",
        },
      ],
    }),
  },
];

export const csvTemplate = `sourceName,problemTitle,problemSlug,skillType,questionType,difficulty,topicTags,statement,instructions,prompt,passage,optionsJson,answerJson,explanation,rootWord,keyword,targetSentence,metadataJson
"CSV Demo Source","CSV MCQ Demo","csv-mcq-demo","MULTIPLE_CHOICE","MCQ","C1","Collocations","Chọn collocation đúng.","","The evidence ____ doubt on the claim.","","[{""id"":""A"",""text"":""casts""},{""id"":""B"",""text"":""throws""},{""id"":""C"",""text"":""puts""},{""id"":""D"",""text"":""makes""}]","{""correctOptionId"":""A"",""display"":""A""}","Cast doubt on là collocation đúng.","","","","{""note"":""academic collocation""}"`;

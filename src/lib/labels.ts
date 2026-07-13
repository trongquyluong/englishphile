import type {
  ContentStatus,
  ContentPackStatus,
  ContestAttemptStatus,
  ContestStatus,
  ContestType,
  ContestVisibility,
  Difficulty,
  ProblemStatus,
  QuestionType,
  Role,
  SkillType,
  SubmissionStatus,
} from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  STUDENT: "Học viên",
  ADMIN: "Quản trị",
};

export const skillLabels: Record<SkillType, string> = {
  PRONUNCIATION: "Pronunciation",
  MULTIPLE_CHOICE: "Multiple Choice",
  OPEN_CLOZE: "Open Cloze",
  GUIDED_CLOZE: "Guided Cloze",
  WORD_FORMATION: "Word Formation",
  SENTENCE_TRANSFORMATION: "Sentence Transformation",
  ERROR_IDENTIFICATION: "Error Identification",
  READING: "Reading",
  WRITING: "Writing",
  LISTENING: "Listening",
  TRIOS: "Trios / Gapped Sentences",
  COLLOCATIONS: "Collocations",
  PHRASAL_VERBS: "Phrasal Verbs",
  TRANSITIONS: "Transitions",
  GRAMMAR_FOCUS: "Grammar Focus",
  USE_OF_ENGLISH: "Use of English",
};

export const skillDescriptions: Record<SkillType, string> = {
  PRONUNCIATION: "Nhận diện âm khác biệt, trọng âm và các quy tắc phát âm hay gặp trong đề chuyên.",
  MULTIPLE_CHOICE: "Bài chọn đáp án về ngữ pháp, từ vựng, register và collocation.",
  OPEN_CLOZE: "Điền từ không có lựa chọn, tập trung vào từ chức năng và mạch văn.",
  GUIDED_CLOZE: "Điền đoạn văn có đáp án A/B/C/D cho từng chỗ trống.",
  WORD_FORMATION: "Biến đổi từ gốc theo loại từ, tiền tố, hậu tố và sắc thái nghĩa.",
  SENTENCE_TRANSFORMATION: "Viết lại câu bằng cấu trúc tương đương, đảo ngữ và cụm cố định.",
  ERROR_IDENTIFICATION: "Tìm lỗi sai, sửa lỗi và hiểu quy tắc đứng sau lỗi.",
  READING: "Đọc hiểu, suy luận, mục đích tác giả và chi tiết trong đoạn văn.",
  WRITING: "Lập dàn ý, viết bài và nhận phản hồi theo tiêu chí học thuật.",
  LISTENING: "Luyện nghe theo section, transcript và câu hỏi kiểm tra ý chính, chi tiết.",
  TRIOS: "Một từ chung cho ba câu, kiểm tra collocation và đa nghĩa.",
  COLLOCATIONS: "Cụm từ tự nhiên trong văn cảnh học thuật và đời sống.",
  PHRASAL_VERBS: "Cụm động từ theo nghĩa, sắc thái và ngữ cảnh.",
  TRANSITIONS: "Từ nối và chuyển ý trong đoạn văn, bài đọc và bài viết.",
  GRAMMAR_FOCUS: "Cụm bài tập tập trung vào một điểm ngữ pháp trọng tâm.",
  USE_OF_ENGLISH: "Bài tập tổng hợp về ngữ pháp, từ vựng, collocation và register.",
};

export const difficultyLabels: Record<Difficulty, string> = {
  B2: "B2",
  C1: "C1",
  C2: "C2",
  CHUYEN: "Chuyên",
  HSG: "HSG",
};

export const questionTypeLabels: Record<QuestionType, string> = {
  PRONUNCIATION_ODD_ONE_OUT: "Phát âm khác nhóm",
  MCQ: "Trắc nghiệm",
  OPEN_CLOZE: "Open Cloze",
  GUIDED_CLOZE: "Guided Cloze",
  WORD_FORMATION: "Word Formation",
  SENTENCE_TRANSFORMATION: "Sentence Transformation",
  ERROR_IDENTIFICATION: "Error Identification",
  READING_MCQ: "Reading MCQ",
  LISTENING_MCQ: "Listening MCQ",
  LISTENING_SHORT_ANSWER: "Listening Short Answer",
  WRITING_PROMPT: "Writing Prompt",
  TRIOS_GAPPED_SENTENCES: "Trios / Gapped Sentences",
  SHORT_ANSWER: "Short Answer",
};

export const problemStatusLabels: Record<ProblemStatus, string> = {
  NOT_ATTEMPTED: "Chưa làm",
  ATTEMPTED: "Đã làm",
  SOLVED: "Đã đúng",
  WRONG: "Đã sai",
  NEEDS_REVIEW: "Cần xem lại",
};

export const contentStatusLabels: Record<ContentStatus, string> = {
  DRAFT: "Bản nháp",
  NEEDS_REVIEW: "Cần duyệt",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

export const contentPackStatusLabels: Record<ContentPackStatus, string> = {
  DRAFT: "Bản nháp",
  VALIDATED: "Đã kiểm tra",
  PARTIALLY_IMPORTED: "Import một phần",
  IMPORTED: "Đã import",
  FAILED: "Thất bại",
  ARCHIVED: "Đã lưu trữ",
};

export const contestTypeLabels: Record<ContestType, string> = {
  PAST_EXAM: "Đề thi cũ",
  LIVE_CONTEST: "Contest trực tiếp",
  PRACTICE_CONTEST: "Contest luyện tập",
};

export const contestStatusLabels: Record<ContestStatus, string> = {
  DRAFT: "Bản nháp",
  SCHEDULED: "Sắp mở",
  LIVE: "Đang mở",
  ENDED: "Đã kết thúc",
  ARCHIVED: "Đã lưu trữ",
};

export const contestVisibilityLabels: Record<ContestVisibility, string> = {
  PUBLIC: "Công khai",
  PRIVATE: "Riêng tư",
  UNLISTED: "Ẩn link",
};

export const contestAttemptStatusLabels: Record<ContestAttemptStatus, string> = {
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Đã nộp",
  LATE: "Nộp muộn",
  NEEDS_REVIEW: "Cần chấm tay",
};

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  ACCEPTED: "Đã đúng",
  WRONG_ANSWER: "Sai",
  PARTIAL: "Đúng một phần",
  NEEDS_REVIEW: "Cần chấm tay",
};

export const skillOrder: SkillType[] = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "READING",
  "WRITING",
  "LISTENING",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
];

export const difficultyOrder: Difficulty[] = ["B2", "C1", "C2", "CHUYEN", "HSG"];

export const contentStatusOrder: ContentStatus[] = ["DRAFT", "NEEDS_REVIEW", "PUBLISHED", "ARCHIVED"];

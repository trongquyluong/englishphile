export type WikiCategoryId = "use-of-english" | "reading" | "writing" | "listening" | "exam-strategy";

/**
 * Wiki article template — copy this as a starting point for new articles.
 *
 * ```ts
 * {
 *   slug: "your-article-slug-here",
 *   title: "Bài viết mới",
 *   description: "Một hoặc hai câu mô tả ngắn gọn nội dung bài viết.",
 *   category: "use-of-english", // use-of-english | reading | writing | listening | exam-strategy
 *   readingTime: "5 phút",
 *   level: "C1 – Chuyên", // optional, omit if applicable to all levels
 *   updatedAt: "2026-07-08",
 *   sections: [
 *     {
 *       // Optional intro paragraph (no heading)
 *       paragraphs: ["Dẫn nhập ngắn gọn 1–2 câu."],
 *     },
 *     {
 *       heading: "Tiêu đề phần 1",
 *       paragraphs: ["Đoạn văn 1.", "Đoạn văn 2."],
 *       items: [
 *         "Mục 1 trong danh sách.",
 *         "Mục 2 trong danh sách.",
 *       ],
 *       tip: "Mẹo hoặc lưu ý quan trọng cho phần này.",
 *     },
 *   ],
 * },
 * ```
 *
 * Rules:
 * - slug must be URL-safe (hyphens, no spaces, lowercase)
 * - readingTime is a string like "5 phút" — estimate based on ~200 words/minute
 * - level is optional; omit if article applies to all levels
 * - updatedAt uses ISO date format: YYYY-MM-DD
 * - Do not invent facts or data. Use source materials provided by the user.
 * - tip is optional per section; use sparingly for genuinely useful shortcuts
 */

export type WikiSection = {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  tip?: string;
  // Extended block types for longer articles
  quote?: QuoteBlock;
  table?: TableBlock;
  practice?: PracticeBlock;
  answerKey?: AnswerKeyBlock;
  studyPlan?: StudyPlanBlock;
  // Additional content blocks for articles with multiple content sections per heading
  items2?: string[];
  paragraphs2?: string[];
};

export type QuoteBlock = {
  type: "tip" | "note" | "example";
  content: string;
};

export type TableBlock = {
  headers: string[];
  rows: string[][];
};

export type PracticeQuestion = {
  question: string;
  options?: string[]; // For multiple choice, e.g. ["A. drawn", "B. made", ...]
  instruction?: string; // Optional instruction like "Fill each blank with ONE suitable word"
};

export type PracticeBlock = {
  title: string;
  instruction?: string;
  questions: PracticeQuestion[];
};

export type AnswerItem = {
  number: string;
  answer: string;
  explanation?: string;
};

export type AnswerKeyBlock = {
  title: string;
  items: AnswerItem[];
};

export type StudyPlanBlock = {
  days: { day: string; task: string }[];
  trackingTable?: {
    headers: string[];
    rows: string[][];
  };
};

export type WikiArticle = {
  slug: string;
  title: string;
  description: string;
  category: WikiCategoryId;
  readingTime: string;
  level?: string;
  updatedAt: string;
  sections: WikiSection[];
};

export const wikiCategoryLabels: Record<WikiCategoryId, string> = {
  "use-of-english": "Use of English",
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  "exam-strategy": "Chiến thuật thi",
};

export const wikiCategoryOrder: WikiCategoryId[] = [
  "use-of-english",
  "reading",
  "writing",
  "listening",
  "exam-strategy",
];

export const wikiArticles: WikiArticle[] = [
  {
    slug: "phan-bo-thoi-gian-khi-lam-de-chuyen-anh",
    title: "Phân bổ thời gian khi làm đề chuyên Anh",
    description:
      "Nguyên tắc chia thời gian theo section, thứ tự làm bài gợi ý và cách xử lý câu khó để không hụt giờ ở phần Writing.",
    category: "exam-strategy",
    readingTime: "6 phút",
    level: "Chuyên / HSG",
    updatedAt: "2026-07-05",
    sections: [
      {
        paragraphs: [
          "Đề chuyên Anh thường dài hơn thời gian cho phép nếu bạn làm tuần tự và cố giải từng câu đến cùng. Mục tiêu của chiến thuật thời gian rất đơn giản: phần nào bạn chắc điểm thì phải được làm trọn vẹn.",
        ],
      },
      {
        heading: "Ba nguyên tắc chung",
        items: [
          "Không để một câu khó lấy mất thời gian của cả section. Quá khoảng 90 giây chưa có hướng thì đánh dấu, bỏ qua và quay lại sau.",
          "Nếu đề cho phép làm không theo thứ tự, bắt đầu từ phần bạn chắc điểm nhất.",
          "Chừa 5–10 phút cuối để soát: chính tả Word Formation, câu bỏ trống, số từ phần Writing.",
        ],
      },
      {
        heading: "Khung tham khảo cho đề 120 phút",
        paragraphs: [
          "Tỷ lệ dưới đây là điểm xuất phát để bạn tự điều chỉnh theo cấu trúc đề của trường hoặc tỉnh mình:",
        ],
        items: [
          "Use of English (cloze, word formation, viết lại câu): khoảng 40–45 phút.",
          "Reading: khoảng 30 phút, chia đều cho từng bài đọc.",
          "Writing: tối thiểu 35 phút, trong đó 5 phút đầu dành cho dàn ý.",
          "Thời gian còn lại: soát bài và xử lý các câu đã đánh dấu.",
        ],
      },
      {
        heading: "Luyện như thi thật",
        paragraphs: [
          "Chia thời gian chỉ hiệu quả khi bạn đã quen áp lực đồng hồ. Khi luyện ở nhà, bấm giờ theo từng section thay vì cả đề — bạn sẽ nhận ra mình chậm ở phần nào.",
        ],
        tip: "Khi mục Contests có đề tính giờ, hãy làm trọn ít nhất một đề trong điều kiện như thi thật trước kỳ thi.",
      },
    ],
  },
  {
    slug: "reading-tim-evidence-truoc-khi-chon-dap-an",
    title: "Reading: tìm evidence trước khi chọn đáp án",
    description:
      "Cách định vị câu chứa căn cứ trong bài đọc và đối chiếu từng phương án để không chọn đáp án chỉ vì nghe có vẻ đúng.",
    category: "reading",
    readingTime: "4 phút",
    updatedAt: "2026-07-02",
    sections: [
      {
        paragraphs: [
          "Phần lớn câu sai trong Reading không phải do không hiểu bài, mà do chọn đáp án bằng trí nhớ hoặc cảm giác. Quy tắc an toàn: chưa chỉ ra được câu evidence trong bài thì chưa chọn.",
        ],
      },
      {
        heading: "Đọc câu hỏi trước, gạch keyword",
        paragraphs: [
          "Với mỗi câu hỏi, xác định những từ khó bị thay thế: tên riêng, số liệu, thuật ngữ. Đây là mỏ neo giúp bạn quay lại đúng đoạn văn cần đọc kỹ.",
        ],
      },
      {
        heading: "Định vị evidence trong bài",
        paragraphs: [
          "Đề hiếm khi lặp lại nguyên văn từ trong câu hỏi. Hãy tìm cách diễn đạt khác của keyword — từ đồng nghĩa, cấu trúc bị động, danh từ hóa. Khi tìm thấy, gạch chân câu đó: mọi phương án sẽ được so với nó.",
        ],
      },
      {
        heading: "Đối chiếu từng phương án với evidence",
        items: [
          "Phương án đúng thường diễn đạt lại evidence bằng từ khác, không sao chép nguyên văn.",
          "Phương án \"đúng một nửa\" — nửa đầu khớp bài, nửa sau thêm thông tin mới — là bẫy phổ biến nhất.",
          "Cẩn trọng với từ tuyệt đối như always, never, only khi bài dùng cách nói dè dặt hơn.",
          "Thông tin có thật trong bài nhưng không trả lời đúng câu hỏi vẫn là phương án sai.",
        ],
        tip: "Khi chữa bài, ghi lại câu evidence cho đáp án đúng và lý do loại từng phương án còn lại. Cách này luyện kỹ năng định vị nhanh hơn là chỉ làm thêm đề mới.",
      },
    ],
  },
  {
    slug: "viet-lai-cau-dung-doi-nghia-goc",
    title: "Viết lại câu: đừng đổi nghĩa gốc",
    description:
      "Bốn kiểu đổi nghĩa hay gặp khi viết lại câu và quy trình so nghĩa từng vế trước khi chốt đáp án.",
    category: "use-of-english",
    readingTime: "4 phút",
    updatedAt: "2026-06-30",
    sections: [
      {
        paragraphs: [
          "Một câu viết lại đúng ngữ pháp nhưng lệch nghĩa vẫn là câu sai. Nghĩa của câu mới phải khớp câu gốc trước khi xét bất kỳ tiêu chí nào khác.",
        ],
      },
      {
        heading: "Bốn kiểu đổi nghĩa hay gặp",
        items: [
          "Đổi thì làm đổi thời điểm: \"He has lived here for years\" khác \"He lived here for years\".",
          "Rơi mất ý phủ định khi đảo cấu trúc, nhất là với hardly, seldom, unless.",
          "Đổi mức độ chắc chắn: must diễn tả suy luận gần như chắc chắn, may/might chỉ là khả năng.",
          "Thêm hoặc bớt thông tin so với câu gốc để câu nghe \"xuôi tai\" hơn.",
        ],
      },
      {
        heading: "Quy trình an toàn",
        items: [
          "Diễn đạt nghĩa câu gốc bằng lời của bạn: ai làm gì, khi nào, chắc chắn đến đâu.",
          "Viết câu mới quanh từ khóa được cho; giữ nguyên dạng từ khóa nếu đề yêu cầu.",
          "So từng vế với câu gốc: chủ ngữ, hành động, thời gian, phủ định, mức độ.",
          "Đếm số từ nếu đề giới hạn, rồi kiểm tra chính tả lần cuối.",
        ],
        tip: "Khi chuyển sang câu bị động hoặc đảo ngữ, đọc lại xem câu mới có bỏ sót tân ngữ hoặc đổi trọng tâm nhấn mạnh không.",
      },
    ],
  },
  {
    slug: "word-formation-khi-khong-chac-hau-to",
    title: "Cách làm Word Formation khi không chắc hậu tố",
    description:
      "Quy trình ba bước khi bạn không nhớ chính xác hậu tố: xác định loại từ, xét nghĩa câu, rồi mới chọn đuôi từ.",
    category: "use-of-english",
    readingTime: "5 phút",
    level: "C1 – Chuyên",
    updatedAt: "2026-06-28",
    sections: [
      {
        paragraphs: [
          "Word Formation mất điểm nhiều nhất không phải vì thiếu từ vựng, mà vì chọn sai loại từ hoặc quên nghĩa phủ định. Trước khi nghĩ đến hậu tố, hãy đi theo thứ tự dưới đây.",
        ],
      },
      {
        heading: "Bước 1: Xác định loại từ cần điền",
        paragraphs: [
          "Tạm che từ gốc và đọc cả câu. Vị trí của chỗ trống cho biết loại từ chính xác hơn là cảm giác về nghĩa:",
        ],
        items: [
          "Sau mạo từ (a/an/the) và trước danh từ: thường là tính từ.",
          "Sau tính từ sở hữu (his, their) hoặc sau giới từ: thường là danh từ.",
          "Bổ nghĩa cho động từ hoặc cả câu: thường là trạng từ.",
          "Sau \"to\" hoặc trợ động từ: động từ.",
        ],
      },
      {
        heading: "Bước 2: Xét nghĩa cả câu trước khi thêm đuôi",
        paragraphs: [
          "Tự hỏi: câu đang mang nghĩa khẳng định hay phủ định? Nếu câu có ý chê, thiếu hoặc ngược với từ gốc, nhiều khả năng đáp án cần tiền tố phủ định như un-, in-, im-, dis-, mis-.",
          "Ví dụ với từ gốc HONEST: câu nói về việc khai gian thì đáp án hợp lý là dishonest hoặc dishonesty, không phải honestly.",
        ],
      },
      {
        heading: "Bước 3: Chọn hậu tố theo loại từ",
        items: [
          "Danh từ: -tion, -ment, -ness, -ity, -ance/-ence, -ship.",
          "Danh từ chỉ người: -er/-or, -ist, -ant/-ent.",
          "Tính từ: -ive, -ous, -ful, -less, -able/-ible, -al.",
          "Trạng từ: -ly, chú ý biến đổi chính tả như happy thành happily.",
          "Động từ: -en, -ize/-ise, -ify.",
        ],
      },
      {
        heading: "Kiểm tra trước khi chốt",
        items: [
          "Danh từ có cần số nhiều không? Đề chuyên rất hay ẩn chi tiết này.",
          "Tính từ nên ở dạng -ed hay -ing (bored/boring)?",
          "Chính tả khi ghép đuôi: bỏ e, gấp đôi phụ âm, y đổi thành i.",
        ],
        tip: "Nếu còn phân vân giữa hai dạng, chọn dạng khớp với nghĩa của cả đoạn, không chỉ nghĩa của một câu.",
      },
    ],
  },
  {
    slug: "writing-lap-dan-y-truoc-khi-viet",
    title: "Writing: lập dàn ý 5 phút trước khi viết",
    description:
      "Khung dàn ý nhanh giúp bài viết đủ ý, đúng dạng và không lạc đề, kể cả khi thời gian trong phòng thi eo hẹp.",
    category: "writing",
    readingTime: "5 phút",
    updatedAt: "2026-06-27",
    sections: [
      {
        paragraphs: [
          "Lỗi nặng nhất trong Writing không phải là sai ngữ pháp mà là lạc đề hoặc thiếu ý. Năm phút lập dàn ý giúp tránh cả hai, và thường tiết kiệm lại nhiều hơn năm phút khi viết.",
        ],
      },
      {
        heading: "Đọc đề: ba câu hỏi bắt buộc",
        items: [
          "Dạng bài là gì: essay, letter/email, report hay đoạn văn? Mỗi dạng có bố cục và văn phong riêng.",
          "Đề hỏi mấy vế? Dạng \"advantages and disadvantages\" hoặc \"discuss both views\" bắt buộc viết đủ các vế.",
          "Người đọc là ai? Câu trả lời quyết định register trang trọng hay thân mật.",
        ],
      },
      {
        heading: "Khung dàn ý 5 phút",
        items: [
          "Chọn 2–3 ý chính, mỗi ý là một đoạn thân bài.",
          "Gắn cho mỗi ý một ví dụ hoặc một câu giải thích cụ thể.",
          "Ghi nhanh vài cụm từ muốn dùng để không quên khi viết.",
          "Định trước câu kết: trả lời thẳng câu hỏi của đề.",
        ],
      },
      {
        heading: "Khi viết",
        items: [
          "Mở bài ngắn, dẫn thẳng vào yêu cầu đề; tránh chép lại nguyên văn đề bài.",
          "Mỗi đoạn một ý chính, câu đầu đoạn nêu rõ ý đó.",
          "Canh số từ: thiếu bị trừ điểm, thừa nhiều dễ lan man và phát sinh lỗi.",
        ],
        tip: "Dành 2–3 phút cuối đọc lại để bắt lỗi thì, mạo từ và hòa hợp chủ ngữ – động từ. Đây là những lỗi người chấm nhìn thấy đầu tiên.",
      },
    ],
  },
  {
    slug: "open-cloze-nhung-nhom-tu-de-mat-diem",
    title: "Open Cloze: những nhóm từ dễ mất điểm",
    description:
      "Sáu nhóm từ chức năng xuất hiện nhiều nhất trong Open Cloze và cách đọc quanh chỗ trống để nhận ra chúng.",
    category: "use-of-english",
    readingTime: "5 phút",
    updatedAt: "2026-06-25",
    sections: [
      {
        paragraphs: [
          "Open Cloze chủ yếu kiểm tra từ chức năng, không phải từ vựng hiếm. Nắm chắc các nhóm dưới đây là bạn xử lý được phần lớn chỗ trống.",
        ],
      },
      {
        heading: "Sáu nhóm hay gặp",
        items: [
          "Giới từ đi theo động từ, tính từ, danh từ: depend on, capable of, reason for.",
          "Đại từ quan hệ: which, whose, whom, what — chú ý which sau dấu phẩy.",
          "Từ nối nhượng bộ và tương phản: although, despite, whereas, however.",
          "Cấu trúc cố định: no sooner… than, not only… but also, would rather, as long as.",
          "Lượng từ và so sánh: few, little, much, more, most, as… as.",
          "Trợ động từ và phủ định: do, did, have, had, not, nor.",
        ],
      },
      {
        heading: "Cách đọc quanh chỗ trống",
        items: [
          "Đọc trọn câu chứa chỗ trống cùng câu liền trước và liền sau; nhiều đáp án phụ thuộc mạch ý chứ không chỉ ngữ pháp.",
          "Xác định loại từ còn thiếu trước, rồi mới nghĩ đến từ cụ thể.",
          "Điền xong đọc lại cả đoạn; chỗ nào nghe gượng thì thường là sai.",
        ],
        tip: "Mỗi chỗ trống chỉ điền một từ. Nếu bạn thấy cần hai từ mới đúng ngữ pháp, bạn đang đoán sai hướng.",
      },
    ],
  },
  {
    slug: "listening-doc-cau-hoi-truoc-khi-nghe",
    title: "Listening: đọc câu hỏi trước khi nghe",
    description:
      "Tận dụng khoảng lặng trước mỗi section để dự đoán thông tin cần nghe và tránh bẫy sửa thông tin trong bài.",
    category: "listening",
    readingTime: "4 phút",
    updatedAt: "2026-06-24",
    sections: [
      {
        paragraphs: [
          "Trong Listening, bạn chỉ được nghe một hoặc hai lần, nên phần thắng thua nằm ở lúc audio chưa chạy: đọc trước câu hỏi và biết mình cần nghe gì.",
        ],
      },
      {
        heading: "Trước khi audio bắt đầu",
        items: [
          "Đọc lướt toàn bộ câu hỏi của section và gạch keyword.",
          "Với dạng điền từ, dự đoán loại thông tin: con số, ngày tháng, tên riêng hay danh từ số nhiều?",
          "Với dạng trắc nghiệm, tập trung vào điểm khác nhau giữa các phương án thay vì đọc cả ba phương án như nhau.",
        ],
      },
      {
        heading: "Trong khi nghe",
        items: [
          "Bám theo thứ tự câu hỏi; đề gần như luôn ra theo mạch bài nghe.",
          "Cảnh giác bẫy sửa thông tin: người nói đưa một đáp án rồi tự đính chính bằng actually, sorry hoặc I mean. Đáp án đúng là thông tin sau cùng.",
          "Lỡ một câu thì bỏ hẳn và tập trung vào câu kế tiếp. Cố nhớ lại câu cũ thường làm mất luôn hai câu.",
        ],
      },
      {
        heading: "Sau khi nghe",
        paragraphs: [
          "Soát chính tả những từ đã điền, nhất là danh từ số nhiều và các từ có phụ âm cuối dễ nuốt âm.",
        ],
        tip: "Khi chữa bài, nghe lại đoạn chứa đáp án và chép lại những từ bạn nghe sai. Luyện tai bằng chính lỗi của mình nhanh hơn nghe tràn lan.",
      },
    ],
  },
  {
    slug: "cach-lam-cloze-test-open-cloze-guided-cloze",
    title: "Cách làm Cloze Test trong đề HSG/Chuyên: Open Cloze và Guided Cloze",
    description:
      "Hướng dẫn cách làm dạng bài Cloze Test trong đề HSG và chuyên Anh: phân biệt Open Cloze, Guided Cloze, nhận diện dạng câu hỏi và chiến thuật tránh mất điểm.",
    category: "use-of-english",
    readingTime: "10-12 phút",
    level: "Chuyên / HSG",
    updatedAt: "2026-07-08",
    sections: [
      {
        paragraphs: [
          "Cloze Test là một trong những dạng bài dễ gây \"sâu\" nhất trong đề chuyên Anh và đề HSG. Đề chỉ cho một đoạn văn bị đục lỗ, nhưng để điền đúng, bạn phải đọc được ngữ cảnh, nhận diện cấu trúc câu, hiểu collocation và phân biệt những từ có nghĩa gần giống nhau.",
          "Với nhiều bạn, Cloze khó vì đáp án thường không phải từ quá lạ. Ngược lại, đáp án có thể là một từ rất ngắn như **of**, **to**, **it**, **which**, **but** hoặc một động từ quen thuộc như **make**, **take**, **draw**, **play**. Cái khó nằm ở việc từ đó có đúng vị trí, đúng cụm và đúng mạch văn hay không.",
          "Bài viết này hướng dẫn cách làm hai dạng chính: **Guided Cloze** và **Open Cloze**. Đây là hai dạng thường gặp trong phần Use of English của đề chuyên, đề HSG và các bài luyện nâng cao.",
        ],
      },
      {
        quote: {
          type: "tip",
          content: "Guided Cloze kiểm tra khả năng chọn đáp án phù hợp nhất trong nhiều lựa chọn. Open Cloze kiểm tra khả năng tự phục hồi một từ còn thiếu dựa trên ngữ pháp và ngữ cảnh.",
        },
      },
      {
        heading: "Cloze Test là gì?",
        paragraphs: [
          "Cloze Test là dạng bài điền từ vào chỗ trống trong một đoạn văn. Mỗi chỗ trống được đặt trong một câu hoặc một đoạn có đủ manh mối để người làm bài suy luận. Muốn làm tốt, bạn không thể chỉ nhìn hai ba từ quanh chỗ trống rồi đoán.",
          "Trong đề chuyên/HSG, Cloze thường không kiểm tra một mảng kiến thức riêng lẻ. Nó trộn nhiều thứ cùng lúc: từ vựng, ngữ pháp, collocation, giới từ, liên từ, đại từ quan hệ, mạo từ và logic đoạn văn.",
        ],
        items: [
          "**Guided Cloze**: đề cho sẵn các lựa chọn A/B/C/D.",
          "**Open Cloze**: đề không cho lựa chọn, thường yêu cầu điền một từ duy nhất.",
        ],
      },
      {
        paragraphs: [
          "Guided Cloze có vẻ dễ hơn vì có đáp án để chọn. Nhưng ở đề khó, bốn lựa chọn đều có thể đúng ngữ pháp. Bạn phải chọn từ tự nhiên nhất với ngữ cảnh.",
          "Open Cloze lại khó theo cách khác. Bạn phải tự nghĩ ra từ cần điền. Đáp án thường là function word hoặc một phần của cụm cố định, nên nếu không quen pattern, bạn rất dễ bỏ sót.",
        ],
      },
      {
        heading: "Guided Cloze và Open Cloze khác nhau thế nào?",
        table: {
          headers: ["Tiêu chí", "Guided Cloze", "Open Cloze"],
          rows: [
            ["Gợi ý", "Có A/B/C/D", "Không có lựa chọn"],
            ["Trọng tâm", "từ vựng, collocation, sắc thái nghĩa", "ngữ pháp, function words, collocation, logic"],
            ["Cách làm", "loại trừ và kiểm tra ngữ cảnh", "xác định loại từ rồi tự phục hồi từ"],
            ["Bẫy thường gặp", "nhiều đáp án \"có vẻ đúng\"", "đáp án là từ ngắn nhưng bắt buộc đúng"],
            ["Cách chữa lỗi", "giải thích vì sao 3 đáp án còn lại sai", "phân loại gap: giới từ, đại từ, liên từ, mạo từ..."],
          ],
        },
      },
      {
        paragraphs: [
          "Điểm chung của hai dạng là đều cần đọc mạch văn. Một câu có thể đúng riêng lẻ nhưng sai khi đặt trong đoạn. Vì vậy, trước khi làm từng gap, hãy đọc lướt đoạn để biết chủ đề, thái độ và hướng triển khai.",
        ],
      },
      {
        heading: "Quy trình 4 bước khi gặp một gap",
      },
      {
        heading: "Bước 1: Xác định chức năng của gap",
        paragraphs: [
          "Đừng hỏi ngay \"đáp án là gì?\". Hãy hỏi: chỗ trống này đang làm nhiệm vụ gì trong câu?",
          "Nó cần một danh từ, động từ, tính từ, trạng từ, giới từ, liên từ, đại từ hay mạo từ? Nếu chưa biết loại từ, bạn đang đoán mò.",
        ],
        quote: {
          type: "note",
          content: "The report has _____ attention from the media.\n\nSau **has**, ta cần một past participle nếu đây là thì hiện tại hoàn thành. Nhưng sau đó còn có cụm **attention from the media**, nên ta phải nghĩ đến collocation. Đáp án tự nhiên là **drawn** trong cụm **draw attention**.",
        },
      },
      {
        heading: "Bước 2: Kiểm tra cụm quanh gap",
        paragraphs: [
          "Cloze Test rất thích kiểm tra cụm cố định. Một số cụm thường gặp:",
        ],
        items: [
          "**play a role**",
          "**make a difference**",
          "**draw criticism**",
          "**take control**",
          "**refer to**",
          "**be interested in**",
          "**be exposed to**",
          "**on foot**",
        ],
        paragraphs2: [
          "Nếu bạn chỉ dịch từng từ, bạn sẽ dễ chọn sai. Hãy học cả cụm, không học từ đơn.",
        ],
      },
      {
        heading: "Bước 3: Đọc câu trước và câu sau",
        paragraphs: [
          "Nếu gap nằm ở đầu câu hoặc giữa hai mệnh đề, nó có thể là linking word như **but**, **however**, **therefore**, **although**, **while**.",
          "Muốn chọn đúng linking word, hãy xác định quan hệ giữa hai ý: bổ sung, đối lập, nguyên nhân, kết quả hay nhượng bộ.",
        ],
      },
      {
        heading: "Bước 4: Kiểm tra lại toàn đoạn",
        paragraphs: [
          "Sau khi chọn hoặc điền, đọc lại câu hoàn chỉnh. Câu có tự nhiên không? Có sai thì, sai số ít/số nhiều, sai giới từ hoặc lệch mạch văn không?",
        ],
        quote: {
          type: "tip",
          content: "Một gap khó thường không cần từ \"cao siêu\". Nó cần một từ đúng vai trò. Trong Open Cloze, đáp án hay nhất đôi khi là **the**, **of**, **to**, **it**, **which** hoặc **but**.",
        },
      },
      {
        heading: "Cách làm Guided Cloze",
        paragraphs: [
          "Guided Cloze cho đáp án sẵn, nhưng đừng chọn vì \"nghe quen\". Hãy xem mỗi lựa chọn có hợp loại từ, hợp cụm và hợp ngữ cảnh không.",
        ],
      },
      {
        heading: "1. Câu hỏi theo ngữ cảnh",
        paragraphs: [
          "Đây là dạng phổ biến. Bốn đáp án có thể cùng loại từ, nhưng chỉ một từ hợp với ý của đoạn.",
        ],
        quote: {
          type: "note",
          content: "The new policy has _____ criticism from both teachers and parents.\nA. drawn\nB. made\nC. taken\nD. put\n\nĐáp án là **A. drawn** vì cụm đúng là **draw criticism**. Các động từ còn lại rất quen, nhưng không đi tự nhiên với **criticism** trong câu này.",
        },
        paragraphs2: [
          "Khi gặp dạng này, hãy gạch chân danh từ hoặc cụm sau gap. Đôi khi đáp án nằm trong mối quan hệ giữa động từ và danh từ, không nằm ở nghĩa từng từ.",
        ],
      },
      {
        heading: "2. Collocation và fixed expression",
        paragraphs: [
          "Đề chuyên thường kiểm tra các cụm như **play a role**, **make progress**, **take responsibility**, **at the turn of the century**.",
        ],
        quote: {
          type: "note",
          content: "Collocations _____ an important role in advanced English exams.\nA. play\nB. make\nC. take\nD. do\n\nĐáp án là **A. play**, vì cụm đúng là **play a role**.",
        },
        paragraphs2: [
          "Nếu bạn sai dạng này, hãy ghi lại cả cụm vào notebook. Đừng ghi riêng \"role = vai trò\". Hãy ghi \"play a role in something\".",
        ],
      },
      {
        heading: "3. Phrasal verb và preposition",
        paragraphs: [
          "Một giới từ nhỏ có thể đổi nghĩa cả câu. Ví dụ **turn on**, **turn off**, **turn out**, **turn over** khác nhau hoàn toàn.",
        ],
        quote: {
          type: "note",
          content: "Students should not rely _____ translation when learning collocations.\nA. in\nB. on\nC. at\nD. with\n\nĐáp án là **B. on** vì cấu trúc đúng là **rely on**.",
        },
        paragraphs2: [
          "Với dạng này, cách học tốt nhất là học theo cụm và ví dụ. Mỗi khi chữa bài, hãy ghi lại câu chứa cụm đó.",
        ],
      },
      {
        heading: "Cách làm Open Cloze",
        paragraphs: [
          "Open Cloze không có đáp án gợi ý nên bạn phải tự xác định từ cần điền. Đừng bắt đầu bằng việc nghĩ một từ bất kỳ. Hãy xác định loại gap trước.",
        ],
      },
      {
        heading: "1. Đại từ và đại từ quan hệ",
        paragraphs: [
          "Các từ như **who**, **which**, **that**, **where**, **when**, **why**, **it**, **they**, **them**, **itself** xuất hiện rất nhiều trong Open Cloze.",
        ],
        quote: {
          type: "note",
          content: "The old city is small, which makes it easy to explore _____ foot.\n\nĐáp án là **on**, vì cụm đúng là **on foot**. Dù câu có đại từ quan hệ **which**, gap này thực chất là một giới từ trong cụm cố định.",
        },
        paragraphs2: [
          "Ví dụ khác:",
        ],
        items2: [
          "The writer interviewed several students, some of _____ had taken the exam twice. → **whom** (sau giới từ **of**, ta cần đại từ quan hệ chỉ người ở dạng phù hợp)",
        ],
      },
      {
        heading: "2. Articles, determiners và quantifiers",
        paragraphs: [
          "Những từ như **a**, **an**, **the**, **some**, **any**, **much**, **many**, **few**, **little**, **either**, **neither** rất dễ bị xem nhẹ.",
        ],
        quote: {
          type: "note",
          content: "This is _____ first time I have tried an Open Cloze passage.\n\nĐáp án là **the**, vì cấu trúc là **the first time**.",
        },
        paragraphs2: [
          "Ở đề khó, gap có thể nằm trong câu dài khiến bạn quên mất danh từ phía sau là xác định hay chưa xác định.",
        ],
      },
      {
        heading: "3. Linking words",
        paragraphs: [
          "Open Cloze hay kiểm tra logic giữa hai ý.",
        ],
        quote: {
          type: "note",
          content: "Many students know the rule, _____ they still forget to apply it under time pressure.\n\nĐáp án có thể là **but** hoặc **yet**, vì vế sau đối lập với kỳ vọng ở vế trước.",
        },
        paragraphs2: [
          "Nếu bạn thấy hai vế có quan hệ tương phản, nghĩ đến nhóm **but / yet / however / although / while**. Nếu vế sau là kết quả, nghĩ đến **so / therefore / thus**.",
        ],
      },
      {
        heading: "4. Preposition và collocation",
        paragraphs: [
          "Đây là nhóm ăn điểm bằng thói quen đọc. Một số cụm nên thuộc:",
        ],
        items: [
          "**interested in**",
          "**famous for**",
          "**depend on**",
          "**refer to**",
          "**exposure to**",
          "**divide into**",
          "**at risk**",
          "**in detail**",
        ],
        quote: {
          type: "example",
          content: "The article refers _____ several recent studies.\n\nĐáp án là **to** vì cấu trúc là **refer to**.\n\nKhi chữa Open Cloze, hãy ghi lại dạng:\n- depend on something\n- be interested in something\n- refer to someone/something\n\nCách ghi này giúp bạn nhớ pattern, không chỉ nhớ nghĩa tiếng Việt.",
        },
      },
      {
        heading: "Những lỗi hay gặp khi làm Cloze Test",
        table: {
          headers: ["Lỗi", "Biểu hiện", "Cách sửa"],
          rows: [
            ["Dịch từng từ", "chọn đáp án nghe hợp nghĩa tiếng Việt", "học cả cụm/collocation"],
            ["Không đọc câu sau", "chọn sai linking word", "đọc hai vế trước khi điền"],
            ["Nhầm loại từ", "cần verb nhưng chọn noun", "phân tích cấu trúc câu"],
            ["Bỏ qua giới từ", "sai **in/on/at/to/of**", "ghi cụm đầy đủ"],
            ["Làm xong không chữa", "làm nhiều nhưng không tiến bộ", "phân loại lỗi sau mỗi passage"],
          ],
        },
        paragraphs: [
          "Lỗi nghiêm trọng nhất là làm xong chỉ xem mình được bao nhiêu điểm. Cloze cần được chữa theo nhóm lỗi. Nếu bạn sai vì collocation, hãy học cụm. Nếu sai vì linking word, hãy đọc lại logic. Nếu sai vì mạo từ, hãy xem danh từ phía sau đã xác định chưa.",
        ],
      },
      {
        heading: "Chiến thuật thời gian khi làm bài",
        paragraphs: [
          "Với đề chuyên/HSG, đừng để một gap giữ bạn quá lâu. Hãy chia bài thành ba lượt.",
        ],
        items: [
          "**Lượt 1:** đọc lướt đoạn trong 30–45 giây. Nắm chủ đề, thì chính và hướng triển khai.",
          "**Lượt 2:** làm các gap rõ ràng trước. Những câu về mạo từ, giới từ quen thuộc hoặc collocation chắc chắn nên xử lý nhanh.",
          "**Lượt 3:** quay lại các gap khó. Lúc này bạn đã hiểu đoạn hơn nên có thể chọn chính xác hơn.",
        ],
      },
      {
        heading: "Checklist trước khi chốt đáp án",
        items: [
          "Từ này có đúng loại từ không?",
          "Có hợp thì, số ít/số nhiều và cấu trúc câu không?",
          "Có đi tự nhiên với từ trước/sau không?",
          "Có hợp logic câu trước và câu sau không?",
          "Với Guided Cloze: vì sao ba đáp án còn lại sai?",
          "Với Open Cloze: có đáp án nào khác cũng hợp lý không?",
        ],
      },
      {
        heading: "Bài tập tự luyện",
        practice: {
          title: "Practice A — Guided Cloze",
          instruction: "Read the passage and choose the best answer.",
          questions: [
            {
              question: "Many students believe that vocabulary learning is simply a matter of memorising long word lists. In reality, successful learners pay close attention to how words are used in context. A word may have several meanings, but only one of them will (1) _____ the sentence naturally.",
              options: ["1. A. match", "B. suit", "C. fit", "D. agree"],
            },
            {
              question: "This is why collocations (2) _____ such an important role in advanced English exams. When students revise, they should record not only the new word but also the words that commonly (3) _____ with it.",
              options: ["2. A. play", "B. make", "C. take", "D. do", "3. A. go", "B. keep", "C. stay", "D. hold"],
            },
            {
              question: "Over time, this habit helps them make better choices under exam pressure. It also prevents them from choosing an answer just because it sounds familiar (4) _____ Vietnamese.",
              options: ["4. A. for", "B. in", "C. from", "D. to"],
            },
            {
              question: "Good preparation, therefore, is less about learning isolated words and more about noticing patterns. Students who do this regularly are more (5) _____ to recognise the right answer, even when the options look confusing. In a Cloze Test, the smallest word can sometimes (6) _____ the biggest difference.",
              options: ["5. A. likely", "B. possible", "C. able", "D. probable", "6. A. do", "B. make", "C. cause", "D. bring"],
            },
          ],
        },
      },
      {
        practice: {
          title: "Practice B — Open Cloze",
          instruction: "Fill each blank with ONE suitable word.",
          questions: [
            {
              question: "Open Cloze questions are often harder than they look because the missing word is not always difficult. In many cases, the answer is a short function word, such (1) _____ a preposition, article or pronoun.",
              options: ["1. _____"],
            },
            {
              question: "The challenge is to understand (2) _____ the word is needed in that exact position. For example, if a noun has already been mentioned, the blank before it may require \"the\". If two ideas contrast with each other, the missing word may be \"but\" or \"however\".",
              options: ["2. _____"],
            },
            {
              question: "Students should therefore read the sentence before and after the gap, (3) _____ only the words next to it. Another useful habit is to decide the role of the blank first.",
              options: ["3. _____"],
            },
            {
              question: "Is it linking two clauses? Is it referring back (4) _____ a person or thing? Is it part of a fixed phrase? Once students begin to ask these questions, they become less dependent (5) _____ guessing.",
              options: ["4. _____", "5. _____"],
            },
            {
              question: "With enough practice, Cloze becomes a test of patterns, not luck. The goal is not to know every word, (6) _____ to know how English holds a text together.",
              options: ["6. _____"],
            },
          ],
        },
      },
      {
        heading: "Answer key",
        answerKey: {
          title: "Practice A",
          items: [
            { number: "1", answer: "**C — fit**", explanation: "Cụm tự nhiên là **fit the sentence naturally**." },
            { number: "2", answer: "**A — play**", explanation: "Cụm đúng là **play a role**." },
            { number: "3", answer: "**A — go**", explanation: 'Ta nói **words that go with it**.' },
            { number: "4", answer: "**B — in**", explanation: 'Câu cần nghĩa "nghe quen trong tiếng Việt": **familiar in Vietnamese**.' },
            { number: "5", answer: "**A — likely**", explanation: "Cấu trúc đúng là **be likely to do something**." },
            { number: "6", answer: "**B — make**", explanation: "Cụm đúng là **make a difference**." },
          ],
        },
      },
      {
        answerKey: {
          title: "Practice B",
          items: [
            { number: "1", answer: "**as**", explanation: 'Cụm đúng là **such as**.' },
            { number: "2", answer: "**why**", explanation: "Câu nói về lý do/chức năng của từ trong vị trí đó." },
            { number: "3", answer: "**not**", explanation: 'Ý là không chỉ đọc những từ ngay cạnh gap.' },
            { number: "4", answer: "**to**", explanation: "Cụm đúng là **refer back to**." },
            { number: "5", answer: "**on**", explanation: "Cấu trúc đúng là **dependent on**." },
            { number: "6", answer: "**but**", explanation: "Cấu trúc đối lập: not A, but B." },
          ],
        },
      },
      {
        heading: "Cách tự học Cloze trong 7 ngày",
        paragraphs: [
          "Nếu muốn cải thiện dạng Cloze, hãy học theo vòng ngắn thay vì làm đề liên tục.",
        ],
        items: [
          "**Ngày 1:** học các bẫy thường gặp trong Guided Cloze.",
          "**Ngày 2:** làm 2 bài Guided Cloze và ghi lại collocation.",
          "**Ngày 3:** chữa lỗi, phân loại sai vì nghĩa, cụm hay logic.",
          "**Ngày 4:** học các dạng Open Cloze: giới từ, đại từ, mạo từ, linking words.",
          "**Ngày 5:** làm 2 bài Open Cloze.",
          "**Ngày 6:** làm lại các câu sai mà không nhìn đáp án.",
          "**Ngày 7:** làm một bài mixed có bấm giờ.",
        ],
        studyPlan: {
          days: [
            { day: "Ngày 1", task: "Học các bẫy thường gặp trong Guided Cloze" },
            { day: "Ngày 2", task: "Làm 2 bài Guided Cloze và ghi lại collocation" },
            { day: "Ngày 3", task: "Chữa lỗi, phân loại sai vì nghĩa, cụm hay logic" },
            { day: "Ngày 4", task: "Học các dạng Open Cloze: giới từ, đại từ, mạo từ, linking words" },
            { day: "Ngày 5", task: "Làm 2 bài Open Cloze" },
            { day: "Ngày 6", task: "Làm lại các câu sai mà không nhìn đáp án" },
            { day: "Ngày 7", task: "Làm một bài mixed có bấm giờ" },
          ],
          trackingTable: {
            headers: ["Gap", "Đáp án đúng", "Mình chọn", "Lý do sai", "Cụm cần nhớ"],
            rows: [
              ["", "", "", "", ""],
              ["", "", "", "", ""],
              ["", "", "", "", ""],
            ],
          },
        },
        paragraphs2: [
          "Sau mỗi bài, hãy ghi lại lỗi theo mẫu trên. Cách này giúp bạn nhìn thấy pattern lỗi của mình. Nếu tuần nào bạn cũng sai giới từ, vấn đề không phải \"bất cẩn\"; đó là nhóm cần luyện riêng.",
        ],
      },
      {
        heading: "Kết luận",
        paragraphs: [
          "Cloze Test không phải dạng bài may rủi. Guided Cloze yêu cầu bạn chọn từ tự nhiên nhất giữa nhiều lựa chọn gần giống nhau. Open Cloze yêu cầu bạn tự phục hồi một từ còn thiếu dựa trên cấu trúc câu và mạch văn.",
          "Muốn làm tốt Cloze, hãy nhớ ba việc: đọc ngữ cảnh trước khi điền, xác định chức năng của gap, và chữa lỗi theo nhóm sau mỗi bài. Khi bạn bắt đầu nhìn thấy các pattern như **verb + preposition**, **article + noun**, **linker giữa hai ý**, hoặc **relative pronoun sau danh từ**, Cloze sẽ bớt đáng sợ hơn rất nhiều.",
        ],
      },
    ],
  },
];

// Draft slot — replace with real content when materials are provided.
// This article is not linked anywhere; remove this comment block once published.
/*
{
  slug: "placeholder-draft-title",
  title: "[DRAFT] Tên bài viết mới",
  description: "Mô tả ngắn 1–2 câu sẽ hiển thị trên trang Wiki.",
  category: "use-of-english",
  readingTime: "5 phút",
  level: "B2 – C1",
  updatedAt: "2026-07-08",
  sections: [
    {
      paragraphs: [
        "Dẫn nhập: ngữ cảnh hoặc lý do bài này hữu ích.",
      ],
    },
    {
      heading: "Phần 1",
      paragraphs: [],
      items: [],
      tip: "Mẹo ngắn gọn.",
    },
  ],
},
*/

export function getWikiArticles(): WikiArticle[] {
  return [...wikiArticles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getWikiArticle(slug: string): WikiArticle | null {
  return wikiArticles.find((article) => article.slug === slug) ?? null;
}

export function getRelatedWikiArticles(slug: string, limit = 3): WikiArticle[] {
  const current = getWikiArticle(slug);
  if (!current) return [];
  const others = getWikiArticles().filter((article) => article.slug !== slug);
  const sameCategory = others.filter((article) => article.category === current.category);
  const rest = others.filter((article) => article.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

export function formatWikiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

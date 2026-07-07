export type WikiCategoryId = "use-of-english" | "reading" | "writing" | "listening" | "exam-strategy";

export type WikiSection = {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  tip?: string;
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
];

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

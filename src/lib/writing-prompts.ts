/**
 * Static beta prompt bank for Writing Gym.
 * All 10 prompts are about technology/internet/family topics.
 * Used instead of DB Problems for the beta period.
 */

export type WritingPrompt = {
  slug: string;
  title: string;
  statement: string;
  essayType:
    | "Opinion essay"
    | "Discussion essay"
    | "Advantage–Disadvantage essay"
    | "Outweigh essay"
    | "Cause/Effect/Solution essay"
    | "Double-question essay"
    | "Other";
  targetWordCount: "250–300 từ";
  difficulty: "Chuyên";
};

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    slug: "machines-at-home",
    title: "Machines at home",
    essayType: "Advantage–Disadvantage essay",
    statement:
      "Many things that used to be done in the home by hands are now being done by machines. Does this development bring more advantages or disadvantages?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "technology-and-social-interaction",
    title: "Technology and social interaction",
    essayType: "Opinion essay",
    statement:
      "Some people argue that technological inventions, such as mobile phones, are making people socially less interactive. Do you agree or disagree?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "technology-in-the-workplace",
    title: "Technology in the workplace",
    essayType: "Double-question essay",
    statement:
      "Modern technology is now very common in most work places. How do you think this has changed the way we work? Do you think there are disadvantages to relying too much on technology?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "technology-and-inequality",
    title: "Technology and inequality",
    essayType: "Discussion essay",
    statement:
      "Some people think that the range of technology currently available is increasing the gap between rich people and poor people. Others think that it is causing the opposite effect. Discuss both views and give your opinion.",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "household-appliances-and-working-mothers",
    title: "Household appliances and working mothers",
    essayType: "Double-question essay",
    statement:
      "New household appliances have resulted in more free time for women and has enabled them to both work and run a home with dependent children. What are the advantages for a family when the mother works? Do you think the disadvantages outweigh the advantages?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "children-and-technology",
    title: "Children and technology",
    essayType: "Cause/Effect/Solution essay",
    statement:
      "With the development of technology children are now living in a world that is completely different to what it was 50 years ago. What problems does this cause for society and the family?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "internet-and-socialising",
    title: "Internet and socialising",
    essayType: "Discussion essay",
    statement:
      "An increasing number of people are now using the internet to meet new people and socialise. Some people think this has brought people closer together while others think people are becoming more isolated. Discuss both sides and give your opinion.",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "children-using-the-internet-unsupervised",
    title: "Children using the internet unsupervised",
    essayType: "Cause/Effect/Solution essay",
    statement:
      "More and more children are accessing the internet unsupervised and at a younger age. This can sometimes put children at risk. What problems do you think parents face when dealing with their children using the internet? How can this problem be solved?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "tv-video-games-and-mental-health",
    title: "TV, video games and mental health",
    essayType: "Opinion essay",
    statement:
      "Nowadays children watch a lot of TV and play video games. However, some people think that these activities are not good for a child's mental health. To what extent do you agree or disagree?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
  {
    slug: "modern-technology-in-the-family",
    title: "Modern technology in the family",
    essayType: "Opinion essay",
    statement:
      "It is common nowadays for each member of the family to have their own piece of modern technology. Some people think this will lead to a break down in family relationships and communication. To what extent do you agree?",
    targetWordCount: "250–300 từ",
    difficulty: "Chuyên",
  },
];

/**
 * Find a prompt by slug. Returns undefined if not found.
 */
export function getWritingPromptBySlug(slug: string): WritingPrompt | undefined {
  return WRITING_PROMPTS.find((p) => p.slug === slug);
}

/**
 * Map static essay type to the internal essayType value used by the grader.
 */
export function mapEssayTypeToGraderValue(essayType: WritingPrompt["essayType"]): string {
  const mapping: Record<WritingPrompt["essayType"], string> = {
    "Opinion essay": "opinion",
    "Discussion essay": "discussion",
    "Advantage–Disadvantage essay": "advantage-disadvantage",
    "Outweigh essay": "outweigh",
    "Cause/Effect/Solution essay": "cause-effect-solution",
    "Double-question essay": "double-question",
    "Other": "other",
  };
  return mapping[essayType];
}

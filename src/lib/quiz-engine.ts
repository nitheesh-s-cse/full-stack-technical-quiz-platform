import type { questions as questionsTable } from "@/db/schema";

export type QuestionRow = typeof questionsTable.$inferSelect;

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

export type SessionQuestionEntry = {
  questionId: number;
  /** optionKeys[i] = original option letter shown at displayed position OPTION_LABELS[i] */
  optionKeys: OptionLabel[];
};

export type QuestionOrder = SessionQuestionEntry[];

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildQuestionOrder(questionIds: number[]): QuestionOrder {
  const shuffledIds = shuffle(questionIds);
  return shuffledIds.map((questionId) => ({
    questionId,
    optionKeys: shuffle([...OPTION_LABELS]) as OptionLabel[],
  }));
}

export function optionFieldFor(key: OptionLabel): "optionA" | "optionB" | "optionC" | "optionD" {
  return (`option${key}`) as "optionA" | "optionB" | "optionC" | "optionD";
}

export type ClientQuestion = {
  position: number;
  questionId: number;
  language: string;
  difficulty: string;
  code: string;
  questionText: string;
  marks: number;
  options: Record<OptionLabel, string>;
};

export function buildClientQuestions(
  order: QuestionOrder,
  questionsById: Map<number, QuestionRow>,
): ClientQuestion[] {
  return order.map((entry, idx) => {
    const q = questionsById.get(entry.questionId);
    if (!q) {
      throw new Error(`Question ${entry.questionId} missing from question bank`);
    }
    const options = {} as Record<OptionLabel, string>;
    entry.optionKeys.forEach((originalKey, i) => {
      const label = OPTION_LABELS[i];
      options[label] = q[optionFieldFor(originalKey)] as string;
    });
    return {
      position: idx + 1,
      questionId: q.id,
      language: q.language,
      difficulty: q.difficulty,
      code: q.code,
      questionText: q.questionText,
      marks: q.marks,
      options,
    };
  });
}

/** Given the original correct option key, find which displayed label it maps to. */
export function displayedLabelForOption(
  order: QuestionOrder,
  questionId: number,
  originalKey: OptionLabel,
): OptionLabel | null {
  const entry = order.find((e) => e.questionId === questionId);
  if (!entry) return null;
  const idx = entry.optionKeys.indexOf(originalKey);
  if (idx === -1) return null;
  return OPTION_LABELS[idx];
}

/** Resolve which original option letter a displayed label refers to for a question. */
export function resolveActualOption(
  order: QuestionOrder,
  questionId: number,
  displayedLabel: OptionLabel,
): OptionLabel | null {
  const entry = order.find((e) => e.questionId === questionId);
  if (!entry) return null;
  const idx = OPTION_LABELS.indexOf(displayedLabel);
  if (idx === -1) return null;
  return entry.optionKeys[idx];
}

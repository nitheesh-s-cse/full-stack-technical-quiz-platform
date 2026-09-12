import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const round = req.nextUrl.searchParams.get("round");
  const rows = round
    ? await db.select().from(questions).where(eq(questions.round, Number(round))).orderBy(asc(questions.orderIndex))
    : await db.select().from(questions).orderBy(asc(questions.round), asc(questions.orderIndex));

  return NextResponse.json({ questions: rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const required = ["round", "language", "difficulty", "code", "optionA", "optionB", "optionC", "optionD", "correctOption"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 });
    }
  }
  if (!["A", "B", "C", "D"].includes(String(body.correctOption).toUpperCase())) {
    return NextResponse.json({ error: "correctOption must be A, B, C, or D." }, { status: 400 });
  }

  const [created] = await db
    .insert(questions)
    .values({
      round: Number(body.round),
      language: String(body.language),
      difficulty: String(body.difficulty),
      code: String(body.code),
      questionText: body.questionText || "What will be the output of this program?",
      optionA: String(body.optionA),
      optionB: String(body.optionB),
      optionC: String(body.optionC),
      optionD: String(body.optionD),
      correctOption: String(body.correctOption).toUpperCase(),
      explanation: body.explanation || null,
      marks: Number(body.marks) || 1,
      negativeMarks: Number(body.negativeMarks) || 0,
      orderIndex: Number(body.orderIndex) || 0,
    })
    .returning();

  await logAdminAction(admin.id, "CREATE_QUESTION", null, { questionId: created.id, round: created.round });

  return NextResponse.json({ question: created });
}

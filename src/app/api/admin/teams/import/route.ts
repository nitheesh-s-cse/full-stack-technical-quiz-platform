import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, adminActions } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type TeamImportItem = {
  teamCode?: string;
  teamName: string;
  member1?: string;
  member2?: string;
  member3?: string;
  member4?: string;
  collegeDept?: string;
};

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!rateLimit(`admin-import-teams:${admin.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many import requests. Please wait a moment." }, { status: 429 });
  }

  let body: {
    teams?: TeamImportItem[];
    autoGenerateIds?: boolean;
    idPrefix?: string;
    skipDuplicates?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawTeams = body.teams;
  if (!Array.isArray(rawTeams) || rawTeams.length === 0) {
    return NextResponse.json({ error: "No teams provided for import." }, { status: 400 });
  }

  if (rawTeams.length > 500) {
    return NextResponse.json({ error: "Maximum 500 teams can be imported at once." }, { status: 400 });
  }

  const prefix = (body.idPrefix || "TEAM").trim().toUpperCase();
  const skipDuplicates = body.skipDuplicates !== false;

  // Retrieve existing team codes from database to prevent conflicts
  const existingTeams = await db.select({ teamCode: teams.teamCode }).from(teams);
  const existingCodeSet = new Set(existingTeams.map((t) => t.teamCode.toUpperCase()));

  // Calculate highest existing numeric suffix for the prefix to continue sequence smoothly
  let highestNum = 0;
  const prefixRegex = new RegExp(`^${prefix}(\\d+)$`, "i");
  for (const code of existingCodeSet) {
    const match = code.match(prefixRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highestNum) highestNum = num;
    }
  }

  const toInsert: {
    teamCode: string;
    teamName: string;
    member1Name: string | null;
    member2Name: string | null;
    member3Name: string | null;
    member4Name: string | null;
    collegeDept: string | null;
  }[] = [];

  const skipped: { teamName: string; teamCode: string; reason: string }[] = [];
  const incomingCodeSet = new Set<string>();

  for (let i = 0; i < rawTeams.length; i++) {
    const item = rawTeams[i];
    const teamName = (item.teamName ?? "").trim().slice(0, 128);
    if (!teamName) {
      skipped.push({ teamName: `Row #${i + 1}`, teamCode: "", reason: "Missing team name" });
      continue;
    }

    let code = (item.teamCode ?? "").trim().toUpperCase().slice(0, 32);

    // Auto-generate ID if missing or explicitly requested
    if (!code || body.autoGenerateIds) {
      do {
        highestNum++;
        code = `${prefix}${String(highestNum).padStart(3, "0")}`;
      } while (existingCodeSet.has(code) || incomingCodeSet.has(code));
    }

    if (existingCodeSet.has(code) || incomingCodeSet.has(code)) {
      if (skipDuplicates) {
        skipped.push({ teamName, teamCode: code, reason: `Team ID ${code} already exists` });
        continue;
      } else {
        return NextResponse.json(
          { error: `Duplicate Team ID: ${code} for team "${teamName}". Set skipDuplicates to true to ignore existing IDs.` },
          { status: 409 },
        );
      }
    }

    incomingCodeSet.add(code);

    toInsert.push({
      teamCode: code,
      teamName,
      member1Name: item.member1?.trim()?.slice(0, 128) || null,
      member2Name: item.member2?.trim()?.slice(0, 128) || null,
      member3Name: item.member3?.trim()?.slice(0, 128) || null,
      member4Name: item.member4?.trim()?.slice(0, 128) || null,
      collegeDept: item.collegeDept?.trim()?.slice(0, 200) || null,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: false,
      count: 0,
      skippedCount: skipped.length,
      skipped,
      message: "No new teams to insert. All rows were either invalid or already registered.",
    });
  }

  // Insert teams in batches of 50
  const inserted: { id: number; teamCode: string; teamName: string }[] = [];
  const BATCH_SIZE = 50;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);
    const res = await db.insert(teams).values(chunk).returning({
      id: teams.id,
      teamCode: teams.teamCode,
      teamName: teams.teamName,
    });
    inserted.push(...res);
  }

  // Record audit log
  await db.insert(adminActions).values({
    adminId: admin.id,
    actionType: "BULK_IMPORT_TEAMS",
    details: {
      totalRequested: rawTeams.length,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      prefix,
    },
  });

  return NextResponse.json({
    success: true,
    count: inserted.length,
    skippedCount: skipped.length,
    skipped,
    teams: inserted,
    message: `Successfully imported ${inserted.length} team${inserted.length === 1 ? "" : "s"}.`,
  });
}

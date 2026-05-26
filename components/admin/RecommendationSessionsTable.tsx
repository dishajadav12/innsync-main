"use client";

import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { fetchRecommendationSessions } from "@/utils/actions";

type Session = Awaited<ReturnType<typeof fetchRecommendationSessions>>[number];

const timeAgo = (date: Date | string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const shortDate = (date: Date | string | null): string => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const buildPreferenceChips = (prefs: unknown): string[] => {
  const p = prefs as Record<string, unknown> | null;
  if (!p) return [];
  const chips: string[] = [];
  if (Array.isArray(p.country) && p.country.length) chips.push(...(p.country as string[]));
  if (Array.isArray(p.city) && p.city.length) chips.push(...(p.city as string[]));
  const budget = p.budget as { min?: number; max?: number } | undefined;
  if (budget?.min != null && budget?.max != null) {
    chips.push(`$${budget.min}–$${budget.max}/night`);
  }
  if (p.guests) chips.push(`${p.guests} guests`);
  if (Array.isArray(p.tripType) && p.tripType.length) chips.push(...(p.tripType as string[]));
  if (Array.isArray(p.vibe) && p.vibe.length) chips.push(...(p.vibe as string[]));
  return chips;
};

const scoreBadgeClass = (score: number) => {
  if (score >= 75) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

const isGemini = (modelUsed: string) =>
  modelUsed.toLowerCase().includes("gemini");

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);

  const swapCount = session.results.filter((r) => r.replacedPropertyId).length;
  const topResult = session.results[0];
  const chips = buildPreferenceChips(session.preferences);
  const userName = session.profile
    ? `${session.profile.firstName} ${session.profile.lastName}`
    : null;
  const gemini = isGemini(session.modelUsed);
  const isActive = session.status === "active";
  const holdAfterCreated =
    session.hasHeldPropertyAfterCreated ||
    (session.invalidationReason?.toLowerCase().includes("put on hold") ?? false);
  const holdBadgeTooltip =
    session.heldPropertyNamesAfterCreated?.length
      ? `Hold after created: ${session.heldPropertyNamesAfterCreated.join(", ")}`
      : "One or more recommended properties were put on hold after this session was created.";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* ── Collapsed header ── */}
      <div className="p-4 space-y-3">
        {/* Top row: model badge + time */}
        <div className="flex items-start justify-between gap-3">
          <div>
            {userName ? (
              <>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{session.profile?.email}</p>
              </>
            ) : (
              <p className="text-sm italic text-muted-foreground">Anonymous visitor</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(session.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>

            {holdAfterCreated && (
              <span
                title={holdBadgeTooltip}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 cursor-help"
              >
                Hold after created
              </span>
            )}

            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                gemini
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {gemini ? "Gemini AI" : "Rule-based"}
            </span>
          </div>
        </div>

        {/* Preference chips */}
        {chips.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              What they searched for
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top pick */}
        {topResult && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Top pick:</span>
            <span className="text-xs font-medium truncate">{topResult.propertyName}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreBadgeClass(
                topResult.matchScore
              )}`}
            >
              {topResult.matchScore}%
            </span>
          </div>
        )}

        {/* Swap summary */}
        {swapCount === 0 ? (
          <p className="text-xs text-green-600 font-medium">✓ No swaps</p>
        ) : (
          <p className="text-xs text-amber-600 font-medium">
            🔄 {swapCount} {swapCount === 1 ? "property" : "properties"} swapped
          </p>
        )}
      </div>

      {/* ── Expanded results ── */}
      {expanded && (
        <div className="border-t divide-y">
          {session.results.map((result) => {
            const wasSwapped = Boolean(result.replacedPropertyId);
            return (
              <div
                key={result.id}
                className={`px-4 py-3 ${
                  wasSwapped ? "bg-amber-50 border-l-2 border-amber-300" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Rank {result.rank}
                  </span>
                  <span className="text-xs font-medium truncate">{result.propertyName}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreBadgeClass(
                      result.matchScore
                    )}`}
                  >
                    {result.matchScore}%
                  </span>
                </div>

                {wasSwapped ? (
                  <p className="text-xs text-amber-700">
                    🔄 Replaced &ldquo;{result.replacedPropertyName}&rdquo;
                    {result.replacedAt && ` · ${shortDate(result.replacedAt)}`}
                    {result.replacedReason && ` · ${result.replacedReason}`}
                  </p>
                ) : (
                  <p className="text-xs text-green-600">✓ Original recommendation</p>
                )}

                {result.aiSummary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {result.aiSummary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-center gap-1.5 border-t py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <span>
          {expanded
            ? "Hide results ↑"
            : `Show all ${session.results.length} results ↓`}
        </span>
        <LuChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function RecommendationSessionsTable({
  sessions,
}: {
  sessions: Session[];
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendation sessions yet. They appear here after users run their
        first Find Stays search.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}

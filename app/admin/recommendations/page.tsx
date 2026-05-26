import { AdminNav } from "@/components/admin/AdminNav";
import { fetchRecommendationSessions } from "@/utils/actions";
import { RecommendationSessionsTable } from "@/components/admin/RecommendationSessionsTable";

async function AdminRecommendationsPage() {
  const sessions = await fetchRecommendationSessions();
  const activeCount = sessions.filter((s) => s.status === "active").length;
  const swappedCount = sessions.filter((s) =>
    s.results.some((r) => r.replacedPropertyId)
  ).length;

  return (
    <div>
      <AdminNav active="/admin/recommendations" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Recommendation History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {sessions.length} sessions total · {activeCount} active ·{" "}
          {swappedCount} had property swaps
        </p>
      </div>
      <RecommendationSessionsTable sessions={sessions} />
    </div>
  );
}
export default AdminRecommendationsPage;

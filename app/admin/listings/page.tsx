import { AdminNav } from "@/components/admin/AdminNav";
import { fetchAllPropertiesForAdmin } from "@/utils/actions";
import { ListingsTable } from "@/components/admin/ListingsTable";

async function AdminListingsPage() {
  const properties = await fetchAllPropertiesForAdmin();
  return (
    <div>
      <AdminNav active="/admin/listings" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">All Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {properties.length} total · {properties.filter((p) => p.isOnHold).length} on hold
          </p>
        </div>
      </div>
      <ListingsTable properties={properties} />
    </div>
  );
}
export default AdminListingsPage;

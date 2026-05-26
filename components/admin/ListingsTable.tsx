import { AdminListingActions } from "@/components/admin/AdminListingActions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Property = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  city: string | null;
  country: string;
  price: number;
  image: string;
  guests: number;
  bedrooms: number;
  beds: number;
  baths: number;
  amenities: string;
  isOnHold: boolean;
  createdAt: Date;
  _count: { bookings: number; reviews: number };
};

type Props = {
  properties: Property[];
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);

export function ListingsTable({ properties }: Props) {
  if (properties.length === 0) {
    return <p className="text-muted-foreground text-sm">No properties found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Property Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Bookings</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map((property) => (
          <TableRow key={property.id}>
            <TableCell className="font-medium">{property.name}</TableCell>
            <TableCell className="capitalize">{property.category}</TableCell>
            <TableCell>
              {[property.city, property.country].filter(Boolean).join(", ")}
            </TableCell>
            <TableCell>{formatPrice(property.price)}</TableCell>
            <TableCell>{property._count.bookings}</TableCell>
            <TableCell>
              {property.isOnHold ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  On Hold
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              )}
            </TableCell>
            <TableCell>
              <AdminListingActions property={property} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

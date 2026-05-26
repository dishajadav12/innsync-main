import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/recommendations", label: "Recommendation History" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="flex gap-4 border-b pb-4 mb-6">
      {adminLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            active === link.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

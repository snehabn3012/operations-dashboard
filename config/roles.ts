import { Role } from "@/types/dashboard";

export interface RoleDefinition {
  id: Role;
  label: string;
  description: string;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Full visibility across every module.",
  },
  {
    id: "operationsManager",
    label: "Operations Manager",
    description: "Customers, transactions, and order operations.",
  },
  {
    id: "financeManager",
    label: "Finance Manager",
    description: "Revenue, transactions, and payment activity.",
  },
  {
    id: "supportAgent",
    label: "Support Agent",
    description: "Customer and order information for support cases.",
  },
  {
    id: "customer",
    label: "Customer",
    description: "Self-service view limited to personal activity.",
  },
];

export function getRoleLabel(role: Role): string {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}

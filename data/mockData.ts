// Deterministic pseudo-random generator so mock data is stable within a server run.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260904);

function pick<const T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const FIRST_NAMES = [
  "Ava",
  "Liam",
  "Noah",
  "Emma",
  "Oliver",
  "Sophia",
  "Elijah",
  "Isabella",
  "Mateo",
  "Mia",
  "Lucas",
  "Amara",
  "Ethan",
  "Priya",
  "Kenji",
  "Zara",
  "Diego",
  "Nadia",
  "Omar",
  "Layla",
];
const LAST_NAMES = [
  "Johnson",
  "Chen",
  "Patel",
  "Garcia",
  "Kim",
  "Novak",
  "Alvarez",
  "Nguyen",
  "Okafor",
  "Silva",
  "Andersson",
  "Rossi",
  "Yamamoto",
  "Haddad",
  "Costa",
];

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  segment: "enterprise" | "smb" | "individual";
  joinedDate: string;
  totalSpent: number;
}

export interface TransactionRecord {
  id: string;
  customerName: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  date: string;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  items: number;
  total: number;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  date: string;
}

export interface PaymentRecord {
  id: string;
  customerName: string;
  amount: number;
  method: "card" | "bank" | "wallet";
  status: "successful" | "failed" | "refunded";
  date: string;
}

export interface RevenuePoint {
  month: string;
  label: string;
  value: number;
}

function makeName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export const CUSTOMERS: CustomerRecord[] = Array.from({ length: 42 }, (_, i) => {
  const name = makeName();
  return {
    id: `cust-${i + 1}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    status: rng() > 0.22 ? "active" : "inactive",
    segment: pick(["enterprise", "smb", "individual"]),
    joinedDate: daysAgo(randomInt(5, 720)),
    totalSpent: randomInt(120, 48000),
  };
});

export const TRANSACTIONS: TransactionRecord[] = Array.from({ length: 140 }, (_, i) => ({
  id: `txn-${1000 + i}`,
  customerName: pick(CUSTOMERS).name,
  amount: randomInt(18, 4200),
  status: pick(["completed", "completed", "completed", "pending", "failed"]),
  date: daysAgo(randomInt(0, 365)),
})).sort((a, b) => (a.date < b.date ? 1 : -1));

export const ORDERS: OrderRecord[] = Array.from({ length: 64 }, (_, i) => ({
  id: `ord-${5000 + i}`,
  customerName: pick(CUSTOMERS).name,
  items: randomInt(1, 8),
  total: randomInt(24, 3100),
  status: pick(["processing", "shipped", "delivered", "delivered", "cancelled"]),
  date: daysAgo(randomInt(0, 365)),
})).sort((a, b) => (a.date < b.date ? 1 : -1));

export const PAYMENTS: PaymentRecord[] = Array.from({ length: 64 }, (_, i) => ({
  id: `pay-${9000 + i}`,
  customerName: pick(CUSTOMERS).name,
  amount: randomInt(18, 4200),
  method: pick(["card", "card", "bank", "wallet"]),
  status: pick(["successful", "successful", "successful", "failed", "refunded"]),
  date: daysAgo(randomInt(0, 365)),
})).sort((a, b) => (a.date < b.date ? 1 : -1));

export const REVENUE: RevenuePoint[] = (() => {
  const now = new Date();
  const points: RevenuePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short" });
    const seasonal = 1 + 0.15 * Math.sin(i / 2);
    const value = Math.round((32000 + i * 900) * seasonal + randomInt(-1800, 1800));
    points.push({ month: `${d.getFullYear()}-${d.getMonth() + 1}`, label, value: Math.max(4000, value) });
  }
  return points;
})();

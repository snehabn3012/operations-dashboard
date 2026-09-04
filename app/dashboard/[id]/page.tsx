import DashboardById from "@/components/dashboard/DashboardById";

export default async function DashboardByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardById id={id} />;
}

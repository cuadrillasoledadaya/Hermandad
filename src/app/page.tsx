import { DashboardAvisos } from "@/components/social/dashboard-avisos";
import { TreasuryStats } from "@/components/treasury/treasury-stats";

export default function Home() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <section>
        <h2 className="text-xl font-bold mb-4 text-primary">Avisos y Novedades</h2>
        <div className="grid gap-6 md:grid-cols-1">
          <DashboardAvisos />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 text-primary">Estado de Tesorería</h2>
        <TreasuryStats />
      </section>
    </div>
  );
}

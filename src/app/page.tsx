import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";
import { AvisoCreator } from "@/components/notifications/aviso-creator";
import { TreasuryStats } from "@/components/treasury/treasury-stats";

export default function Home() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <section>
        <h2 className="text-xl font-bold mb-4 text-primary">Gestión de Avisos</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <AvisoCreator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actividad Reciente</h3>
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Último Aviso</CardTitle>
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Recordamos a todos los hermanos que el plazo para la retirada de papeletas de sitio comienza el próximo lunes.
                </p>
                <p className="text-xs text-muted-foreground mt-2">Hace 2 horas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 text-primary">Estado de Tesorería</h2>
        <TreasuryStats />
      </section>
    </div>
  );
}

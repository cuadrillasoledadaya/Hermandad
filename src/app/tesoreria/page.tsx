import { TreasuryDashboard } from "@/components/treasury/dashboard";

export default function TesoreriaPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Control de Pagos</h2>
                <p className="text-muted-foreground">
                    Visualización anual de cuotas por hermano. Los colores indican el estado de cada mes.
                </p>
            </div>

            <div className="bg-card rounded-xl shadow-sm border p-4">
                <div className="flex items-center space-x-4 mb-6 text-sm">
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-100 border border-green-800 rounded mr-2" />
                        <span>Pagado</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-white border rounded mr-2" />
                        <span>Pendiente</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-100 border border-red-800 rounded mr-2" />
                        <span>Impagada</span>
                    </div>
                </div>

                <TreasuryDashboard />
            </div>
        </div>
    );
}

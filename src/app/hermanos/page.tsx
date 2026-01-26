import { BrothersList } from "@/components/brothers/brothers-list";

export default function HermanosPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-primary">Censo de Hermanos</h2>
                <p className="text-muted-foreground">
                    Gestión de registros, antigüedad y recalibración de números.
                </p>
            </div>

            <BrothersList />
        </div>
    );
}

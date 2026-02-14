"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPapeletasPendientes, asignarPosicionAPapeleta, TipoPapeleta } from "@/lib/papeletas-cortejo"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, User, Search, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PosicionTipo } from "@/lib/cortejo"

interface AsignarPapeletaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posicionId: string
    posicionNombre: string
    posicionTipo: PosicionTipo
    posicionTramo: number
}

export function AsignarPapeletaDialog({
    open,
    onOpenChange,
    posicionId,
    posicionNombre,
    posicionTipo,
    posicionTramo
}: AsignarPapeletaDialogProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedPapeletaId, setSelectedPapeletaId] = useState<string | null>(null)
    const [showAllTramos, setShowAllTramos] = useState(false)
    const queryClient = useQueryClient()

    // Mapear tipo de posición a tipo de papeleta
    const mapTipoPosicionToPapeleta = (tipo: PosicionTipo): TipoPapeleta | null => {
        if (tipo === 'vara') return 'vara'
        if (tipo === 'insignia') return 'insignia'
        if (tipo === 'nazareno') return 'nazareno'
        if (tipo === 'bocina') return 'bocina'
        if (tipo === 'cruz_guia') return 'cruz_guia'
        return null
    }

    const tipoPapeleta = mapTipoPosicionToPapeleta(posicionTipo)

    const { data: papeletas, isLoading } = useQuery({
        queryKey: ['papeletas_pendientes', tipoPapeleta, showAllTramos ? null : posicionTramo],
        queryFn: () => getPapeletasPendientes(
            tipoPapeleta || undefined,
            showAllTramos ? undefined : posicionTramo
        ),
        enabled: open && (!!tipoPapeleta || posicionTipo === 'cruz_guia')
    })

    const asignarMutation = useMutation({
        mutationFn: async () => {
            if (!selectedPapeletaId) throw new Error("Debes seleccionar una papeleta")
            await asignarPosicionAPapeleta(selectedPapeletaId, posicionId)
        },
        onSuccess: () => {
            toast.success("Posición asignada correctamente")
            queryClient.invalidateQueries({ queryKey: ['cortejo_completo'] })
            queryClient.invalidateQueries({ queryKey: ['cortejo_stats'] })
            queryClient.invalidateQueries({ queryKey: ['papeletas_pendientes'] })
            onOpenChange(false)
            setSelectedPapeletaId(null)
        },
        onError: (error: Error) => {
            toast.error(error.message || "Error al asignar la posición")
        }
    })

    const filteredPapeletas = papeletas?.filter(p => {
        const nombre = p.hermano?.nombre?.toLowerCase() || ''
        const apellidos = p.hermano?.apellidos?.toLowerCase() || ''
        const search = searchTerm.toLowerCase()
        return nombre.includes(search) ||
            apellidos.includes(search) ||
            p.numero.toString().includes(searchTerm)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-white">
                <DialogHeader>
                    <DialogTitle>Asignar: {posicionNombre}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!tipoPapeleta ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-md">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">No se pueden asignar papeletas a este tipo de posición automáticamente.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre o número..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center space-x-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="showAll"
                                        checked={showAllTramos}
                                        onChange={(e) => setShowAllTramos(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label
                                        htmlFor="showAll"
                                        className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                        Mostrar hermanos de otros tramos
                                    </label>
                                </div>
                            </div>

                            <div className="border rounded-md min-h-[200px] max-h-[300px] overflow-y-auto p-2 space-y-1">
                                {isLoading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredPapeletas?.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
                                        <User className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm">No hay papeletas {tipoPapeleta ? `de ${tipoPapeleta}` : 'disponibles'} pendientes.</p>
                                    </div>
                                ) : (
                                    filteredPapeletas?.map((papeleta) => (
                                        <button
                                            key={papeleta.id}
                                            onClick={() => setSelectedPapeletaId(papeleta.id)}
                                            className={`w-full text-left p-3 rounded-md transition-colors flex items-center justify-between group border ${selectedPapeletaId === papeleta.id
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                                                : 'bg-white border-transparent hover:bg-slate-50'
                                                }`}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {papeleta.hermano?.nombre} {papeleta.hermano?.apellidos}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Papeleta {papeleta.numero > 0 ? `#${papeleta.numero}` : '(OFFLINE)'}
                                                    {papeleta.tramo !== null && ` • Tramo ${papeleta.tramo}`}
                                                    • {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(papeleta.importe)}
                                                </p>
                                            </div>
                                            {selectedPapeletaId === papeleta.id && (
                                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => asignarMutation.mutate()}
                            disabled={!selectedPapeletaId || asignarMutation.isPending}
                        >
                            {asignarMutation.isPending && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Confirmar Asignación
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

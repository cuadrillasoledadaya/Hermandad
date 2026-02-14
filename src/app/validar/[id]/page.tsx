"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getPapeleta, type PapeletaConDetalles, TIPOS_PAPELETA } from "@/lib/papeletas-cortejo"
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Calendar, Hash, User } from "lucide-react"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function ValidarPapeletaPage() {
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(true)
    const [papeleta, setPapeleta] = useState<PapeletaConDetalles | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const data = await getPapeleta(id)
                setPapeleta(data)
            } catch (err) {
                console.error("Error validando papeleta:", err)
                setError("No se ha podido encontrar la papeleta o el código es inválido.")
            } finally {
                setLoading(false)
            }
        }
        if (id) load()
    }, [id])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
                    <p className="text-slate-600 font-medium">Verificando autenticidad...</p>
                </div>
            </div>
        )
    }

    if (error || !papeleta) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-t-4 border-red-500">
                    <XCircle className="w-20 h-20 text-red-500 mx-auto" />
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-900">PAPELETA INVÁLIDA</h1>
                        <p className="text-slate-500">{error || "Esta papeleta no existe en nuestros registros."}</p>
                    </div>
                </Card>
            </div>
        )
    }

    const isValid = papeleta.estado !== 'cancelada'
    const hermanoNombre = papeleta.hermano
        ? `${papeleta.hermano.nombre.charAt(0)}. ${papeleta.hermano.apellidos}`
        : "Confidencial"

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
            <Card className={`max-w-md w-full overflow-hidden shadow-2xl border-none ${isValid ? 'ring-2 ring-emerald-500' : 'ring-2 ring-red-500'}`}>
                {/* Cabecera Estado */}
                <div className={`p-8 text-center space-y-4 ${isValid ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                    {isValid ? (
                        <>
                            <CheckCircle2 className="w-20 h-20 mx-auto" />
                            <h1 className="text-3xl font-black tracking-tighter uppercase">Papeleta Válida</h1>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-20 h-20 mx-auto" />
                            <h1 className="text-3xl font-black tracking-tighter uppercase">Papeleta Cancelada</h1>
                        </>
                    )}
                    <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        Verificación Oficial
                    </div>
                </div>

                {/* Detalles */}
                <div className="p-8 space-y-6 bg-white">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <User className="w-6 h-6 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hermano</p>
                                <p className="text-xl font-bold text-slate-900">{hermanoNombre}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <Hash className="w-6 h-6 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Número</p>
                                    <p className="text-xl font-bold text-slate-900">#{papeleta.numero}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <Calendar className="w-6 h-6 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Año</p>
                                    <p className="text-xl font-bold text-slate-900">{papeleta.anio}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tipo de Sitio</p>
                                    <p className="text-lg font-bold text-slate-800">
                                        {TIPOS_PAPELETA[papeleta.tipo as keyof typeof TIPOS_PAPELETA] || papeleta.tipo}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tramo</p>
                                    <p className="text-lg font-bold text-slate-800">{papeleta.tramo ?? '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 text-center">
                        <p className="text-[10px] text-slate-400 uppercase italic">
                            Verificado el {format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Footer de la Hermandad */}
            <div className="fixed bottom-8 text-center text-slate-400 font-medium">
                <p className="text-xs uppercase tracking-widest mb-1">Pontificia y Real Hermandad</p>
                <p className="text-[10px] italic">Gestión de Cortejo v1.2.27</p>
            </div>
        </div>
    )
}

"use client"

import { QRCodeSVG } from "qrcode.react"
import { TIPOS_PAPELETA, type PapeletaConDetalles } from "@/lib/papeletas-cortejo"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface PapeletaImprimibleProps {
    papeleta: PapeletaConDetalles
}

export function PapeletaImprimible({ papeleta }: PapeletaImprimibleProps) {
    const validationUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/validar/${papeleta.id}`

    return (
        <div className="print-container bg-white p-8 max-w-[210mm] mx-auto border shadow-sm">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-container, .print-container * {
                        visibility: visible;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none;
                        box-shadow: none;
                        padding: 0;
                        margin: 0;
                    }
                    @page {
                        size: A5 landscape;
                        margin: 10mm;
                    }
                }
            `}</style>

            <div className="border-4 border-double border-slate-800 p-6 flex flex-col h-full min-h-[148mm]">
                {/* Cabecera */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-2 border-slate-300">
                            {/* Aquí iría el escudo de la hermandad */}
                            <span className="text-xs text-slate-400 font-bold uppercase text-center">Escudo<br />Hdad</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">
                                Pontificia y Real Hermandad
                            </h1>
                            <p className="text-sm font-serif italic text-slate-600 uppercase">
                                Estación de Penitencia - Viernes Santo
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-slate-900 mb-1">
                            # {papeleta.numero > 0 ? papeleta.numero : 'PEND.'}
                        </div>
                        <div className="text-xs font-bold bg-slate-900 text-white px-2 py-1 inline-block uppercase tracking-widest">
                            Año {papeleta.anio}
                        </div>
                    </div>
                </div>

                {/* Título Central */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-serif uppercase tracking-[0.2em] border-y-2 border-slate-900 py-2 inline-block px-12">
                        Papeleta de Sitio
                    </h2>
                </div>

                {/* Datos del Hermano */}
                <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Hermano / Hermanos</span>
                        <div className="text-2xl font-black text-slate-900 uppercase">
                            {papeleta.hermano?.nombre} {papeleta.hermano?.apellidos}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-1 border-b-2 border-slate-200 pb-2">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tipo de Sitio</span>
                                <div className="text-xl font-bold text-slate-800 capitalize">
                                    {TIPOS_PAPELETA[papeleta.tipo as keyof typeof TIPOS_PAPELETA] || papeleta.tipo}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-1 border-b-2 border-slate-200 pb-2">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tramo / Posición</span>
                                <div className="text-xl font-bold text-slate-800">
                                    {papeleta.tramo !== null ? `Tramo ${papeleta.tramo}` : 'General'}
                                    {papeleta.posicion && ` - ${papeleta.posicion.nombre}`}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                            <QRCodeSVG
                                value={validationUrl}
                                size={120}
                                level="H"
                                includeMargin={true}
                            />
                            <span className="text-[8px] font-mono mt-2 text-slate-400">
                                {papeleta.id}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-slate-300 flex justify-between items-end">
                    <div className="text-xs text-slate-500 space-y-1">
                        <p>Emitida el: <span className="font-bold text-slate-700">{format(new Date(papeleta.fecha_pago), "d 'de' MMMM 'de' yyyy", { locale: es })}</span></p>
                        <p>Importe abonado: <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(papeleta.importe)}</span></p>
                    </div>
                    <div className="text-right flex flex-col items-center">
                        <div className="w-32 h-16 border-b border-slate-400 mb-1"></div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Firma Secretario / Tesorero</span>
                    </div>
                </div>

                <div className="mt-4 text-[8px] text-center text-slate-400 uppercase italic">
                    Esta papeleta es personal e intransferible. Debe conservarse durante toda la Estación de Penitencia.
                </div>
            </div>
        </div>
    )
}

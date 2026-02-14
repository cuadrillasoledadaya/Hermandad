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
        <div className="papeleta-root bg-white p-4 sm:p-8 w-full max-w-[210mm] mx-auto overflow-hidden">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A5 landscape;
                        margin: 0;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .papeleta-root, .papeleta-root * {
                        visibility: visible;
                    }
                    .papeleta-root {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 210mm;
                        height: 148mm;
                        padding: 10mm;
                        border: none;
                        background: white !important;
                    }
                }
                
                .papeleta-border {
                    border: 8px double #1e293b;
                    padding: 1.5rem;
                    background: #fff;
                    position: relative;
                    min-height: 120mm;
                    display: flex;
                    flex-direction: column;
                }

                .papeleta-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    font-size: 8rem;
                    opacity: 0.03;
                    pointer-events: none;
                    font-weight: 900;
                    white-space: nowrap;
                    z-index: 0;
                }
            `}</style>

            <div className="papeleta-border shadow-inner">
                <div className="papeleta-watermark uppercase font-serif">
                    Hermandad
                </div>

                {/* Cabecera */}
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center p-2">
                            {/* Escudo simbólico con CSS */}
                            <div className="w-full h-full border-2 border-white/50 rounded-full flex items-center justify-center">
                                <span className="text-[10px] text-white font-black text-center leading-none">PONTIFICIA<br />Y REAL</span>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1 font-serif">
                                Pontificia y Real Hermandad
                            </h1>
                            <p className="text-sm font-serif italic text-slate-600 uppercase tracking-widest">
                                Estación de Penitencia • Viernes Santo
                            </p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="text-4xl font-black text-slate-900 leading-none mb-1">
                            № {papeleta.numero > 0 ? papeleta.numero : '---'}
                        </div>
                        <div className="bg-slate-900 text-white px-4 py-1.5 font-bold text-sm tracking-[0.2em] uppercase">
                            Año {papeleta.anio}
                        </div>
                    </div>
                </div>

                {/* Título */}
                <div className="relative z-10 text-center mb-8">
                    <div className="h-px bg-slate-300 w-full mb-2"></div>
                    <h2 className="text-4xl font-serif uppercase tracking-[0.25em] py-2 text-slate-800">
                        Papeleta de Sitio
                    </h2>
                    <div className="h-px bg-slate-300 w-full mt-2"></div>
                </div>

                {/* Contenido Principal */}
                <div className="relative z-10 flex-1 grid grid-cols-3 gap-8 items-center">
                    <div className="col-span-2 space-y-8">
                        <div className="space-y-1">
                            <span className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em]">Hermano / Hermanos</span>
                            <div className="text-3xl font-black text-slate-900 uppercase leading-snug break-words">
                                {papeleta.hermano?.nombre} {papeleta.hermano?.apellidos}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <span className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em]">Tipo de Sitio</span>
                                <div className="text-xl font-bold text-slate-700 uppercase border-b-2 border-slate-100 pb-1">
                                    {TIPOS_PAPELETA[papeleta.tipo as keyof typeof TIPOS_PAPELETA] || papeleta.tipo}
                                </div>
                            </div>
                            <div>
                                <span className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em]">Tramo / Posición</span>
                                <div className="text-xl font-bold text-slate-700 border-b-2 border-slate-100 pb-1">
                                    {papeleta.tramo !== null ? `Tramo ${papeleta.tramo}` : 'General'}
                                    {papeleta.posicion && ` - ${papeleta.posicion.nombre}`}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <div className="bg-white p-2 border-2 border-slate-200 shadow-sm rounded-lg hover:shadow-md transition-shadow">
                            <QRCodeSVG
                                value={validationUrl}
                                size={140}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <span className="text-[9px] font-mono mt-3 text-slate-400 font-bold tracking-tighter">
                            CERT: {papeleta.id.slice(0, 18).toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 mt-8 pt-6 border-t border-slate-200 flex justify-between items-end">
                    <div className="text-xs space-y-2 text-slate-600">
                        <p className="flex items-center gap-2">
                            <span className="font-black text-slate-400">EMISIÓN:</span>
                            <span className="font-bold text-slate-800 uppercase">{format(new Date(papeleta.fecha_pago), "d 'de' MMMM 'de' yyyy", { locale: es })}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <span className="font-black text-slate-400">IMPORTE:</span>
                            <span className="text-lg font-black text-emerald-700">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(papeleta.importe)}</span>
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="mb-1 italic font-serif text-slate-400 text-[10px]">Firma y Sello Digital:</div>
                        <div className="px-8 py-2 border border-slate-200 rounded italic font-serif text-slate-400 text-sm">
                            Secretaría / Tesorería
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-[9px] text-center text-slate-300 uppercase tracking-widest font-black">
                Esta certificación es personal e intransferible • Documento Oficial de la Hermandad
            </div>
        </div>
    )
}

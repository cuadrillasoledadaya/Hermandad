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
        <div className="papeleta-root bg-white p-2 sm:p-6 w-full max-w-[210mm] mx-auto overflow-hidden">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Sorts+Mill+Goudy:ital@0;1&display=swap');

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
                        padding: 8mm;
                        border: none;
                        background: white !important;
                    }
                }
                
                .papeleta-border-outer {
                    border: 2px solid #0f172a;
                    padding: 4px;
                    height: 100%;
                }

                .papeleta-border-inner {
                    border: 1px solid #0f172a;
                    padding: 1.5rem;
                    background: #fff;
                    position: relative;
                    min-height: 115mm;
                    display: flex;
                    flex-direction: column;
                    z-index: 10;
                }

                /* Ornamentos en las esquinas */
                .corner-decoration {
                    position: absolute;
                    width: 40px;
                    height: 40px;
                    border: 2px solid #0f172a;
                    z-index: 20;
                }
                .top-left { top: -2px; left: -2px; border-right: none; border-bottom: none; border-top-left-radius: 4px; }
                .top-right { top: -2px; right: -2px; border-left: none; border-bottom: none; border-top-right-radius: 4px; }
                .bottom-left { bottom: -2px; left: -2px; border-right: none; border-top: none; border-bottom-left-radius: 4px; }
                .bottom-right { bottom: -2px; right: -2px; border-left: none; border-top: none; border-bottom-right-radius: 4px; }

                .papeleta-font-serif {
                    font-family: 'Sorts Mill Goudy', serif;
                }
                
                .papeleta-font-accent {
                    font-family: 'Cinzel', serif;
                }

                .papeleta-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 300px;
                    height: 300px;
                    opacity: 0.04;
                    pointer-events: none;
                    z-index: 0;
                    background-image: url('https://files.insforge.com/hermandad/escudo_watermark.png'); /* Fallback pattern if image not exists */
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                }

                .divider-classic {
                    height: 2px;
                    background: linear-gradient(to right, transparent, #0f172a, transparent);
                    margin: 1rem 0;
                    opacity: 0.3;
                }
            `}</style>

            <div className="papeleta-border-outer shadow-2xl">
                <div className="papeleta-border-inner">
                    {/* Esquinas Ornamentales */}
                    <div className="corner-decoration top-left" />
                    <div className="corner-decoration top-right" />
                    <div className="corner-decoration bottom-left" />
                    <div className="corner-decoration bottom-right" />

                    <div className="papeleta-watermark" />

                    {/* Cabecera */}
                    <div className="relative z-10 flex justify-between items-center mb-4">
                        <div className="flex-1 text-center">
                            <h3 className="papeleta-font-accent text-xs tracking-[0.4em] uppercase text-slate-500 mb-1">
                                Pontificia y Real
                            </h3>
                            <h1 className="papeleta-font-accent text-2xl font-black uppercase tracking-[0.1em] text-slate-900 leading-none mb-1">
                                Hermandad de la Soledad
                            </h1>
                            <p className="papeleta-font-serif italic text-[11px] text-slate-600 uppercase tracking-[0.3em]">
                                Estación de Penitencia • Viernes Santo
                            </p>
                        </div>
                    </div>

                    <div className="divider-classic" />

                    {/* Fila superior: Número y Año */}
                    <div className="relative z-10 flex justify-between items-end mb-8 px-4">
                        <div className="text-left">
                            <span className="papeleta-font-accent text-[10px] uppercase tracking-widest text-slate-400">Papeleta Número</span>
                            <div className="papeleta-font-serif text-4xl font-bold text-slate-900">
                                № {papeleta.numero > 0 ? papeleta.numero : '---'}
                            </div>
                        </div>
                        <div className="text-center bg-slate-100 border border-slate-200 px-6 py-2 rounded">
                            <span className="papeleta-font-accent text-[10px] uppercase tracking-widest text-slate-400 block mb-1">Ejercicio</span>
                            <div className="papeleta-font-serif text-2xl font-black text-slate-900 leading-none">
                                {papeleta.anio}
                            </div>
                        </div>
                    </div>

                    {/* Título Central */}
                    <div className="relative z-10 text-center mb-10">
                        <h2 className="papeleta-font-serif text-5xl font-normal italic tracking-wide text-slate-800">
                            Papeleta de Sitio
                        </h2>
                    </div>

                    {/* Cuerpo de Información */}
                    <div className="relative z-10 flex-1 px-4">
                        <div className="grid grid-cols-12 gap-6 items-start">
                            <div className="col-span-12 mb-6">
                                <span className="papeleta-font-accent text-[10px] uppercase tracking-[0.3em] text-slate-400 block mb-2">Hermano de Pleno Derecho</span>
                                <div className="papeleta-font-serif text-3xl font-medium text-slate-900 border-b border-slate-100 pb-2">
                                    {papeleta.hermano?.nombre} {papeleta.hermano?.apellidos}
                                </div>
                            </div>

                            <div className="col-span-8 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <span className="papeleta-font-accent text-[10px] uppercase tracking-[0.3em] text-slate-400 block mb-2">Tipo de Sitio</span>
                                        <div className="papeleta-font-serif text-xl font-bold text-slate-800 bg-slate-50 px-3 py-2 border-l-4 border-slate-900">
                                            {TIPOS_PAPELETA[papeleta.tipo as keyof typeof TIPOS_PAPELETA] || papeleta.tipo}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="papeleta-font-accent text-[10px] uppercase tracking-[0.3em] text-slate-400 block mb-2">Tramo de Cortejo</span>
                                        <div className="papeleta-font-serif text-xl font-bold text-slate-800 bg-slate-50 px-3 py-2 border-l-4 border-slate-400">
                                            {papeleta.tramo !== null ? `Tramo ${papeleta.tramo}` : 'Tramo General'}
                                        </div>
                                    </div>
                                </div>

                                {papeleta.posicion && (
                                    <div>
                                        <span className="papeleta-font-accent text-[10px] uppercase tracking-[0.3em] text-slate-400 block mb-2">Puesto Asignado</span>
                                        <div className="papeleta-font-serif text-lg font-medium italic text-slate-700">
                                            {papeleta.posicion.nombre}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="col-span-4 flex flex-col items-center justify-center">
                                <div className="bg-white p-3 border-2 border-slate-200 shadow-xl rounded-sm relative">
                                    <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-slate-900"></div>
                                    <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-slate-900"></div>
                                    <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-slate-900"></div>
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-slate-900"></div>

                                    <QRCodeSVG
                                        value={validationUrl}
                                        size={120}
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>
                                <span className="papeleta-font-accent text-[8px] font-bold mt-4 text-slate-400 tracking-widest uppercase">
                                    Verificación Digital
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Pie de Página */}
                    <div className="relative z-10 mt-6 pt-6 border-t border-slate-100 flex justify-between items-end px-4">
                        <div className="text-left">
                            <div className="flex items-center gap-4 mb-2">
                                <div>
                                    <span className="papeleta-font-accent text-[9px] uppercase tracking-widest text-slate-400 block">Expedición</span>
                                    <span className="papeleta-font-serif font-bold text-slate-700 text-sm">
                                        {format(new Date(papeleta.fecha_pago), "d 'de' MMMM 'de' yyyy", { locale: es })}
                                    </span>
                                </div>
                                <div className="w-px h-8 bg-slate-200"></div>
                                <div>
                                    <span className="papeleta-font-accent text-[9px] uppercase tracking-widest text-slate-400 block">Limosna</span>
                                    <span className="papeleta-font-serif font-black text-slate-900 text-base">
                                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(papeleta.importe)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center opacity-50 space-y-2">
                            <div className="papeleta-font-serif italic text-slate-400 text-[10px] mb-8">Sello de la Secretaría</div>
                            <div className="w-24 h-24 border-2 border-slate-300 rounded-full flex items-center justify-center p-2 mx-auto">
                                <div className="w-full h-full border border-slate-200 rounded-full border-dashed flex items-center justify-center">
                                    <span className="papeleta-font-accent text-[7px] text-slate-300 font-bold leading-none text-center">SIGILLUM<br />HERMANDAD</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-[10px] text-center text-slate-400 uppercase tracking-[0.4em] papeleta-font-accent opacity-50">
                Potius Mori Quam Foedari
            </div>
        </div>
    )
}

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Users, Calendar, ShieldCheck, ArrowRight, Euro, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';

export default function ConfiguracionPage() {
    const { role } = useAuth();

    if (role !== 'SUPERADMIN' && role !== 'JUNTA') {
        return (
            <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-slate-900">Acceso Restringido</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Esta sección solo es accesible para la Junta de Gobierno y Superadmins.
                </p>
            </div>
        );
    }

    const sections = [
        {
            title: 'Temporadas',
            description: 'Gestionar ciclos de trabajo y temporadas activas.',
            icon: Calendar,
            href: '/configuracion/temporadas',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            roles: ['SUPERADMIN', 'JUNTA']
        },
        {
            title: 'Usuarios y Roles',
            description: 'Gestionar privilegios de hermanos y miembros de junta.',
            icon: ShieldCheck,
            href: '/configuracion/usuarios',
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            roles: ['SUPERADMIN', 'JUNTA']
        },
        {
            title: 'Precios y Cuotas',
            description: 'Configurar precios fijos para cuotas y papeletas.',
            icon: Euro,
            href: '/configuracion/precios',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            roles: ['SUPERADMIN', 'JUNTA']
        },
        {
            title: 'Miembros de la Hermandad',
            description: 'Acceso directo a la base de datos de hermanos.',
            icon: Users,
            href: '/hermanos',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            roles: ['SUPERADMIN', 'JUNTA']
        }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 py-6 px-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configuración</h1>
                <p className="text-slate-500">Administra los parámetros generales y privilegios del sistema.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => {
                    const hasPermission = section.roles.includes(role || '');
                    if (!hasPermission) return null;

                    return (
                        <Link href={section.href} key={section.title} className="group">
                            <Card className="h-full border-slate-200 transition-all group-hover:shadow-md group-hover:border-primary/20">
                                <CardHeader className="pb-4">
                                    <div className={`w-12 h-12 rounded-xl ${section.bg} flex items-center justify-center mb-2`}>
                                        <section.icon className={`w-6 h-6 ${section.color}`} />
                                    </div>
                                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                        {section.title}
                                    </CardTitle>
                                    <CardDescription>{section.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                        Acceder <ArrowRight className="ml-1 w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            <Card className="bg-slate-50 border-dashed border-slate-300">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5 text-slate-400" />
                        Ajustes del Sistema
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500 italic">
                    Más opciones de personalización (Escudo, Nombre de la Hermandad, etc.) estarán disponibles en futuras actualizaciones.
                </CardContent>
            </Card>
        </div>
    );
}

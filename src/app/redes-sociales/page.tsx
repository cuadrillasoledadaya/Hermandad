'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InternalManager } from '@/components/social/internal-manager';
import { ExternalManager } from '@/components/social/external-manager';
import { Bell, Share2 } from 'lucide-react';

export default function SocialMediaPage() {
    return (
        <div className="container mx-auto px-4 py-6 pb-24">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-primary">Redes Sociales y Avisos</h1>
                <p className="text-slate-500">Gestiona las notificaciones internas y publicaciones en redes sociales.</p>
            </div>

            <Tabs defaultValue="internal" className="w-full space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="internal" className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Avisos Internos
                    </TabsTrigger>
                    <TabsTrigger value="external" className="flex items-center gap-2">
                        <Share2 className="w-4 h-4" />
                        Redes Sociales
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="internal">
                    <Card>
                        <CardHeader>
                            <CardTitle>Avisos de la Hermandad</CardTitle>
                            <CardDescription>
                                Estos avisos solo son visibles para los usuarios dentro de la aplicación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <InternalManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="external">
                    <Card>
                        <CardHeader>
                            <CardTitle>Publicación en Redes</CardTitle>
                            <CardDescription>
                                Gestiona publicaciones para Instagram, Facebook y Twitter a través de Make.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ExternalManager />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

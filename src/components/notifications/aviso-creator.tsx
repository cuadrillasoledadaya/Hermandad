'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Share2 } from 'lucide-react';
import { sendToSocialMedia } from '@/lib/notifications';
import { toast } from 'sonner';

import { useAuth } from '@/components/providers/auth-provider';

export function AvisoCreator() {
    const { role } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
    });

    if (role === 'HERMANO') return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const result = await sendToSocialMedia({
            ...formData,
            platforms: ['Facebook', 'Instagram', 'Twitter'], // Example default platforms
        });

        setLoading(false);

        if (result.success) {
            toast.success('Aviso enviado correctamente a redes sociales');
            setFormData({ title: '', content: '' });
        } else {
            toast.error('Error al enviar el aviso: ' + result.error);
        }
    };

    return (
        <Card className="border-primary/10">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <Share2 className="mr-2 h-5 w-5 text-primary" />
                    Redactar Nuevo Aviso
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título del Aviso</Label>
                        <Input
                            id="title"
                            placeholder="Ej. Cambio de horario ensayos"
                            value={formData.title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="content">Contenido</Label>
                        <Textarea
                            id="content"
                            placeholder="Escribe aquí el mensaje detallado..."
                            rows={4}
                            value={formData.content}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, content: e.target.value })}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        <Send className="mr-2 h-4 w-4" />
                        {loading ? 'Enviando...' : 'Publicar en Redes'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { offlineInsert, offlineUpdate } from '@/lib/offline-mutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Send, AlertCircle, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface Aviso {
    id: string;
    titulo: string;
    contenido: string;
    fecha_creacion: string;
    activo: boolean;
}

export function InternalManager() {
    const { role, user } = useAuth();
    const [avisos, setAvisos] = useState<Aviso[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        content: '',
    });

    // Only allow admin or specific roles to edit/delete
    // Assuming 'HERMANO' is basic user, others are admins/staff
    const canManage = role !== 'HERMANO';

    useEffect(() => {
        fetchAvisos();
    }, []);

    const fetchAvisos = async () => {
        try {
            const { data, error } = await supabase
                .from('avisos_internos')
                .select('*')
                .eq('activo', true)
                .order('fecha_creacion', { ascending: false });

            if (error) throw error;
            setAvisos(data || []);
        } catch (error) {
            console.error('Error fetching avisos:', error);
            toast.error('Error al cargar los avisos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        setSubmitting(true);
        try {
            const { success, offline, error } = await offlineInsert('avisos_internos', {
                titulo: formData.title,
                contenido: formData.content,
                autor_id: user?.id,
            });

            if (!success) throw new Error(error || 'Error publicando aviso');

            if (offline) {
                toast.success('Aviso guardado localmente (Offline). Se publicará al recuperar la conexión.');
            } else {
                toast.success('Aviso interno publicado correctamente');
            }

            setFormData({ title: '', content: '' });
            fetchAvisos();
        } catch (error) {
            console.error('Error creating aviso:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al publicar el aviso: ' + msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (aviso: Aviso) => {
        setEditingId(aviso.id);
        setEditForm({
            title: aviso.titulo,
            content: aviso.contenido
        });
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSubmitting(true);
        try {
            const { success, offline, error } = await offlineUpdate('avisos_internos', {
                id: editingId,
                titulo: editForm.title,
                contenido: editForm.content,
                updated_at: new Date().toISOString()
            });

            if (!success) throw new Error(error || 'Error actualizando');

            if (offline) {
                toast.success('Cambios guardados localmente (Offline).');
            } else {
                toast.success('Aviso actualizado correctamente');
            }

            setEditingId(null);
            fetchAvisos();
        } catch (error: unknown) {
            console.error('Error updating aviso:', error);
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al actualizar el aviso: ' + msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canManage) return;
        if (!confirm('¿Estás seguro de que deseas borrar este aviso?')) return;

        try {
            const { success, offline, error } = await offlineUpdate('avisos_internos', {
                id,
                activo: false
            });

            if (!success) {
                throw new Error(error || 'Error eliminando aviso');
            }

            if (offline) {
                toast.success('Borrado registrado localmente (Offline).');
            } else {
                toast.success('Aviso eliminado');
            }

            // Optimistic update for UI list
            setAvisos(prev => prev.filter(a => a.id !== id));
        } catch (error: unknown) {
            console.error('Error deleting aviso:', error);
            toast.error('No se pudo borrar el aviso.');
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            {canManage && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-semibold mb-4 text-sm uppercase text-slate-500">Nuevo Aviso Interno</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="internal-title">Título</Label>
                            <Input
                                id="internal-title"
                                placeholder="Título del aviso"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="internal-content">Contenido</Label>
                            <Textarea
                                id="internal-content"
                                placeholder="Escribe el contenido del aviso..."
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Publicar Aviso Interno
                        </Button>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase text-slate-500">Avisos Activos</h3>
                {avisos.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
                        <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No hay avisos activos</p>
                    </div>
                ) : (
                    avisos.map((aviso) => (
                        <Card key={aviso.id} className="relative overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-primary">{aviso.titulo}</CardTitle>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {new Date(aviso.fecha_creacion).toLocaleDateString()} a las {new Date(aviso.fecha_creacion).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleEdit(aviso)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-300 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(aviso.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{aviso.contenido}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Dialogo de Edición */}
            <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Aviso Interno</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Título</Label>
                            <Input
                                id="edit-title"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-content">Contenido</Label>
                            <Textarea
                                id="edit-content"
                                rows={5}
                                value={editForm.content}
                                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingId(null)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdate} disabled={submitting}>
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

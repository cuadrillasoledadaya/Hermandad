'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Send, Edit, Globe, History, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { sendToSocialMedia } from '@/lib/notifications';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Publicacion {
    id: string;
    titulo: string;
    contenido: string;
    plataformas: string[];
    estado: string;
    fecha_publicacion: string;
}

export function ExternalManager() {
    const { role, user } = useAuth();
    const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Create Form
    const [formData, setFormData] = useState({
        title: '',
        content: '',
    });

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', content: '' });
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const canManage = role !== 'HERMANO';

    useEffect(() => {
        fetchPublicaciones();
    }, []);

    const fetchPublicaciones = async () => {
        try {
            const { data, error } = await supabase
                .from('publicaciones_redes')
                .select('*')
                .neq('estado', 'eliminado') // Don't show soft deleted ?? Or show them? Prompt said "borrar cualquier cosa... sin tener que ir a red a red". 
                // Currently only hiding locally deleted ones.
                .order('fecha_publicacion', { ascending: false });

            if (error) throw error;
            setPublicaciones(data || []);
        } catch (error) {
            console.error('Error fetching publicaciones:', error);
            toast.error('Error al cargar publicaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        setSubmitting(true);
        try {
            // 1. Insert into DB first to get ID
            const { data, error } = await supabase.from('publicaciones_redes').insert({
                titulo: formData.title,
                contenido: formData.content,
                plataformas: ['Facebook', 'Instagram', 'Twitter'], // Default for now
                autor_id: user?.id,
                estado: 'publicado'
            }).select().single();

            if (error) throw error;

            const newPost = data;

            // 2. Send to Make
            const makeResult = await sendToSocialMedia({
                action: 'create',
                id: newPost.id,
                title: newPost.titulo,
                content: newPost.contenido,
                platforms: newPost.plataformas || ['Facebook', 'Instagram', 'Twitter']
            });

            if (!makeResult.success) {
                toast.warning('Guardado en base de datos pero falló el envío a redes: ' + makeResult.error);
            } else {
                toast.success('Publicado correctamente en redes sociales');
            }

            setFormData({ title: '', content: '' });
            fetchPublicaciones();
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error('Error al crear la publicación');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (post: Publicacion) => {
        setEditingId(post.id);
        setEditForm({ title: post.titulo, content: post.contenido });
        setIsEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingId || !canManage) return;
        setSubmitting(true);

        try {
            // 1. Update DB
            const { error } = await supabase
                .from('publicaciones_redes')
                .update({
                    titulo: editForm.title,
                    contenido: editForm.content,
                    estado: 'editado',
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingId);

            if (error) throw error;

            // 2. Send to Make (Update)
            // Note: Make scenario needs to handle finding the post via our internal ID or just creating a "Correction" post
            const makeResult = await sendToSocialMedia({
                action: 'update',
                id: editingId,
                title: editForm.title,
                content: editForm.content,
                platforms: ['Facebook', 'Instagram', 'Twitter']
            });

            if (!makeResult.success) {
                toast.warning('Actualizado localmente pero falló la notificación a redes');
            } else {
                toast.success('Editado y notificado a redes');
            }

            setIsEditDialogOpen(false);
            setEditingId(null);
            fetchPublicaciones();
        } catch (error) {
            console.error('Error updating post:', error);
            toast.error('Error al actualizar la publicación');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, currentTitle: string) => {
        if (!canManage) return;
        if (!confirm('¿Seguro que deseas eliminar esta publicación de todas las redes?')) return;

        try {
            // 1. Update DB to deleted
            const { error } = await supabase
                .from('publicaciones_redes')
                .update({ estado: 'eliminado' })
                .eq('id', id);

            if (error) throw error;

            // 2. Send to Make (Delete)
            const makeResult = await sendToSocialMedia({
                action: 'delete',
                id: id,
                title: currentTitle,
                content: '',
                platforms: []
            });

            if (!makeResult.success) {
                toast.warning('Eliminado localmente pero falló la notificación de borrado a redes');
            } else {
                toast.success('Eliminado y solicitud de borrado enviada');
            }

            fetchPublicaciones();
        } catch (error) {
            console.error('Error deleting post:', error);
            toast.error('Error al eliminar');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            {canManage && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-semibold mb-4 text-sm uppercase text-slate-500 flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Nueva Publicación Multi-Plataforma
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ext-title">Título</Label>
                            <Input
                                id="ext-title"
                                placeholder="Título para el post"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ext-content">Contenido</Label>
                            <Textarea
                                id="ext-content"
                                placeholder="Contenido del post para redes sociales..."
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Publicar en Todas las Redes
                        </Button>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase text-slate-500 flex items-center">
                    <History className="w-4 h-4 mr-2" />
                    Historial de Publicaciones
                </h3>

                {publicaciones.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
                        <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No hay historial de publicaciones</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {publicaciones.map((post) => (
                            <Card key={post.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base font-bold">{post.titulo}</CardTitle>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={post.estado === 'publicado' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {post.estado.toUpperCase()}
                                                </Badge>
                                                <span className="text-xs text-slate-400">
                                                    {new Date(post.fecha_publicacion).toLocaleDateString()} {new Date(post.fecha_publicacion).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(post)}>
                                                    <Edit className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(post.id, post.titulo)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 mb-2">{post.contenido}</p>
                                    <div className="flex gap-2">
                                        {post.plataformas?.map((p) => (
                                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Publicación</DialogTitle>
                        <DialogDescription>
                            Esto actualizará el registro y notificará a Make para intentar editar en redes.
                        </DialogDescription>
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
                                value={editForm.content}
                                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdate} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

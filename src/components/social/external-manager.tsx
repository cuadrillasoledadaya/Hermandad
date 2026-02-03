'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { offlineInsert, offlineUpdate } from '@/lib/offline-mutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Send, Edit, Globe, History, AlertCircle, Loader2, Plus } from 'lucide-react';
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
    archivos?: Array<{ url: string; type: string; name: string }>;
}

export function ExternalManager() {
    const { role, user } = useAuth();
    const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // State for files
    const [files, setFiles] = useState<Array<{ url: string; type: string; name: string }>>([]);
    const [uploading, setUploading] = useState(false);

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
                .neq('estado', 'eliminado') // Don't show soft deleted
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('social-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data } = supabase.storage
                .from('social-media')
                .getPublicUrl(filePath);

            const newFile = {
                url: data.publicUrl,
                type: file.type,
                name: file.name
            };

            setFiles(prev => [...prev, newFile]);
            toast.success('Archivo subido correctamente');
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error al subir el archivo');
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        setSubmitting(true);
        try {
            // 1. Insert into DB first
            const { success, data, offline, error } = await offlineInsert('publicaciones_redes', {
                titulo: formData.title,
                contenido: formData.content,
                plataformas: ['Facebook', 'Instagram', 'Twitter'],
                autor_id: user?.id,
                estado: 'publicado',
                archivos: files
            });

            if (!success) throw new Error(error || 'Error guardando publicación');

            if (offline) {
                toast.success('Publicación guardada localmente (Offline). Se enviará a redes cuando haya conexión.');
                setFormData({ title: '', content: '' });
                setFiles([]);
                fetchPublicaciones();
                return;
            }

            const newPost = data as Publicacion;

            // 2. Send to Make (Only if online)
            const makeResult = await sendToSocialMedia({
                action: 'create',
                id: newPost.id,
                title: newPost.titulo,
                content: newPost.contenido,
                platforms: newPost.plataformas || ['Facebook', 'Instagram', 'Twitter'],
                media: files
            });

            if (!makeResult.success) {
                toast.warning('Guardado en base de datos pero falló el envío a redes: ' + makeResult.error);
            } else {
                toast.success('Publicado correctamente en redes sociales');
            }

            setFormData({ title: '', content: '' });
            setFiles([]); // Reset files
            fetchPublicaciones();
        } catch (error) {
            console.error('Error creating post:', error);
            const msg = error instanceof Error ? error.message : '';
            toast.error('Error al crear la publicación: ' + msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (post: Publicacion) => {
        setEditingId(post.id);
        setEditForm({ title: post.titulo, content: post.contenido });
        // Restore files if existing
        setFiles(post.archivos || []);
        setIsEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingId || !canManage) return;
        setSubmitting(true);

        try {
            // 1. Update DB
            const { success, offline, error } = await offlineUpdate('publicaciones_redes', {
                id: editingId,
                titulo: editForm.title,
                contenido: editForm.content,
                estado: 'editado',
                updated_at: new Date().toISOString(),
                archivos: files
            });

            if (!success) throw new Error(error || 'Error actualizando');

            if (offline) {
                toast.success('Editado localmente (Offline). Se notificará a redes al conectar.');
                setIsEditDialogOpen(false);
                setEditingId(null);
                setFiles([]);
                fetchPublicaciones();
                return;
            }

            // 2. Send to Make (Update)
            const makeResult = await sendToSocialMedia({
                action: 'update',
                id: editingId,
                title: editForm.title,
                content: editForm.content,
                platforms: ['Facebook', 'Instagram', 'Twitter'],
                media: files
            });

            if (!makeResult.success) {
                toast.warning('Actualizado localmente pero falló la notificación a redes');
            } else {
                toast.success('Editado y notificado a redes');
            }

            setIsEditDialogOpen(false);
            setEditingId(null);
            setFiles([]);
            fetchPublicaciones();
        } catch (error) {
            console.error('Error updating post:', error);
            const msg = error instanceof Error ? error.message : '';
            toast.error('Error al actualizar la publicación: ' + msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, currentTitle: string) => {
        if (!canManage) return;
        if (!confirm('¿Seguro que deseas eliminar esta publicación de todas las redes?')) return;

        try {
            // 1. Update DB to deleted
            const { success, offline, error } = await offlineUpdate('publicaciones_redes', {
                id,
                estado: 'eliminado'
            });

            if (!success) throw new Error(error || 'Error eliminando');

            if (offline) {
                toast.success('Marcado como eliminado localmente. Se procesará al conectar.');
                fetchPublicaciones();
                return;
            }

            // 2. Send to Make (Delete)
            const makeResult = await sendToSocialMedia({
                action: 'delete',
                id: id,
                title: currentTitle,
                content: '',
                platforms: [],
                media: []
            });

            if (!makeResult.success) {
                toast.warning('Eliminado localmente pero falló la notificación de borrado a redes');
            } else {
                toast.success('Eliminado y solicitud de borrado enviada');
            }

            fetchPublicaciones();
        } catch (error) {
            console.error('Error deleting post:', error);
            const msg = error instanceof Error ? error.message : '';
            toast.error('Error al eliminar: ' + msg);
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

                        {/* File Upload Section */}
                        <div className="space-y-2">
                            <Label>Multimedia (Fotos/Documentos)</Label>
                            <div className="flex gap-2 flex-wrap">
                                {files.map((file, idx) => (
                                    <div key={idx} className="relative group bg-white p-2 border rounded-md flex items-center gap-2 pr-8">
                                        {file.type.startsWith('image/') ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={file.url}
                                                alt="preview"
                                                className="w-8 h-8 object-cover rounded"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-slate-100 flex items-center justify-center rounded text-xs font-bold text-slate-500">DOC</div>
                                        )}
                                        <span className="text-xs truncate max-w-[100px]" title={file.name}>{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="absolute top-1 right-1 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                <label className={`cursor-pointer border-2 border-dashed border-slate-300 hover:border-primary/50 hover:bg-slate-50 rounded-md p-2 flex items-center justify-center w-12 h-12 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        accept="image/*,.pdf,.doc,.docx"
                                        disabled={uploading}
                                    />
                                    {uploading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    ) : (
                                        <Plus className="w-5 h-5 text-slate-400" />
                                    )}
                                </label>
                            </div>
                        </div>

                        <Button type="submit" disabled={submitting || uploading} className="w-full sm:w-auto">
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
                                    {/* Preview attachments in history */}
                                    {post.archivos && post.archivos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2 mb-2">
                                            {post.archivos.map((file, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">
                                                    {file.type.startsWith('image/') ? (
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className='flex items-center gap-1 hover:underline'>
                                                            <span>📷</span> {file.name}
                                                        </a>
                                                    ) : (
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className='flex items-center gap-1 hover:underline'>
                                                            <span>📎</span> {file.name}
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
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

                        {/* File Upload Section in Edit Modal */}
                        <div className="space-y-2">
                            <Label>Multimedia (Fotos/Documentos)</Label>
                            <div className="flex gap-2 flex-wrap">
                                {files.map((file, idx) => (
                                    <div key={idx} className="relative group bg-white p-2 border rounded-md flex items-center gap-2 pr-8">
                                        {file.type.startsWith('image/') ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={file.url}
                                                alt="preview"
                                                className="w-8 h-8 object-cover rounded"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-slate-100 flex items-center justify-center rounded text-xs font-bold text-slate-500">DOC</div>
                                        )}
                                        <span className="text-xs truncate max-w-[100px]" title={file.name}>{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="absolute top-1 right-1 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                <label className={`cursor-pointer border-2 border-dashed border-slate-300 hover:border-primary/50 hover:bg-slate-50 rounded-md p-2 flex items-center justify-center w-12 h-12 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        accept="image/*,.pdf,.doc,.docx"
                                        disabled={uploading}
                                    />
                                    {uploading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    ) : (
                                        <Plus className="w-5 h-5 text-slate-400" />
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdate} disabled={submitting || uploading}>
                            {submitting ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

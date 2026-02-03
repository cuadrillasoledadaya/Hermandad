'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { useAutoScroll } from '@/hooks/use-auto-scroll';

export default function RegisterPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Auto-scroll para inputs
    const formRef = useAutoScroll();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error('Las contraseñas no coinciden');
        }

        if (password.length < 6) {
            return toast.error('La contraseña debe tener al menos 6 caracteres');
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                // El error del trigger llegará aquí
                toast.error(error.message);
            } else if (data.user) {
                toast.success('¡Registro completado! Si se requiere verificación, revisa tu email. Ahora puedes iniciar sesión.');
                // Redirigir a login después de un breve delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        } catch (err: unknown) {
            console.error('Registration error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error inesperado';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <UserPlus className="text-primary w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl">Registro de Hermano</CardTitle>
                    <CardDescription>
                        Crea tu cuenta de acceso si ya eres hermano y tienes email registrado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={formRef} onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico registrado</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                * Debe coincidir con el email que facilitaste a la Hermandad.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Verificando...
                                </>
                            ) : 'Registrarme'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t p-4 bg-slate-50/50">
                    <Link href="/login" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3" />
                        Volver al inicio de sesión
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}

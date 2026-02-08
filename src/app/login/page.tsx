'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import Link from 'next/link';

import { useAutoScroll } from '@/hooks/use-auto-scroll';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Auto-scroll para inputs
    const formRef = useAutoScroll();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        console.log('Attempting login for:', email);

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
        const loginPromise = supabase.auth.signInWithPassword({
            email,
            password,
        });

        // @ts-expect-error - race typing
        const { data, error } = await Promise.race([loginPromise, timeoutPromise]).catch(() => ({ data: { user: null }, error: { message: 'La conexión ha tardado demasiado. Revisa tu internet o ngrok.' } }));

        if (error) {
            console.error('Login error:', error.message);
            toast.error('Error al iniciar sesión: ' + error.message);
            setLoading(false);
        } else {
            console.log('Login successful:', data.user?.email);
            console.log('Session:', data.session ? 'Valid' : 'Invalid');
            toast.success('Sesión iniciada correctamente. Redirigiendo...');
            // Esperar un momento para que las cookies se establezcan
            setTimeout(() => {
                console.log('Redirecting to /');
                window.location.href = '/';
            }, 500);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <LogIn className="text-primary w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl">Acceso Gestión</CardTitle>
                    <CardDescription>
                        Sistema Integral - Hermandad de la Soledad
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={formRef} onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password">Contraseña</Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Cargando...' : 'Iniciar Sesión'}
                        </Button>
                        <div className="text-center pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                ¿Eres hermano y no tienes cuenta?
                            </p>
                            <Link href="/register">
                                <Button variant="link" type="button" className="text-primary font-bold">
                                    Regístrate aquí con tu email
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

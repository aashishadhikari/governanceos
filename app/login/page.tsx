'use client';

//import { FormEvent, useEffect, useState } from 'react';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    const { status } = useSession();

    const router = useRouter();
    const searchParams = useSearchParams();

    const callbackUrl =
        searchParams.get('callbackUrl') || '/dashboard';

    const error = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status === 'authenticated') {
            router.replace('/dashboard');
        }
    }, [status, router]);

    //const handleLogin = async (e: FormEvent) => {
    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setLoading(true);

        const result = await signIn('credentials', {
            email,
            password,
            callbackUrl,
            redirect: false,
        });

        setLoading(false);

        if (result?.ok) {
            router.push(callbackUrl);
        } else {
            router.push('/login?error=CredentialsSignin');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">

            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-white">
                    <h1 className="text-2xl font-bold">
                        ISEND Corporate Entities Governance Platform
                    </h1>

                    <p className="text-indigo-100 mt-2 text-sm">
                        Sign in using your iSend Corporate Entities Governance Platform account.
                    </p>
                </div>

                {/* Body */}
                <form
                    onSubmit={handleLogin}
                    className="p-8 space-y-5"
                >
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Invalid email or password.
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-indigo-600 py-3 text-white font-semibold hover:bg-indigo-700 disabled:bg-indigo-400"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                </form>

            </div>

        </div>
    );
}
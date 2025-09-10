"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useSession();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (mode === 'login') await api.login(email, password);
      else await api.signup(email, password, name || email.split('@')[0]);
      await refresh();
      router.replace('/');
    } catch (e: any) {
      setErr(e.message || 'Failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="frame w-full max-w-md p-6 bg-[#2B2B31]">
        <h1 className="text-xl mb-4">{mode === 'login' ? 'Log in' : 'Sign up'} to Chronic</h1>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block mb-1 text-sm">Display name</label>
              <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block mb-1 text-sm">Email</label>
            <input className="input w-full" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm">Password</label>
            <input className="input w-full" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <button className="button w-full" type="submit">{mode==='login'?'Log in':'Create account'}</button>
        </form>
        <div className="mt-3 text-sm">
          {mode==='login' ? (
            <button className="underline" onClick={()=>setMode('signup')}>Need an account? Sign up</button>
          ) : (
            <button className="underline" onClick={()=>setMode('login')}>Have an account? Log in</button>
          )}
        </div>
      </div>
    </div>
  );
}


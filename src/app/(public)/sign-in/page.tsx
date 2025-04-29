'use client'

import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const router = useRouter()

  async function handleLoginWithProvider(provider: 'google' | 'github' | 'discord') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error(`Erro ao fazer login com ${provider}:`, error.message)
    } else {
      console.log(`Redirecionando para autenticação com ${provider}...`)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold mb-6">Chatterly!</h1>

      {/* Botão de Login com Google */}
      <button
        onClick={() => handleLoginWithProvider('google')}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com Google
      </button>

      {/* Botão de Login com GitHub */}
      <button
        onClick={() => handleLoginWithProvider('github')}
        className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com GitHub
      </button>

      {/* Botão de Login com Discord */}
      <button
        onClick={() => handleLoginWithProvider('discord')}
        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com Discord
      </button>
    </div>
  )
}

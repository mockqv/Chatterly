'use client'

import Providers from '@/enums/providers'
import handleLoginWithProvider from '@/services/providerLogin'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold mb-6">Chatterly!</h1>

      {/* Botão de Login com Google */}
      <button
        onClick={() => handleLoginWithProvider('google' as Providers.GOOGLE)}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com Google
      </button>

      {/* Botão de Login com GitHub */}
      <button
        onClick={() => handleLoginWithProvider('github' as Providers.GITHUB)}
        className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com GitHub
      </button>

      {/* Botão de Login com Discord */}
      <button
        onClick={() => handleLoginWithProvider('discord' as Providers.DISCORD)}
        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded w-64"
      >
        Entrar com Discord
      </button>
    </div>
  )
}

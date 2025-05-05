'use client'

import { useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function handleAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        console.error('Erro ao obter sessão:', error || "Nenhuma sessão encontrada");
        router.push('/sign-in')
        return
      }

      Cookies.set('token', 'enabled')


      router.push('/')
    }

    handleAuth()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Autenticando...</p>
    </div>
  )
}

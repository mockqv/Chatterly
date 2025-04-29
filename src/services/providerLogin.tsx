import Providers from "@/enums/providers"
import { supabase } from "@/utils/supabase"

type Provider = Providers.DISCORD | Providers.GITHUB | Providers.GOOGLE

export default async function handleLoginWithProvider(provider: Provider) {
    try{
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
    } catch (err) {
        console.error(`Erro ao fazer login com ${provider}:`, err)
    }
  }
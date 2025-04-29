'use client'

import Image from 'next/image'
import Providers from '@/enums/providers'
import handleLoginWithProvider from '@/services/providerLogin'
import { useRouter } from 'next/navigation'
import { FaGithub, FaDiscord, FaXTwitter } from 'react-icons/fa6'
import googleIcon from '../../../assets/img/Google-Icon.jpg'

export default function SignIn() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a1a1a] space-y-4">
      {/* Título */}
      <h1 className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent leading-[1.2]">
        Chatterly!
      </h1>

      {/* Caixa de login */}
      <div className="bg-[#2a2a2a] px-10 pt-10 pb-14 rounded-2xl shadow-lg flex flex-col items-center space-y-5 w-[420px]">
        {/* Google */}
        <button
          onClick={() => handleLoginWithProvider('google' as Providers.GOOGLE)}
          className="flex items-center justify-center gap-4 bg-white text-black font-semibold py-4 px-6 rounded-md w-full hover:bg-gray-100 cursor-pointer transition"
        >
          <Image src={googleIcon} alt="Google" width={28} height={28} className="rounded-sm" />
          Entrar com Google
        </button>

        {/* GitHub */}
        <button
          onClick={() => handleLoginWithProvider('github' as Providers.GITHUB)}
          className="flex items-center justify-center gap-4 bg-[#171515] text-white font-semibold py-4 px-6 rounded-md w-full hover:bg-[#333333] cursor-pointer transition"
        >
          <FaGithub className="text-2xl" />
          Entrar com GitHub
        </button>

        {/* Discord */}
        <button
          onClick={() => handleLoginWithProvider('discord' as Providers.DISCORD)}
          className="flex items-center justify-center gap-4 bg-[#5865F2] text-white font-semibold py-4 px-6 rounded-md w-full hover:bg-[#4752c4] cursor-pointer transition"
        >
          <FaDiscord className="text-2xl" />
          Entrar com Discord
        </button>

        {/* X (Twitter) */}
        {/* <button
          onClick={() => handleLoginWithProvider('twitter' as Providers.TWITTER)}
          className="flex items-center justify-center gap-4 bg-black text-white font-semibold py-4 px-6 rounded-md w-full hover:bg-[#333333] cursor-pointer transition"
        >
          <FaXTwitter className="text-2xl" />
          Entrar com X
        </button> */}
        
      </div>
    </div>
  )
}

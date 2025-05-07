# Chatterly - Chat em Tempo Real

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

Chatterly é uma aplicação moderna de chat em tempo real construída com Next.js e Supabase, oferecendo uma experiência de comunicação instantânea e segura.

## 🚀 Tecnologias

- [Next.js](https://nextjs.org) - Framework React para desenvolvimento web
- [Supabase](https://supabase.com) - Backend como serviço (BaaS) com banco de dados PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) - Framework CSS utilitário

## 🔐 Autenticação

O Chatterly oferece múltiplas opções de login através de provedores populares:

<div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
  <div style="display: flex; align-items: center; gap: 10px;">
    <input type="checkbox" disabled checked style="width: 20px; height: 20px;" />
    <img src="https://img.icons8.com/?size=100&id=V5cGWnc9R4xj&format=png&color=000000" alt="Google Login" style="width: 24px; height: 24px;" />
    <span>Google</span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px;">
    <input type="checkbox" disabled checked style="width: 20px; height: 20px;" />
    <img src="https://img.icons8.com/?size=100&id=phOKFKYpe00C&format=png&color=ffffff" alt="Twitter Login" style="width: 24px; height: 24px;" />
    <span>Twitter</span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px;">
    <input type="checkbox" disabled checked style="width: 20px; height: 20px;" />
    <img src="https://cdn.simpleicons.org/discord/24" alt="Discord Login" style="width: 24px; height: 24px;" />
    <span>Discord</span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px;">
    <input type="checkbox" disabled checked style="width: 20px; height: 20px;" />
    <img src="https://img.icons8.com/?size=100&id=106562&format=png&color=ffffff" alt="GitHub Login" style="width: 24px; height: 24px;" />
    <span>GitHub</span>
  </div>
</div>

## 🛠️ Como Executar

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/chatterly.git
```

2. Instale as dependências
```bash
npm install
# ou
yarn install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
```

4. Inicie o servidor de desenvolvimento
```bash
npm run dev
# ou
yarn dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação em funcionamento.

## 📝 Funcionalidades

- Chat em tempo real
- Autenticação social
- Interface responsiva
- Mensagens em tempo real
- Histórico de conversas

## 🤝 Contribuindo

Contribuições são sempre bem-vindas! Sinta-se à vontade para abrir uma issue ou enviar um pull request.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

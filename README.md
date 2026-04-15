# Mobile App - Gestão de Caçambas

App React Native com Expo para motoristas registrarem entregas e retiradas de caçambas.

## 📋 Pré-requisitos

- Node.js (v18 ou superior)
- npm
- Expo CLI (`npm install -g expo-cli`)
- A API backend rodando (veja o projeto `server`)

## 🚀 Instalação

1. Navegue até o diretório do projeto:
   ```bash
   cd mobile
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto com:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

## 🏃 Executando o projeto

### Modo desenvolvimento
```bash
npm start
```

Isso abrirá o Expo Dev Tools. Você pode:
- Pressionar `i` para abrir no iOS Simulator
- Pressionar `a` para abrir no Android Emulator
- Escanear o QR code com o app Expo Go no seu dispositivo físico

### Build para produção

#### iOS
```bash
npm run build:ios
```

#### Android
```bash
npm run build:android
```

## 📝 Scripts disponíveis

- `npm start` - Inicia o servidor de desenvolvimento Expo
- `npm run android` - Executa no Android
- `npm run ios` - Executa no iOS
- `npm run web` - Executa na web
- `npm run type-check` - Verifica os tipos TypeScript
- `npm run build:ios` - Build para iOS
- `npm run build:android` - Build para Android

## 🔧 Configuração

### Variáveis de Ambiente

O arquivo `.env` contém as variáveis de ambiente:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

⚠️ **Importante:** Certifique-se de que a API backend está rodando antes de iniciar o app.

### Permissões Necessárias

O app requer a permissão de **localização (GPS)** para registrar a conclusão das ordens. Ela é configurada no `app.json` (plugin `expo-location`).

## 📁 Estrutura do Projeto

```
mobile/
├── src/
│   ├── app/              # Telas do app (expo-router)
│   │   ├── login.tsx     # Tela de login
│   │   ├── home.tsx      # Tela inicial (lista de ordens)
│   │   └── work-order-detail.tsx # Detalhes da ordem de serviço
│   ├── hooks/            # React hooks customizados
│   │   ├── useAuth.ts    # Hook de autenticação
│   │   └── useLocation.ts # Hook de localização GPS
│   ├── lib/              # Bibliotecas e utilitários
│   │   ├── api.ts        # Cliente API (Axios)
│   │   └── authStorage.ts # Sessão (token / utilizador)
│   └── shared/           # Tipos, DTOs e enums compartilhados
│       ├── dto.ts        # Data Transfer Objects
│       ├── enums.ts      # Enumeradores
│       ├── types.ts      # Tipos TypeScript
│       └── index.ts      # Exportações principais
├── app.json              # Configuração do Expo
├── babel.config.js      # Configuração do Babel
├── tsconfig.json        # Configuração do TypeScript
└── eas.json             # Configuração do EAS Build
```

## 🔐 Autenticação

O app utiliza autenticação JWT. Ao fazer login, o token é armazenado no `AsyncStorage` e enviado automaticamente em todas as requisições via interceptor do Axios.

## 📱 Funcionalidades

- ✅ Login de motorista
- ✅ Listagem de ordens de serviço atribuídas ao motorista
- ✅ Visualização de detalhes da ordem
- ✅ Iniciar ordem de serviço
- ✅ Completar ordem de serviço com:
  - Captura de GPS (latitude, longitude, precisão)
  - Observações (opcional)
- ✅ Registro de entregas/retiradas de caçambas

## 🔗 Integração com API

O app consome a API através do cliente Axios configurado em `src/lib/api.ts`. A URL da API é configurada via variável de ambiente `EXPO_PUBLIC_API_URL`.

### Endpoints principais:

- `/auth/login` - Autenticação
- `/work-orders/driver` - Ordens do motorista
- `/work-orders/driver/:id` - Detalhes da ordem
- `/work-orders/driver/:id/start` - Iniciar ordem
- `/work-orders/driver/:id/complete` - Completar ordem
- `/deliveries` - Entregas/Retiradas
- `/dumpsters` - Caçambas
- `/job-sites` - Obras/Endereços

## 📚 Tecnologias

- **Expo** - Framework React Native
- **React Native** - Framework mobile
- **Expo Router** - Roteamento baseado em arquivos
- **TypeScript** - Tipagem estática
- **Axios** - Cliente HTTP
- **AsyncStorage** - Armazenamento local
- **Expo Location** - Acesso à localização GPS

## 🛠️ Build e Deploy

### EAS Build

O projeto está configurado para usar EAS Build. Para fazer build:

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login no Expo
eas login

# Configurar projeto
eas build:configure

# Build para produção
eas build --platform ios
eas build --platform android
```

## 📄 Licença

Este projeto é privado e de uso interno.

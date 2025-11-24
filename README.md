# CloakerBreaker Enterprise

Módulo completo para quebra de cloaker com suporte a múltiplos cenários, emulação de dispositivos, e detecção de VSL.

## 🚀 Recursos

### Dispositivos Suportados
- **Android** - Samsung Galaxy S23 (emulação)
- **iPhone** - iPhone 14 Pro (emulação)
- **iPad** - iPad Pro 11 (emulação)
- **Desktop** - Windows/Mac Chrome
- **Windows Phone** - Lumia 950 XL (emulação)

### Plataformas Simuladas
- **Facebook** - Simula tráfego vindo do Facebook
- **Google** - Simula tráfego vindo do Google
- **YouTube** - Simula tráfego vindo do YouTube
- **Instagram** - Simula tráfego vindo do Instagram
- **Direto** - Acesso direto sem referer

### Regiões/Proxies
- 🇧🇷 Brasil (br)
- 🇨🇴 Colômbia (co)
- 🇺🇸 Estados Unidos (us)
- 🇲🇽 México (mx)
- 🇫🇷 França (fr)
- 🇨🇦 Canadá (ca)
- 🇵🇹 Portugal (pt)
- 🇦🇺 Austrália - Sydney (au-sydney)
- 🇩🇪 Alemanha (de)
- 🇮🇹 Itália (it)

### Idiomas
- Português (pt)
- English (en)
- Español (es)
- Deutsch (de)
- Italiano (it)
- Français (fr)

### Recursos Enterprise
- ✅ Emulação de user-agent e headers realistas
- ✅ Configuração de proxy/região
- ✅ Accept-Language / locale override
- ✅ Interação humana mínima (scroll, movimento mouse, clique neutro)
- ✅ Detecção automática de VSL (Video Sales Letter)
- ✅ Captura de screenshot full-page
- ✅ Gravação de vídeo (30-60s) quando VSL detectado
- ✅ Geolocalização simulada
- ✅ Timezone por região

## 📦 Instalação

```bash
npm install
npx playwright install chromium
```

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# Supabase (Obrigatório)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-anon

# Proxy único (Opcional)
PROXY_SERVER=http://user:pass@proxy.provider.com:port

# Proxies por região (Opcional - JSON)
PROXY_SERVERS='{"br":"http://br.proxy.com:port","us":"http://us.proxy.com:port"}'
```

### Estrutura da Tabela Supabase

```sql
CREATE TABLE cloaker_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_url TEXT NOT NULL,
    device_config TEXT DEFAULT 'desktop',
    platform_config TEXT DEFAULT 'direct',
    proxy_config TEXT DEFAULT 'us',
    lang_config TEXT DEFAULT 'en',
    status TEXT DEFAULT 'pending',
    result_url TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket para evidências
-- Criar bucket 'cloaker_evidence' no Supabase Storage
```

## 🔧 Uso

### Via Worker (Processamento em Fila)

```bash
node cloaker_worker.mjs
```

### Via API Programática

```javascript
import { 
    DEVICE_MAP, 
    PLATFORM_MAP, 
    REGION_MAP, 
    LANGUAGE_MAP,
    generateScenarios,
    getScenarioConfig 
} from './cloaker_config.mjs';

// Gerar todos os cenários
const scenarios = generateScenarios({
    devices: ['android', 'iphone'],
    platforms: ['facebook', 'google'],
    regions: ['br', 'us'],
    languages: ['pt', 'en']
});

// Obter configuração para um cenário específico
const config = getScenarioConfig({
    device: 'android',
    platform: 'facebook',
    region: 'br',
    language: 'pt'
});
```

## 🌐 Extensão do Navegador

A extensão permite enviar jobs diretamente do navegador.

### Instalação da Extensão

1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `extension/`

### Configuração da Extensão

1. Clique no ícone da extensão
2. Insira a URL alvo
3. Selecione as combinações desejadas
4. Clique em "Iniciar Quebra"

## 🧪 Testes

```bash
npm test
```

## 📁 Estrutura do Projeto

```
brkclker/
├── cloaker_worker.mjs     # Worker principal (processa fila do Supabase)
├── cloaker_config.mjs     # Configurações de dispositivos, plataformas, regiões
├── human_interaction.mjs  # Simulação de comportamento humano
├── package.json           # Dependências do projeto
├── extension/             # Extensão do navegador
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   └── icons/
├── test/                  # Testes automatizados
│   ├── cloaker_config.test.mjs
│   └── human_interaction.test.mjs
└── .github/
    └── workflows/
        ├── cloaker.yml    # Workflow do worker
        └── test.yml       # Workflow de testes
```

## 🔒 Segurança

- Nunca exponha suas chaves do Supabase no código
- Use GitHub Secrets para variáveis sensíveis
- Configure proxies de provedores confiáveis

## 📊 Fluxo de Trabalho

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Extensão   │ --> │  Supabase   │ --> │   Worker    │
│  (Browser)  │     │    (Fila)   │     │ (Playwright)│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  Resultados │ <-- │  Evidência  │
                    │   (UI)      │     │  (Storage)  │
                    └─────────────┘     └─────────────┘
```

## 📝 Licença

MIT

## 🤝 Contribuição

1. Fork o repositório
2. Crie sua branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

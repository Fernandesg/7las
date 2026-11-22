# Spec — 7las Desktop com Tauri e árvore de retransmissão

- **Versão:** 0.2
- **Plataforma inicial:** Windows 11 x64
- **Repositório:** https://github.com/brunobach/7las
- **Status:** pronta para spikes técnicos; ainda não iniciar o produto completo

## 1. Resumo

Criar um aplicativo desktop que fica na bandeja do Windows e permite compartilhar tela e áudio com uma sala privada de amigos. Ao iniciar, os amigos online recebem uma notificação e podem assistir com baixa latência.

Além do modo P2P tradicional, a sala usará uma **árvore de distribuição WebRTC**. O host não precisa enviar uma cópia para cada espectador: um espectador autorizado pode retransmitir a mídia recebida para outro.

Exemplo obrigatório do MVP:

```text
Host ├── A ─── C
     └── B ─── D
```

- O host envia somente para A e B.
- A retransmite para C.
- B retransmite para D.
- Todos continuam vendo a mesma sessão.
- Se A ou B sair, seu filho deve ser realocado sem encerrar a sala.

Isso é uma árvore de relays/restreamers, não um SFU. Cada relay recebe, decodifica e codifica novamente a mídia. A otimização economiza upload e codificação no host, mas transfere custo de rede e processamento para os relays.

## 2. Decisões de arquitetura

| Área | Decisão |
|---|---|
| Desktop | Tauri 2, Rust e WebView2 no Windows 11 |
| Frontend | React + TypeScript, reutilizando a UI e os módulos úteis do 7las |
| Captura de vídeo inicial | `navigator.mediaDevices.getDisplayMedia()` dentro do WebView2 |
| Captura de áudio | Módulo nativo Windows/WASAPI com loopback por processo; ponte para uma track WebRTC |
| Mídia | WebRTC, DTLS-SRTP, STUN e TURN |
| Sinalização da sessão | Trystero/Nostr, mantido no MVP para reaproveitar o 7las |
| Controle de presença | Backend pequeno com WebSocket; nenhum vídeo passa por ele no modo P2P |
| Identidade | Par de chaves por instalação; chave privada protegida por DPAPI |
| Dados locais | Configurações e amigos em armazenamento local; segredos nunca em JSON puro |
| Topologia | Coordenada pelo host, com no máximo dois saltos de mídia no MVP |
| Escala do MVP | Um host e até quatro espectadores |
| Visualização web | Fora do MVP; todos os participantes usam o app desktop |

### 2.1 Gate técnico do Tauri

Antes de construir o produto, executar um spike no app Tauri empacotado, não apenas no navegador:

1. Capturar um monitor a 1080p60.
2. Capturar uma janela.
3. Capturar áudio nativo de um jogo enquanto Discord desktop e outro app produzem som.
4. Confirmar por gravação de teste que o modo **Sistema sem Discord** contém o jogo, mas não as vozes do Discord.
5. Transformar o PCM nativo em uma `MediaStreamTrack` e enviá-la pelo WebRTC com sincronia aceitável.
6. Manter captura e WebRTC ativos por 30 minutos com a janela minimizada e depois oculta na bandeja.
7. Receber um `MediaStream` remoto e retransmiti-lo por um segundo `RTCPeerConnection`.
8. Confirmar áudio e vídeo após essa retransmissão, sem misturar o áudio local do relay.

O áudio retornado por `getDisplayMedia` é opcional e dependente da plataforma; `audio: true` não garante uma faixa de áudio nem exclusão por aplicativo. Por isso, o áudio do MVP não depende dessa faixa: o vídeo vem do WebView2 e o áudio vem do módulo nativo. Se captura, ponte de áudio ou retransmissão não funcionarem de forma estável, não esconder o problema atrás de novas features. As saídas são:

- implementar um adaptador nativo de mídia para Windows, com escopo e custo próprios; ou
- revisar a escolha do shell desktop.

A conclusão do spike deve ser registrada em `docs/tauri-media-spike.md` no projeto.

## 3. Objetivos e não objetivos

### 3.1 Objetivos do MVP

- Abrir no login do Windows, de forma opcional.
- Fechar a janela para a bandeja sem encerrar a transmissão.
- Iniciar e parar por atalho global configurável.
- Salvar amigos e uma sala privada permanente.
- Avisar amigos online quando o host entrar ao vivo.
- Compartilhar monitor ou janela.
- Oferecer **Sem áudio**, **Somente aplicativo/jogo**, **Sistema sem Discord** e **Sistema inteiro**.
- Excluir Discord desktop do áudio por processo, evitando duplicar vozes para quem já está na call.
- Não capturar microfone por padrão e nunca misturar o áudio local de um relay.
- Permitir que espectadores atuem como relays mediante consentimento.
- Manter no máximo duas saídas de mídia no host no cenário padrão.
- Realocar espectadores quando um relay sair ou degradar.
- Mostrar quem está assistindo, quem está retransmitindo e a rota de cada conexão.
- Encerrar toda a árvore quando o host parar.

### 3.2 Não objetivos do MVP

- Chat, voz entre participantes ou substituição completa do Discord.
- Vários hosts simultâneos.
- Gravação da transmissão.
- Aplicativo móvel.
- Relay automático por espectadores em navegador.
- Salas públicas ou descoberta de lives desconhecidas.
- Mais de oito participantes sem repensar a topologia ou adotar SFU.

## 4. Papéis

Um mesmo app implementa três papéis; eles não são builds separados.

### Host

- Captura a tela e publica a mídia original.
- Coordena a árvore.
- Autoriza entradas usando a lista de membros da sala.
- Define o bitrate e o modo de qualidade da sessão.
- Possui `directSlots`, inicialmente dois.

### Relay

- É um espectador que também retransmite.
- Recebe de um pai e envia para um ou mais filhos.
- Respeita `relaySlots`, inicialmente um.
- Pode desligar o relay; nesse caso, os filhos são migrados antes da saída sempre que possível.
- Não pode escolher livremente para quem retransmitir: somente o host atribui filhos.

### Leaf

- Somente assiste.
- Não abre saídas de mídia para outros participantes.
- Pode se tornar relay depois, se habilitar a opção e passar pelos limites de saúde.

## 5. Componentes

```text
src/
  app.tsx
  screens/
    home.tsx
    room.tsx
    viewer.tsx
    settings.tsx
  lib/
    capture.ts              # adaptado do 7las
    peer.ts                 # tuning WebRTC
    room.ts                 # sessão Trystero
    link.ts
  media/
    media-session.ts        # ciclo de vida da sessão
    outgoing-stream.ts      # uma saída por filho
    incoming-stream.ts      # stream atual e transição de pai
    relay-node.ts           # recebe e republica tracks
    tree-coordinator.ts     # somente no host
    metrics.ts              # getStats e relatórios
    probing.ts              # testes entre possíveis pais e filhos
    audio-source.ts         # seleção e ciclo de vida do áudio
    native-audio-track.ts   # PCM nativo -> AudioWorklet -> MediaStreamTrack
  audio/
    pcm-worklet.ts          # ring buffer, conversão e controle de jitter
  state/
    friends.ts
    rooms.ts
    settings.ts
  backend/
    client.ts
    presence.ts

src-tauri/
  src/
    lib.rs
    tray.rs
    shortcuts.rs
    notifications.rs
    identity.rs             # geração, assinatura e DPAPI
    storage.rs
    audio/
      mod.rs
      windows_wasapi.rs     # loopback por processo e PCM 48 kHz
      processes.rs          # descoberta de jogo, Discord e processos filhos
```

### Separação importante

- `tree-coordinator.ts` decide a árvore, mas não manipula elementos de vídeo.
- `relay-node.ts` executa a retransmissão, mas não escolhe a topologia.
- A UI nunca é a fonte de verdade da sessão.
- Fechar ou ocultar a janela não destrói `MediaSession`; somente **Parar** ou **Sair do app** faz isso.

## 6. Fluxos principais

### 6.1 Pareamento de amigos

1. Cada instalação gera uma identidade criptográfica.
2. O usuário cria um convite de pareamento de uso único e curta duração.
3. O amigo abre o convite no app e confirma nome/avatar.
4. Cada lado salva `friendId`, apelido, avatar seed e chave pública.
5. A seed do avatar é cosmética e nunca autentica um amigo.

### 6.2 Iniciar transmissão

1. Host pressiona o atalho ou clica em **Compartilhar**.
2. O app abre o seletor de monitor/janela.
3. O backend autentica o host e cria uma nova sessão dentro da sala permanente.
4. O app gera novo `sessionSecret` e novo `hostId`, mantendo a propriedade de sessões não correlacionáveis do 7las.
5. O backend publica `session.live` somente para membros autorizados.
6. Amigos online recebem notificação “Nome está compartilhando”.
7. O host abre a sala Trystero da sessão e aguarda participantes.

### 6.3 Entrar para assistir

1. O espectador clica em **Assistir** ou entra pela sala.
2. O app solicita um `joinTicket` curto ao backend.
3. O app entra na sessão e informa suas capacidades, incluindo se aceita ser relay.
4. O host escolhe um pai.
5. O espectador abre uma conexão somente com esse pai.
6. Depois de receber os primeiros frames, o player passa a exibir a sessão.

### 6.4 Retransmitir

1. O relay recebe as tracks de vídeo e áudio do pai.
2. Para cada filho atribuído, cria uma saída WebRTC independente usando as tracks recebidas.
3. A saída usa o modo e o teto de bitrate definidos pelo host.
4. Desconectar um filho não pode parar as tracks originais nem afetar outros filhos.
5. O player local do relay continua funcionando enquanto ele retransmite.

### 6.5 Parar

1. O host para as tracks de captura.
2. Publica `live=false` e encerra a sessão.
3. Relays fecham suas saídas.
4. Todos os players mostram “Transmissão encerrada”.
5. O app volta ao estado de bandeja, sem deslogar da presença.

## 7. Árvore de distribuição

### 7.1 Regras

- O host é a raiz e a única origem da mídia.
- Cada participante tem exatamente um pai ativo.
- A árvore não pode conter ciclos.
- `maxDepth = 2`: `host -> relay -> leaf`.
- `host.directSlots = 2` por padrão.
- `relay.relaySlots = 1` por padrão e somente com opt-in.
- Nenhum nó pode ser pai de si mesmo ou de um ancestral.
- Um relay só recebe filhos depois de estar recebendo mídia estável do próprio pai.
- O host sempre mantém a possibilidade de aceitar um espectador diretamente durante uma recuperação, mesmo que isso exceda temporariamente o limite desejado.

Para quatro espectadores, a árvore padrão é obrigatoriamente capaz de chegar a duas saídas no host e uma em cada relay.

### 7.2 Por que não escolher somente pelo ping

Um bom relay precisa ter:

1. conexão saudável com o possível filho;
2. upload livre para uma nova saída;
3. CPU/GPU sem limitação sustentada;
4. baixa perda e jitter;
5. consentimento e slot disponível;
6. profundidade permitida na árvore.

Um relay com 15 ms de RTT, mas upload saturado, é pior que o host com 60 ms e banda livre.

### 7.3 Métricas

Coletar via `RTCPeerConnection.getStats()` a cada cinco segundos e enviar ao host:

```ts
type NodeMetrics = {
  nodeId: string
  sessionId: string
  treeEpoch: number
  at: number
  rttMs: number | null
  jitterMs: number | null
  packetLossPct: number | null
  incomingBitrate: number | null
  outgoingBitrate: number | null
  availableOutgoingBitrate: number | null
  framesPerSecond: number | null
  freezeCount: number
  qualityLimitationReason: string | null
  activeChildren: number
  relayEnabled: boolean
  relaySlots: number
  route: "direct" | "turn" | "unknown"
}
```

Métricas ausentes não valem zero. Um nó recém-chegado começa como leaf até existir amostra suficiente.

### 7.4 Probing entre pares

O host não conhece automaticamente a qualidade da ligação A–C. Quando considerar A como pai de C:

1. Host ordena A e C a executarem um probe.
2. Eles abrem uma conexão WebRTC temporária com data channel, sem mídia.
3. Medem RTT, perda, jitter e rota por aproximadamente três segundos.
4. O resultado é enviado ao host.
5. A conexão temporária é reutilizada para mídia se A for escolhido; caso contrário, é fechada.

Para salas pequenas, probes sob demanda são suficientes. Não executar malha completa de probes continuamente.

### 7.5 Gates de elegibilidade

Um candidato a pai só é elegível se:

- estiver online e autorizado;
- tiver slot livre;
- tiver `relayEnabled=true`, exceto quando for o host;
- estiver recebendo mídia estável;
- não criar ciclo nem exceder `maxDepth`;
- tiver perda recente abaixo de 3%;
- não estiver com `qualityLimitationReason="cpu"` de forma sustentada;
- tiver headroom de upload estimado de pelo menos 1,25 vez o bitrate alvo, quando essa métrica existir.

Se faltar telemetria confiável, preferir o host ou manter a árvore atual. Não promover um relay às cegas.

### 7.6 Score inicial

Entre candidatos elegíveis, usar score menor como melhor:

```text
score =
  0.40 * rttNormalizado +
  0.25 * perdaNormalizada +
  0.15 * jitterNormalizado +
  0.10 * ocupacaoDeUpload +
  0.10 * profundidadeNormalizada
```

Os pesos são configuração inicial, não uma promessa de otimalidade. O algoritmo deve ser determinístico para o mesmo conjunto de métricas e testável sem WebRTC real.

### 7.7 Quando recalcular

- Novo participante.
- Participante saiu.
- Relay habilitou/desabilitou a retransmissão.
- Perda acima de 3% ou freezes por pelo menos dez segundos.
- Relay saturado por pelo menos dez segundos.
- Host solicitou rebalanceamento manual.

Não rebalancear continuamente. Aplicar:

- cooldown de 30 segundos entre mudanças do mesmo espectador;
- histerese: novo pai precisa ter score pelo menos 20% melhor;
- uma migração de espectador por vez;
- prioridade para recuperar espectadores sem mídia sobre otimizar quem já assiste bem.

### 7.8 Troca de pai sem queda

Usar **make-before-break**:

1. Host envia nova atribuição com `treeEpoch` maior.
2. Espectador conecta ao novo pai, ainda mantendo o stream antigo.
3. Novo pai envia vídeo e áudio.
4. Espectador aguarda track ao vivo e primeiro frame decodificado.
5. Player troca para o novo stream.
6. Somente então a conexão antiga é fechada.
7. Se a preparação falhar em dez segundos, cancelar a migração e manter o pai antigo.

### 7.9 Saída ou falha de relay

- **Saída voluntária:** relay envia intenção de sair; host prepara novos pais para os filhos antes do desligamento.
- **Falha abrupta:** filhos congelam o último frame, entram em reconexão e pedem nova atribuição.
- O host escolhe outro relay elegível ou assume temporariamente o filho.
- Se nenhum pai tiver capacidade, reduzir qualidade da sessão antes de derrubar participantes.
- Se ainda assim não houver capacidade, colocar o espectador em fila explícita; nunca ficar em loading infinito.

## 8. Protocolo de controle da sessão

As mensagens são autenticadas pela sessão e validadas por schema. O host só aceita relatórios do remetente correspondente; espectadores só aceitam atribuições do host administrador.

```ts
type TreeAssignment = {
  type: "tree.assign"
  sessionId: string
  treeEpoch: number
  childId: string
  parentId: string
  parentTrysteroId: string
  depth: 1 | 2
  reason: "join" | "recovery" | "rebalance" | "drain"
  expiresAt: number
}

type TreeLeaving = {
  type: "tree.leaving"
  sessionId: string
  treeEpoch: number
  nodeId: string
  graceful: boolean
}

type RelayCapacity = {
  type: "relay.capacity"
  nodeId: string
  enabled: boolean
  slots: number
}
```

Metadata obrigatória da mídia:

```ts
type StreamMetadata = {
  kind: "screen"
  sessionId: string
  originHostId: string
  parentId: string
  treeEpoch: number
}
```

O viewer aceita mídia somente se:

- `sessionId` for o atual;
- `originHostId` for o host da sessão;
- `parentId` for o pai atualmente atribuído;
- `treeEpoch` não for anterior ao último epoch confirmado.

## 9. Backend mínimo

O backend não transporta mídia no MVP.

### HTTP

```text
POST   /v1/auth/challenge
POST   /v1/auth/verify
POST   /v1/friends/invites
POST   /v1/friends/invites/{code}/accept
DELETE /v1/friends/{friendId}
POST   /v1/rooms
POST   /v1/rooms/{roomId}/members
DELETE /v1/rooms/{roomId}/members/{memberId}
POST   /v1/rooms/{roomId}/sessions
POST   /v1/sessions/{sessionId}/join-ticket
POST   /v1/sessions/{sessionId}/end
GET    /v1/rooms/{roomId}
```

### WebSocket de presença

```text
WS /v1/presence
```

Eventos:

```text
friend.online
friend.offline
session.live
session.ended
room.membership.changed
```

`session.live` contém somente `roomId`, `sessionId`, perfil público do host e horário de expiração. O segredo de entrada é obtido depois, por `join-ticket` autenticado. Não colocar segredos em logs, analytics ou payloads de erro.

## 10. Comandos Tauri

```text
identity_get_public_key() -> string
identity_sign(challenge: bytes) -> signature
friends_list() -> Friend[]
friend_remove(friendId)
settings_get() -> AppSettings
settings_update(patch)
window_show()
window_hide_to_tray()
sharing_get_state() -> SharingState
notification_show_live(payload)
audio_list_applications() -> AudioApplication[]
audio_start(config: AudioCaptureConfig, onPcm: Channel<AudioPacket>) -> captureId
audio_stop(captureId)
audio_restart_if_target_changed(captureId)
autostart_set(enabled)
shortcut_update(shortcut)
```

Regras:

- Comandos que produzem assinatura exigem payload efêmero e validado.
- A chave privada nunca é devolvida ao frontend.
- O frontend não acessa arbitrariamente o filesystem ou shell.
- CSP restritiva e nenhum conteúdo remoto não confiável dentro do WebView.

## 11. Persistência

```ts
type Friend = {
  friendId: string
  displayName: string
  avatarSeed: number
  publicKey: string
  createdAt: number
}

type Room = {
  roomId: string
  name: string
  createdBy: string
  memberIds: string[]
}

type AppSettings = {
  startWithWindows: boolean
  closeToTray: boolean
  globalShortcut: string
  mode: "sharp" | "smooth"
  audioMode: "none" | "process" | "system_except_discord" | "system"
  audioTargetExecutable: string | null
  audioTargetWindowTitle: string | null
  relayEnabled: boolean
  relaySlots: number
  maxDirectSlots: number
  turnUrl: string
  turnUsername: string
}
```

- Credenciais TURN e chaves privadas usam armazenamento protegido; não entram nesse JSON.
- O padrão de `relayEnabled` é `false` até o usuário entender o custo de upload/processamento. A sala pode solicitar que ele habilite, mas não ativar silenciosamente.
- A sala permanente guarda somente membros e configuração. Cada live usa uma sessão nova.

## 12. UX obrigatória

### Bandeja

Menu:

- Compartilhar tela.
- Abrir sala.
- Parar transmissão, quando ao vivo.
- Abrir configurações.
- Sair.

### Durante a transmissão

Mostrar:

- estado ao vivo;
- número de espectadores;
- saídas diretas ativas;
- upload total estimado;
- modo Text/Motion;
- botão de parar;
- árvore visual simples.

Exemplo:

```text
Você — 18 Mbps
├── Ana — relay, 8 Mbps
│   └── Caio
└── Bruno — relay, 7 Mbps
    └── Dani
```

### Para o espectador/relay

- “Assistindo diretamente de Luann” ou “Assistindo via Ana”.
- “Você está retransmitindo para Caio”.
- Opção **Parar de retransmitir**, com migração dos filhos.
- Aviso claro de que relay usa internet e processamento.
- Tela cheia, mute, volume, PiP e estatísticas continuam disponíveis.

## 12.1 Áudio e exclusão do Discord

O compartilhamento deve tratar voz e som do jogo como coisas diferentes. Quem já está ouvindo os amigos pelo Discord não deve ouvir essas mesmas vozes novamente pela live.

### Modos

| Modo | O que os espectadores ouvem |
|---|---|
| **Sem áudio** | Nenhuma track de áudio é publicada |
| **Somente aplicativo/jogo** | Somente o processo escolhido e seus processos filhos |
| **Sistema sem Discord** | Jogos, música e demais apps; Discord desktop excluído |
| **Sistema inteiro** | Todo o mix, inclusive Discord; exige aviso de possível duplicação |

O padrão inicial é **Sem áudio**. Ao escolher compartilhar com som e detectar Discord desktop, a opção recomendada é **Sistema sem Discord**. Microfone não faz parte do MVP.

### Captura nativa

No Windows 11, usar WASAPI com `ActivateAudioInterfaceAsync`, `VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK` e `AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS`:

- **Somente aplicativo/jogo:** `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE`.
- **Sistema sem Discord:** `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`, usando a raiz da árvore do Discord.
- **Sistema inteiro:** loopback tradicional do endpoint de saída.

Referência de implementação: [Application Loopback Audio Sample da Microsoft](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/).

Não usar injeção de DLL, driver ou cabo de áudio virtual no MVP.

### Descoberta e mudança de processos

- Enumerar apps com áudio e janelas, sem depender somente de janela: alguns processos de áudio não possuem HWND.
- Salvar executável e identidade amigável do alvo; PID é resolvido novamente a cada sessão.
- Para Discord desktop, reconhecer pelo menos `Discord.exe`, `DiscordPTB.exe` e `DiscordCanary.exe` e resolver a árvore correta.
- Se Discord ou jogo reiniciar, localizar o novo PID e recriar a captura sem encerrar o vídeo.
- Se houver mais de uma instância candidata, pedir seleção ao usuário em vez de adivinhar.
- Discord em navegador não entra na promessa automática de exclusão do MVP: excluir todo o navegador também removeria outros sons dele. Exibir essa limitação e oferecer **Somente aplicativo/jogo** como alternativa.

### Ponte WASAPI para WebRTC

A captura nativa entrega PCM little-endian, 48 kHz, estéreo, em pacotes de 20 ms. O frontend recebe os pacotes por um canal binário, alimenta um `AudioWorklet` com ring buffer e usa `MediaStreamAudioDestinationNode` para produzir a track enviada ao WebRTC.

Requisitos da ponte:

- buffer inicial de jitter entre 60 e 100 ms, adaptável dentro de limite configurado;
- conversão para o formato exigido pelo Web Audio sem clipping;
- timestamps e contadores para detectar perda, overflow e underflow;
- backpressure: descartar atraso acumulado em vez de deixar a latência crescer indefinidamente;
- nenhuma reprodução local automática desse PCM;
- trocar a fonte com `RTCRtpSender.replaceTrack()`, sem derrubar a captura de vídeo ou a sessão.

Essa ponte é parte do spike da Fase 0. Se sua estabilidade ou sincronia não for aceitável, a alternativa é mover mais da pipeline de mídia para código nativo, e não esconder o problema com um atraso fixo grande.

### Relays e espectadores

- O host cria exatamente uma track de áudio para a sessão.
- Relay apenas republica a track remota recebida; nunca abre WASAPI nem captura o próprio sistema.
- Leaf nunca devolve áudio à sessão.
- O espectador pode mutar localmente sem afetar os demais.
- O host vê um medidor de nível, mas monitoramento local fica desligado por padrão para evitar feedback.

## 13. Qualidade e codecs

Começar com os limites do 7las:

| Modo | FPS máximo | Bitrate máximo por saída | Uso |
|---|---:|---:|---|
| Text | 30 | 6 Mbps | código, documentos e desktop |
| Motion | 60 | 8 Mbps | jogos e vídeo |

- Opus estéreo a 128 kbps quando houver áudio; desligar echo cancellation, noise suppression e auto gain para preservar o som de jogos e música.
- Uma sessão tem no máximo uma track de áudio de conteúdo; relays não adicionam nem remixam áudio.
- Meta de sincronia áudio/vídeo: desvio absoluto de até 150 ms em condição de rede estável.
- AV1/VP9/H.264 conforme negociação e suporte eficiente detectado.
- Um relay pode precisar limitar sua saída abaixo do teto quando houver saturação.
- Não prometer 1080p60 para todos: a qualidade depende do pior trecho entre host, relay e leaf.
- Se o relay degradar, primeiro reduzir bitrate; depois FPS; por último realocar o filho.

## 14. Segurança e privacidade

- Todo acesso ao backend usa TLS.
- Tickets de entrada expiram em até 60 segundos e têm uso único.
- Segredo e host ID continuam efêmeros por sessão.
- Somente membros autorizados recebem parâmetros de entrada.
- Host só publica mídia para IDs presentes na lista de membros da sessão.
- Relay é membro autorizado e só publica para filhos atribuídos pelo host.
- A mídia é criptografada em cada trecho WebRTC, mas é processada pelo relay. Não descrever esse modelo como criptografia de ponta a ponta entre host e leaf.
- Pai e filho P2P podem conhecer os endereços IP um do outro, como já ocorre no 7las. Uma política TURN-only pode ser adicionada depois, com custo de infraestrutura.
- Remover um membro da sala invalida futuros tickets e encerra suas conexões ativas.
- Não registrar SDP, ICE candidates, segredos, chaves privadas ou credenciais TURN em logs.

## 15. Telemetria local e diagnóstico

Uma tela de diagnóstico exporta um relatório sem segredos contendo:

- versão do app e WebView2;
- codecs negociados;
- resolução, FPS e bitrate;
- RTT, jitter, perda e freezes;
- rota direta/TURN;
- árvore e profundidade de cada nó;
- motivo da última migração;
- modo de áudio, processo-alvo e PID resolvido, sem gravar PCM;
- underflows, overflows, atraso do buffer e sincronia de áudio;
- erros de captura e encerramento de tracks.

Isso é necessário porque, sem esses dados, será quase impossível distinguir problema de captura, upload do host, relay saturado ou TURN.

## 16. Critérios de aceite

### Desktop

1. O app abre no Windows 11 e pode ficar somente na bandeja.
2. Fechar a janela não interrompe uma sessão ativa.
3. Uma sessão dura 30 minutos com a janela oculta, sem parar áudio/vídeo.
4. O atalho global inicia o fluxo e não captura tela sem ação do usuário.
5. Parar pela bandeja encerra a sessão para todos.

### Amigos e sala

6. Amigos continuam salvos após reiniciar o app.
7. Uma pessoa removida não consegue obter novo ticket de entrada.
8. Ao iniciar uma live, amigos online e autorizados recebem uma notificação.
9. A notificação abre a sala correta; nenhum botão fica sem ação.

### Mídia direta

10. Host compartilha monitor para um espectador com vídeo e, quando disponível, áudio.
11. Host consegue trocar a fonte sem criar outra sessão.
12. Text e Motion alteram os limites reais observados via `getStats()`.

### Árvore e relay

13. Com quatro espectadores A, B, C e D, o host consegue transmitir apenas para A e B; A envia para C e B para D.
14. O contador de saídas de mídia confirma duas no host e uma em cada relay.
15. C e D recebem áudio e vídeo corretos, sem loop de mídia.
16. Desligar C ou D não afeta os demais participantes.
17. Desligar retransmissão em A migra C antes de fechar a saída, quando houver capacidade.
18. Encerrar A abruptamente faz C recuperar a mídia por outro pai em até dez segundos no cenário de teste com capacidade disponível.
19. Uma atribuição que formaria ciclo é rejeitada pelo coordenador e pelo receptor.
20. Um relay sem consentimento nunca recebe filhos.
21. Um relay saturado deixa de ser escolhido mesmo tendo o menor RTT.
22. Trocar o pai usa make-before-break e não apresenta tela preta quando o novo caminho está saudável.

### Segurança

23. Um espectador não aceita stream de um peer que não seja seu pai atribuído.
24. Mensagens com `sessionId` ou `treeEpoch` antigos são descartadas.
25. Nenhum segredo aparece em logs ou no relatório de diagnóstico.

### Áudio

26. Com jogo, música e Discord desktop tocando, **Somente aplicativo/jogo** entrega somente o jogo.
27. No mesmo cenário, **Sistema sem Discord** entrega jogo e música, mas não as vozes do Discord.
28. Duas pessoas na mesma call do Discord ouvem a voz uma única vez: pelo Discord, nunca duplicada pela live.
29. **Sistema inteiro** mostra aviso de duplicação quando Discord desktop é detectado.
30. **Sem áudio** remove a track publicada e interrompe o consumo de captura nativa.
31. Reiniciar Discord não faz suas vozes voltarem indevidamente ao modo de exclusão.
32. Trocar entre modos de áudio não derruba o vídeo nem muda a sala.
33. Um relay encaminha somente a track recebida; sons produzidos no PC do relay não entram na live.
34. O desvio de sincronia áudio/vídeo permanece dentro da meta em teste estável de 30 minutos.

## 17. Testes automatizados

### Unitários

- Score e gates de elegibilidade.
- Detecção de ciclos.
- Limite de profundidade e slots.
- Histerese e cooldown.
- Escolha de pai com dados incompletos.
- Validação de mensagens e metadata.
- Seleção de codec e parsing de convites.

### Integração

Usar quatro contextos WebRTC automatizados:

1. Host–A–C em árvore.
2. Mudança de C de A para B sem parar o player.
3. Queda abrupta de A.
4. Relay sem slot ou com métricas ruins.
5. Host oculto na bandeja.
6. TURN forçado em um dos trechos.

### Teste manual de rede

Validar pelo menos:

- todos na mesma rede;
- redes domésticas diferentes;
- um participante com upload limitado;
- perda artificial de pacotes;
- relay fechando o app pelo Gerenciador de Tarefas;
- host parando enquanto uma migração está em andamento;
- jogo, música e Discord desktop tocando simultaneamente;
- Discord reiniciando durante a live;
- troca do dispositivo de saída padrão do Windows;
- relay com áudio local alto para confirmar que nada desse áudio é injetado.

## 18. Fases de implementação

### Fase 0 — spikes

- Captura de vídeo no Tauri empacotado.
- Loopback WASAPI incluindo um jogo e excluindo Discord desktop.
- Ponte PCM -> AudioWorklet -> WebRTC, com teste de sincronia.
- WebRTC com janela oculta.
- Retransmissão de tracks remotas.
- Teste de STUN/TURN.

**Saída:** decisão go/no-go do WebView2 documentada.

### Fase 1 — desktop e identidade

- Bandeja, atalhos, autostart e notificações.
- Identidade protegida, amigos e sala.
- Backend de autenticação e presença.

### Fase 2 — compartilhamento direto

- Portar captura de vídeo, tuning, host e viewer do 7las.
- Integrar os quatro modos de áudio nativo e seus diagnósticos.
- Uma sala, um host e espectadores diretos.
- Diagnóstico e TURN.

### Fase 3 — relay estático

- Implementar `host -> A -> C` com atribuição manual.
- Confirmar tracks, lifecycle e métricas.
- Só depois liberar vários filhos/relays.

### Fase 4 — coordenador automático

- Probes, score, árvore, migração e recuperação.
- Testes de ciclo, saturação e flapping.

### Fase 5 — produto mínimo

- Notificações completas, permissões, configurações e instalador.
- Teste prolongado com quatro espectadores.
- Assinatura de código e atualização do app ficam para a preparação de distribuição.

## 19. Riscos e decisões futuras

| Risco | Mitigação |
|---|---|
| WebView2 não sustentar captura/áudio/retransmissão | Gate na Fase 0; adaptador nativo ou revisão do shell |
| Exclusão por processo falhar em algum app ou Discord mudar sua arquitetura | Testes com Discord desktop, detecção de PID e fallback explícito para **Somente jogo** |
| Ponte de PCM introduzir atraso ou estalos | Pacotes de 20 ms, ring buffer, métricas de underflow e spike antes do produto |
| Discord no navegador não ser isolável sem excluir outros sons do navegador | Não prometer exclusão automática; usar captura do jogo |
| Relay economiza host, mas aumenta latência e perde qualidade | `maxDepth=2`, métricas e make-before-break |
| Oscilação de pais | Cooldown, histerese e uma migração por vez |
| Upload insuficiente em todos | Reduzir qualidade, fila explícita ou SFU |
| Relays Nostr públicos instáveis | Métricas de sinalização e opção futura de signaling próprio |
| Crescimento da sala | SFU como caminho de escala; árvore P2P não é substituto universal |
| Reuso legal do código | Confirmar autorização/licença do 7las antes de distribuir derivados |

## 20. Definição de pronto do MVP

O MVP está pronto quando duas pessoas conseguem instalar o app, parear, entrar na mesma sala e repetir uma transmissão sem ajuda do desenvolvedor; quatro espectadores conseguem assistir usando a árvore de dois relays; a saída de um relay recupera seus filhos; o host consegue iniciar, minimizar, acompanhar e parar tudo pela bandeja; e uma live com jogo e Discord desktop entrega o som do jogo sem duplicar as vozes da call.

# Spike de mídia Tauri — 7las

Status: **aberto**. A base desktop, a captura por `getDisplayMedia`, a sessão WebRTC e a coordenação da árvore estão implementadas, mas o gate da Fase 0 ainda não foi concluído.

## Verificações necessárias no app empacotado

- [ ] Capturar um monitor a 1080p60.
- [ ] Capturar uma janela.
- [ ] Capturar áudio WASAPI de um jogo com Discord desktop e outro app produzindo som.
- [ ] Confirmar por gravação que “Sistema sem Discord” preserva o jogo e exclui as vozes do Discord.
- [ ] Validar PCM 48 kHz estéreo → AudioWorklet → MediaStreamTrack com desvio de áudio/vídeo de até 150 ms.
- [ ] Manter áudio e vídeo por 30 minutos com a janela minimizada e depois oculta na bandeja.
- [ ] Receber e retransmitir um MediaStream remoto por um segundo RTCPeerConnection.
- [ ] Confirmar áudio e vídeo após retransmissão sem misturar áudio local do relay.
- [ ] Validar STUN e TURN em redes domésticas diferentes.

## Estado atual

- Vídeo: captura real implementada em `src/lib/capture.ts`; ainda depende de teste manual no executável.
- Áudio: os quatro modos estão modelados, mas os comandos WASAPI retornam erro explícito e a UI permite iniciar somente com “Sem áudio”.
- Sinalização: Trystero/Nostr com segredo efêmero por sessão.
- Relay: publicação por atribuição e validação de metadata implementadas; falta o teste de integração com quatro contextos.
- Recuperação: regras de árvore cobertas por testes unitários; falta medir a recuperação real em até dez segundos.
- Backend de presença e tickets: não configurado; convites locais não substituem esse backend.

## Decisão go/no-go

Ainda não há decisão go. Não ampliar o escopo de áudio ou distribuição antes de completar esta lista e registrar resultados, limitações e métricas obtidas no Windows 11 x64.

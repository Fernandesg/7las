# 7las

App de compartilhamento de tela para Windows, construído com Tauri 2, React, TypeScript e WebRTC. Funciona na bandeja do sistema e oferece salas privadas para transmitir um monitor ou uma janela.

## Desenvolvimento

Requisitos: Node.js 24, Rust 1.90 ou superior e as dependências de build do Tauri para Windows.

```bash
npm ci
npx tauri dev
```

## Verificações

```bash
npm run lint
npm test
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Build

```bash
npx tauri build
```

O instalador NSIS é gerado em `src-tauri/target/release/bundle/nsis/`.

## Releases

O workflow `.github/workflows/release.yml` compila o app no Windows quando uma tag `v*` é publicada e cria um rascunho de release no GitHub com o instalador.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Estado da mídia

A captura de vídeo e a sessão WebRTC estão implementadas. O áudio WASAPI e os testes de integração de mídia ainda estão pendentes; consulte `docs/tauri-media-spike.md` e `spec-7las-tauri.md`.

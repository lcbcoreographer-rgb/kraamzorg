Portal da enfermeira: Hoje, Famílias, Alertas e Perfil, com abas inferiores em qualquer largura (casca `CascaEnfermeira`).
Hoje, Famílias (com a ficha em `minhas-familias/[id]`) e Perfil são do P38, sobre o motor offline do P12 (`ProvedorPortal` no layout). Alertas continua o estado vazio do P10 até o P40.
PWA instalável (D-01 e D-02 do PRD): `public/manifest.webmanifest`, `public/sw.js` e a página pública `src/app/portal-offline`, que abre sem sinal lendo o IndexedDB.

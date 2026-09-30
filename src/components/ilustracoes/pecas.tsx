import { Forma, Ilustracao, Traco, type IlustracaoProps } from "./base";

/*
 * As dez ilustrações da casa (DESIGN.md, 5.1). Cada peça tem uma mancha de
 * fundo num tom claro, uma ou duas formas de destaque e o desenho em traço
 * marinho, um pouco fora do preenchimento. Coordenadas numa grade de 120.
 * Nenhuma tem rosto, coração, bebê ou pessoa.
 */

/** Sem tarefas: uma xícara quente, a pausa entre uma coisa e outra. */
export function XicaraQuente(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="dourado-claro"
        d="M62 18c26-1 44 20 42 46-2 27-22 42-46 40-25-2-42-20-40-44 2-25 20-41 44-42Z"
      />
      <Forma
        tom="branco"
        d="M37 60h46v10c0 13-10 22-23 22s-23-9-23-22Z"
        atraso={120}
      />
      <Forma tom="dourado-medio" d="M40 62h40c-1 5-9 8-20 8s-19-3-20-8Z" />
      <Traco d="M35 58h48v12c0 14-11 23-24 23S35 84 35 70Z" />
      <Traco d="M83 62c11-1 14 16 0 18" atraso={120} />
      <Traco d="M26 95c14 7 50 7 66 0" atraso={200} />
      <Traco d="M48 48c-5-6 4-9-1-17" atraso={300} />
      <Traco d="M59 46c-5-6 4-9-1-17" atraso={360} />
      <Traco d="M70 48c-5-6 4-9-1-17" atraso={420} />
    </Ilustracao>
  );
}

/** Sem visitas hoje: a janela com o sol da manhã. */
export function JanelaManha(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="dourado-claro"
        d="M58 14c28 0 48 18 46 46-1 28-21 46-48 44-26-1-42-22-40-46 1-25 17-44 42-44Z"
      />
      <Forma
        tom="lavanda-clara"
        d="M32 26h56a6 6 0 0 1 6 6v58H26V32a6 6 0 0 1 6-6Z"
      />
      <Forma tom="dourado" d="M73 51a12 12 0 1 1-24 0 12 12 0 0 1 24 0Z" />
      <Traco d="M34 24h52a8 8 0 0 1 8 8v60H26V32a8 8 0 0 1 8-8Z" />
      <Traco d="M60 24v68M26 58h68" atraso={120} />
      <Traco d="M30 28c14 12 14 30 4 42" atraso={220} />
      <Traco d="M18 98h84" atraso={300} />
    </Ilustracao>
  );
}

/** Sem conversas e nenhum alerta aberto: um sino quieto. */
export function SinoCalmo(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="argila-clara"
        d="M60 16c25 0 44 19 44 44s-17 46-44 46-44-18-44-45 19-45 44-45Z"
      />
      <Forma
        tom="areia-clara"
        d="M36 98c0-3 11-5 24-5s24 2 24 5-11 5-24 5-24-2-24-5Z"
      />
      <Forma tom="branco" d="M41 80c0-24 5-40 19-40s19 16 19 40Z" />
      <Forma tom="dourado" d="M65 87a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />
      <Traco d="M40 81c0-26 5-43 20-43s20 17 20 43" />
      <Traco d="M33 82h54" atraso={140} />
      <Traco d="M60 38v-6m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" atraso={220} />
    </Ilustracao>
  );
}

/** Busca sem resultado: a folha e a lupa. */
export function FolhaLupa(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="salvia-clara"
        d="M56 16c28-2 50 18 48 46-2 26-22 44-48 42-25-2-41-22-40-46 1-23 17-40 40-42Z"
      />
      <Forma
        tom="salvia-media"
        d="M34 84c-3-25 14-45 44-49 3 29-15 47-44 49Z"
      />
      <Traco d="M36 86c-3-26 14-46 44-50 3 30-15 48-44 50Z" />
      <Traco d="M36 86c12-13 24-26 36-40" atraso={140} />
      <Forma tom="branco" d="M92 74a14 14 0 1 1-28 0 14 14 0 0 1 28 0Z" />
      <Traco d="M93 75a14 14 0 1 1-28 0 14 14 0 0 1 28 0Z" atraso={220} />
      <Traco d="M89 85l10 10" atraso={300} />
    </Ilustracao>
  );
}

/** Sem sinal: a nuvem longe e o registro guardado no aparelho. */
export function NuvemSemSinal(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="lavanda-clara"
        d="M60 14c26 0 46 20 44 46-1 26-20 46-46 44-25-1-43-21-42-45 1-25 19-45 44-45Z"
      />
      <Forma
        tom="branco"
        d="M36 64c-9 0-11-12-2-14 0-10 14-14 20-7 4-9 20-9 22 3 11 0 13 18 2 18Z"
      />
      <Traco d="M36 66c-10 0-12-14-2-15 0-11 15-15 21-8 4-10 22-10 24 3 12 0 14 20 2 20Z" />
      <Traco d="M58 74c2 8 8 12 16 14" tracejado />
      <Forma
        tom="dourado-claro"
        d="M76 76h14a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H76a4 4 0 0 1-4-4V80a4 4 0 0 1 4-4Z"
      />
      <Traco
        d="M77 74h14a5 5 0 0 1 5 5v21a5 5 0 0 1-5 5H77a5 5 0 0 1-5-5V79a5 5 0 0 1 5-5Z"
        atraso={160}
      />
      <Traco d="M78 90l4 4 7-8" atraso={260} />
    </Ilustracao>
  );
}

/** Checklist completo: o caderno de visita fechado, com o check. */
export function CadernoDeVisita(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="salvia-clara"
        d="M58 12c29-1 48 20 46 48-2 27-22 46-48 44-26-2-42-22-40-46 2-25 17-45 42-46Z"
      />
      <Forma
        tom="branco"
        d="M34 24h46a6 6 0 0 1 6 6v64a6 6 0 0 1-6 6H34Z"
        atraso={60}
      />
      <Traco d="M36 24h44a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H36a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6Z" />
      <Traco d="M41 25v74" atraso={160} />
      <Traco d="M51 44h24" atraso={260} />
      <Traco d="M51 54h19" atraso={320} />
      <Traco d="M51 64h22" atraso={380} />
      <Forma tom="dourado" d="M70 22h9v19l-4.5-4-4.5 4Z" atraso={300} />
      <Traco d="M70 24v17l4.5-4 4.5 4V24" atraso={300} />
      <Forma
        tom="salvia-media"
        d="M98 84a14 14 0 1 1-28 0 14 14 0 0 1 28 0Z"
        atraso={520}
      />
      <Traco d="M99 85a14 14 0 1 1-28 0 14 14 0 0 1 28 0Z" atraso={520} />
      <Traco d="M78 85l5 5 9-10" atraso={640} />
      <Traco d="M104 66l4-4M106 78h6M101 97l4 4" atraso={720} />
    </Ilustracao>
  );
}

/** Dia tranquilo e nenhuma família no estágio: a manta dobrada. */
export function MantaDobrada(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="areia-clara"
        d="M60 16c26 0 45 19 44 45-1 26-20 44-46 43-25-1-43-19-42-44 1-25 19-44 44-44Z"
      />
      <Forma
        tom="dourado-claro"
        d="M24 78h72a8 8 0 0 1 0 16H24a8 8 0 0 1 0-16Z"
      />
      <Forma
        tom="lavanda-clara"
        d="M30 58h60a8 8 0 0 1 0 16H30a8 8 0 0 1 0-16Z"
      />
      <Traco d="M24 80h72a9 9 0 0 1 0 18H24a9 9 0 0 1 0-18Z" />
      <Traco d="M30 60h60a9 9 0 0 1 0 18H30a9 9 0 0 1 0-18Z" atraso={140} />
      <Traco d="M36 69h48" tracejado />
      <Traco d="M86 60c8 3 8 15 0 18" atraso={240} />
    </Ilustracao>
  );
}

/** Nenhuma família atribuída ainda: a chave de casa. */
export function ChaveDeCasa(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="dourado-claro"
        d="M58 16c27-1 47 20 46 46-1 26-21 44-47 42-25-2-42-21-41-45 1-24 18-42 42-43Z"
      />
      <Forma
        tom="dourado-medio"
        d="M60 60a18 18 0 1 1-36 0 18 18 0 0 1 36 0Z"
      />
      <Traco d="M62 60a19 19 0 1 1-38 0 19 19 0 0 1 38 0Z" />
      <Traco d="M36 66v-7l7-6 7 6v7Z" atraso={140} />
      <Traco d="M62 60h36" atraso={220} />
      <Traco d="M86 60v9M95 60v6" atraso={300} />
    </Ilustracao>
  );
}

/** Plantão tranquilo: a lua e a nuvem. */
export function LuaENuvem(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="lavanda-clara"
        d="M60 14c27 0 46 20 44 46-1 27-20 45-46 44-26-1-43-21-42-46 1-25 18-44 44-44Z"
      />
      <Forma tom="dourado" d="M70 28a24 24 0 1 0 22 34 18 18 0 1 1-22-34Z" />
      <Traco d="M72 27a24 24 0 1 0 22 34 18 18 0 1 1-22-34Z" />
      <Forma
        tom="branco"
        d="M32 86c-9 0-9-13 0-14 1-9 13-12 18-5 4-8 18-8 20 3 9 0 10 16 1 16Z"
      />
      <Traco
        d="M32 88c-10 0-10-15 0-15 1-10 14-13 19-6 4-9 20-9 22 3 10 0 11 18 1 18Z"
        atraso={160}
      />
    </Ilustracao>
  );
}

/** Esta parte ainda está em construção: um broto no vaso de barro. */
export function Broto(props: IlustracaoProps) {
  return (
    <Ilustracao {...props}>
      <Forma
        tom="salvia-clara"
        d="M60 14c27 0 46 20 44 46-1 26-21 46-46 44-26-2-43-21-42-46 1-25 19-44 44-44Z"
      />
      <Forma tom="argila-media" d="M44 80h32l-4 20H48Z" />
      <Traco d="M42 80h36M45 80l4 20h22l4-20" />
      <Traco d="M60 80V56" atraso={160} />
      <Forma tom="salvia-media" d="M60 66c-10 0-18-8-20-18 12 0 20 6 20 18Z" />
      <Traco d="M60 67c-11 0-19-8-21-19 13 0 21 7 21 19Z" atraso={240} />
      <Forma tom="salvia-media" d="M60 58c2-12 11-20 23-21 0 12-10 21-23 21Z" />
      <Traco d="M60 59c2-13 12-21 24-22 0 13-11 22-24 22Z" atraso={320} />
    </Ilustracao>
  );
}

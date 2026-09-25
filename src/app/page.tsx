/**
 * Página inicial provisória (P00). Sem design ainda: o sistema visual entra
 * no P10, a partir de docs/design/DESIGN.md. Por enquanto, só o essencial.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Kraamzorg OS</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Repositório em construção. As telas de cada módulo chegam nas próximas
        sessões do PROMPTS.md.
      </p>
    </main>
  );
}

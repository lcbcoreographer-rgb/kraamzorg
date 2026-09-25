/**
 * Bairro e cidade juntos, sem repetir quando são o mesmo texto (crítica do
 * CRM, P3 item 22: "Alphaville, Alphaville" e "Granja Viana, Granja Viana"
 * apareciam no pipeline, na ficha e no resumo da Isadora quando o bairro
 * cadastrado é igual ao nome da cidade). `null` quando não há nenhum dos
 * dois.
 */
export function localidade(
  bairro: string | null,
  cidade: string | null,
): string | null {
  const partes = [bairro, cidade].filter((parte): parte is string =>
    Boolean(parte && parte.trim()),
  );
  const unicas = [
    ...new Set(partes.map((parte) => parte.trim().toLowerCase())),
  ].map((chave) =>
    partes.find((parte) => parte.trim().toLowerCase() === chave)!,
  );
  return unicas.length > 0 ? unicas.join(", ") : null;
}

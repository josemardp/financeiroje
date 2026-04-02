function mapStructuredCaptureToParsed(result: StructuredCaptureResult): ParsedTransaction {
  const fallback = parseTransactionText(result.text);
  const metadata = result.metadata;

  const hasTypeFromMetadata =
    metadata?.transactionType === "income" || metadata?.transactionType === "expense";
  const hasAmountFromMetadata =
    typeof metadata?.amount === "number" && metadata.amount > 0;
  const hasDateFromMetadata =
    typeof metadata?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metadata.date);

  const finalValor = hasAmountFromMetadata ? metadata!.amount ?? null : fallback.valor;
  const finalTipo = hasTypeFromMetadata
    ? (metadata!.transactionType as "income" | "expense")
    : fallback.tipo;
  const finalData = hasDateFromMetadata ? metadata!.date! : fallback.data;

  const finalDescription = (
    metadata?.description?.trim() ||
    metadata?.merchantName?.trim() ||
    metadata?.counterparty?.trim() ||
    fallback.descricao
  ).trim();

  const hasFinalAmount = typeof finalValor === "number" && finalValor > 0;
  const hasFinalType = finalTipo === "income" || finalTipo === "expense";
  const hasFinalDate =
    typeof finalData === "string" && /^\d{4}-\d{2}-\d{2}$/.test(finalData);
  const hasFinalDescription = Boolean(finalDescription);

  const observacoes = [
    ...((metadata?.evidence || []).slice(0, 6).map((item) => `Evidência IA: ${item}`)),
    ...(!hasTypeFromMetadata && hasFinalType
      ? ["Tipo preenchido por fallback local; revise no Modo Espelho."]
      : !hasFinalType
        ? ["Tipo da transação não foi identificado com segurança."]
        : []),
    ...(!hasAmountFromMetadata && hasFinalAmount
      ? ["Valor principal preenchido por fallback local; revise no Modo Espelho."]
      : !hasFinalAmount
        ? ["Valor principal não foi identificado com segurança."]
        : []),
    ...(!hasDateFromMetadata && hasFinalDate
      ? ["Data preenchida por fallback local; revise no Modo Espelho."]
      : !hasFinalDate
        ? ["Data não foi identificada com segurança."]
        : []),
    ...fallback.observacoes.filter((obs) => {
      if (
        obs === "Tipo da transação não foi identificado com clareza; mantido padrão conservador." &&
        hasFinalType
      ) {
        return false;
      }

      if (
        obs === "Nenhuma data explícita encontrada; usado o dia atual como fallback." &&
        hasDateFromMetadata
      ) {
        return false;
      }

      return true;
    }),
  ].slice(0, 8);

  const camposFaltantes = Array.from(
    new Set([
      ...(hasFinalAmount ? [] : ["valor"]),
      ...(hasFinalType ? [] : ["tipo"]),
      ...(hasFinalDate ? [] : ["data"]),
      ...(hasFinalDescription ? [] : ["descricao"]),
      ...((metadata?.categoryHint || fallback.categoriaSugerida) ? [] : ["categoria"]),
      ...((result.missingFields || []).filter(Boolean)),
    ])
  );

  return {
    valor: finalValor,
    tipo: finalTipo,
    descricao: finalDescription || fallback.descricao,
    data: finalData,
    categoriaSugerida: metadata?.categoryHint || fallback.categoriaSugerida,
    escopo:
      metadata?.scope === "family" ||
      metadata?.scope === "business" ||
      metadata?.scope === "private"
        ? metadata.scope
        : fallback.escopo,
    confianca: mapOcrConfidence(metadata, result.confidence),
    textoOriginal: result.text,
    observacoes,
    camposFaltantes,
  };
}

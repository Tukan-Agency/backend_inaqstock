import Counter from "../model/Counter";

/**
 * Obtiene el siguiente valor del contador de forma atómica en dos pasos:
 * 1) upsert de inicialización sin tocar 'seq' con $inc
 * 2) $inc para incrementar y devolver el nuevo valor
 */
export async function getNextSequence(name: string, startAt = 10000): Promise<number> {
  // 1) Asegurar que exista el documento
  await Counter.updateOne(
    { _id: name },
    { $setOnInsert: { seq: startAt } },
    { upsert: true }
  );

  // 2) Incrementar y devolver
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true }
  ).lean();

  if (!doc) {
    // Reintento ultra raro si el paso anterior aún no es visible
    const retry = await Counter.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    ).lean();
    if (!retry) throw new Error("No se pudo obtener el siguiente sequenceId");
    return retry.seq;
  }

  return doc.seq;
}

export async function peekNextSequence(name: string, startAt = 10000): Promise<number> {
  const doc = await Counter.findById(name).lean();
  if (!doc) return startAt + 1;
  return (doc.seq ?? startAt) + 1;
}
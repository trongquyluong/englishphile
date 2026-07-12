export class ReplayRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayRejectedError";
  }
}

export async function claimSingleWinner(
  claim: () => Promise<number>,
  rejectionMessage: string,
): Promise<void> {
  const claimed = await claim();
  if (claimed !== 1) throw new ReplayRejectedError(rejectionMessage);
}

export async function runSingleWinnerTransaction<TTransaction, TResult>(
  withTransaction: (operation: (transaction: TTransaction) => Promise<TResult>) => Promise<TResult>,
  claim: (transaction: TTransaction) => Promise<number>,
  applySideEffects: (transaction: TTransaction) => Promise<TResult>,
  rejectionMessage: string,
): Promise<TResult> {
  return withTransaction(async (transaction) => {
    await claimSingleWinner(() => claim(transaction), rejectionMessage);
    return applySideEffects(transaction);
  });
}

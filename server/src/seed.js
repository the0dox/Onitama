// picks the deck seed: DECK_SEED from env when set, otherwise a freshly generated random seed
export function ResolveDeckSeed(env, MakeRandom)
{
  const fromEnv = env?.DECK_SEED;
  if (typeof fromEnv === "string" && fromEnv !== "")
  {
    return { seed: fromEnv, source: "env" };
  }
  return { seed: MakeRandom(), source: "random" };
}

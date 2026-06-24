/**
 * Loads the committed corpus assets (passages, precomputed embeddings, example
 * queries, metadata) with ZERO network beyond fetching these static files. The
 * embeddings arrive as one packed Float32 buffer and are exposed as per-row
 * subarray views (no copy) for the Metric.
 */
export interface Meta {
  count: number;
  dim: number;
  dtype: string;
  normalized: boolean;
  model: string;
  pooling: string;
  retrieved: string;
  sources: Record<string, { count: number; license: string }>;
}

export interface PassageRow {
  id: number;
  title: string;
  text: string;
  source: "helpcenter" | "wikipedia";
}

export interface ExampleQuery {
  query: string;
  note: string;
  vector: number[];
}

export interface Corpus {
  meta: Meta;
  passages: PassageRow[];
  vectors: Float32Array[];
  examples: ExampleQuery[];
}

function join(base: string, path: string): string {
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

export async function loadCorpus(base: string): Promise<Corpus> {
  const dataBase = join(base, "data");
  const [meta, passages, examples, binBuf] = await Promise.all([
    fetch(join(dataBase, "meta.json")).then((r) => r.json() as Promise<Meta>),
    fetch(join(dataBase, "passages.json")).then((r) => r.json() as Promise<PassageRow[]>),
    fetch(join(dataBase, "examples.json")).then((r) => r.json() as Promise<ExampleQuery[]>),
    fetch(join(dataBase, "embeddings.bin")).then((r) => r.arrayBuffer()),
  ]);

  const flat = new Float32Array(binBuf);
  const { count, dim } = meta;
  if (flat.length !== count * dim) {
    throw new Error(`embeddings.bin length ${flat.length} != ${count}*${dim}`);
  }
  const vectors: Float32Array[] = new Array(count);
  for (let i = 0; i < count; i++) {
    vectors[i] = flat.subarray(i * dim, (i + 1) * dim); // zero-copy view
  }

  return { meta, passages, vectors, examples };
}

export async function enrichSnapshot(snapshot) {
  return {
    meta: {
      repoName: snapshot.repoName ?? 'placeholder',
      generatedAt: snapshot.generatedAt ?? null,
      source: 'placeholder',
    },
    nodes: [],
    edges: [],
    files: snapshot.files ?? [],
  };
}

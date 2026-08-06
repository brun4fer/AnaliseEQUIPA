export async function readJson<T>(request: Request) {
  return request.json() as Promise<T>;
}

export function handleApiError(error: unknown) {
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 400 });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

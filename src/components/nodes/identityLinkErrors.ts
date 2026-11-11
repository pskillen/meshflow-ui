const CODE_MESSAGES: Record<string, string> = {
  link_conflict:
    "These two nodes can't be linked: one of them is already linked to another radio, or this pair was marked not the same radio before. Nothing was changed.",
  link_cycle: 'That would make two nodes replace each other, so nothing was changed.',
  not_owner: 'You can only do this when you own the nodes involved, or the other node has no owner yet.',
  cross_protocol:
    "Those nodes are different kinds of radio (Meshtastic and MeshCore), so they can't be the same radio.",
  same_node: "A node can't replace itself. Pick a different node.",
  invalid_state: 'This link was already reviewed. Reload the page to see where it stands.',
  not_found: 'That node or link was not found. It may have been removed.',
  ambiguous_node: 'More than one node matches. Pick the node from the search list.',
};

/**
 * Plain message for a failed identity-link call. The API client's interceptor turns failures into
 * `{ message, status, data }`, so the `{code, detail}` body is read from `data`. Known codes get our words; an
 * unknown code shows the API's `detail`; anything else gets `fallback`.
 */
export function identityLinkErrorMessage(err: unknown, fallback: string): string {
  const body = typeof err === 'object' && err !== null ? (err as { data?: unknown }).data : undefined;
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    if (typeof data.code === 'string' && CODE_MESSAGES[data.code]) return CODE_MESSAGES[data.code];
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (typeof data.code === 'string' && data.code) return `The server refused the change (${data.code}).`;
  }
  return fallback;
}

export const IDENTITY_LINK_ERROR_CODES = Object.keys(CODE_MESSAGES);

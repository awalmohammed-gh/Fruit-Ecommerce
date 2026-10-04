/** Categories accept public HTTP(S) image addresses, never credentials or executable URL schemes. */
export function validCategoryImageUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

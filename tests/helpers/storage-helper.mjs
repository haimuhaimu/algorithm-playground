export function memoryStorage() {
  const records = new Map();
  return { records, writes: 0, getItem: key => records.get(key) ?? null,
    setItem(key, value) { this.writes++; records.set(key, String(value)); },
    removeItem: key => records.delete(key) };
}

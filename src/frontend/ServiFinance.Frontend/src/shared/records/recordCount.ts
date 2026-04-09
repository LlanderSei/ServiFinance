export function formatRecordCount(count: number, singular: string, plural = `${singular}s`) {
  const label = count === 1 ? singular : plural;
  return `${count} ${label}`;
}

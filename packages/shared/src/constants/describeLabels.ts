// "slug = Label; …" for enum descriptions in the OpenAPI contract, where the mobile app reads
// display labels. Internal: not re-exported from the package.
export function describeLabels(labels: Record<string, string>) {
  return Object.entries(labels)
    .map(([slug, label]) => `${slug} = ${label}`)
    .join('; ')
}

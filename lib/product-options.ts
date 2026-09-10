export const MAX_PRODUCT_OPTIONS = 30;
export const MAX_PRODUCT_OPTION_LENGTH = 40;

export function parseProductOptions(value: string) {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const rawOption of value.split(/[\n,]/)) {
    const option = rawOption.trim();

    if (!option) {
      continue;
    }

    if (option.length > MAX_PRODUCT_OPTION_LENGTH) {
      throw new Error(
        `Each option must be ${MAX_PRODUCT_OPTION_LENGTH} characters or fewer.`,
      );
    }

    const comparisonKey = option.toLocaleLowerCase();

    if (!seen.has(comparisonKey)) {
      seen.add(comparisonKey);
      options.push(option);
    }
  }

  if (options.length > MAX_PRODUCT_OPTIONS) {
    throw new Error(`Add no more than ${MAX_PRODUCT_OPTIONS} options.`);
  }

  return options;
}

export function productOptionsInputValue(options: string[] | null | undefined) {
  return (options ?? []).join(", ");
}

import "server-only";

// Read time in server work, outside React's render expression.
export async function requestTime() { return Date.now(); }

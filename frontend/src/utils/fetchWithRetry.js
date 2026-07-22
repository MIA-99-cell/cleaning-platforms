const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (requestFn, { retries = 2, delayMs = 1500 } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }
  throw lastError;
};

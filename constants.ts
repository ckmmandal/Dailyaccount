
export const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 1, 1.6];

export const DEFAULT_DENOMINATIONS = DENOMINATIONS.map(val => ({ value: val, quantity: 0 }));

export const APP_STORAGE_KEY = 'ZEN_ACCOUNT_DATA_V1';
export const APP_LOGS_KEY = 'ZEN_ACCOUNT_LOGS_V1';

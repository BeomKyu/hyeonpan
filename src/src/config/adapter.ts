import type { DataAdapter } from '../adapters/DataAdapter';
import { ManualAdapter } from '../adapters/ManualAdapter';
import { ApiAdapter } from '../adapters/ApiAdapter';

const adapterMode = import.meta.env.VITE_ADAPTER_MODE || 'manual';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

export function getAdapter(): DataAdapter {
    if (adapterMode === 'api') {
        return new ApiAdapter(apiBaseUrl);
    }
    return new ManualAdapter();
}

export type ViewMode = 'manual' | 'dashboard';

export function getViewMode(): ViewMode {
    if (adapterMode === 'dashboard') return 'dashboard';
    return 'manual';
}

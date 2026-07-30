import { supabase } from '../lib/supabase';
import { TIMEOUTS } from '../config/constants';

export async function rpcWithTimeout(functionName, parameters) {
    const controller = new AbortController();
    let timeoutId;

    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error('Délai Supabase dépassé'));
        }, TIMEOUTS.SUPABASE_RPC);
    });

    const query = supabase.rpc(functionName, parameters);
    const request = typeof query.abortSignal === 'function'
        ? query.abortSignal(controller.signal)
        : query;

    try {
        return await Promise.race([request, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
}

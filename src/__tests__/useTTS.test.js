import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTTS } from '../hooks/useTTS';
import { synthesizeSpeech } from '../services/ttsService';

vi.mock('../services/ttsService', () => ({
    synthesizeSpeech: vi.fn()
}));

describe('useTTS', () => {
    let audio;
    let createObjectURL;

    beforeEach(() => {
        vi.resetAllMocks();
        localStorage.clear();

        audio = {
            src: '',
            pause: vi.fn(),
            play: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };
        createObjectURL = vi.fn();

        vi.stubGlobal('Audio', class {
            constructor() {
                return audio;
            }
        });
        vi.stubGlobal('URL', {
            createObjectURL,
            revokeObjectURL: vi.fn()
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not reuse cached audio when the message position has different content', async () => {
        const firstAudio = new Blob(['premier']);
        const secondAudio = new Blob(['second']);
        synthesizeSpeech
            .mockResolvedValueOnce({ audio: firstAudio, error: null })
            .mockResolvedValueOnce({ audio: secondAudio, error: null });
        createObjectURL.mockImplementation(blob => (
            blob === firstAudio ? 'blob:first' : 'blob:second'
        ));

        const { result } = renderHook(() => useTTS('user-1'));

        await act(async () => {
            await result.current.preloadAudio('Premier contenu', 2);
        });
        await act(async () => {
            await result.current.play('Second contenu', 2);
        });

        expect(audio.src).toBe('blob:second');
    });

    it('aborts and ignores a pending preload when the user changes', async () => {
        const firstAudio = new Blob(['utilisateur-1']);
        const secondAudio = new Blob(['utilisateur-2']);
        let resolveFirstPreload;
        let firstPreloadSignal;

        synthesizeSpeech
            .mockImplementationOnce((_text, signal) => {
                firstPreloadSignal = signal;
                return new Promise(resolve => {
                    resolveFirstPreload = resolve;
                });
            })
            .mockResolvedValueOnce({ audio: secondAudio, error: null });
        createObjectURL.mockImplementation(blob => (
            blob === firstAudio ? 'blob:user-1' : 'blob:user-2'
        ));

        const { result, rerender } = renderHook(
            ({ userId }) => useTTS(userId),
            { initialProps: { userId: 'user-1' } }
        );

        let preloadPromise;
        act(() => {
            preloadPromise = result.current.preloadAudio('Contenu privé', 2);
        });

        rerender({ userId: 'user-2' });

        expect(firstPreloadSignal.aborted).toBe(true);

        await act(async () => {
            resolveFirstPreload({ audio: firstAudio, error: null });
            await preloadPromise;
        });
        await act(async () => {
            await result.current.play('Nouveau contenu', 2);
        });

        expect(audio.src).toBe('blob:user-2');
        expect(
            createObjectURL.mock.calls.some(([blob]) => blob === firstAudio)
        ).toBe(false);
    });

    it('clears cached audio and playback state on reset', async () => {
        const firstAudio = new Blob(['avant-reset']);
        const secondAudio = new Blob(['apres-reset']);
        synthesizeSpeech
            .mockResolvedValueOnce({ audio: firstAudio, error: null })
            .mockResolvedValueOnce({ audio: secondAudio, error: null });
        createObjectURL.mockImplementation(blob => (
            blob === firstAudio ? 'blob:before-reset' : 'blob:after-reset'
        ));

        const { result } = renderHook(() => useTTS('user-1'));

        await act(async () => {
            await result.current.preloadAudio('Contenu identique', 2);
        });
        await act(async () => {
            await result.current.play('Contenu identique', 2);
        });

        expect(result.current.isPlaying).toBe(true);
        expect(result.current.playingMessageId).toBe(2);

        act(() => {
            result.current.reset();
        });

        expect(audio.src).toBe('');
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.playingMessageId).toBe(null);

        await act(async () => {
            await result.current.play('Contenu identique', 2);
        });

        expect(audio.src).toBe('blob:after-reset');
    });
});

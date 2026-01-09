import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragDrop } from '../hooks/useDragDrop';

describe('useDragDrop', () => {
    const createDragEvent = (files = []) => ({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files },
        currentTarget: 'target',
        target: 'target'
    });

    describe('état initial', () => {
        it('isDragging est false par défaut', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
            expect(result.current.isDragging).toBe(false);
        });

        it('retourne les handlers drag', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
            expect(result.current.dragHandlers).toHaveProperty('onDragOver');
            expect(result.current.dragHandlers).toHaveProperty('onDragLeave');
            expect(result.current.dragHandlers).toHaveProperty('onDrop');
        });
    });

    describe('onDragOver', () => {
        it('active isDragging quand non désactivé', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
            const event = createDragEvent();

            act(() => {
                result.current.dragHandlers.onDragOver(event);
            });

            expect(result.current.isDragging).toBe(true);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });

        it('n\'active pas isDragging quand désactivé', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn(), disabled: true }));
            const event = createDragEvent();

            act(() => {
                result.current.dragHandlers.onDragOver(event);
            });

            expect(result.current.isDragging).toBe(false);
        });
    });

    describe('onDragLeave', () => {
        it('désactive isDragging quand on quitte le container principal', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
            const event = createDragEvent();

            // D'abord activer le dragging
            act(() => {
                result.current.dragHandlers.onDragOver(event);
            });
            expect(result.current.isDragging).toBe(true);

            // Puis quitter
            act(() => {
                result.current.dragHandlers.onDragLeave(event);
            });
            expect(result.current.isDragging).toBe(false);
        });

        it('ne désactive pas isDragging si target !== currentTarget', () => {
            const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
            const eventOver = createDragEvent();
            const eventLeave = {
                ...createDragEvent(),
                currentTarget: 'parent',
                target: 'child'
            };

            act(() => {
                result.current.dragHandlers.onDragOver(eventOver);
            });
            expect(result.current.isDragging).toBe(true);

            act(() => {
                result.current.dragHandlers.onDragLeave(eventLeave);
            });
            expect(result.current.isDragging).toBe(true);
        });
    });

    describe('onDrop', () => {
        it('appelle onDrop avec les fichiers', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragDrop({ onDrop }));
            const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];
            const event = createDragEvent(files);

            act(() => {
                result.current.dragHandlers.onDrop(event);
            });

            expect(onDrop).toHaveBeenCalledWith(files);
            expect(result.current.isDragging).toBe(false);
        });

        it('n\'appelle pas onDrop si désactivé', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragDrop({ onDrop, disabled: true }));
            const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];
            const event = createDragEvent(files);

            act(() => {
                result.current.dragHandlers.onDrop(event);
            });

            expect(onDrop).not.toHaveBeenCalled();
        });

        it('n\'appelle pas onDrop si aucun fichier', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragDrop({ onDrop }));
            const event = createDragEvent([]);

            act(() => {
                result.current.dragHandlers.onDrop(event);
            });

            expect(onDrop).not.toHaveBeenCalled();
        });

        it('gère plusieurs fichiers', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragDrop({ onDrop }));
            const files = [
                new File(['content1'], 'test1.txt', { type: 'text/plain' }),
                new File(['content2'], 'test2.pdf', { type: 'application/pdf' })
            ];
            const event = createDragEvent(files);

            act(() => {
                result.current.dragHandlers.onDrop(event);
            });

            expect(onDrop).toHaveBeenCalledWith(files);
            expect(files.length).toBe(2);
        });
    });
});

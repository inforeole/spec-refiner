import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpecRefiner from '../SpecRefiner';
import { useSession } from '../hooks/useSession';

const mockClearInput = vi.fn();
const interviewPhaseProps = vi.fn();

vi.mock('../components', () => ({
    LoginForm: () => <div>Connexion</div>,
    InterviewPhase: props => {
        interviewPhaseProps(props);
        return <div>Entretien</div>;
    },
    CompletePhase: () => <div>Spécification</div>
}));

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            email: 'test@example.com',
            sessionToken: 'session-1'
        },
        isAuthenticated: true,
        isLoading: false,
        logout: vi.fn()
    })
}));

vi.mock('../hooks/useSession', () => ({
    useSession: vi.fn()
}));

vi.mock('../hooks/useSpecVersions', () => ({
    useSpecVersions: () => ({
        versions: [],
        selectedVersion: null,
        selectVersion: vi.fn(),
        isLoading: false,
        error: null
    })
}));

vi.mock('../hooks/useChatInput', () => ({
    useChatInput: () => ({
        inputMessage: '',
        setInputMessage: vi.fn(),
        chatFiles: [],
        isProcessingFiles: false,
        handleFileSelect: vi.fn(),
        removeFile: vi.fn(),
        clearInput: mockClearInput,
        addFiles: vi.fn(),
        processCurrentFiles: vi.fn(),
        validationDialog: { isOpen: false },
        handleValidationAction: vi.fn(),
        handleValidationCancel: vi.fn()
    })
}));

vi.mock('../hooks/useInterviewChat', () => ({
    useInterviewChat: () => ({
        isLoading: false,
        isRegenerating: false,
        errorMessage: null,
        clearError: vi.fn(),
        sendMessage: vi.fn(),
        requestFinalSpec: vi.fn(),
        abortRequest: vi.fn()
    })
}));

vi.mock('../hooks/useDragDrop', () => ({
    useDragDrop: () => ({
        isDragging: false,
        dragHandlers: {}
    })
}));

vi.mock('../hooks/useTTSMessage', () => ({
    useTTSMessage: () => ({
        messagesEndRef: { current: null },
        playingMessageId: null,
        isPlayingAudio: false,
        isLoadingAudio: false,
        autoPlayEnabled: false,
        playAudio: vi.fn(),
        toggleAutoPlay: vi.fn()
    })
}));

vi.mock('../hooks/useMessageFlow', () => ({
    useMessageFlow: () => ({
        handleSendMessage: vi.fn()
    })
}));

describe('SpecRefiner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useSession.mockReturnValue({
            messages: [],
            phase: 'interview',
            questionCount: 0,
            finalSpec: null,
            messageCountAtLastSpec: 0,
            isLoading: false,
            connectionError: null,
            saveError: 'Erreur de sauvegarde',
            updatePhase: vi.fn(),
            enterModificationMode: vi.fn(),
            updateMessages: vi.fn()
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('affiche une alerte visible quand la session n’est pas sauvegardée', () => {
        render(<SpecRefiner />);

        expect(screen.getByRole('alert').textContent).toContain('Session non sauvegardée');
    });

    it('ne transmet aucune action de recommencement au client', () => {
        render(<SpecRefiner />);

        expect(interviewPhaseProps).toHaveBeenCalledWith(
            expect.not.objectContaining({ onReset: expect.anything() })
        );
    });
});

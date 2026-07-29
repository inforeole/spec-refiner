import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageList from '../components/MessageList';

describe('MessageList', () => {
    it('affiche le nom et le texte extrait d’une pièce jointe depuis apiContent', () => {
        render(
            <MessageList
                messages={[
                    {
                        role: 'user',
                        content: 'Voici mon document\n\n[Résumé du fichier]',
                        apiContent: [
                            {
                                type: 'text',
                                text: 'Voici mon document\n\nDocuments attachés :\n\n--- besoins.txt ---\nContenu extrait du document'
                            }
                        ]
                    }
                ]}
                isLoading={false}
            />
        );

        expect(screen.getByText('Voici mon document')).toBeTruthy();
        expect(screen.getByText('besoins.txt')).toBeTruthy();
        expect(screen.getByText('Contenu extrait du document')).toBeTruthy();
    });

    it('affiche une pièce jointe après rechargement quand apiContent est une chaîne', () => {
        render(
            <MessageList
                messages={[
                    {
                        role: 'user',
                        content: 'Voici mon document\n\n[Résumé du fichier]',
                        apiContent: 'Voici mon document\n\nDocuments attachés :\n\n--- besoins.txt ---\nContenu extrait rechargé'
                    }
                ]}
                isLoading={false}
            />
        );

        expect(screen.getByText('besoins.txt')).toBeTruthy();
        expect(screen.getByText('Contenu extrait rechargé')).toBeTruthy();
    });
});

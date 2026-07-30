import { useState, useEffect, useCallback } from 'react';
import { Shield, UserPlus, Trash2, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import {
    checkIsAdmin,
    createUser,
    deleteUser,
    listUsers,
    resetUserProject
} from '../services/userService';
import { deleteImage } from '../services/imageService';
import { extractStorageImageUrls } from '../utils/messageUtils';

export default function AdminPage() {
    // Autorisation admin: 'checking' | 'authorized' | 'denied'
    // Vérifiée côté serveur (token de session + is_admin), plus de mot de passe client.
    const [adminState, setAdminState] = useState('checking');

    // User management state
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [error, setError] = useState(null);

    // Create user form state
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [createSuccess, setCreateSuccess] = useState(null);
    const [resetTarget, setResetTarget] = useState(null);
    const [resetConfirmation, setResetConfirmation] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [resetNotice, setResetNotice] = useState(null);

    // Vérifie l'autorisation admin au montage (serveur)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const ok = await checkIsAdmin();
            if (!cancelled) {
                setAdminState(ok ? 'authorized' : 'denied');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load users once authorized
    useEffect(() => {
        if (adminState === 'authorized') {
            loadUsers();
        }
    }, [adminState]);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setError(null);
        const { users: userList, error: loadError } = await listUsers();
        if (loadError) {
            setError(loadError);
        } else {
            setUsers(userList);
        }
        setIsLoadingUsers(false);
    };

    const handleCreateUser = useCallback(async (e) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError(null);
        setCreateSuccess(null);

        const { user, error: err } = await createUser(newEmail, newPassword);

        if (user) {
            setCreateSuccess(`Utilisateur ${user.email} créé avec succès`);
            setNewEmail('');
            setNewPassword('');
            await loadUsers();
        } else {
            setCreateError(err);
        }

        setIsCreating(false);
    }, [newEmail, newPassword]);

    const handleDeleteUser = useCallback(async (userId, userEmail) => {
        if (!confirm(`Supprimer l'utilisateur ${userEmail} ? Cette action est irréversible.`)) {
            return;
        }

        const { success, error: err } = await deleteUser(userId);
        if (success) {
            await loadUsers();
        } else {
            setError(err);
        }
    }, []);

    const openResetDialog = useCallback(user => {
        setResetTarget(user);
        setResetConfirmation('');
        setResetNotice(null);
    }, []);

    const closeResetDialog = useCallback(() => {
        if (isResetting) return;
        setResetTarget(null);
        setResetConfirmation('');
    }, [isResetting]);

    const handleResetProject = useCallback(async () => {
        if (!resetTarget || resetConfirmation !== resetTarget.email) {
            return;
        }

        setIsResetting(true);
        setError(null);
        const result = await resetUserProject(resetTarget.id);
        if (result.error) {
            setError(result.error);
            setIsResetting(false);
            return;
        }

        const imageUrls = extractStorageImageUrls(result.messages);
        const deletionResults = await Promise.all(
            imageUrls.map(url => deleteImage(url))
        );
        const partialFailure = deletionResults.some(item => !item.success);
        setResetNotice(partialFailure
            ? 'Projet réinitialisé, mais certaines images n’ont pas pu être supprimées'
            : `Projet de ${resetTarget.email} réinitialisé`
        );
        setResetTarget(null);
        setResetConfirmation('');
        setIsResetting(false);
    }, [resetConfirmation, resetTarget]);

    const goToApp = () => {
        window.location.href = '/';
    };

    // Vérification en cours
    if (adminState === 'checking') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    // Accès refusé (non connecté ou compte non-admin)
    if (adminState === 'denied') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Administration</h1>
                    <p className="text-slate-400 mb-6">
                        Accès réservé aux administrateurs. Connecte-toi avec un compte administrateur
                        depuis l&apos;application.
                    </p>

                    <button
                        onClick={goToApp}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour à l&apos;application
                    </button>
                </div>
            </div>
        );
    }

    // Admin dashboard (adminState === 'authorized')
    return (
        <div className="min-h-screen bg-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Administration</h1>
                    </div>
                    <button
                        onClick={goToApp}
                        className="text-slate-400 hover:text-white flex items-center gap-2 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </button>
                </div>

                {/* Create user form */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-amber-500" />
                        Créer un utilisateur
                    </h2>

                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Email"
                                required
                                disabled={isCreating}
                                className="bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                            />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mot de passe (12+ car., maj, min, chiffre, special)"
                                required
                                minLength={12}
                                disabled={isCreating}
                                className="bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                            />
                        </div>

                        {createError && (
                            <p className="text-red-400 text-sm">{createError}</p>
                        )}
                        {createSuccess && (
                            <p className="text-green-400 text-sm">{createSuccess}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isCreating}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Création...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    Créer l&apos;utilisateur
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Users list */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Utilisateurs ({users.length})
                    </h2>

                    {error && (
                        <p className="text-red-400 text-sm mb-4">{error}</p>
                    )}
                    {resetNotice && (
                        <p role="status" className="text-amber-300 text-sm mb-4">
                            {resetNotice}
                        </p>
                    )}

                    {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">Aucun utilisateur</p>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3"
                                >
                                    <div>
                                        <p className="text-white font-medium">{user.email}</p>
                                        <p className="text-slate-500 text-sm">
                                            Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!user.is_admin && (
                                            <button
                                                onClick={() => openResetDialog(user)}
                                                className="p-2 text-slate-400 hover:text-amber-300 hover:bg-slate-700 rounded-lg transition-colors"
                                                aria-label={`Réinitialiser le projet de ${user.email}`}
                                                title="Réinitialiser le projet"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteUser(user.id, user.email)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {resetTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reset-project-title"
                >
                    <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-800 p-6">
                        <h2 id="reset-project-title" className="text-xl font-bold text-white">
                            Réinitialiser le projet
                        </h2>
                        <p className="mt-3 text-sm text-slate-300">
                            Le projet, la conversation et les six versions de{' '}
                            <strong>{resetTarget.email}</strong> seront supprimés.
                            Le compte client restera actif.
                        </p>
                        <label
                            htmlFor="reset-confirmation"
                            className="mt-5 block text-sm font-medium text-slate-200"
                        >
                            Confirmer avec l’adresse email
                        </label>
                        <input
                            id="reset-confirmation"
                            type="email"
                            value={resetConfirmation}
                            onChange={event => setResetConfirmation(event.target.value)}
                            disabled={isResetting}
                            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                            autoComplete="off"
                        />
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeResetDialog}
                                disabled={isResetting}
                                className="rounded-xl bg-slate-700 px-4 py-2 text-white"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleResetProject}
                                disabled={
                                    isResetting ||
                                    resetConfirmation !== resetTarget.email
                                }
                                className="rounded-xl bg-amber-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isResetting
                                    ? 'Réinitialisation...'
                                    : 'Réinitialiser définitivement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

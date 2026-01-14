import { useState, useEffect, useCallback } from 'react';
import { Shield, UserPlus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { createUser, listUsers, deleteUser } from '../services/userService';

const ADMIN_STORAGE_KEY = 'spec-refiner-admin-auth';

export default function AdminPage() {
    // Admin auth state
    const [isAdminAuth, setIsAdminAuth] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState(false);

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

    // Check admin auth on mount
    useEffect(() => {
        const storedAuth = sessionStorage.getItem(ADMIN_STORAGE_KEY);
        if (storedAuth === 'true') {
            setIsAdminAuth(true);
        }
    }, []);

    // Load users when admin is authenticated
    useEffect(() => {
        if (isAdminAuth) {
            loadUsers();
        }
    }, [isAdminAuth]);

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

    const handleAdminLogin = (e) => {
        e.preventDefault();
        const correctPassword = (import.meta.env.VITE_APP_PASSWORD || '')
            .replace(/^["']|["']$/g, '')
            .trim();
        if (adminPassword === correctPassword) {
            setIsAdminAuth(true);
            setAdminError(false);
            sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        } else {
            setAdminError(true);
        }
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

    const goToApp = () => {
        window.location.href = '/';
    };

    // Admin login form
    if (!isAdminAuth) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Administration</h1>
                    <p className="text-slate-400 mb-6">Accès restreint</p>

                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="Mot de passe admin"
                                className={`w-full bg-slate-900/50 border ${adminError ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500`}
                            />
                            {adminError && <p className="text-red-400 text-sm mt-2">Mot de passe incorrect</p>}
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                        >
                            Accéder
                        </button>
                    </form>

                    <button
                        onClick={goToApp}
                        className="mt-4 text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour à l&apos;application
                    </button>
                </div>
            </div>
        );
    }

    // Admin dashboard
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
                                    <button
                                        onClick={() => handleDeleteUser(user.id, user.email)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import { Sparkles } from 'lucide-react';

// Build timestamp (evaluated at build time)
const BUILD_TIME = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

export default function LoginForm({
    onSubmit,
    error,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    isLoading
}) {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md text-center">
                <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Vous avez dit spécifications !?<br />En avant !</h1>
                <p className="text-slate-400 mb-6">Accès sécurisé</p>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => onEmailChange(e.target.value)}
                            placeholder="Email"
                            disabled={isLoading}
                            className={`w-full bg-slate-900/50 border ${error ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50`}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="Mot de passe"
                            disabled={isLoading}
                            className={`w-full bg-slate-900/50 border ${error ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50`}
                        />
                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Connexion...' : 'Entrer'}
                    </button>
                </form>
            </div>
            <p className="text-slate-600 text-xs mt-4">Build: {BUILD_TIME}</p>
        </div>
    );
}
